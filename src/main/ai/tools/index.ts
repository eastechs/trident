import { tool, experimental_generateImage as generateImageFn } from 'ai';
import { z } from 'zod';
import { eq, and, ilike } from 'drizzle-orm';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getDb } from '../../database.js';
import { documents, images } from '../../db/schema.js';
import { getApiKey } from '../../settings.js';

// OpenAI image models (gpt-image-1, gpt-image-1.5) accept size in "WxH" format
// and only support specific resolutions. Map common aspect ratios to those.
function sizeFromAspect(aspect: string): `${number}x${number}` {
  switch (aspect) {
    case '1:1': return '1024x1024';
    case '3:2': return '1536x1024';
    case '2:3': return '1024x1536';
    case '16:9': return '1536x1024';
    case '9:16': return '1024x1536';
    default: return '1024x1024';
  }
}

// Reverse lookup for Gemini where we've been given a "WxH" string.
function aspectFromSize(size: string): `${number}:${number}` {
  const [w, h] = size.split('x').map(Number);
  if (!w || !h) return '1:1';
  // Return a simple form; Gemini accepts e.g. "16:9", "3:2", etc.
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const d = gcd(w, h);
  return `${w / d}:${h / d}` as `${number}:${number}`;
}

// ─── Workspace tools ─────────────────────────────────────────
//
// When a project has a local filesystem root, the agent gets ListDirectory /
// ReadFile / SearchFiles for exploring that directory. All paths are treated
// as relative to the workspace root and validated to prevent traversal
// outside it (absolute paths, parent-directory traversal, and symlink
// escapes are rejected via realpath comparison).

const READ_FILE_MAX_BYTES = 100 * 1024;
const SEARCH_FILE_MAX_BYTES = 512 * 1024;
const SEARCH_MAX_RESULTS = 20;
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.cache', '.turbo',
]);

function resolveWithinRoot(root: string, relative: string): string {
  const realRoot = fs.realpathSync(root);
  const resolved = path.resolve(realRoot, relative);
  let realResolved: string;
  try {
    realResolved = fs.realpathSync(resolved);
  } catch {
    // Path may not exist yet (e.g. before a write); fall back to the
    // pre-symlink-resolution path. The startsWith check below still applies.
    realResolved = resolved;
  }
  if (realResolved !== realRoot && !realResolved.startsWith(realRoot + path.sep)) {
    throw new Error(`Path "${relative}" escapes workspace root`);
  }
  return realResolved;
}

function buildWorkspaceTools(filesystemRoot: string) {
  return {
    ListDirectory: tool({
      description: 'List the entries (files and directories) inside a directory in the local workspace. Hidden entries (names starting with ".") are skipped. Path is relative to the workspace root; use "." for the root itself.',
      inputSchema: z.object({
        path: z.string().default('.').describe('Path relative to the workspace root. Use "." for the root.'),
      }),
      execute: async ({ path: relPath }) => {
        try {
          const resolved = resolveWithinRoot(filesystemRoot, relPath);
          const stat = fs.statSync(resolved);
          if (!stat.isDirectory()) {
            return { status: 'error', message: `Path "${relPath}" is not a directory.` };
          }
          const entries = fs.readdirSync(resolved, { withFileTypes: true })
            .filter((e) => !e.name.startsWith('.'))
            .map((e) => ({
              name: e.name,
              type: e.isDirectory() ? 'directory' : (e.isFile() ? 'file' : 'other'),
            }));
          return { status: 'success', path: relPath, entries };
        } catch (err) {
          return { status: 'error', message: (err as Error).message };
        }
      },
    }),

    ReadFile: tool({
      description: 'Read the contents of a text file in the local workspace. Returns up to 100 KB; larger files are truncated. Path is relative to the workspace root.',
      inputSchema: z.object({
        path: z.string().describe('Path relative to the workspace root.'),
      }),
      execute: async ({ path: relPath }) => {
        try {
          const resolved = resolveWithinRoot(filesystemRoot, relPath);
          const stat = fs.statSync(resolved);
          if (!stat.isFile()) {
            return { status: 'error', message: `Path "${relPath}" is not a file.` };
          }
          const buf = fs.readFileSync(resolved);
          const truncated = buf.length > READ_FILE_MAX_BYTES;
          const content = (truncated ? buf.subarray(0, READ_FILE_MAX_BYTES) : buf).toString('utf-8');
          const line_count = content.split('\n').length;
          return {
            status: 'success',
            path: relPath,
            content,
            line_count,
            ...(truncated ? { truncated_bytes: buf.length - READ_FILE_MAX_BYTES } : {}),
          };
        } catch (err) {
          return { status: 'error', message: (err as Error).message };
        }
      },
    }),

    SearchFiles: tool({
      description: 'Search for a literal substring across files in the local workspace. Case-sensitive. Returns up to 20 matches. Skips hidden entries and heavy directories like node_modules / .git / dist / build. Path is relative to the workspace root; defaults to the entire workspace.',
      inputSchema: z.object({
        query: z.string().describe('The literal substring to search for. Case-sensitive.'),
        path: z.string().default('.').describe('Sub-path to limit the search; defaults to "." (entire workspace).'),
      }),
      execute: async ({ query, path: relPath }) => {
        try {
          const startResolved = resolveWithinRoot(filesystemRoot, relPath);
          const matches: Array<{ path: string; line: number; text: string }> = [];

          const walk = (dir: string): void => {
            if (matches.length >= SEARCH_MAX_RESULTS) return;
            let entries: fs.Dirent[];
            try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
            for (const entry of entries) {
              if (matches.length >= SEARCH_MAX_RESULTS) return;
              if (entry.name.startsWith('.')) continue;
              if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
              const full = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                walk(full);
              } else if (entry.isFile()) {
                let stat: fs.Stats;
                try { stat = fs.statSync(full); } catch { continue; }
                if (stat.size > SEARCH_FILE_MAX_BYTES) continue;
                let content: string;
                try { content = fs.readFileSync(full, 'utf-8'); } catch { continue; }
                const lines = content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                  if (lines[i].includes(query)) {
                    matches.push({
                      path: path.relative(filesystemRoot, full),
                      line: i + 1,
                      text: lines[i].trim().slice(0, 200),
                    });
                    if (matches.length >= SEARCH_MAX_RESULTS) return;
                  }
                }
              }
            }
          };

          walk(startResolved);
          return {
            status: 'success',
            query,
            path: relPath,
            results: matches,
            ...(matches.length >= SEARCH_MAX_RESULTS ? { truncated: true } : {}),
          };
        } catch (err) {
          return { status: 'error', message: (err as Error).message };
        }
      },
    }),
  };
}

/**
 * Creates all tools for the DocumentCollaborator agent, scoped to a project.
 *
 * Always-present (8): AskQuestions, ConfigureImageGeneration, SearchDocuments,
 *   ReadDocument, EditDocument, RenameDocument, CreateDocument, GenerateImage
 *
 * Workspace tools (3, only when filesystemRoot is set): ListDirectory,
 *   ReadFile, SearchFiles — scoped to the project's local working directory.
 */
export function createTools(
  projectId: string,
  projectPath: string,
  modelId: string,
  filesystemRoot: string | null,
) {
  const db = getDb();
  // Laravel: `$directory = $this->modelId ?: 'user'`
  const agentDirectory = modelId || 'user';
  const workspaceTools = filesystemRoot ? buildWorkspaceTools(filesystemRoot) : {};

  function buildFrontmatter(docId: string, name: string, createdBy: string, lastEditedBy: string): string {
    const now = new Date().toISOString();
    return `---\nuuid: ${docId}\nname: ${name}\ncreated_by: ${createdBy}\nlast_edited_by: ${lastEditedBy}\nupdated_at: ${now}\n---\n`;
  }

  return {
    AskQuestions: tool({
      description: 'Present clarifying questions to the user before proceeding with work. This tool displays an interactive questionnaire in the chat UI. Each question has multiple-choice options the user can select from, plus a freeform "Something else" option. IMPORTANT: After calling this tool, you MUST stop and wait for the user\'s answers. Do NOT continue with any other actions or tool calls until you receive the user\'s response. The user\'s answers will arrive as their next message.',
      inputSchema: z.object({
        questions: z.array(z.object({
          question: z.string().describe('The question text to display to the user.'),
          options: z.array(z.object({
            label: z.string().describe('Short answer text (1-5 words).'),
            description: z.string().describe('Longer explanation of this option (1-2 sentences).'),
          })).min(2).describe('The available choices for this question.'),
        })).min(1).describe('The list of questions to present to the user.'),
      }),
      execute: async ({ questions }) => ({
        status: 'pending',
        message: 'Questions have been presented to the user. STOP here and wait for their answers before continuing.',
        questions,
      }),
    }),

    ConfigureImageGeneration: tool({
      description: 'Present image generation configuration options to the user before calling GenerateImage. The user will select their preferred model, aspect ratio, and quality. Use this exactly once before any image generation task. After the user responds, call GenerateImage with their selections.',
      inputSchema: z.object({}),
      execute: async () => ({
        status: 'pending',
        type: 'image_config',
        message: 'Image generation options presented to the user. Wait for their selections.',
      }),
    }),

    SearchDocuments: tool({
      description: 'Search for documents in the project by name. Use this when the user references a document by name that is not attached to the conversation. Returns matching document IDs and names.',
      inputSchema: z.object({
        query: z.string().describe('The search term to match against document names.'),
      }),
      execute: async ({ query }) => {
        const results = await db
          .select({ id: documents.id, name: documents.name })
          .from(documents)
          .where(and(
            eq(documents.projectId, projectId),
            eq(documents.directory, agentDirectory),
            ilike(documents.name, `%${query}%`),
          ));

        if (results.length === 0) {
          return { status: 'success', documents: [], message: 'No documents found matching that query.' };
        }

        return {
          status: 'success',
          documents: results.map((d) => ({ document_id: d.id, document_name: d.name })),
        };
      },
    }),

    ReadDocument: tool({
      description: 'Read the full content of a document by its UUID. Use this after searching for documents to retrieve their content.',
      inputSchema: z.object({
        document_id: z.string().describe('The UUID of the document to read.'),
      }),
      execute: async ({ document_id }) => {
        const [doc] = await db
          .select()
          .from(documents)
          .where(and(eq(documents.id, document_id), eq(documents.projectId, projectId)));

        if (!doc) {
          return { status: 'error', message: 'Document not found or does not belong to this project.' };
        }

        return {
          status: 'success',
          document_id: doc.id,
          document_name: doc.name,
          content: doc.content ?? '',
        };
      },
    }),

    EditDocument: tool({
      description: 'Edit the content of an existing document in the project. Use this when the user asks you to make changes to a document that was attached to the conversation. Provide the complete new markdown content for the document.',
      inputSchema: z.object({
        document_id: z.string().describe('The UUID of the document to edit. Must be one of the documents attached to this conversation.'),
        content: z.string().describe('The complete new markdown content for the document.'),
      }),
      execute: async ({ document_id, content }) => {
        const [doc] = await db
          .select()
          .from(documents)
          .where(and(eq(documents.id, document_id), eq(documents.projectId, projectId)));

        if (!doc) {
          return { status: 'error', message: 'Document not found or does not belong to this project.' };
        }

        const editedBy = modelId || 'ai';

        await db
          .update(documents)
          .set({ content, lastEditedBy: editedBy, updatedAt: new Date() })
          .where(eq(documents.id, document_id));

        const createdBy = doc.createdBy ?? 'ai';
        const frontMatter = buildFrontmatter(doc.id, doc.name, createdBy, editedBy);
        fs.writeFileSync(path.join(os.homedir(), doc.path), frontMatter + content);

        return {
          status: 'success',
          document_id: doc.id,
          document_name: doc.name,
          content,
          last_edited_by: editedBy,
        };
      },
    }),

    RenameDocument: tool({
      description: 'Rename an existing document in the project.',
      inputSchema: z.object({
        document_id: z.string().describe('The UUID of the document to rename.'),
        name: z.string().describe('The new name for the document (without file extension). Use a natural, human-readable title with normal spacing and capitalization (e.g. "Chuck Norris Tribute") — not kebab-case, snake_case, camelCase, or PascalCase.'),
      }),
      execute: async ({ document_id, name: newName }) => {
        const [doc] = await db
          .select()
          .from(documents)
          .where(and(eq(documents.id, document_id), eq(documents.projectId, projectId)));

        if (!doc) {
          return { status: 'error', message: 'Document not found or does not belong to this project.' };
        }

        const newDocPath = `${projectPath}/documents/${doc.directory}/${newName}.md`;
        const oldFullPath = path.join(os.homedir(), doc.path);
        const newFullPath = path.join(os.homedir(), newDocPath);

        await db
          .update(documents)
          .set({ name: newName, path: newDocPath, updatedAt: new Date() })
          .where(eq(documents.id, document_id));

        if (fs.existsSync(oldFullPath)) {
          fs.renameSync(oldFullPath, newFullPath);
        }

        // Rewrite frontmatter in new file with updated name
        try {
          let content = fs.readFileSync(newFullPath, 'utf-8');
          const createdBy = doc.createdBy ?? 'user';
          const lastEditedBy = doc.lastEditedBy ?? 'user';
          content = content.replace(
            /^---\s*\n.*?\n---\s*\n/s,
            buildFrontmatter(doc.id, newName, createdBy, lastEditedBy),
          );
          fs.writeFileSync(newFullPath, content);
        } catch { /* file may not exist on disk */ }

        return {
          status: 'success',
          document_id: doc.id,
          document_name: newName,
        };
      },
    }),

    CreateDocument: tool({
      description: 'Create a new document in the project. Use this when the user asks you to create a new document with specific content.',
      inputSchema: z.object({
        name: z.string().describe('The name for the new document (without file extension). Use a natural, human-readable title with normal spacing and capitalization (e.g. "Chuck Norris Tribute", "Solar System Outline") — not kebab-case, snake_case, camelCase, or PascalCase.'),
        content: z.string().describe('The initial markdown content for the new document.'),
      }),
      execute: async ({ name, content }) => {
        const createdBy = modelId || 'ai';
        const directory = modelId || 'user';
        const dirPath = `${projectPath}/documents/${directory}`;
        const docPath = `${dirPath}/${name}.md`;
        const fullDir = path.join(os.homedir(), dirPath);
        const fullPath = path.join(os.homedir(), docPath);

        // Check for duplicate (case-insensitive, like Laravel's LOWER comparison)
        const existing = await db
          .select({ id: documents.id })
          .from(documents)
          .where(and(
            eq(documents.projectId, projectId),
            ilike(documents.path, docPath),
          ));

        if (existing.length > 0) {
          return {
            status: 'error',
            message: `A document named '${name}' already exists. Use EditDocument to update it, or choose a different name.`,
          };
        }

        fs.mkdirSync(fullDir, { recursive: true });

        const [doc] = await db.insert(documents).values({
          projectId,
          name,
          path: docPath,
          content,
          directory,
          createdBy,
          lastEditedBy: createdBy,
        }).returning();

        const frontMatter = buildFrontmatter(doc.id, name, createdBy, createdBy);
        fs.writeFileSync(fullPath, frontMatter + content);

        return {
          status: 'success',
          document_id: doc.id,
          document_name: name,
          content,
          created_by: createdBy,
          last_edited_by: createdBy,
          directory,
        };
      },
    }),

    GenerateImage: tool({
      description: 'Generate an image using an AI image model and save it to the project. Use this after the user has selected their preferred image model and settings via ConfigureImageGeneration.',
      inputSchema: z.object({
        prompt: z.string().describe('The image generation prompt describing what to create.'),
        name: z.string().describe('A descriptive name for the image (without file extension). Use a natural, human-readable title with normal spacing and capitalization (e.g. "Chuck Norris Tribute") — not kebab-case, snake_case, camelCase, or PascalCase.'),
        model: z.string().describe('The image model ID to use (e.g. gpt-image-1.5, gemini-3.1-flash-image-preview).'),
        size: z.string().optional().describe('The aspect ratio for the image (e.g. 1:1, 3:2, 2:3, 16:9).'),
        quality: z.string().optional().describe('The quality or resolution setting (e.g. low, medium, high for OpenAI; 1K, 2K, 4K for Gemini).'),
      }),
      execute: async ({ prompt, name, model, size, quality }) => {
        try {
          const isGemini = model.startsWith('gemini-');
          let imageModel;

          if (isGemini) {
            const key = getApiKey('gemini');
            if (!key) return { status: 'error', message: 'Gemini API key not configured' };
            const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
            const google = createGoogleGenerativeAI({ apiKey: key });
            imageModel = google.image(model);
          } else {
            const key = getApiKey('openai');
            if (!key) return { status: 'error', message: 'OpenAI API key not configured' };
            const { createOpenAI } = await import('@ai-sdk/openai');
            const openai = createOpenAI({ apiKey: key });
            imageModel = openai.image(model);
          }

          const genOptions: Record<string, unknown> = { model: imageModel, prompt };
          if (size) {
            if (isGemini) {
              // Gemini supports aspectRatio directly (e.g. '16:9', '3:2').
              genOptions.aspectRatio = size.includes(':') ? size : aspectFromSize(size);
            } else {
              // OpenAI image models (gpt-image-1/1.5) need size as WxH.
              // Map aspect ratios to the model's supported resolutions.
              genOptions.size = size.includes(':') ? sizeFromAspect(size) : size;
            }
          }
          if (quality) {
            genOptions.providerOptions = isGemini
              ? { google: { quality } }
              : { openai: { quality } };
          }

          const result = await generateImageFn(genOptions as Parameters<typeof generateImageFn>[0]);
          const generatedImage = result.image;
          const mime = generatedImage.mediaType ?? 'image/png';
          const extension = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';

          const dirPath = `${projectPath}/images`;
          const imagePath = `${dirPath}/${name}.${extension}`;
          const fullDir = path.join(os.homedir(), dirPath);
          const fullPath = path.join(os.homedir(), imagePath);

          fs.mkdirSync(fullDir, { recursive: true });
          fs.writeFileSync(fullPath, generatedImage.uint8Array);

          const [image] = await db.insert(images).values({
            projectId,
            name,
            path: imagePath,
            mimeType: mime,
            createdBy: model,
            metadata: { prompt, size, quality, model },
          }).returning();

          return {
            status: 'success',
            image_id: image.id,
            image_name: image.name,
            mime_type: mime,
            prompt,
          };
        } catch (err) {
          return {
            status: 'error',
            message: `Failed to generate image: ${(err as Error).message}`,
          };
        }
      },
    }),
    ...workspaceTools,
  };
}

import { tool, experimental_generateImage as generateImageFn } from 'ai';
import { z } from 'zod';
import { eq, and, ilike } from 'drizzle-orm';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getDb } from '../../database.js';
import { documents, images } from '../../db/schema.js';
import { getApiKey } from '../../settings.js';

/**
 * Creates all tools for the DocumentCollaborator agent,
 * scoped to a specific project.
 *
 * Matches the Laravel DocumentCollaborator's 8-tool set exactly:
 *   AskQuestions, ConfigureImageGeneration, SearchDocuments, ReadDocument,
 *   EditDocument, RenameDocument, CreateDocument, GenerateImage
 */
export function createTools(projectId: string, projectPath: string, modelId: string) {
  const db = getDb();
  // Laravel: `$directory = $this->modelId ?: 'user'`
  const agentDirectory = modelId || 'user';

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
            // OpenAI typically uses "1024x1024"-style size; Gemini uses aspectRatio "16:9"
            if (size.includes(':')) {
              genOptions.aspectRatio = size;
            } else {
              genOptions.size = size;
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
  };
}

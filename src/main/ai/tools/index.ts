import { tool } from 'ai';
import { z } from 'zod';
import { eq, and, ilike } from 'drizzle-orm';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getDb } from '../../database.js';
import { documents, images } from '../../db/schema.js';

/**
 * Creates all tools for the DocumentCollaborator agent,
 * scoped to a specific project.
 */
export function createTools(projectId: string, projectPath: string, modelId: string, filesystemRoot?: string | null) {
  const db = getDb();

  return {
    askQuestions: tool({
      description: 'Present clarifying questions to the user before proceeding with work. This tool displays an interactive questionnaire in the chat UI. Each question has multiple-choice options the user can select from, plus a freeform "Something else" option. IMPORTANT: After calling this tool, you MUST stop and wait for the user\'s answers. Do NOT continue with any other actions or tool calls until you receive the user\'s response.',
      parameters: z.object({
        questions: z.array(z.object({
          question: z.string().describe('The question text to display to the user.'),
          options: z.array(z.object({
            label: z.string().describe('Short answer text (1-5 words).'),
            description: z.string().describe('Longer explanation of this option (1-2 sentences).'),
          })).min(2).describe('The available choices for this question.'),
        })).min(1).describe('The list of questions to present to the user.'),
      }),
      execute: async ({ questions }) => ({
        questions,
        message: 'Questions have been presented to the user. STOP here and wait for their answers before continuing.',
      }),
    }),

    searchDocuments: tool({
      description: 'Search for documents in the project by name.',
      parameters: z.object({
        query: z.string().describe('Search query to match against document names'),
        directory: z.enum(['user', 'ai']).optional().describe('Optional directory to scope the search to'),
      }),
      execute: async ({ query, directory }) => {
        const conditions = [eq(documents.projectId, projectId), ilike(documents.name, `%${query}%`)];
        if (directory) {
          conditions.push(eq(documents.directory, directory));
        }

        const results = await db
          .select({ id: documents.id, name: documents.name, directory: documents.directory })
          .from(documents)
          .where(and(...conditions));

        return { documents: results };
      },
    }),

    readDocument: tool({
      description: 'Read the full content of a document by its UUID.',
      parameters: z.object({
        documentId: z.string().uuid().describe('UUID of the document to read'),
      }),
      execute: async ({ documentId }) => {
        const [doc] = await db
          .select()
          .from(documents)
          .where(and(eq(documents.id, documentId), eq(documents.projectId, projectId)));

        if (!doc) return { error: 'Document not found' };

        return {
          id: doc.id,
          name: doc.name,
          content: doc.content,
          created_by: doc.createdBy,
          last_edited_by: doc.lastEditedBy,
        };
      },
    }),

    editDocument: tool({
      description: 'Replace the content of an existing document. Provide the complete new content.',
      parameters: z.object({
        documentId: z.string().uuid().describe('UUID of the document to edit'),
        content: z.string().describe('The complete new content for the document'),
      }),
      execute: async ({ documentId, content }) => {
        const [doc] = await db
          .select()
          .from(documents)
          .where(and(eq(documents.id, documentId), eq(documents.projectId, projectId)));

        if (!doc) return { error: 'Document not found' };

        await db
          .update(documents)
          .set({ content, lastEditedBy: modelId, updatedAt: new Date() })
          .where(eq(documents.id, documentId));

        // Write to disk with frontmatter
        const now = new Date().toISOString();
        const createdBy = doc.createdBy ?? 'user';
        const frontMatter = `---\nuuid: ${doc.id}\nname: ${doc.name}\ncreated_by: ${createdBy}\nlast_edited_by: ${modelId}\nupdated_at: ${now}\n---\n`;
        fs.writeFileSync(path.join(os.homedir(), doc.path), frontMatter + content);

        return { document_id: doc.id, document_name: doc.name };
      },
    }),

    createDocument: tool({
      description: 'Create a new document in the project. Use this proactively for any long-form output.',
      parameters: z.object({
        name: z.string().describe('Name of the document (without .md extension)'),
        content: z.string().describe('Content of the document'),
        directory: z.enum(['user', 'ai']).default('ai').describe('Directory to create the document in'),
      }),
      execute: async ({ name, content, directory }) => {
        const docDir = `${projectPath}/documents/${directory}`;
        const docPath = `${docDir}/${name}.md`;
        const fullPath = path.join(os.homedir(), docPath);
        const fullDir = path.join(os.homedir(), docDir);

        // Check for duplicate name
        if (fs.existsSync(fullPath)) {
          return { error: `A document named "${name}" already exists in the ${directory} directory.` };
        }

        fs.mkdirSync(fullDir, { recursive: true });

        const [doc] = await db.insert(documents).values({
          projectId,
          name,
          path: docPath,
          content,
          directory,
          createdBy: modelId,
          lastEditedBy: modelId,
        }).returning();

        const now = new Date().toISOString();
        const frontMatter = `---\nuuid: ${doc.id}\nname: ${name}\ncreated_by: ${modelId}\nlast_edited_by: ${modelId}\nupdated_at: ${now}\n---\n`;
        fs.writeFileSync(path.join(os.homedir(), docPath), frontMatter + content);

        return { document_id: doc.id, document_name: name };
      },
    }),

    renameDocument: tool({
      description: 'Rename a document.',
      parameters: z.object({
        documentId: z.string().uuid().describe('UUID of the document to rename'),
        name: z.string().describe('New name for the document (without .md extension)'),
      }),
      execute: async ({ documentId, name: newName }) => {
        const [doc] = await db
          .select()
          .from(documents)
          .where(and(eq(documents.id, documentId), eq(documents.projectId, projectId)));

        if (!doc) return { error: 'Document not found' };

        const newDocPath = `${projectPath}/documents/${doc.directory}/${newName}.md`;
        const oldFullPath = path.join(os.homedir(), doc.path);
        const newFullPath = path.join(os.homedir(), newDocPath);

        if (fs.existsSync(oldFullPath)) {
          fs.renameSync(oldFullPath, newFullPath);
        }

        await db
          .update(documents)
          .set({ name: newName, path: newDocPath, updatedAt: new Date() })
          .where(eq(documents.id, documentId));

        return { document_id: doc.id, old_name: doc.name, new_name: newName };
      },
    }),

    configureImageGeneration: tool({
      description: 'Present image generation configuration options to the user.',
      parameters: z.object({
        suggestedPrompt: z.string().optional().describe('Suggested prompt for image generation'),
      }),
      execute: async ({ suggestedPrompt }) => ({
        suggestedPrompt,
        message: 'Configuration options have been presented to the user. Wait for their selections.',
      }),
    }),

    generateImage: tool({
      description: 'Generate an image using AI.',
      parameters: z.object({
        prompt: z.string().describe('Image generation prompt'),
        model: z.string().optional().describe('Model to use for generation'),
        size: z.string().optional().describe('Image size'),
        quality: z.string().optional().describe('Image quality'),
      }),
      execute: async ({ prompt, model: imgModel, size, quality }) => {
        // TODO: Implement with experimental_generateImage from ai SDK
        // For now, return a placeholder
        return {
          error: 'Image generation not yet implemented in Electron version',
          prompt,
          model: imgModel,
          size,
          quality,
        };
      },
    }),

    updateProgress: tool({
      description: 'Send a progress update to the user.',
      parameters: z.object({
        message: z.string().describe('Progress message'),
        percentage: z.number().optional().describe('Completion percentage (0-100)'),
      }),
      execute: async ({ message, percentage }) => ({
        message,
        percentage,
      }),
    }),

    // ─── Filesystem tools (require filesystemRoot) ──────────

    ...(filesystemRoot ? {
      listDirectory: tool({
        description: 'List files and directories at a given path within the workspace filesystem root. Returns names and types (file or directory).',
        parameters: z.object({
          path: z.string().describe('Relative path within the workspace root to list. Use "." for the root.'),
        }),
        execute: async ({ path: relativePath }) => {
          const root = fs.realpathSync(filesystemRoot);
          const absolutePath = fs.realpathSync(path.join(root, relativePath));

          if (!absolutePath.startsWith(root)) {
            return { error: 'Path is outside the allowed directory.' };
          }

          if (!fs.statSync(absolutePath).isDirectory()) {
            return { error: 'Path is not a directory.' };
          }

          const entries = fs.readdirSync(absolutePath, { withFileTypes: true })
            .filter((e) => !e.name.startsWith('.'))
            .map((e) => ({
              name: e.name,
              type: e.isDirectory() ? 'directory' : 'file',
            }));

          return { path: relativePath, entries };
        },
      }),

      readFile: tool({
        description: 'Read the content of a file within the workspace filesystem root. Returns the file content and line count. Limited to 100KB.',
        parameters: z.object({
          path: z.string().describe('Relative path to the file within the workspace root.'),
        }),
        execute: async ({ path: relativePath }) => {
          const root = fs.realpathSync(filesystemRoot);
          let absolutePath: string;
          try {
            absolutePath = fs.realpathSync(path.join(root, relativePath));
          } catch {
            return { error: 'File not found.' };
          }

          if (!absolutePath.startsWith(root)) {
            return { error: 'Path is outside the allowed directory.' };
          }

          const stat = fs.statSync(absolutePath);
          if (stat.isDirectory()) {
            return { error: 'Path is a directory, not a file.' };
          }
          if (stat.size > 102400) {
            return { error: 'File exceeds 100KB limit. Try reading a specific section or searching instead.' };
          }

          const content = fs.readFileSync(absolutePath, 'utf-8');
          const lineCount = content.split('\n').length;

          return {
            filename: path.basename(absolutePath),
            path: relativePath,
            content,
            line_count: lineCount,
          };
        },
      }),

      searchFiles: tool({
        description: 'Search for text within files in the workspace filesystem root. Returns matching file paths, line numbers, and snippets. Limited to 20 results.',
        parameters: z.object({
          query: z.string().describe('The text to search for in file contents.'),
          path: z.string().optional().describe('Optional subdirectory to scope the search. Defaults to the workspace root.'),
        }),
        execute: async ({ query, path: searchPath }) => {
          const root = fs.realpathSync(filesystemRoot);
          const searchRoot = searchPath
            ? fs.realpathSync(path.join(root, searchPath))
            : root;

          if (!searchRoot.startsWith(root)) {
            return { error: 'Path is outside the allowed directory.' };
          }

          const MAX_RESULTS = 20;
          const matches: Array<{ file: string; line: number; snippet: string }> = [];

          function searchDir(dirPath: string) {
            if (matches.length >= MAX_RESULTS) return;

            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
              if (matches.length >= MAX_RESULTS) return;
              if (entry.name.startsWith('.')) continue;

              const fullEntryPath = path.join(dirPath, entry.name);

              if (entry.isDirectory()) {
                searchDir(fullEntryPath);
              } else if (entry.isFile()) {
                try {
                  const stat = fs.statSync(fullEntryPath);
                  if (stat.size > 512000) continue;

                  const content = fs.readFileSync(fullEntryPath, 'utf-8');
                  const lines = content.split('\n');
                  const queryLower = query.toLowerCase();

                  for (let i = 0; i < lines.length; i++) {
                    if (matches.length >= MAX_RESULTS) return;
                    if (lines[i].toLowerCase().includes(queryLower)) {
                      const relPath = path.relative(root, fullEntryPath);
                      const snippet = lines[i].trim().substring(0, 200);
                      matches.push({ file: relPath, line: i + 1, snippet });
                    }
                  }
                } catch {
                  // Skip unreadable files
                }
              }
            }
          }

          searchDir(searchRoot);

          if (matches.length === 0) {
            return { matches: [], message: 'No matches found.' };
          }

          return { matches, truncated: matches.length >= MAX_RESULTS };
        },
      }),
    } : {}),
  };
}

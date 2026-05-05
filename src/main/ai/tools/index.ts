import { tool } from "ai";
import { z } from "zod";
import { eq, and, ilike, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import readline from "readline";
import ignore, { type Ignore } from "ignore";
import { getDb } from "../../database.js";
import { documents, images, projects } from "../../db/schema.js";
import { safePathInside } from "../../safe-paths.js";
import { getApiKey } from "../../settings.js";
import {
  embedDocument,
  searchProject,
  searchImagesProject,
  NoOpenAIKeyError,
} from "../embeddings.js";

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
// Sensible defaults applied only when the workspace has no .gitignore. Once
// a real .gitignore exists it takes over and these are not used.
const DEFAULT_IGNORES = [
  "node_modules",
  "dist",
  "build",
  ".next",
  "__pycache__",
  ".cache",
  ".turbo",
  ".DS_Store",
];

// gitignore semantics use POSIX-style paths regardless of OS.
function relPosix(root: string, full: string): string {
  return path.relative(root, full).split(path.sep).join("/");
}

// Throw a DOMException-shaped abort error so the AI SDK marks the tool call
// as aborted (matches what fetch/AbortController throws natively).
function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

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
  if (
    realResolved !== realRoot &&
    !realResolved.startsWith(realRoot + path.sep)
  ) {
    throw new Error(`Path "${relative}" escapes workspace root`);
  }
  return realResolved;
}

// Strips path separators, rejects traversal segments, and normalizes
// whitespace. Names come from the model so they have to be treated as
// untrusted input before being composed into a filesystem path.
function sanitizeDocumentName(raw: string): string {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    throw new Error("Document name cannot be empty.");
  }
  if (/[/\\]/.test(trimmed)) {
    throw new Error("Document name cannot contain path separators.");
  }
  if (trimmed === ".." || trimmed === ".") {
    throw new Error(`Document name cannot be "${trimmed}".`);
  }
  return trimmed;
}

// Confirms a composed document path stays under the project's documents
// root, with full symlink resolution. Thin wrapper over the shared helper so
// the tool call sites read naturally.
function safeDocumentFullPath(projectPath: string, relPath: string): string {
  return safePathInside(`${projectPath}/documents`, relPath);
}

// ─── Hierarchical .gitignore handling ────────────────────────
//
// Each .gitignore file applies to its own directory and below, with patterns
// relative to that directory. Honoring nested gitignores means we maintain a
// stack of (base, Ignore) entries while traversing — a path is ignored if any
// stack entry says so.
//
// Memoized by file path + mtime so the per-request, per-directory reads
// don't actually hit disk on each turn for files that haven't changed.

interface IgStackEntry {
  base: string;
  ig: Ignore;
}
type IgStack = ReadonlyArray<IgStackEntry>;

const gitignoreCache = new Map<string, { mtime: number; ig: Ignore }>();

function loadDirGitignore(dir: string): Ignore | null {
  const filePath = path.join(dir, ".gitignore");
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return null;
  }
  const cached = gitignoreCache.get(filePath);
  if (cached && cached.mtime === stat.mtimeMs) return cached.ig;
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
  const ig = ignore().add(content);
  gitignoreCache.set(filePath, { mtime: stat.mtimeMs, ig });
  return ig;
}

// Built-in always-on ignore — `.git` plus the sensible defaults. Constructed
// once per process; the `ignore` instances are immutable after creation.
const DEFAULT_IG: Ignore = ignore().add(".git").add(DEFAULT_IGNORES);

function isIgnoredByStack(
  root: string,
  stack: IgStack,
  fullPath: string,
  isDir: boolean,
): boolean {
  // Built-in defaults check (relative to root).
  const rootRel = relPosix(root, fullPath);
  if (rootRel && DEFAULT_IG.ignores(isDir ? `${rootRel}/` : rootRel))
    return true;
  // Then each .gitignore in the stack — patterns are relative to its own base.
  for (const { base, ig } of stack) {
    const rel = path.relative(base, fullPath);
    if (rel === "" || rel.startsWith("..")) continue;
    const posix = rel.split(path.sep).join("/");
    if (ig.ignores(isDir ? `${posix}/` : posix)) return true;
  }
  return false;
}

// Build the gitignore stack for a starting directory by walking from root
// down, picking up each .gitignore on the way. The starting directory's own
// gitignore is included.
function buildAncestorStack(root: string, dir: string): IgStack {
  const stack: IgStackEntry[] = [];
  const rootGi = loadDirGitignore(root);
  if (rootGi) stack.push({ base: root, ig: rootGi });
  if (dir === root) return stack;
  const rel = path.relative(root, dir);
  const segments = rel.split(path.sep).filter(Boolean);
  let current = root;
  for (const seg of segments) {
    current = path.join(current, seg);
    const gi = loadDirGitignore(current);
    if (gi) stack.push({ base: current, ig: gi });
  }
  return stack;
}

// Stream a file line-by-line looking for literal query matches. Bounded
// memory regardless of file size (the SEARCH_FILE_MAX_BYTES gate is still
// applied by the caller from the dirent stat). Returns true when the global
// SEARCH_MAX_RESULTS cap is hit so the walker can stop.
function scanFileForMatches(
  full: string,
  rel: string,
  query: string,
  matches: Array<{ path: string; line: number; text: string }>,
  signal: AbortSignal | undefined,
): Promise<boolean> {
  return new Promise((resolve) => {
    const stream = fs.createReadStream(full, { encoding: "utf-8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let lineNum = 0;
    let cappedOut = false;
    const onAbort = () => {
      rl.close();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    rl.on("line", (line) => {
      lineNum++;
      if (line.includes(query)) {
        matches.push({
          path: rel,
          line: lineNum,
          text: line.trim().slice(0, 200),
        });
        if (matches.length >= SEARCH_MAX_RESULTS) {
          cappedOut = true;
          rl.close();
        }
      }
    });
    rl.on("close", () => {
      signal?.removeEventListener("abort", onAbort);
      resolve(cappedOut);
    });
    rl.on("error", () => {
      signal?.removeEventListener("abort", onAbort);
      resolve(false);
    });
    stream.on("error", () => {
      rl.close();
    });
  });
}

function buildWorkspaceTools(filesystemRoot: string) {
  return {
    ListDirectory: tool({
      description:
        'List the entries (files and directories) inside a directory in the local workspace. Entries matched by .gitignore (root or any ancestor) are skipped, plus a built-in skip list for common build artifacts. Path is relative to the workspace root; use "." for the root.',
      inputSchema: z.object({
        path: z
          .string()
          .default(".")
          .describe(
            'Path relative to the workspace root. Use "." for the root.',
          ),
      }),
      execute: async ({ path: relPath }, { abortSignal }) => {
        throwIfAborted(abortSignal);
        try {
          const resolved = resolveWithinRoot(filesystemRoot, relPath);
          const stat = fs.statSync(resolved);
          if (!stat.isDirectory()) {
            return {
              status: "error",
              message: `Path "${relPath}" is not a directory.`,
            };
          }
          const stack = buildAncestorStack(filesystemRoot, resolved);
          const entries = fs
            .readdirSync(resolved, { withFileTypes: true })
            .filter(
              (e) =>
                !isIgnoredByStack(
                  filesystemRoot,
                  stack,
                  path.join(resolved, e.name),
                  e.isDirectory(),
                ),
            )
            .map((e) => ({
              name: e.name,
              type: e.isDirectory()
                ? "directory"
                : e.isFile()
                  ? "file"
                  : "other",
            }));
          return { status: "success", path: relPath, entries };
        } catch (err) {
          return { status: "error", message: (err as Error).message };
        }
      },
    }),

    ReadFile: tool({
      description:
        "Read the contents of a text file in the local workspace. Returns up to 100 KB; larger files are truncated. Path is relative to the workspace root.",
      inputSchema: z.object({
        path: z.string().describe("Path relative to the workspace root."),
      }),
      execute: async ({ path: relPath }, { abortSignal }) => {
        throwIfAborted(abortSignal);
        try {
          const resolved = resolveWithinRoot(filesystemRoot, relPath);
          const stat = fs.statSync(resolved);
          if (!stat.isFile()) {
            return {
              status: "error",
              message: `Path "${relPath}" is not a file.`,
            };
          }
          const buf = fs.readFileSync(resolved);
          const truncated = buf.length > READ_FILE_MAX_BYTES;
          const content = (
            truncated ? buf.subarray(0, READ_FILE_MAX_BYTES) : buf
          ).toString("utf-8");
          const line_count = content.split("\n").length;
          return {
            status: "success",
            path: relPath,
            content,
            line_count,
            ...(truncated
              ? { truncated_bytes: buf.length - READ_FILE_MAX_BYTES }
              : {}),
          };
        } catch (err) {
          return { status: "error", message: (err as Error).message };
        }
      },
    }),

    SearchFiles: tool({
      description:
        "Search for a literal substring across files in the local workspace. Case-sensitive. Returns up to 20 matches. Honors .gitignore at every directory level plus a built-in skip list for common build artifacts. Path is relative to the workspace root; defaults to the entire workspace.",
      inputSchema: z.object({
        query: z
          .string()
          .describe("The literal substring to search for. Case-sensitive."),
        path: z
          .string()
          .default(".")
          .describe(
            'Sub-path to limit the search; defaults to "." (entire workspace).',
          ),
      }),
      execute: async ({ query, path: relPath }, { abortSignal }) => {
        throwIfAborted(abortSignal);
        try {
          const startResolved = resolveWithinRoot(filesystemRoot, relPath);
          const matches: Array<{ path: string; line: number; text: string }> =
            [];

          const walk = async (
            dir: string,
            stack: IgStack,
          ): Promise<boolean> => {
            throwIfAborted(abortSignal);
            if (matches.length >= SEARCH_MAX_RESULTS) return true;
            let entries: fs.Dirent[];
            try {
              entries = await fs.promises.readdir(dir, { withFileTypes: true });
            } catch {
              return false;
            }

            // If this directory has its own .gitignore and isn't already
            // represented in the stack (the start dir's gitignore is added
            // by buildAncestorStack), push a new frame for the subtree.
            let currentStack = stack;
            const top = stack[stack.length - 1];
            if (!top || top.base !== dir) {
              const localGi = loadDirGitignore(dir);
              if (localGi)
                currentStack = [...stack, { base: dir, ig: localGi }];
            }

            for (const entry of entries) {
              throwIfAborted(abortSignal);
              if (matches.length >= SEARCH_MAX_RESULTS) return true;
              const full = path.join(dir, entry.name);
              if (
                isIgnoredByStack(
                  filesystemRoot,
                  currentStack,
                  full,
                  entry.isDirectory(),
                )
              )
                continue;
              if (entry.isDirectory()) {
                if (await walk(full, currentStack)) return true;
              } else if (entry.isFile()) {
                const fullStat = await fs.promises.stat(full).catch(() => null);
                if (!fullStat || fullStat.size > SEARCH_FILE_MAX_BYTES)
                  continue;
                if (
                  await scanFileForMatches(
                    full,
                    relPosix(filesystemRoot, full),
                    query,
                    matches,
                    abortSignal,
                  )
                )
                  return true;
              }
            }
            return false;
          };

          await walk(
            startResolved,
            buildAncestorStack(filesystemRoot, startResolved),
          );
          return {
            status: "success",
            query,
            path: relPath,
            results: matches,
            ...(matches.length >= SEARCH_MAX_RESULTS
              ? { truncated: true }
              : {}),
          };
        } catch (err) {
          if ((err as Error).name === "AbortError") throw err;
          return { status: "error", message: (err as Error).message };
        }
      },
    }),
  };
}

/**
 * Creates all tools for the DocumentCollaborator agent, scoped to a project.
 *
 * Always-present (7): AskQuestions, SearchDocuments, ReadDocument,
 *   EditDocument, RenameDocument, CreateDocument, GenerateImage
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
  const workspaceTools = filesystemRoot
    ? buildWorkspaceTools(filesystemRoot)
    : {};

  function buildFrontmatter(
    docId: string,
    name: string,
    createdBy: string,
    lastEditedBy: string,
  ): string {
    const now = new Date().toISOString();
    return `---\nuuid: ${docId}\nname: ${name}\ncreated_by: ${createdBy}\nlast_edited_by: ${lastEditedBy}\nupdated_at: ${now}\n---\n`;
  }

  return {
    AskQuestions: tool({
      description:
        "Present clarifying questions to the user before proceeding with work. This tool displays an interactive questionnaire in the chat UI. Each question has multiple-choice options the user can select from, plus a freeform \"Something else\" option. IMPORTANT: After calling this tool, you MUST stop and wait for the user's answers. Do NOT continue with any other actions or tool calls, and do NOT generate any additional text — the tool handles all display. The user's answers will arrive as their next message.",
      inputSchema: z.object({
        questions: z
          .array(
            z.object({
              question: z
                .string()
                .describe("The question text to display to the user."),
              options: z
                .array(
                  z.object({
                    label: z
                      .string()
                      .describe("Short answer text (1-5 words)."),
                    description: z
                      .string()
                      .describe(
                        "Longer explanation of this option (1-2 sentences).",
                      ),
                  }),
                )
                .min(2)
                .describe("The available choices for this question."),
            }),
          )
          .min(1)
          .describe("The list of questions to present to the user."),
      }),
      execute: async ({ questions }) => ({
        status: "pending",
        message:
          "Questions have been presented to the user. STOP here and wait for their answers before continuing.",
        questions,
      }),
    }),

    SearchDocuments: tool({
      description:
        "Search for documents you previously created in this project. Matches by name and (when an OpenAI key is configured) by content meaning. Returns only documents in your own bucket — to work with a user-authored doc, the user must attach it to the conversation. Use this when the user references one of your prior documents by name or topic that is not attached.",
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            "A name fragment or topic phrase. Both literal name matches and meaning-based matches are searched.",
          ),
      }),
      execute: async ({ query }, { abortSignal }) => {
        throwIfAborted(abortSignal);

        // Both paths are scoped to the agent's own directory bucket so a
        // model never surfaces another model's or the user's documents in
        // search; user docs reach the agent only via explicit attachment.
        // Without a modelId there is no own-bucket to search, so return
        // empty rather than falling back to user docs.
        if (!modelId) {
          return {
            status: "success",
            documents: [],
            message: "No documents found matching that query.",
          };
        }

        // Prefer semantic search when an OpenAI key is configured and the
        // project allows embeddings. Falls through to ILIKE on any failure.
        if (getApiKey("openai")) {
          const [project] = await db
            .select({ embeddingsEnabled: projects.embeddingsEnabled })
            .from(projects)
            .where(eq(projects.id, projectId));
          if (project?.embeddingsEnabled) {
            try {
              const semantic = await searchProject(projectId, query, {
                topK: 10,
                directory: modelId,
              });
              if (semantic.length === 0) {
                return {
                  status: "success",
                  documents: [],
                  message: "No documents found matching that query.",
                };
              }
              return {
                status: "success",
                documents: semantic.map((d) => ({
                  document_id: d.id,
                  document_name: d.name,
                  snippet: d.snippet,
                })),
              };
            } catch (err) {
              if (!(err instanceof NoOpenAIKeyError)) {
                console.error(
                  "[embeddings] Semantic search failed, falling back to name match:",
                  err,
                );
              }
            }
          }
        }

        const results = await db
          .select({ id: documents.id, name: documents.name })
          .from(documents)
          .where(
            and(
              eq(documents.projectId, projectId),
              eq(documents.directory, modelId),
              ilike(documents.name, `%${query}%`),
            ),
          );

        if (results.length === 0) {
          return {
            status: "success",
            documents: [],
            message: "No documents found matching that query.",
          };
        }

        return {
          status: "success",
          documents: results.map((d) => ({
            document_id: d.id,
            document_name: d.name,
          })),
        };
      },
    }),

    SearchImages: tool({
      description:
        "Search for images in this project by name or by the prompt they were generated from. Returns matching images with their generation prompt as a snippet. Unlike SearchDocuments this is project-wide — the user picks the generation model on a per-image card, so images aren't owned by the conversational agent that requested them.",
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            "A name fragment or topic phrase. Both literal name matches and meaning-based matches against the generation prompt are searched.",
          ),
      }),
      execute: async ({ query }, { abortSignal }) => {
        throwIfAborted(abortSignal);

        // Prefer semantic match; fall through to ILIKE on the name when no
        // OpenAI key, embeddings disabled, or the call fails. The two paths
        // return the same shape so callers don't have to branch.
        if (getApiKey("openai")) {
          const [project] = await db
            .select({ embeddingsEnabled: projects.embeddingsEnabled })
            .from(projects)
            .where(eq(projects.id, projectId));
          if (project?.embeddingsEnabled) {
            try {
              const semantic = await searchImagesProject(projectId, query, {
                topK: 10,
              });
              if (semantic.length === 0) {
                return {
                  status: "success",
                  images: [],
                  message: "No images found matching that query.",
                };
              }
              return {
                status: "success",
                images: semantic.map((i) => ({
                  image_id: i.id,
                  image_name: i.name,
                  prompt: i.prompt,
                  snippet: i.snippet,
                })),
              };
            } catch (err) {
              if (!(err instanceof NoOpenAIKeyError)) {
                console.error(
                  "[embeddings] Image semantic search failed, falling back to name match:",
                  err,
                );
              }
            }
          }
        }

        const results = await db
          .select({ id: images.id, name: images.name })
          .from(images)
          .where(
            and(
              eq(images.projectId, projectId),
              ilike(images.name, `%${query}%`),
            ),
          );

        if (results.length === 0) {
          return {
            status: "success",
            images: [],
            message: "No images found matching that query.",
          };
        }

        return {
          status: "success",
          images: results.map((i) => ({ image_id: i.id, image_name: i.name })),
        };
      },
    }),

    ReadDocument: tool({
      description:
        "Read the full content of a document by its UUID. Use this after searching for documents to retrieve their content.",
      inputSchema: z.object({
        document_id: z.string().describe("The UUID of the document to read."),
      }),
      execute: async ({ document_id }, { abortSignal }) => {
        throwIfAborted(abortSignal);
        const [doc] = await db
          .select()
          .from(documents)
          .where(
            and(
              eq(documents.id, document_id),
              eq(documents.projectId, projectId),
            ),
          );

        if (!doc) {
          return {
            status: "error",
            message: "Document not found or does not belong to this project.",
          };
        }

        return {
          status: "success",
          document_id: doc.id,
          document_name: doc.name,
          content: doc.content ?? "",
        };
      },
    }),

    EditDocument: tool({
      description:
        "Edit the content of an existing document in the project. Use this when the user asks you to make changes to a document that was attached to the conversation, regardless of which model originally created it. Provide the complete new markdown content for the document.",
      inputSchema: z.object({
        document_id: z
          .string()
          .describe(
            'The UUID of the document to edit. Take it from the `id` attribute of the matching <attached_document id="..." name="..."> block in the user message.',
          ),
        content: z
          .string()
          .describe("The complete new markdown content for the document."),
      }),
      execute: async ({ document_id, content }, { abortSignal }) => {
        throwIfAborted(abortSignal);
        const [doc] = await db
          .select()
          .from(documents)
          .where(
            and(
              eq(documents.id, document_id),
              eq(documents.projectId, projectId),
            ),
          );

        if (!doc) {
          return {
            status: "error",
            message: "Document not found or does not belong to this project.",
          };
        }

        const editedBy = modelId || "ai";
        const fullPath = safeDocumentFullPath(projectPath, doc.path);

        await db
          .update(documents)
          .set({ content, lastEditedBy: editedBy, updatedAt: new Date() })
          .where(eq(documents.id, document_id));

        const createdBy = doc.createdBy ?? "ai";
        const frontMatter = buildFrontmatter(
          doc.id,
          doc.name,
          createdBy,
          editedBy,
        );
        fs.writeFileSync(fullPath, frontMatter + content);

        void embedDocument(doc.id).catch((err) => {
          console.error(`[embeddings] Failed to embed doc ${doc.id}:`, err);
        });

        return {
          status: "success",
          document_id: doc.id,
          document_name: doc.name,
          content,
          last_edited_by: editedBy,
        };
      },
    }),

    RenameDocument: tool({
      description: "Rename an existing document in the project.",
      inputSchema: z.object({
        document_id: z.string().describe("The UUID of the document to rename."),
        name: z
          .string()
          .describe(
            "The new name for the document (without file extension). Use a natural, descriptive, human-readable title with normal spacing and capitalization — not kebab-case, snake_case, camelCase, or PascalCase.",
          ),
      }),
      execute: async ({ document_id, name: newName }, { abortSignal }) => {
        throwIfAborted(abortSignal);
        const [doc] = await db
          .select()
          .from(documents)
          .where(
            and(
              eq(documents.id, document_id),
              eq(documents.projectId, projectId),
            ),
          );

        if (!doc) {
          return {
            status: "error",
            message: "Document not found or does not belong to this project.",
          };
        }

        const safeName = sanitizeDocumentName(newName);
        const newDocPath = `${projectPath}/documents/${doc.directory}/${safeName}.md`;

        // Reject when another document already occupies the target path.
        // Without this, fs.renameSync would silently overwrite the existing
        // file on POSIX and both DB rows would point to the same path, mixing
        // content between documents on subsequent edits. The check matches
        // CreateDocument's case-insensitive shape.
        const conflict = await db
          .select({ id: documents.id })
          .from(documents)
          .where(
            and(
              eq(documents.projectId, projectId),
              eq(sql`LOWER(${documents.path})`, newDocPath.toLowerCase()),
            ),
          );
        if (conflict.length > 0 && conflict[0].id !== document_id) {
          return {
            status: "error",
            message: `A document named '${safeName}' already exists. Choose a different name.`,
          };
        }

        const oldFullPath = safeDocumentFullPath(projectPath, doc.path);
        const newFullPath = safeDocumentFullPath(projectPath, newDocPath);

        await db
          .update(documents)
          .set({ name: safeName, path: newDocPath, updatedAt: new Date() })
          .where(eq(documents.id, document_id));

        if (fs.existsSync(oldFullPath)) {
          fs.renameSync(oldFullPath, newFullPath);
        }

        // Rewrite frontmatter in new file with updated name
        try {
          let content = fs.readFileSync(newFullPath, "utf-8");
          const createdBy = doc.createdBy ?? "user";
          const lastEditedBy = doc.lastEditedBy ?? "user";
          content = content.replace(
            /^---\s*\n.*?\n---\s*\n/s,
            buildFrontmatter(doc.id, safeName, createdBy, lastEditedBy),
          );
          fs.writeFileSync(newFullPath, content);
        } catch {
          /* file may not exist on disk */
        }

        return {
          status: "success",
          document_id: doc.id,
          document_name: safeName,
        };
      },
    }),

    CreateDocument: tool({
      description:
        "Create a new document in the project. Use this when the user asks you to create a new document with specific content.",
      inputSchema: z.object({
        name: z
          .string()
          .describe(
            "The name for the new document (without file extension). Use a natural, descriptive, human-readable title with normal spacing and capitalization — not kebab-case, snake_case, camelCase, or PascalCase.",
          ),
        content: z
          .string()
          .describe("The initial markdown content for the new document."),
      }),
      execute: async ({ name, content }, { abortSignal }) => {
        throwIfAborted(abortSignal);
        const safeName = sanitizeDocumentName(name);
        const createdBy = modelId || "ai";
        const directory = modelId || "user";
        const dirPath = `${projectPath}/documents/${directory}`;
        const docPath = `${dirPath}/${safeName}.md`;
        const fullDir = safeDocumentFullPath(projectPath, dirPath);
        const fullPath = safeDocumentFullPath(projectPath, docPath);

        // Case-insensitive equality on path; ilike treats _ and % as wildcards,
        // so we lower-case both sides instead.
        const existing = await db
          .select({ id: documents.id })
          .from(documents)
          .where(
            and(
              eq(documents.projectId, projectId),
              eq(sql`LOWER(${documents.path})`, docPath.toLowerCase()),
            ),
          );

        if (existing.length > 0) {
          return {
            status: "error",
            message: `A document named '${safeName}' already exists. Use EditDocument to update it, or choose a different name.`,
          };
        }

        fs.mkdirSync(fullDir, { recursive: true });

        const [doc] = await db
          .insert(documents)
          .values({
            projectId,
            name: safeName,
            path: docPath,
            content,
            directory,
            createdBy,
            lastEditedBy: createdBy,
          })
          .returning();

        const frontMatter = buildFrontmatter(
          doc.id,
          safeName,
          createdBy,
          createdBy,
        );
        fs.writeFileSync(fullPath, frontMatter + content);

        void embedDocument(doc.id).catch((err) => {
          console.error(`[embeddings] Failed to embed doc ${doc.id}:`, err);
        });

        return {
          status: "success",
          document_id: doc.id,
          document_name: safeName,
          content,
          created_by: createdBy,
          last_edited_by: createdBy,
          directory,
        };
      },
    }),

    // Client-side tool. The agent provides the prompt and name; the chat UI
    // renders an image-generation card where the user picks model, aspect
    // ratio, and quality. The card POSTs to /images/generate (which actually
    // runs the provider call) and then fulfills this tool call via
    // addToolOutput, so the agent never has to re-emit the user's choices.
    // No execute => the AI SDK pauses the stream after this call's input is
    // emitted and waits for the client to provide an output.
    GenerateImage: tool({
      description:
        'Generate and save an image. Calling this tool renders an inline image card in the chat where the user picks the model, aspect ratio, and quality and clicks Generate; the tool does not return until that flow finishes. A "success" result means the image has ALREADY been generated and saved with the settings echoed back in the result (model, size, quality) — the card is gone by the time you read this. Briefly confirm completion by name and stop. Do NOT tell the user to choose model/aspect/quality, click Generate, or otherwise interact with the card after a success result; all of that already happened before this output reached you. A "cancelled" result means the user dismissed the card before generating — acknowledge it without retrying unless they ask. Input is just the prompt and a descriptive name.',
      inputSchema: z.object({
        prompt: z
          .string()
          .describe("The image generation prompt describing what to create."),
        name: z
          .string()
          .describe(
            "A name for the image (without file extension). Use a natural, descriptive, human-readable title with normal spacing and capitalization — not kebab-case, snake_case, camelCase, or PascalCase.",
          ),
      }),
      outputSchema: z.union([
        z.object({
          status: z.literal("success"),
          image_id: z.string(),
          image_name: z.string(),
          mime_type: z.string(),
          prompt: z.string(),
          // Settings the user picked on the image card before submitting.
          // Present so the agent has positive evidence that the user has
          // already configured the generation — not a request to choose.
          model: z.string(),
          size: z.string(),
          quality: z.string(),
        }),
        z.object({
          status: z.literal("cancelled"),
          message: z.string().optional(),
        }),
      ]),
    }),
    ...workspaceTools,
  };
}

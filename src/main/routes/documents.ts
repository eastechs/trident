import { Router, type Request } from "express";
import { eq, and, sql } from "drizzle-orm";
import fs from "fs";
import os from "os";
import path from "path";
import { shell } from "electron";
import { getDb } from "../database.js";
import { documents } from "../db/schema.js";
import { safePathInside } from "../safe-paths.js";
import { getSetting } from "../settings.js";
import { embedDocument } from "../ai/embeddings.js";

const router = Router({ mergeParams: true });

type ProjectRequest = Request<{ projectId: string }>;
type DocRequest = Request<{ projectId: string; docId: string }>;

// ─── Store (create new untitled document) ──────────────────

router.post("/", async (req: ProjectRequest, res) => {
  const db = getDb();
  const { projectId } = req.params;

  // Look up the project path
  const { projects } = await import("../db/schema.js");
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const userDir = path.join(os.homedir(), project.path, "documents", "user");
  fs.mkdirSync(userDir, { recursive: true });

  // Find next available "Untitled N" name
  const existing = fs
    .readdirSync(userDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.basename(f, ".md"));

  let number = 1;
  while (existing.includes(`Untitled ${number}`)) number++;
  const filename = `Untitled ${number}`;
  const docPath = `${project.path}/documents/user/${filename}.md`;

  const [document] = await db
    .insert(documents)
    .values({
      projectId,
      name: filename,
      path: docPath,
      directory: "user",
      content: "",
      createdBy: "user",
    })
    .returning();

  const now = new Date().toISOString();
  const frontMatter = `---\nuuid: ${document.id}\nname: ${document.name}\ncreated_by: user\nlast_edited_by: user\nupdated_at: ${now}\n---\n`;
  fs.writeFileSync(path.join(os.homedir(), docPath), frontMatter);

  res.json({ id: document.id, filename });
});

// ─── Show (get document metadata + content) ────────────────

router.get("/:docId", async (req: DocRequest, res) => {
  const db = getDb();
  const [document] = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, req.params.docId),
        eq(documents.projectId, req.params.projectId),
      ),
    );

  if (!document) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({
    id: document.id,
    name: document.name,
    content: document.content,
    created_by: document.createdBy,
    last_edited_by: document.lastEditedBy,
  });
});

// ─── Update (rename) ──────────────────────────────────────

router.patch("/:docId", async (req: DocRequest, res) => {
  const db = getDb();
  const { name } = req.body;
  if (!name) {
    res.status(422).json({ error: "Name is required" });
    return;
  }

  const safeName = path.basename(name).replace(/^\.+/, "").trim();
  if (!safeName) {
    res.status(422).json({ error: "name must be a valid filename" });
    return;
  }

  const [document] = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, req.params.docId),
        eq(documents.projectId, req.params.projectId),
      ),
    );
  if (!document) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const { projects } = await import("../db/schema.js");
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, req.params.projectId));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const newDocPath = `${project.path}/documents/${document.directory}/${safeName}.md`;

  // Reject when another document already occupies the target path. Without
  // this, fs.renameSync silently overwrites the existing file on POSIX and
  // both DB rows end up pointing to the same path, mixing content between
  // documents on subsequent edits.
  const conflict = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.projectId, req.params.projectId),
        eq(sql`LOWER(${documents.path})`, newDocPath.toLowerCase()),
      ),
    );
  if (conflict.length > 0 && conflict[0].id !== document.id) {
    res.status(409).json({
      error: `A document named '${safeName}' already exists.`,
    });
    return;
  }

  const oldFullPath = safePathInside(
    `${project.path}/documents`,
    document.path,
  );
  const newFullPath = safePathInside(`${project.path}/documents`, newDocPath);

  // Rename file on disk
  if (fs.existsSync(oldFullPath)) {
    fs.renameSync(oldFullPath, newFullPath);
  }

  // Update frontmatter in file
  let content = "";
  try {
    content = fs.readFileSync(newFullPath, "utf-8");
  } catch {
    /* empty */
  }
  const now = new Date().toISOString();
  const createdBy = document.createdBy ?? "user";
  const lastEditedBy = document.lastEditedBy ?? "user";
  content = content.replace(
    /^---\s*\n.*?\n---\s*\n/s,
    `---\nuuid: ${document.id}\nname: ${safeName}\ncreated_by: ${createdBy}\nlast_edited_by: ${lastEditedBy}\nupdated_at: ${now}\n---\n`,
  );
  fs.writeFileSync(newFullPath, content);

  // Update database
  await db
    .update(documents)
    .set({ name: safeName, path: newDocPath, updatedAt: new Date() })
    .where(eq(documents.id, document.id));

  res.json({ id: document.id, name: safeName });
});

// ─── Update content ────────────────────────────────────────

router.put("/:docId/content", async (req: DocRequest, res) => {
  const db = getDb();
  const { content } = req.body;
  if (content === undefined) {
    res.status(422).json({ error: "Content is required" });
    return;
  }

  const [document] = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, req.params.docId),
        eq(documents.projectId, req.params.projectId),
      ),
    );
  if (!document) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const { projects } = await import("../db/schema.js");
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, req.params.projectId));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  await db
    .update(documents)
    .set({ content, lastEditedBy: "user", updatedAt: new Date() })
    .where(eq(documents.id, document.id));

  // Write to disk with frontmatter. Boundary at the documents tree so a
  // symlink planted anywhere on the path (bucket dir, leaf file) can't
  // divert the write outside the project.
  const createdBy = document.createdBy ?? "user";
  const now = new Date().toISOString();
  const frontMatter = `---\nuuid: ${document.id}\nname: ${document.name}\ncreated_by: ${createdBy}\nlast_edited_by: user\nupdated_at: ${now}\n---\n`;
  const fullPath = safePathInside(`${project.path}/documents`, document.path);
  fs.writeFileSync(fullPath, frontMatter + content);

  res.json({ success: true });

  // Re-embed in the background. The function is a no-op when embeddings are
  // disabled for the project or no OpenAI key is configured.
  void embedDocument(document.id).catch((err) => {
    console.error(`[embeddings] Failed to embed doc ${document.id}:`, err);
  });
});

// ─── Destroy ───────────────────────────────────────────────

router.delete("/:docId", async (req: DocRequest, res) => {
  const db = getDb();
  const [document] = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, req.params.docId),
        eq(documents.projectId, req.params.projectId),
      ),
    );
  if (!document) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const fullPath = path.join(os.homedir(), document.path);

  if (getSetting("useTrash")) {
    try {
      await shell.trashItem(fullPath);
    } catch {
      /* file might not exist */
    }
  } else {
    try {
      fs.unlinkSync(fullPath);
    } catch {
      /* file might not exist */
    }
  }

  await db.delete(documents).where(eq(documents.id, document.id));

  res.json({ success: true });
});

export default router;

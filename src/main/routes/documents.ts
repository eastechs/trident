import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { shell } from 'electron';
import { getDb } from '../database.js';
import { documents } from '../db/schema.js';
import { getSetting } from '../settings.js';

const router = Router({ mergeParams: true });

// ─── Store (create new untitled document) ──────────────────

router.post('/', async (req, res) => {
  const db = getDb();
  const projectId = req.params.projectId;

  // Look up the project path
  const { projects } = await import('../db/schema.js');
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }

  const userDir = path.join(os.homedir(), project.path, 'documents', 'user');
  fs.mkdirSync(userDir, { recursive: true });

  // Find next available "Untitled N" name
  const existing = fs.readdirSync(userDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.basename(f, '.md'));

  let number = 1;
  while (existing.includes(`Untitled ${number}`)) number++;
  const filename = `Untitled ${number}`;
  const docPath = `${project.path}/documents/user/${filename}.md`;

  const [document] = await db.insert(documents).values({
    projectId,
    name: filename,
    path: docPath,
    directory: 'user',
    content: '',
    createdBy: 'user',
  }).returning();

  const now = new Date().toISOString();
  const frontMatter = `---\nuuid: ${document.id}\nname: ${document.name}\ncreated_by: user\nlast_edited_by: user\nupdated_at: ${now}\n---\n`;
  fs.writeFileSync(path.join(os.homedir(), docPath), frontMatter);

  res.json({ id: document.id, filename });
});

// ─── Show (get document metadata + content) ────────────────

router.get('/:docId', async (req, res) => {
  const db = getDb();
  const [document] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, req.params.docId), eq(documents.projectId, req.params.projectId)));

  if (!document) { res.status(404).json({ error: 'Not found' }); return; }

  res.json({
    id: document.id,
    name: document.name,
    content: document.content,
    created_by: document.createdBy,
    last_edited_by: document.lastEditedBy,
  });
});

// ─── Update (rename) ──────────────────────────────────────

router.patch('/:docId', async (req, res) => {
  const db = getDb();
  const { name } = req.body;
  if (!name) { res.status(422).json({ error: 'Name is required' }); return; }

  const [document] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, req.params.docId), eq(documents.projectId, req.params.projectId)));
  if (!document) { res.status(404).json({ error: 'Not found' }); return; }

  const { projects } = await import('../db/schema.js');
  const [project] = await db.select().from(projects).where(eq(projects.id, req.params.projectId));
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }

  const oldFullPath = path.join(os.homedir(), document.path);
  const newDocPath = `${project.path}/documents/${document.directory}/${name}.md`;
  const newFullPath = path.join(os.homedir(), newDocPath);

  // Rename file on disk
  if (fs.existsSync(oldFullPath)) {
    fs.renameSync(oldFullPath, newFullPath);
  }

  // Update frontmatter in file
  let content = '';
  try { content = fs.readFileSync(newFullPath, 'utf-8'); } catch { /* empty */ }
  const now = new Date().toISOString();
  const createdBy = document.createdBy ?? 'user';
  const lastEditedBy = document.lastEditedBy ?? 'user';
  content = content.replace(
    /^---\s*\n.*?\n---\s*\n/s,
    `---\nuuid: ${document.id}\nname: ${name}\ncreated_by: ${createdBy}\nlast_edited_by: ${lastEditedBy}\nupdated_at: ${now}\n---\n`,
  );
  fs.writeFileSync(newFullPath, content);

  // Update database
  await db
    .update(documents)
    .set({ name, path: newDocPath, updatedAt: new Date() })
    .where(eq(documents.id, document.id));

  res.json({ id: document.id, name });
});

// ─── Update content ────────────────────────────────────────

router.put('/:docId/content', async (req, res) => {
  const db = getDb();
  const { content } = req.body;
  if (content === undefined) { res.status(422).json({ error: 'Content is required' }); return; }

  const [document] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, req.params.docId), eq(documents.projectId, req.params.projectId)));
  if (!document) { res.status(404).json({ error: 'Not found' }); return; }

  await db
    .update(documents)
    .set({ content, lastEditedBy: 'user', updatedAt: new Date() })
    .where(eq(documents.id, document.id));

  // Write to disk with frontmatter
  const createdBy = document.createdBy ?? 'user';
  const now = new Date().toISOString();
  const frontMatter = `---\nuuid: ${document.id}\nname: ${document.name}\ncreated_by: ${createdBy}\nlast_edited_by: user\nupdated_at: ${now}\n---\n`;
  fs.writeFileSync(path.join(os.homedir(), document.path), frontMatter + content);

  res.json({ success: true });
});

// ─── Destroy ───────────────────────────────────────────────

router.delete('/:docId', async (req, res) => {
  const db = getDb();
  const [document] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, req.params.docId), eq(documents.projectId, req.params.projectId)));
  if (!document) { res.status(404).json({ error: 'Not found' }); return; }

  const fullPath = path.join(os.homedir(), document.path);

  if (getSetting('useTrash')) {
    try { await shell.trashItem(fullPath); } catch { /* file might not exist */ }
  } else {
    try { fs.unlinkSync(fullPath); } catch { /* file might not exist */ }
  }

  await db.delete(documents).where(eq(documents.id, document.id));

  res.json({ success: true });
});

export default router;

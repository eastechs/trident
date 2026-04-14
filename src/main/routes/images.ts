import { Router } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { shell } from 'electron';
import { getDb } from '../database.js';
import { images } from '../db/schema.js';
import { getSetting } from '../settings.js';

const router = Router({ mergeParams: true });

// ─── Index ─────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const db = getDb();
  const projectImages = await db
    .select({ id: images.id, name: images.name, createdBy: images.createdBy })
    .from(images)
    .where(eq(images.projectId, req.params.projectId))
    .orderBy(desc(images.createdAt));

  res.json(projectImages.map((i) => ({ id: i.id, name: i.name, created_by: i.createdBy })));
});

// ─── Show (serve image file) ───────────────────────────────

router.get('/:imageId', async (req, res) => {
  const db = getDb();
  const [image] = await db
    .select()
    .from(images)
    .where(and(eq(images.id, req.params.imageId), eq(images.projectId, req.params.projectId)));

  if (!image) { res.status(404).json({ error: 'Not found' }); return; }

  const fullPath = path.join(os.homedir(), image.path);
  if (!fs.existsSync(fullPath)) { res.status(404).json({ error: 'File not found' }); return; }

  res.type(image.mimeType).sendFile(fullPath);
});

// ─── Update (rename) ──────────────────────────────────────

router.patch('/:imageId', async (req, res) => {
  const db = getDb();
  const { name } = req.body;
  if (!name) { res.status(422).json({ error: 'Name is required' }); return; }

  const [image] = await db
    .select()
    .from(images)
    .where(and(eq(images.id, req.params.imageId), eq(images.projectId, req.params.projectId)));
  if (!image) { res.status(404).json({ error: 'Not found' }); return; }

  const ext = path.extname(image.path);
  const dir = path.dirname(image.path);
  const newImagePath = `${dir}/${name}${ext}`;

  const oldFullPath = path.join(os.homedir(), image.path);
  const newFullPath = path.join(os.homedir(), newImagePath);

  if (fs.existsSync(oldFullPath)) {
    fs.renameSync(oldFullPath, newFullPath);
  }

  await db
    .update(images)
    .set({ name, path: newImagePath, updatedAt: new Date() })
    .where(eq(images.id, image.id));

  res.json({ id: image.id, name });
});

// ─── Destroy ───────────────────────────────────────────────

router.delete('/:imageId', async (req, res) => {
  const db = getDb();
  const [image] = await db
    .select()
    .from(images)
    .where(and(eq(images.id, req.params.imageId), eq(images.projectId, req.params.projectId)));
  if (!image) { res.status(404).json({ error: 'Not found' }); return; }

  const fullPath = path.join(os.homedir(), image.path);

  if (getSetting('useTrash')) {
    try { await shell.trashItem(fullPath); } catch { /* file might not exist */ }
  } else {
    try { fs.unlinkSync(fullPath); } catch { /* file might not exist */ }
  }

  await db.delete(images).where(eq(images.id, image.id));

  res.json({ success: true });
});

export default router;

import { Router, type Request } from 'express';
import { experimental_generateImage as generateImageFn } from 'ai';
import { eq, and, desc } from 'drizzle-orm';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { shell } from 'electron';
import { getDb } from '../database.js';
import { images, projects } from '../db/schema.js';
import { getSetting, getApiKey } from '../settings.js';
import { embedImage } from '../ai/embeddings.js';

const router = Router({ mergeParams: true });

type ProjectRequest = Request<{ projectId: string }>;
type ImageRequest = Request<{ projectId: string; imageId: string }>;

// OpenAI image models (gpt-image-1, gpt-image-1.5) accept size in "WxH" and
// only support specific resolutions. Map common aspect ratios to those.
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

// ─── Generate ──────────────────────────────────────────────
//
// Runs an image generation with the exact options the user picked in the
// chat's image-config card. The card POSTs here directly so the parameters
// don't have to round-trip through the LLM as prose. The agent provides
// only the prompt and name; everything else (model, aspect ratio, quality)
// comes from the user's selection on the card.

router.post('/generate', async (req: ProjectRequest, res) => {
  const db = getDb();
  const { prompt, name, model, size, quality } = req.body ?? {};

  if (typeof prompt !== 'string' || !prompt.trim()) {
    res.status(422).json({ error: 'prompt is required' });
    return;
  }
  if (typeof name !== 'string' || !name.trim()) {
    res.status(422).json({ error: 'name is required' });
    return;
  }
  // Strip any path components from the name (defense against the user or
  // agent submitting a value like '../foo' that would write outside the
  // project's images directory). path.basename handles both POSIX and
  // Windows separators.
  const safeName = path.basename(name).replace(/^\.+/, '').trim();
  if (!safeName) {
    res.status(422).json({ error: 'name must be a valid filename' });
    return;
  }
  if (typeof model !== 'string' || !model) {
    res.status(422).json({ error: 'model is required' });
    return;
  }

  const [project] = await db.select().from(projects).where(eq(projects.id, req.params.projectId));
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }

  const abortController = new AbortController();
  req.on('close', () => {
    if (!res.writableEnded) abortController.abort();
  });

  try {
    const isGemini = model.startsWith('gemini-');
    let imageModel;

    if (isGemini) {
      const key = getApiKey('gemini');
      if (!key) { res.status(400).json({ error: 'Gemini API key not configured' }); return; }
      const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
      const google = createGoogleGenerativeAI({ apiKey: key });
      imageModel = google.image(model);
    } else {
      const key = getApiKey('openai');
      if (!key) { res.status(400).json({ error: 'OpenAI API key not configured' }); return; }
      const { createOpenAI } = await import('@ai-sdk/openai');
      const openai = createOpenAI({ apiKey: key });
      imageModel = openai.image(model);
    }

    const genOptions: Record<string, unknown> = {
      model: imageModel,
      prompt,
      abortSignal: abortController.signal,
    };
    if (typeof size === 'string' && size) {
      if (isGemini) {
        // Gemini supports aspectRatio directly (e.g. '16:9', '3:2').
        genOptions.aspectRatio = size;
      } else {
        // OpenAI image models need WxH; map the ratio.
        genOptions.size = sizeFromAspect(size);
      }
    }
    if (typeof quality === 'string' && quality) {
      genOptions.providerOptions = isGemini
        ? { google: { quality } }
        : { openai: { quality } };
    }

    const result = await generateImageFn(genOptions as Parameters<typeof generateImageFn>[0]);
    const generated = result.image;
    const mime = generated.mediaType ?? 'image/png';
    const extension = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';

    const dirPath = `${project.path}/images`;
    const imagePath = `${dirPath}/${safeName}.${extension}`;
    const fullDir = path.join(os.homedir(), dirPath);
    const fullPath = path.join(os.homedir(), imagePath);

    fs.mkdirSync(fullDir, { recursive: true });
    fs.writeFileSync(fullPath, generated.uint8Array);

    const [image] = await db.insert(images).values({
      projectId: req.params.projectId,
      name: safeName,
      path: imagePath,
      mimeType: mime,
      createdBy: model,
      metadata: { prompt, size, quality, model },
    }).returning();

    void embedImage(image.id).catch((err) => {
      console.error(`[embeddings] Failed to embed image ${image.id}:`, err);
    });

    res.json({
      status: 'success',
      image_id: image.id,
      image_name: image.name,
      mime_type: mime,
      prompt,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      // Client closed the request mid-generation; nothing to send back.
      return;
    }
    console.error('Image generation failed:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Index ─────────────────────────────────────────────────

router.get('/', async (req: ProjectRequest, res) => {
  const db = getDb();
  const projectImages = await db
    .select({
      id: images.id,
      name: images.name,
      mimeType: images.mimeType,
      createdBy: images.createdBy,
      metadata: images.metadata,
      createdAt: images.createdAt,
    })
    .from(images)
    .where(eq(images.projectId, req.params.projectId))
    .orderBy(desc(images.createdAt));

  res.json(projectImages.map((i) => ({
    id: i.id,
    name: i.name,
    mime_type: i.mimeType,
    created_by: i.createdBy,
    metadata: i.metadata,
    created_at: i.createdAt,
  })));
});

// ─── Show (serve image file) ───────────────────────────────

router.get('/:imageId', async (req: ImageRequest, res) => {
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

router.patch('/:imageId', async (req: ImageRequest, res) => {
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

  void embedImage(image.id).catch((err) => {
    console.error(`[embeddings] Failed to embed image ${image.id}:`, err);
  });

  res.json({ id: image.id, name });
});

// ─── Destroy ───────────────────────────────────────────────

router.delete('/:imageId', async (req: ImageRequest, res) => {
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

import express from 'express';
import path from 'path';
import { app as electronApp } from 'electron';
import projectRoutes from './routes/projects.js';
import documentRoutes from './routes/documents.js';
import imageRoutes from './routes/images.js';
import conversationRoutes from './routes/conversations.js';
import settingsRoutes from './routes/settings.js';
import chatRoutes from './routes/chat.js';

export async function createServer(port: number): Promise<void> {
  const isDev = !electronApp.isPackaged;
  const app = express();

  // Default body-parser limit is 100 KB; chat requests carry the full
  // UIMessage history including any embedded document attachments, which
  // blows past that quickly in a multi-turn conversation. 50 MB is safely
  // above any realistic chat payload for this local-only server.
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // ─── JSON API routes ────────────────────────────────────
  app.use('/api/projects', projectRoutes);
  app.use('/api/projects/:projectId/documents', documentRoutes);
  app.use('/api/projects/:projectId/images', imageRoutes);
  app.use('/api/projects/:projectId/conversations', conversationRoutes);
  app.use('/api/projects/:projectId/chat', chatRoutes);
  app.use('/api/settings', settingsRoutes);

  app.post('/api/select-directory', async (_req, res) => {
    const { selectDirectory } = await import('./native/dialogs.js');
    const dirPath = await selectDirectory();
    res.json({ path: dirPath });
  });

  // ─── SPA serving (production only) ──────────────────────
  // In dev, Vite serves the SPA and proxies /api/* to this server.
  if (!isDev) {
    const rendererDir = path.join(__dirname, '../renderer');
    app.use(express.static(rendererDir));

    // SPA catch-all — serve index.html for all non-API routes
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(rendererDir, 'index.html'));
    });
  }

  // ─── Start listening ────────────────────────────────────
  return new Promise((resolve) => {
    app.listen(port, () => {
      console.log(`Express server running on http://localhost:${port}`);
      resolve();
    });
  });
}

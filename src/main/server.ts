import express from 'express';
import path from 'path';
import fs from 'fs';
import { app as electronApp } from 'electron';
import projectRoutes from './routes/projects.js';
import documentRoutes from './routes/documents.js';
import imageRoutes from './routes/images.js';
import conversationRoutes from './routes/conversations.js';
import settingsRoutes from './routes/settings.js';
import chatRoutes from './routes/chat.js';

const isDev = !electronApp.isPackaged;

export async function createServer(port: number): Promise<void> {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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

  // ─── SPA serving ────────────────────────────────────────
  if (isDev) {
    // In dev mode, proxy non-API requests to Vite dev server
    const { createProxyMiddleware } = await import('http-proxy-middleware');
    app.use(
      '/',
      createProxyMiddleware({
        target: 'http://localhost:5173',
        changeOrigin: true,
        ws: true,
      }),
    );
  } else {
    // In production, serve built renderer files
    const rendererDir = path.join(__dirname, '../renderer');
    app.use(express.static(rendererDir));

    // SPA catch-all — serve index.html for all non-API routes
    app.get('*', (_req, res) => {
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

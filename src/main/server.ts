import express from "express";
import path from "path";
import { app as electronApp } from "electron";
import projectRoutes from "./routes/projects.js";
import documentRoutes from "./routes/documents.js";
import imageRoutes from "./routes/images.js";
import conversationRoutes from "./routes/conversations.js";
import settingsRoutes from "./routes/settings.js";
import chatRoutes from "./routes/chat.js";
import searchRoutes from "./routes/search.js";
import { initPricing } from "./ai/pricing.js";
import { requireServerAuth } from "./auth.js";

export async function createServer(port: number): Promise<void> {
  // Load any cached pricing snapshot and kick off a background refresh from
  // LiteLLM. Non-blocking — pricing always falls back to the bundled file.
  initPricing();

  const isDev = !electronApp.isPackaged;
  const app = express();

  // Default body-parser limit is 100 KB; chat requests carry the full
  // UIMessage history including any embedded document attachments, which
  // blows past that quickly in a multi-turn conversation. 50 MB is safely
  // above any realistic chat payload for this local-only server.
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Per-launch shared-secret auth on every /api/* request. The renderer
  // attaches X-Trident-Auth via lib/api.ts; static SPA assets are served
  // unauthenticated below since the bundle is useless without the secret.
  app.use("/api", requireServerAuth);

  // ─── JSON API routes ────────────────────────────────────
  app.use("/api/projects", projectRoutes);
  app.use("/api/projects/:projectId/documents", documentRoutes);
  app.use("/api/projects/:projectId/images", imageRoutes);
  app.use("/api/projects/:projectId/conversations", conversationRoutes);
  app.use("/api/projects/:projectId/chat", chatRoutes);
  app.use("/api/projects/:projectId/search", searchRoutes);
  app.use("/api/settings", settingsRoutes);

  app.post("/api/select-directory", async (_req, res) => {
    const { selectDirectory } = await import("./native/dialogs.js");
    const dirPath = await selectDirectory();
    res.json({ path: dirPath });
  });

  // ─── SPA serving (production only) ──────────────────────
  // In dev, Vite serves the SPA and proxies /api/* to this server.
  if (!isDev) {
    const rendererDir = path.join(__dirname, "../renderer");
    app.use(express.static(rendererDir));

    // SPA catch-all — serve index.html for all non-API routes
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(rendererDir, "index.html"));
    });
  }

  // ─── Start listening ────────────────────────────────────
  // Bind explicitly to loopback so the API isn't reachable from other devices
  // on the LAN. Combined with the per-launch X-Trident-Auth secret above,
  // this restricts the API to processes running as the same user on this
  // machine that can read the live BrowserWindow's preload context.
  return new Promise((resolve) => {
    app.listen(port, "127.0.0.1", () => {
      console.log(`Express server running on http://127.0.0.1:${port}`);
      resolve();
    });
  });
}

import { app, BrowserWindow, ipcMain, Menu, nativeImage } from "electron";
import contextMenu from "electron-context-menu";
import fs from "fs";
import os from "os";
import path from "path";
import { createServer } from "./server.js";
import { buildMenu, setEnabledMenuActions } from "./native/menus.js";
import { initDatabase } from "./database.js";
import { initSettings, getSetting } from "./settings.js";
import { selectDirectory } from "./native/dialogs.js";
import {
  attachExternalLinkHandlers,
  openDocumentationWindow,
  setMainWindow,
} from "./native/windows.js";
import { appIconPath } from "./native/app-icon.js";
import { initAutoUpdater, registerUpdaterIpc } from "./native/updater.js";
import { getServerAuth } from "./auth.js";

app.setName("Trident");
app.setAppUserModelId("com.eastechs.trident");
app.setAboutPanelOptions({
  applicationName: "Trident",
  applicationVersion: app.getVersion(),
  copyright: `Copyright © ${new Date().getFullYear()} Eastechs`,
  iconPath: appIconPath(),
});

const isDev = !app.isPackaged;
const SERVER_PORT = 19274;

// Enable native OS right-click menu (Select All, Copy, Paste, Cut, spellcheck
// suggestions, etc.) on every BrowserWindow.
contextMenu({
  showSelectAll: true,
  showCopyImage: true,
  showSaveImageAs: true,
  showInspectElement: isDev,
});

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    // The project view holds two chat panels either side of the editor. Below
    // this the panels' percentage cap binds before their 280px floor and the
    // composer starts losing controls.
    minWidth: 960,
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 12, y: 8 },
    icon: appIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  attachExternalLinkHandlers(mainWindow);
  setMainWindow(mainWindow);
  Menu.setApplicationMenu(buildMenu(mainWindow));

  // Production loads the SPA from the same Express server. Use 127.0.0.1
  // explicitly to match the loopback bind in server.ts and avoid any IPv4 vs
  // ::1 ambiguity from `localhost` resolution.
  const baseUrl = isDev
    ? "http://localhost:5173"
    : `http://127.0.0.1:${SERVER_PORT}`;
  const initialRoute = getSetting("onboardingCompleted") ? "/" : "/onboarding";
  mainWindow.loadURL(baseUrl + initialRoute);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.on("closed", () => {
    setMainWindow(null);
    mainWindow = null;
  });
}

// IPC handlers
ipcMain.handle("get-server-auth", () => getServerAuth());
ipcMain.handle("select-directory", () => selectDirectory());
ipcMain.handle("open-documentation", () => openDocumentationWindow());
ipcMain.on("menu-set-enabled", (_event, actions: string[]) => {
  if (Array.isArray(actions)) setEnabledMenuActions(actions);
});

function writeTridentMetadata(): void {
  try {
    const projectsDir = path.join(os.homedir(), "Trident", "Projects");
    fs.mkdirSync(projectsDir, { recursive: true });

    const metadataPath = path.join(os.homedir(), "Trident", ".trident");
    fs.writeFileSync(
      metadataPath,
      JSON.stringify({
        app_version: app.getVersion(),
        release_version: process.env.TRIDENT_RELEASE_VERSION ?? null,
        migration_version: process.env.TRIDENT_MIGRATION_VERSION ?? null,
      }),
    );
  } catch (err) {
    console.error("Failed to write Trident metadata:", err);
  }
}

app.whenReady().then(async () => {
  if (isDev && process.platform === "darwin") {
    app.dock?.setIcon(nativeImage.createFromPath(appIconPath()));
  }

  // Write ~/Trident/.trident metadata and ensure ~/Trident/Projects exists
  writeTridentMetadata();

  // Initialize settings (electron-store is ESM-only, requires dynamic import)
  await initSettings();

  // Initialize PGLite database
  await initDatabase();

  // Start the Express server
  await createServer(SERVER_PORT);

  // Register the updater IPC before any window loads, so the sidebar's first
  // query resolves rather than rejecting.
  registerUpdaterIpc();

  // Create the main window
  await createWindow();

  // Start background update checks (no-op unless packaged)
  initAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

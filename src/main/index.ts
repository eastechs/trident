import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createServer } from './server.js';
import { buildMenu } from './native/menus.js';
import { initDatabase } from './database.js';
import { initSettings } from './settings.js';
import { selectDirectory } from './native/dialogs.js';
import { openDocumentationWindow } from './native/windows.js';

const isDev = !app.isPackaged;
const SERVER_PORT = 19274;

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  Menu.setApplicationMenu(buildMenu(mainWindow));

  const url = isDev ? 'http://localhost:5173' : `http://localhost:${SERVER_PORT}`;
  mainWindow.loadURL(url);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handlers
ipcMain.handle('select-directory', () => selectDirectory());
ipcMain.handle('open-documentation', () => openDocumentationWindow());

function writeTridentMetadata(): void {
  try {
    const projectsDir = path.join(os.homedir(), 'Trident', 'Projects');
    fs.mkdirSync(projectsDir, { recursive: true });

    const metadataPath = path.join(os.homedir(), 'Trident', '.trident');
    fs.writeFileSync(metadataPath, JSON.stringify({
      app_version: app.getVersion(),
      release_version: process.env.TRIDENT_RELEASE_VERSION ?? null,
      migration_version: process.env.TRIDENT_MIGRATION_VERSION ?? null,
    }));
  } catch (err) {
    console.error('Failed to write Trident metadata:', err);
  }
}

app.whenReady().then(async () => {
  // Write ~/Trident/.trident metadata and ensure ~/Trident/Projects exists
  writeTridentMetadata();

  // Initialize settings (electron-store is ESM-only, requires dynamic import)
  await initSettings();

  // Initialize PGLite database
  await initDatabase();

  // Start the Express server
  await createServer(SERVER_PORT);

  // Create the main window
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

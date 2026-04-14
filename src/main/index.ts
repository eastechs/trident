import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import path from 'path';
import { createServer } from './server.js';
import { buildMenu } from './native/menus.js';
import { initDatabase } from './database.js';
import { selectDirectory } from './native/dialogs.js';

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

  // Always load from Express (which serves the Inertia HTML shell with data-page props).
  // In dev mode, the Inertia HTML template points script/CSS tags at Vite's dev server.
  mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handlers
ipcMain.handle('select-directory', () => selectDirectory());

app.whenReady().then(async () => {
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

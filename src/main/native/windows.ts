import { BrowserWindow, app } from 'electron';
import path from 'path';

const isDev = !app.isPackaged;
const SERVER_PORT = 19274;

const secondaryWindows = new Map<string, BrowserWindow>();

// Single-instance pointer to the primary window so anything in the main
// process (notifications, deep-link handlers, etc.) can focus or dispatch
// to it without re-importing the index module.
let mainWindow: BrowserWindow | null = null;

export function setMainWindow(win: BrowserWindow | null): void {
  mainWindow = win;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function baseUrl(): string {
  return isDev ? 'http://localhost:5173' : `http://localhost:${SERVER_PORT}`;
}

export function openSecondaryWindow(
  key: string,
  route: string,
  options: { title: string; width: number; height: number },
): void {
  const existing = secondaryWindows.get(key);
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return;
  }

  const win = new BrowserWindow({
    width: options.width,
    height: options.height,
    title: options.title,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 12 },
    center: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL(`${baseUrl()}${route}`);
  secondaryWindows.set(key, win);
  win.on('closed', () => secondaryWindows.delete(key));
}

export function openDocumentationWindow(): void {
  openSecondaryWindow('documentation', '/documentation', {
    title: 'Trident Documentation',
    width: 1000,
    height: 700,
  });
}

export function openAboutWindow(): void {
  const key = 'about';
  const existing = secondaryWindows.get(key);
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return;
  }

  const win = new BrowserWindow({
    width: 380,
    height: 420,
    title: 'About Trident',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 12 },
    center: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setMenu(null);
  win.loadURL(`${baseUrl()}/about?version=${encodeURIComponent(app.getVersion())}`);
  secondaryWindows.set(key, win);
  win.on('closed', () => secondaryWindows.delete(key));
}

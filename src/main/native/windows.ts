import { BrowserWindow, app } from 'electron';
import path from 'path';

const isDev = !app.isPackaged;
const SERVER_PORT = 19274;

const secondaryWindows = new Map<string, BrowserWindow>();

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
    height: 520,
    title: 'About Trident',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 12 },
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

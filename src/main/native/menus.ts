import { Menu, BrowserWindow, app } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import { openAboutWindow, openDocumentationWindow } from './windows.js';

export function buildMenu(mainWindow: BrowserWindow): Menu {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { label: `About ${app.name}`, click: () => openAboutWindow() },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Document',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('menu-action', 'new-document'),
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu-action', 'save'),
        },
        {
          label: 'Save as',
          click: () => mainWindow.webContents.send('menu-action', 'save-as'),
        },
        { type: 'separator' },
        {
          label: 'Export',
          click: () => mainWindow.webContents.send('menu-action', 'export'),
        },
        {
          label: 'Print',
          accelerator: 'CmdOrCtrl+P',
          click: () => mainWindow.webContents.send('menu-action', 'print'),
        },
        { type: 'separator' },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          click: () => mainWindow.webContents.send('menu-action', 'close'),
        },
        {
          label: 'Delete',
          click: () => mainWindow.webContents.send('menu-action', 'delete'),
        },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => openDocumentationWindow(),
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

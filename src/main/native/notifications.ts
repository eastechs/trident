import { Notification } from 'electron';
import { getSetting } from '../settings.js';
import { appIconPath } from './app-icon.js';
import { getMainWindow } from './windows.js';

export interface NotificationTarget {
  projectId: string;
  conversationId: string;
}

export function showNotification(
  title: string,
  body: string,
  target?: NotificationTarget,
): void {
  if (!getSetting('notifications')) return;

  const notification = new Notification({ title, body, icon: appIconPath() });

  if (target) {
    notification.on('click', () => {
      const win = getMainWindow();
      if (!win || win.isDestroyed()) return;
      if (win.isMinimized()) win.restore();
      if (!win.isVisible()) win.show();
      win.focus();
      win.webContents.send('notification-navigate', target);
    });
  }

  notification.show();
}

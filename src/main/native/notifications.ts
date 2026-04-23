import { Notification } from 'electron';
import { getSetting } from '../settings.js';
import { appIconPath } from './app-icon.js';

export function showNotification(title: string, body: string): void {
  if (!getSetting('notifications')) return;

  new Notification({ title, body, icon: appIconPath() }).show();
}

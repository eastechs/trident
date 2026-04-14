import { Notification } from 'electron';
import { getSetting } from '../settings.js';

export function showNotification(title: string, body: string): void {
  if (!getSetting('notifications')) return;

  new Notification({ title, body }).show();
}

import { app } from 'electron';
import path from 'path';

export function appIconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'images/app-icon.png')
    : path.join(__dirname, '../../resources/images/app-icon.png');
}

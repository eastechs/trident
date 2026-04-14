import { dialog, BrowserWindow } from 'electron';

export async function selectDirectory(parentWindow?: BrowserWindow): Promise<string | null> {
  const result = await dialog.showOpenDialog(parentWindow ?? BrowserWindow.getFocusedWindow()!, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Project Directory',
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
}

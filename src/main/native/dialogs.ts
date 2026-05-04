import { dialog, BrowserWindow } from "electron";
import type { OpenDialogOptions } from "electron";

export async function selectDirectory(
  parentWindow?: BrowserWindow,
): Promise<string | null> {
  const owner = parentWindow ?? BrowserWindow.getFocusedWindow();
  const options: OpenDialogOptions = {
    properties: ["openDirectory", "createDirectory"],
    title: "Select Project Directory",
  };
  const result = owner
    ? await dialog.showOpenDialog(owner, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
}

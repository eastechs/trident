import { app, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";
import { getMainWindow } from "./windows.js";

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

// Wire up background auto-update against the GitHub Releases feed configured in
// electron-builder.yml (provider: github, eastechs/trident-releases). Updates
// download silently; when one is ready we notify the renderer so the sidebar
// can surface an "Install available" control.
export function initAutoUpdater(): void {
  // electron-updater throws when run from an unpacked dev tree — it needs the
  // bundled app-update.yml that only exists in a packaged build. No-op under
  // `npm run dev`.
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-downloaded", () => {
    getMainWindow()?.webContents.send("update-ready");
  });

  autoUpdater.on("error", (err) => {
    console.error("[updater] error:", err);
  });

  // Triggered from the renderer when the user clicks the sidebar indicator.
  ipcMain.handle("install-update", () => {
    autoUpdater.quitAndInstall();
  });

  void autoUpdater.checkForUpdates();
  setInterval(() => {
    void autoUpdater.checkForUpdates();
  }, CHECK_INTERVAL_MS);
}

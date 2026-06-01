import { app, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";
import { getMainWindow } from "./windows.js";

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

// Whether an update has finished downloading and is staged for install. Kept in
// the main process so a window opened after the download (e.g. on macOS the app
// stays alive with no windows) can still learn the update is ready.
let updateReady = false;

function runCheck(): void {
  // checkForUpdates() both emits an "error" event (logged below) and rejects
  // its returned promise. Catch the rejection so a transient/offline failure or
  // a misconfigured feed doesn't surface as an unhandled rejection at startup.
  autoUpdater.checkForUpdates().catch(() => {});
}

// Wire up background auto-update against the GitHub Releases feed configured in
// electron-builder.yml (provider: github, eastechs/trident-releases). Updates
// download silently; when one is ready we notify the renderer so the sidebar
// can surface an "Install available" control.
export function initAutoUpdater(): void {
  // electron-updater throws when run from an unpacked dev tree — it needs the
  // bundled app-update.yml that only exists in a packaged build. No-op under
  // `npm run dev`.
  if (!app.isPackaged) return;

  // Only macOS arm64 builds have published update metadata/assets. Other
  // packaged targets (win/linux in electron-builder.yml, built by `build:all`)
  // would poll for feeds that are never uploaded, so leave them a no-op.
  if (process.platform !== "darwin" || process.arch !== "arm64") return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-downloaded", () => {
    updateReady = true;
    getMainWindow()?.webContents.send("update-ready");
  });

  autoUpdater.on("error", (err) => {
    console.error("[updater] error:", err);
  });

  // Lets a freshly opened window query whether an update is already staged,
  // since the "update-ready" push is a one-shot event it may have missed.
  ipcMain.handle("get-update-ready", () => updateReady);

  // Triggered from the renderer when the user clicks the sidebar indicator.
  ipcMain.handle("install-update", () => {
    autoUpdater.quitAndInstall();
  });

  runCheck();
  setInterval(runCheck, CHECK_INTERVAL_MS);
}

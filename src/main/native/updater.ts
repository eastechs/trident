import { app, dialog, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";
import { getMainWindow } from "./windows.js";

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

// Whether an update has finished downloading and is staged for install. Kept in
// the main process so a window opened after the download (e.g. on macOS the app
// stays alive with no windows) can still learn the update is ready.
let updateReady = false;
let updateCheckInProgress = false;
let updateDownloadInProgress = false;
let notifyOnDownloadFailure = false;

function isAutoUpdaterSupported(): boolean {
  return (
    app.isPackaged && process.platform === "darwin" && process.arch === "arm64"
  );
}

function showUpdateDialog(options: Electron.MessageBoxOptions): void {
  const owner = getMainWindow();
  const dialogOptions: Electron.MessageBoxOptions = {
    ...options,
    buttons: options.buttons ?? ["OK"],
  };

  if (owner) {
    void dialog.showMessageBox(owner, dialogOptions);
  } else {
    void dialog.showMessageBox(dialogOptions);
  }
}

function showUpdateDownloadFailedDialog(err: unknown): void {
  const detail = err instanceof Error ? err.message : String(err);
  showUpdateDialog({
    type: "error",
    title: "Update Download Failed",
    message: "Trident found an update but could not download it.",
    detail,
  });
}

async function startUpdateCheck(options?: {
  notifyOnDownloadFailure?: boolean;
}) {
  if (updateCheckInProgress || updateDownloadInProgress || updateReady) {
    return null;
  }

  updateCheckInProgress = true;
  try {
    const result = await autoUpdater.checkForUpdates();

    if (result?.downloadPromise) {
      updateDownloadInProgress = true;
      notifyOnDownloadFailure ||= options?.notifyOnDownloadFailure ?? false;

      void result.downloadPromise
        .catch((err: unknown) => {
          console.error("[updater] download error:", err);
          if (notifyOnDownloadFailure) {
            showUpdateDownloadFailedDialog(err);
          }
        })
        .finally(() => {
          updateDownloadInProgress = false;
          notifyOnDownloadFailure = false;
        });
    }

    return result;
  } finally {
    updateCheckInProgress = false;
  }
}

function runCheck(): void {
  // checkForUpdates() both emits an "error" event (logged below) and rejects
  // its returned promise. Catch the rejection so a transient/offline failure or
  // a misconfigured feed doesn't surface as an unhandled rejection at startup.
  startUpdateCheck().catch(() => {});
}

export async function checkForUpdatesFromMenu(): Promise<void> {
  if (!isAutoUpdaterSupported()) {
    showUpdateDialog({
      type: "info",
      title: "Check for Updates",
      message: "Updates are not available in this build of Trident.",
      detail:
        "Automatic updates are available for packaged Apple silicon macOS builds.",
    });
    return;
  }

  if (updateReady) {
    showUpdateDialog({
      type: "info",
      title: "Update Ready",
      message: "An update is ready to install.",
      detail:
        "Use the update button in the sidebar to install the downloaded update and restart Trident.",
    });
    return;
  }

  if (updateCheckInProgress) {
    showUpdateDialog({
      type: "info",
      title: "Checking for Updates",
      message: "Trident is already checking for updates.",
    });
    return;
  }

  if (updateDownloadInProgress) {
    notifyOnDownloadFailure = true;
    showUpdateDialog({
      type: "info",
      title: "Update Downloading",
      message: "Trident is already downloading an update.",
      detail:
        "Trident will show an install button in the sidebar when the update is ready.",
    });
    return;
  }

  try {
    const result = await startUpdateCheck({ notifyOnDownloadFailure: true });

    if (result?.isUpdateAvailable) {
      showUpdateDialog({
        type: "info",
        title: "Update Found",
        message: `Trident ${result.updateInfo.version} is available.`,
        detail:
          "The update is downloading in the background. Trident will show an install button in the sidebar when it is ready.",
      });
      return;
    }

    showUpdateDialog({
      type: "info",
      title: "No Updates Available",
      message: "Trident is up to date.",
      detail: `Version ${app.getVersion()} is the latest available version.`,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    showUpdateDialog({
      type: "error",
      title: "Update Check Failed",
      message: "Trident could not check for updates.",
      detail,
    });
  }
}

// Wire up background auto-update against the GitHub Releases feed configured in
// electron-builder.yml (provider: github, eastechs/trident-releases). Updates
// download silently; when one is ready we notify the renderer so the sidebar
// can surface an "Install available" control.
export function initAutoUpdater(): void {
  // electron-updater throws when run from an unpacked dev tree — it needs the
  // bundled app-update.yml that only exists in a packaged build. No-op under
  // `npm run dev`.
  if (!isAutoUpdaterSupported()) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-downloaded", () => {
    updateReady = true;
    updateDownloadInProgress = false;
    notifyOnDownloadFailure = false;
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

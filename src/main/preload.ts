import { contextBridge, ipcRenderer } from "electron";

// Both subscription helpers return an unsubscribe function so callers can
// detach on component unmount. Without this, useEffect-based subscribers
// accumulate listeners across remounts/route changes — every menu click
// then fires every stale handler in turn (e.g. multiple `New Document`
// callbacks → multiple docs created from one menu invocation).
contextBridge.exposeInMainWorld("electronAPI", {
  onMenuAction: (callback: (action: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: string) =>
      callback(action);
    ipcRenderer.on("menu-action", handler);
    return () => ipcRenderer.removeListener("menu-action", handler);
  },
  onNotificationNavigate: (
    callback: (target: { projectId: string; conversationId: string }) => void,
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      target: { projectId: string; conversationId: string },
    ) => callback(target);
    ipcRenderer.on("notification-navigate", handler);
    return () => ipcRenderer.removeListener("notification-navigate", handler);
  },
  onUpdateReady: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("update-ready", handler);
    return () => ipcRenderer.removeListener("update-ready", handler);
  },
  getUpdateReady: (): Promise<boolean> =>
    ipcRenderer.invoke("get-update-ready"),
  installUpdate: (): Promise<void> => ipcRenderer.invoke("install-update"),
  selectDirectory: () => ipcRenderer.invoke("select-directory"),
  openDocumentation: () => ipcRenderer.invoke("open-documentation"),
  setMenuEnabled: (actions: string[]) =>
    ipcRenderer.send("menu-set-enabled", actions),
  getServerAuth: (): Promise<string> => ipcRenderer.invoke("get-server-auth"),
});

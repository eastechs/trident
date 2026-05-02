import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  onMenuAction: (callback: (action: string) => void) => {
    ipcRenderer.on('menu-action', (_event, action: string) => callback(action));
  },
  onNotificationNavigate: (
    callback: (target: { projectId: string; conversationId: string }) => void,
  ) => {
    ipcRenderer.on('notification-navigate', (_event, target) => callback(target));
  },
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  openDocumentation: () => ipcRenderer.invoke('open-documentation'),
});

declare global {
  interface Window {
    electronAPI?: {
      onMenuAction: (callback: (action: string) => void) => () => void;
      onNotificationNavigate: (
        callback: (target: {
          projectId: string;
          conversationId: string;
        }) => void,
      ) => () => void;
      onUpdateReady: (callback: () => void) => () => void;
      installUpdate: () => Promise<void>;
      selectDirectory: () => Promise<string | null>;
      openDocumentation: () => Promise<void>;
      setMenuEnabled: (actions: string[]) => void;
      getServerAuth: () => Promise<string>;
    };
  }
}

export {};

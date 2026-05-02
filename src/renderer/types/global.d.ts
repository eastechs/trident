import type { Auth } from '@/types/auth';

declare global {
  interface Window {
    electronAPI?: {
      onMenuAction: (callback: (action: string) => void) => void;
      onNotificationNavigate: (
        callback: (target: { projectId: string; conversationId: string }) => void,
      ) => void;
      selectDirectory: () => Promise<string | null>;
      openDocumentation: () => Promise<void>;
    };
  }
}

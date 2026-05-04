import { api_get, api_post, api_patch, api_delete } from "@/lib/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatPanelHeader } from "@/components/chat-panel-header";
import { ConversationHistory } from "@/components/conversation-history";
import { SidebarChat } from "@/components/sidebar-chat";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ConversationData, DocumentData, ImageData } from "@/types/api";

interface ChatPanelProps {
  projectId: string;
  side: "left" | "right";
  conversations: ConversationData[];
  otherSideActiveId: string | null;
  documents: DocumentData[];
  defaultModel?: string;
  initialPrompt?: string;
  // When set, force the panel to open this conversation (the chat tab) on
  // the next change. Used by the notification deep-link flow to swap the
  // left panel to the conversation that fired the notification.
  requestedActiveId?: string | null;
  onConversationCreated: (conversation: ConversationData) => void;
  onConversationUpdated: (
    id: string,
    updates: Partial<ConversationData>,
  ) => void;
  onConversationDeleted: (id: string) => void;
  onConversationsRefreshed: (conversations: ConversationData[]) => void;
  onActiveIdChanged: (side: "left" | "right", id: string | null) => void;
  onDocumentEdited?: (documentId: string) => void;
  onDocumentCreated?: (documentId: string, documentName: string) => void;
  onImageCreated?: (image: ImageData) => void;
}

function getStorageKey(projectId: string): string {
  return `trident:project:${projectId}:conversations`;
}

interface PanelState {
  activeId: string | null;
  tab: "chat" | "history";
}

function readPanelState(
  projectId: string,
  side: "left" | "right",
): PanelState | null {
  try {
    const saved = localStorage.getItem(getStorageKey(projectId));

    if (saved) {
      const parsed = JSON.parse(saved);

      if (parsed[side]) {
        return {
          activeId: parsed[side].activeId ?? null,
          tab: parsed[side].tab ?? "history",
        };
      }
    }
  } catch {
    /* fall through */
  }

  return null;
}

function writePanelState(
  projectId: string,
  side: "left" | "right",
  state: PanelState,
): void {
  try {
    const saved = localStorage.getItem(getStorageKey(projectId));
    const parsed = saved ? JSON.parse(saved) : {};
    parsed[side] = state;
    localStorage.setItem(getStorageKey(projectId), JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

export function ChatPanel({
  projectId,
  side,
  conversations,
  otherSideActiveId,
  documents,
  defaultModel,
  initialPrompt,
  requestedActiveId,
  onConversationCreated,
  onConversationUpdated,
  onConversationDeleted,
  onConversationsRefreshed,
  onActiveIdChanged,
  onDocumentEdited,
  onDocumentCreated,
  onImageCreated,
}: ChatPanelProps) {
  const savedState = readPanelState(projectId, side);

  const [activeTab, setActiveTab] = useState<"chat" | "history">(() => {
    return savedState?.tab ?? "history";
  });

  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(() => {
    if (
      savedState?.activeId &&
      conversations.some((c) => c.id === savedState.activeId)
    ) {
      return savedState.activeId;
    }

    return null;
  });

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const autoStartedRef = useRef(false);
  const [autoCreatedId, setAutoCreatedId] = useState<string | null>(null);

  // Auto-create conversation and open chat when initialPrompt is set
  useEffect(() => {
    if (initialPrompt && !autoStartedRef.current) {
      autoStartedRef.current = true;
      api_post<ConversationData>(`/api/projects/${projectId}/conversations`)
        .then((data) => {
          onConversationCreated(data);
          setAutoCreatedId(data.id);
          setActiveConversationId(data.id);
          setActiveTab("chat");
        })
        .catch(console.error);
    }
  }, [initialPrompt, projectId, onConversationCreated]);

  // Notify parent whenever active conversation changes
  useEffect(() => {
    onActiveIdChanged(side, activeConversationId);
  }, [activeConversationId, side, onActiveIdChanged]);

  // Honor an externally requested active conversation (notification
  // deep-link). Track the last id we applied so a manual switch doesn't
  // get reverted when this effect re-runs. Defer applying until the
  // requested conversation is present in `conversations` — otherwise
  // the panel ends up on the chat tab with a null active conversation
  // and silently flips back to history.
  const lastAppliedRequestRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    lastAppliedRequestRef.current = undefined;
  }, [conversations]);
  useEffect(() => {
    if (
      requestedActiveId &&
      requestedActiveId !== lastAppliedRequestRef.current &&
      conversations.some((c) => c.id === requestedActiveId)
    ) {
      lastAppliedRequestRef.current = requestedActiveId;
      setActiveConversationId(requestedActiveId);
      setActiveTab("chat");
    }
  }, [requestedActiveId, conversations]);

  // Persist state changes to localStorage
  useEffect(() => {
    writePanelState(projectId, side, {
      activeId: activeConversationId,
      tab: activeTab,
    });
  }, [activeConversationId, activeTab, projectId, side]);

  // Derive effective state — if the active conversation no longer exists, fall back to history
  const activeConversation =
    (activeConversationId &&
      conversations.find((c) => c.id === activeConversationId)) ||
    null;
  const effectiveTab = activeConversation ? activeTab : "history";
  const conversationTitle = activeConversation?.title ?? null;

  const handleTabChange = useCallback((tab: "chat" | "history") => {
    setActiveTab(tab);
  }, []);

  const handleCloseChat = useCallback(() => {
    setActiveConversationId(null);
    setActiveTab("history");
  }, []);

  const handleSelectConversation = useCallback(
    (id: string) => {
      setActiveConversationId(id);
      setActiveTab("chat");

      api_patch(`/api/projects/${projectId}/conversations/${id}`, {
        side,
      }).catch(() => {});
    },
    [projectId, side],
  );

  const handleNewChat = useCallback(() => {
    api_post<ConversationData>(`/api/projects/${projectId}/conversations`)
      .then((data) => {
        onConversationCreated(data);
        setActiveConversationId(data.id);
        setActiveTab("chat");
      })
      .catch(console.error);
  }, [projectId, onConversationCreated]);

  const handleRename = useCallback(
    (id: string, title: string) => {
      api_patch<ConversationData>(
        `/api/projects/${projectId}/conversations/${id}`,
        { title },
      )
        .then((data) => {
          onConversationUpdated(id, { title: data.title });
        })
        .catch(console.error);
    },
    [projectId, onConversationUpdated],
  );

  const handleDeleteRequest = useCallback((id: string) => {
    setDeletingId(id);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deletingId) {
      return;
    }

    const id = deletingId;
    setDeletingId(null);

    api_delete(`/api/projects/${projectId}/conversations/${id}`)
      .then(() => {
        onConversationDeleted(id);

        if (activeConversationId === id) {
          const remaining = conversations.filter((c) => c.id !== id);
          const available = remaining.find((c) => c.id !== otherSideActiveId);

          if (available) {
            setActiveConversationId(available.id);
          } else {
            handleNewChat();
          }
        }
      })
      .catch(console.error);
  }, [
    deletingId,
    projectId,
    onConversationDeleted,
    activeConversationId,
    conversations,
    otherSideActiveId,
    handleNewChat,
  ]);

  const handleStreamingComplete = useCallback(() => {
    // Stop passing initialPrompt to SidebarChat now that the first
    // exchange is complete — prevents a re-send if the component
    // re-renders or remounts after the stream finishes.
    if (activeConversationId === autoCreatedId) {
      setAutoCreatedId(null);
    }

    if (activeConversation?.title === "New Chat") {
      api_get<ConversationData[]>(`/api/projects/${projectId}/conversations`)
        .then((data) => {
          onConversationsRefreshed(data);
        })
        .catch(console.error);
    }
  }, [
    projectId,
    activeConversation?.title,
    activeConversationId,
    autoCreatedId,
    onConversationsRefreshed,
  ]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatPanelHeader
        activeTab={effectiveTab}
        onTabChange={handleTabChange}
        conversationTitle={conversationTitle}
        onNewChat={handleNewChat}
        onCloseChat={handleCloseChat}
      />

      {effectiveTab === "history" ? (
        <ConversationHistory
          conversations={conversations}
          activeId={activeConversationId}
          otherSideActiveId={otherSideActiveId}
          onSelect={handleSelectConversation}
          onRename={handleRename}
          onDelete={handleDeleteRequest}
          onNewChat={handleNewChat}
        />
      ) : (
        <div className="min-h-0 flex-1">
          {activeConversationId && (
            <SidebarChat
              key={activeConversationId}
              projectId={projectId}
              conversationId={activeConversationId}
              documents={documents}
              defaultModel={defaultModel}
              lockedModel={activeConversation?.model ?? null}
              initialEffort={activeConversation?.effort ?? "medium"}
              onEffortChange={(effort) =>
                onConversationUpdated(activeConversationId, { effort })
              }
              side={side}
              initialPrompt={
                activeConversationId === autoCreatedId
                  ? initialPrompt
                  : undefined
              }
              onDocumentEdited={onDocumentEdited}
              onDocumentCreated={onDocumentCreated}
              onImageCreated={onImageCreated}
              onStreamingComplete={handleStreamingComplete}
            />
          )}
        </div>
      )}

      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(open) => !open && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all messages in this conversation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

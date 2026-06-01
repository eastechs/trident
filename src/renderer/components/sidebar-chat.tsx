import { useChat } from "@ai-sdk/react";
import { Link } from "react-router-dom";
import {
  DefaultChatTransport,
  isToolUIPart,
  getToolName,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import type { UIMessage } from "ai";
import { api_get, api_patch, authedFetch } from "@/lib/api";
import { CheckIcon, FileTextIcon, PlusIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GridLoader } from "react-spinners";
import agentChimeUrl from "@/../audio/agent-chime-2.mp3";
import {
  Context,
  ContextCacheUsage,
  ContextCacheWriteUsage,
  ContextContent,
  ContextContentBody,
  ContextContentFooter,
  ContextContentHeader,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextTrigger,
} from "@/components/ai-elements/context";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { ImageConfigCard } from "@/components/ai-elements/image-config-card";
import { Tool, ToolHeader } from "@/components/ai-elements/tool";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input";
import { QuestionsCard } from "@/components/ai-elements/questions-card";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  DocumentData,
  EffortLevel,
  ImageData,
  ModelInfo,
} from "@/types/api";

const EFFORT_OPTIONS: Array<{ value: EffortLevel; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra high" },
  { value: "max", label: "Max" },
];

function toolLabel(toolName: string): string {
  return toolName.replace(/([A-Z])/g, " $1").trim();
}

// Attached documents are prepended to the user message server-side as text
// parts wrapped in <attached_document id="..." name="...">…</attached_document>.
// The model needs to see them; the user doesn't — they already know what they
// attached. Tag attribute order isn't fixed, so match anything up to `>`.
const ATTACHED_DOC_RE =
  /<attached_document\b[^>]*>[\s\S]*?<\/attached_document>\n?/g;

function cleanText(text: string): string {
  return text.replace(ATTACHED_DOC_RE, "");
}

// Curated set; every entry here is a known reasoning-capable model so the
// initial-render fallback flag is hardcoded true. Once the real /api/settings/models
// list arrives, each entry carries its own server-stamped flag.
const FALLBACK_MODELS: ModelInfo[] = [
  {
    id: "claude-opus-4-8",
    provider: "Anthropic",
    providerSlug: "anthropic",
    name: "Opus 4.8",
    supportsReasoning: true,
  },
  {
    id: "claude-opus-4-7",
    provider: "Anthropic",
    providerSlug: "anthropic",
    name: "Opus 4.7",
    supportsReasoning: true,
  },
  {
    id: "claude-sonnet-4-6",
    provider: "Anthropic",
    providerSlug: "anthropic",
    name: "Sonnet 4.6",
    supportsReasoning: true,
  },
  {
    id: "claude-haiku-4-5",
    provider: "Anthropic",
    providerSlug: "anthropic",
    name: "Haiku 4.5",
    supportsReasoning: true,
  },
  {
    id: "gpt-5.5",
    provider: "OpenAI",
    providerSlug: "openai",
    name: "GPT-5.5",
    supportsReasoning: true,
  },
  {
    id: "gpt-5-mini",
    provider: "OpenAI",
    providerSlug: "openai",
    name: "GPT-5 Mini",
    supportsReasoning: true,
  },
  {
    id: "gpt-5-nano",
    provider: "OpenAI",
    providerSlug: "openai",
    name: "GPT-5 Nano",
    supportsReasoning: true,
  },
  {
    id: "gemini-3.1-pro-preview",
    provider: "Gemini",
    providerSlug: "google",
    name: "Gemini 3.1 Pro Preview",
    supportsReasoning: true,
  },
  {
    id: "gemini-3-flash-preview",
    provider: "Gemini",
    providerSlug: "google",
    name: "Gemini 3 Flash Preview",
    supportsReasoning: true,
  },
];

// Generic safe default when the LiteLLM snapshot doesn't list the model.
// The real per-model values come from `selectedModelData.pricing.contextWindow`
// (sourced from LiteLLM at app launch — see src/main/ai/pricing.ts).
const FALLBACK_CONTEXT_WINDOW = 200_000;

const draftKeyFor = (conversationId: string) =>
  `trident:conversation:${conversationId}:draft`;

function loadDraft(conversationId: string): string {
  try {
    return localStorage.getItem(draftKeyFor(conversationId)) ?? "";
  } catch {
    return "";
  }
}

// Mounted inside <PromptInputProvider>; reads the live textarea value from
// the controller and mirrors it to localStorage on every change. Unsent
// text survives navigation away from the conversation; on submit the
// controller calls clear() which empties the value, and we erase the
// localStorage entry in the same effect.
function DraftPersister({ conversationId }: { conversationId: string }) {
  const { textInput } = usePromptInputController();
  useEffect(() => {
    const key = draftKeyFor(conversationId);
    try {
      if (textInput.value) {
        localStorage.setItem(key, textInput.value);
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      // localStorage may be unavailable (private browsing, quota); silently
      // skip — drafts are a nice-to-have, not load-bearing.
    }
  }, [conversationId, textInput.value]);
  return null;
}

interface UsageData {
  prompt_tokens?: number;
  completion_tokens?: number;
  cache_write_input_tokens?: number;
  cache_read_input_tokens?: number;
  reasoning_tokens?: number;
}

interface SidebarChatProps {
  projectId: string;
  conversationId: string;
  documents: DocumentData[];
  defaultModel?: string;
  lockedModel?: string | null;
  initialEffort?: EffortLevel;
  onEffortChange?: (effort: EffortLevel) => void;
  side?: "left" | "right";
  conversationVersion?: number;
  initialPrompt?: string;
  onDocumentEdited?: (documentId: string) => void;
  onDocumentCreated?: (
    documentId: string,
    documentName: string,
    meta?: {
      directory?: string;
      created_by?: string | null;
      last_edited_by?: string | null;
    },
  ) => void;
  onImageCreated?: (image: ImageData) => void;
  onStreamingComplete?: () => void;
}

export function SidebarChat({
  projectId,
  conversationId,
  documents,
  defaultModel,
  lockedModel,
  initialEffort = "medium",
  onEffortChange,
  side,
  conversationVersion = 0,
  initialPrompt,
  onDocumentEdited,
  onDocumentCreated,
  onImageCreated,
  onStreamingComplete,
}: SidebarChatProps) {
  const [availableModels, setAvailableModels] =
    useState<ModelInfo[]>(FALLBACK_MODELS);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  useEffect(() => {
    api_get<ModelInfo[]>("/api/settings/models")
      .then((data) => {
        setAvailableModels(data);
        setModelsLoaded(true);
      })
      .catch(() => setModelsLoaded(true));
  }, []);

  const availableProviders = useMemo(
    () => [...new Set(availableModels.map((m) => m.provider))],
    [availableModels],
  );
  const [model, setModel] = useState<string>(() => {
    // Trust both lockedModel and defaultModel verbatim. FALLBACK_MODELS is
    // the only data we have at first render and it's Anthropic-only, so
    // checking membership here would silently snap any non-Anthropic id
    // (e.g. a project default of gpt-5.4) to FALLBACK_MODELS[0]
    // (claude-opus-4-8) — and the catch-up effect below wouldn't correct
    // it because opus is in the eventually-loaded list. The reconciliation
    // effect handles truly-invalid ids by snapping to availableModels[0]
    // once the real list lands.
    if (lockedModel) return lockedModel;
    return defaultModel ?? FALLBACK_MODELS[0].id;
  });

  // Once the dynamic list loads, reconcile the selected model. For a locked
  // conversation we always force the saved model id (in case anything
  // upstream — initial state, a parent re-render — set state away from it).
  // For an unlocked one we drop to the first available model when the
  // current selection isn't in the fetched list.
  useEffect(() => {
    if (!modelsLoaded || availableModels.length === 0) return;
    if (lockedModel != null) {
      if (model !== lockedModel) setModel(lockedModel);
      return;
    }
    if (!availableModels.some((m) => m.id === model)) {
      setModel(availableModels[0].id);
    }
  }, [modelsLoaded, availableModels, model, lockedModel]);

  const modelRef = useRef(model);
  modelRef.current = model;
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [effort, setEffort] = useState<EffortLevel>(initialEffort);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(
    new Set(),
  );
  const [attachmentSelectorOpen, setAttachmentSelectorOpen] = useState(false);

  // Sequence counter so an older in-flight effort PATCH that fails can't
  // revert past a newer click. Only the most recent request's failure may
  // roll the optimistic update back.
  const effortReqSeqRef = useRef(0);

  const handleEffortChange = useCallback(
    (next: EffortLevel) => {
      const prev = effort;
      const seq = ++effortReqSeqRef.current;
      setEffort(next);
      onEffortChange?.(next);
      api_patch(`/api/projects/${projectId}/conversations/${conversationId}`, {
        effort: next,
      }).catch((err) => {
        if (seq !== effortReqSeqRef.current) return;
        console.error("Failed to update conversation effort:", err);
        setEffort(prev);
        onEffortChange?.(prev);
      });
    },
    [effort, projectId, conversationId, onEffortChange],
  );
  const answeredQuestionsRef = useRef<
    Map<string, Array<{ question: string; answer: string }>>
  >(new Map());

  const selectedModelData = availableModels.find((m) => m.id === model);
  const maxTokens =
    selectedModelData?.pricing?.contextWindow ?? FALLBACK_CONTEXT_WINDOW;

  const [messagesLoaded, setMessagesLoaded] = useState(false);

  const { messages, setMessages, sendMessage, stop, status, addToolOutput } =
    useChat({
      id: conversationId,
      transport: new DefaultChatTransport({
        api: `/api/projects/${projectId}/chat`,
        fetch: authedFetch,
        // Use a function so modelRef.current is read at send time (latest selection),
        // not frozen at transport construction.
        prepareSendMessagesRequest({ messages, body }) {
          return {
            body: {
              messages,
              model_id: modelRef.current,
              conversation_id: conversationId,
              side: side ?? undefined,
              ...body,
            },
          };
        },
      }),
      // After the user submits the image-config card, addToolOutput fulfills
      // the pending GenerateImage call client-side. This helper detects that
      // and triggers the next agent turn automatically so the assistant can
      // acknowledge the generated image.
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
      onFinish({ message }) {
        if (message.role !== "assistant") {
          return;
        }

        for (const part of message.parts) {
          if (!isToolUIPart(part) || part.state !== "output-available") {
            continue;
          }

          const toolName = getToolName(part);
          const output = part.output as Record<string, unknown> | undefined;

          if (output?.document_id) {
            if (toolName === "EditDocument") {
              onDocumentEdited?.(output.document_id as string);
            } else if (toolName === "CreateDocument") {
              onDocumentCreated?.(
                output.document_id as string,
                (output.document_name as string) ?? "",
                {
                  directory: output.directory as string | undefined,
                  created_by:
                    (output.created_by as string | null | undefined) ?? null,
                  last_edited_by:
                    (output.last_edited_by as string | null | undefined) ??
                    null,
                },
              );
            }
          }
          // GenerateImage is now a client-side tool; the image-config
          // card calls onImageCreated directly when the server endpoint
          // returns. Nothing to do here for it.
        }
      },
    });

  const isStreaming = status === "streaming" || status === "submitted";
  const isModelLocked = lockedModel != null || messages.length > 0;
  const hasNoProviders = availableModels.length === 0;

  // Aggregate per-message usage off `messages` directly — the AI SDK attaches
  // each turn's `messageMetadata` (set in src/main/routes/chat.ts on the
  // `finish` part) onto the assistant message in place, so this useMemo
  // updates the moment a stream completes. Maintaining a separate
  // `setConversationUsage` state would only ever populate on conversation
  // load, so the chip would stay empty during a fresh chat session — which
  // is exactly the regression this replaces.
  const conversationUsage = useMemo<UsageData>(() => {
    const accumulated: UsageData = {};
    for (const m of messages) {
      const usage = (m as UIMessage & { metadata?: { usage?: UsageData } })
        .metadata?.usage;
      if (!usage) continue;
      accumulated.prompt_tokens =
        (accumulated.prompt_tokens ?? 0) + (usage.prompt_tokens ?? 0);
      accumulated.completion_tokens =
        (accumulated.completion_tokens ?? 0) + (usage.completion_tokens ?? 0);
      accumulated.cache_write_input_tokens =
        (accumulated.cache_write_input_tokens ?? 0) +
        (usage.cache_write_input_tokens ?? 0);
      accumulated.cache_read_input_tokens =
        (accumulated.cache_read_input_tokens ?? 0) +
        (usage.cache_read_input_tokens ?? 0);
      accumulated.reasoning_tokens =
        (accumulated.reasoning_tokens ?? 0) + (usage.reasoning_tokens ?? 0);
    }
    return accumulated;
  }, [messages]);

  const usedTokens =
    (conversationUsage.prompt_tokens ?? 0) +
    (conversationUsage.completion_tokens ?? 0);
  const inputTokens = conversationUsage.prompt_tokens ?? 0;
  const outputTokens = conversationUsage.completion_tokens ?? 0;
  const contextUsage = useMemo(
    () => ({
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      inputTokenDetails: {
        cacheReadTokens: conversationUsage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: conversationUsage.cache_write_input_tokens ?? 0,
        noCacheTokens: undefined,
      },
      outputTokenDetails: {
        reasoningTokens: conversationUsage.reasoning_tokens ?? 0,
        textTokens: undefined,
      },
    }),
    [conversationUsage, inputTokens, outputTokens],
  );

  // Stable ref for sendMessage so the auto-send effect doesn't re-run
  // every time useChat recreates the function.
  const sendMessageRef = useRef(sendMessage);
  sendMessageRef.current = sendMessage;

  // Load existing messages on mount / conversation change. Messages are
  // stored in native UIMessage format — no transformation needed. Usage
  // numbers ride along on each message's metadata and are aggregated by
  // the conversationUsage useMemo above; nothing to accumulate here.
  useEffect(() => {
    setMessagesLoaded(false);
    api_get<UIMessage[]>(
      `/api/projects/${projectId}/chat/messages?conversation_id=${conversationId}`,
    )
      .then((data) => {
        setMessages(data as UIMessage[]);
        setMessagesLoaded(true);
      })
      .catch((err) => {
        console.error(err);
        setMessagesLoaded(true);
      });
  }, [projectId, conversationId, conversationVersion, setMessages]);

  // Auto-send initial prompt only after messages have loaded (prevents the
  // message-loader's setMessages([]) from wiping the optimistic user message
  // that sendMessage() adds).  sendMessageRef keeps this effect stable so it
  // doesn't re-run when useChat recreates the function on every render.
  const initialPromptSentRef = useRef(false);
  useEffect(() => {
    if (
      initialPrompt &&
      !initialPromptSentRef.current &&
      messagesLoaded &&
      status === "ready"
    ) {
      initialPromptSentRef.current = true;
      sendMessageRef.current({ text: initialPrompt });
    }
  }, [initialPrompt, messagesLoaded, status]);

  // Play chime and notify parent when streaming finishes
  const chimeEnabledRef = useRef(true);
  useEffect(() => {
    api_get<{ enabled: boolean }>("/api/settings/agent-chime")
      .then((data) => {
        chimeEnabledRef.current = data.enabled;
      })
      .catch(() => {});
  }, []);

  // Set when the user clicks the stop button so the streaming→ready
  // transition that follows doesn't trigger the "response complete" chime.
  const userStoppedRef = useRef(false);
  const handleStop = useCallback(() => {
    userStoppedRef.current = true;
    stop();
  }, [stop]);

  const prevStatusRef = useRef(status);
  useEffect(() => {
    const wasActive =
      prevStatusRef.current === "streaming" ||
      prevStatusRef.current === "submitted";
    const isActive = status === "streaming" || status === "submitted";

    if (wasActive && status === "ready") {
      // Only chime when the assistant actually streamed visible content.
      // A submitted→ready transition with nothing streamed (e.g. aborted
      // before any chunks arrived) shouldn't fire the "done" sound.
      const lastMessage = messages[messages.length - 1];
      const streamedContent =
        lastMessage?.role === "assistant" &&
        lastMessage.parts.some(
          (p) =>
            (p.type === "text" && p.text !== "") ||
            p.type === "reasoning" ||
            isToolUIPart(p),
        );
      if (
        streamedContent &&
        chimeEnabledRef.current &&
        !userStoppedRef.current
      ) {
        new Audio(agentChimeUrl).play().catch(() => {});
      }
      onStreamingComplete?.();
    }

    if (wasActive && !isActive) {
      userStoppedRef.current = false;
    }

    prevStatusRef.current = status;
  }, [status, messages, onStreamingComplete]);

  const handleModelSelect = useCallback((id: string) => {
    setModel(id);
    setModelSelectorOpen(false);
  }, []);

  const handleSubmit = useCallback(
    async (message: { text: string }) => {
      const text = message.text.trim();

      // Throw a sentinel error so PromptInput's submit catch keeps the
      // user's draft instead of clearing it. See the catch at the bottom
      // of PromptInput's handleSubmit.
      if (!text || isStreaming) {
        throw new Error("not-sent");
      }

      sendMessage(
        { text },
        { body: { document_ids: Array.from(selectedDocumentIds) } },
      );
      setSelectedDocumentIds(new Set());
    },
    [isStreaming, sendMessage, selectedDocumentIds],
  );

  const handleQuestionsSubmit = useCallback(
    (
      toolCallId: string,
      answers: Array<{ question: string; answer: string }>,
    ) => {
      answeredQuestionsRef.current.set(toolCallId, answers);

      const formattedMessage = answers
        .map((a) => `**${a.question}**\n${a.answer}`)
        .join("\n\n");

      sendMessage(
        { text: formattedMessage },
        { body: { document_ids: Array.from(selectedDocumentIds) } },
      );
      setSelectedDocumentIds(new Set());
    },
    [sendMessage, selectedDocumentIds],
  );

  // Lock the input while the user has an unfulfilled prompt: an
  // unanswered AskQuestions or a pending GenerateImage call awaiting
  // submission from the image-config card.
  const questionsLocked = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];

      if (msg.role !== "assistant") {
        continue;
      }

      for (const part of msg.parts) {
        if (!isToolUIPart(part)) {
          continue;
        }

        const toolName = getToolName(part);

        if (toolName === "GenerateImage") {
          // Client-side tool — locked while awaiting input from the
          // image-config card. Once addToolOutput is called the
          // state moves to output-available/error and we unlock.
          if (
            part.state === "input-available" ||
            part.state === "input-streaming"
          ) {
            return true;
          }
          continue;
        }

        if (toolName !== "AskQuestions") {
          continue;
        }

        if (answeredQuestionsRef.current.has(part.toolCallId)) {
          continue;
        }

        // Check if a user message follows this assistant message
        const hasFollowingUserMessage = messages
          .slice(i + 1)
          .some((m) => m.role === "user");

        if (!hasFollowingUserMessage) {
          return true;
        }
      }
    }

    return false;
  }, [messages]);

  const initialDraft = useMemo(
    () => loadDraft(conversationId),
    [conversationId],
  );

  const toggleDocument = useCallback((docId: string) => {
    setSelectedDocumentIds((prev) => {
      const next = new Set(prev);

      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }

      return next;
    });
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent
          className="gap-4 p-3"
          scrollClassName="thin-scrollbar"
        >
          {messages.length === 0 && !isStreaming && (
            <div className="flex h-full items-center justify-center text-sm text-neutral-400">
              Start a conversation...
            </div>
          )}
          {messages.map((message, messageIndex) => {
            const isLastMessage = messageIndex === messages.length - 1;
            const hasFollowingUserMessage = messages
              .slice(messageIndex + 1)
              .some((m) => m.role === "user");
            const hasPendingImageConfig = message.parts.some(
              (p) =>
                isToolUIPart(p) &&
                getToolName(p) === "GenerateImage" &&
                p.state === "input-available",
            );

            return (
              <Message
                from={message.role}
                key={message.id}
                className={hasPendingImageConfig ? "max-w-full" : undefined}
              >
                <MessageContent
                  className={
                    hasPendingImageConfig ? "w-full max-w-full" : undefined
                  }
                >
                  {message.parts.map((part, i) => {
                    if (part.type === "text") {
                      const cleaned =
                        message.role === "user"
                          ? cleanText(part.text)
                          : part.text;
                      if (!cleaned.trim()) return null;
                      return (
                        <MessageResponse key={`${message.id}-${i}`}>
                          {cleaned}
                        </MessageResponse>
                      );
                    }

                    if (part.type === "reasoning") {
                      // Merge all reasoning parts into a single block
                      const firstReasoningIndex = message.parts.findIndex(
                        (p) => p.type === "reasoning",
                      );

                      if (i !== firstReasoningIndex) {
                        return null;
                      }

                      const mergedText = message.parts
                        .filter((p): p is typeof part => p.type === "reasoning")
                        .map((p) => p.text)
                        .join("\n\n");

                      return (
                        <Reasoning
                          key={`${message.id}-reasoning`}
                          isStreaming={isStreaming && isLastMessage}
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>{mergedText}</ReasoningContent>
                        </Reasoning>
                      );
                    }

                    if (
                      isToolUIPart(part) &&
                      getToolName(part) === "AskQuestions" &&
                      (part.state === "input-available" ||
                        part.state === "approval-requested" ||
                        part.state === "approval-responded" ||
                        part.state === "output-available")
                    ) {
                      const input = part.input as
                        | Record<string, unknown>
                        | undefined;
                      let output: Record<string, unknown> | undefined;
                      if (typeof part.output === "string") {
                        try {
                          output = JSON.parse(part.output);
                        } catch {
                          output = undefined;
                        }
                      } else {
                        output = part.output as
                          | Record<string, unknown>
                          | undefined;
                      }
                      const questionsData = (input?.questions ||
                        output?.questions) as
                        | {
                            question: string;
                            options: Array<{
                              label: string;
                              description: string;
                            }>;
                          }[]
                        | undefined;

                      if (questionsData) {
                        const isSubmitted =
                          answeredQuestionsRef.current.has(part.toolCallId) ||
                          hasFollowingUserMessage;

                        return (
                          <QuestionsCard
                            key={`${message.id}-${i}`}
                            questions={questionsData}
                            onSubmit={(answers) =>
                              handleQuestionsSubmit(part.toolCallId, answers)
                            }
                            submitted={isSubmitted}
                          />
                        );
                      }
                    }

                    if (
                      isToolUIPart(part) &&
                      getToolName(part) === "GenerateImage"
                    ) {
                      // Render the config card while input is ready and the
                      // user hasn't fulfilled it yet. Once addToolOutput
                      // resolves the call, state moves to output-available
                      // and the default "hide resolved tool calls" rule
                      // below kicks in.
                      if (part.state !== "input-available") {
                        return null;
                      }
                      const input = part.input as
                        | { prompt?: string; name?: string }
                        | undefined;
                      const promptText = input?.prompt ?? "";
                      const nameText = input?.name ?? "Image";
                      return (
                        <ImageConfigCard
                          key={`${message.id}-${i}`}
                          projectId={projectId}
                          prompt={promptText}
                          name={nameText}
                          onGenerated={(result) => {
                            addToolOutput({
                              tool: "GenerateImage",
                              toolCallId: part.toolCallId,
                              output: {
                                status: "success",
                                image_id: result.image_id,
                                image_name: result.image_name,
                                mime_type: result.mime_type,
                                prompt: result.prompt,
                                model: result.model,
                                size: result.size,
                                quality: result.quality,
                              },
                            });
                            onImageCreated?.(result.image);
                          }}
                          onCancel={() => {
                            addToolOutput({
                              tool: "GenerateImage",
                              toolCallId: part.toolCallId,
                              output: {
                                status: "cancelled",
                                message: "User cancelled image generation",
                              },
                            });
                          }}
                        />
                      );
                    }

                    // Render tool calls only while running. Once a tool call
                    // resolves (output / error / denied), it's noise — hide it.
                    if (isToolUIPart(part)) {
                      if (
                        part.state === "output-available" ||
                        part.state === "output-error" ||
                        part.state === "output-denied"
                      ) {
                        return null;
                      }
                      const toolName = getToolName(part);
                      return (
                        <Tool key={`${message.id}-${i}`}>
                          {part.type === "dynamic-tool" ? (
                            <ToolHeader
                              type={part.type}
                              state={part.state}
                              toolName={toolName}
                              title={toolLabel(toolName)}
                            />
                          ) : (
                            <ToolHeader
                              type={part.type}
                              state={part.state}
                              title={toolLabel(toolName)}
                            />
                          )}
                        </Tool>
                      );
                    }

                    return null;
                  })}
                </MessageContent>
              </Message>
            );
          })}
          {isStreaming &&
            (() => {
              // Show a "Thinking..." indicator while the assistant is working
              // but has no visible content yet (no text, no reasoning, no tool call).
              const lastMessage = messages[messages.length - 1];
              const hasVisibleAssistantContent =
                lastMessage?.role === "assistant" &&
                lastMessage.parts.some(
                  (p) =>
                    (p.type === "text" && p.text !== "") ||
                    p.type === "reasoning" ||
                    isToolUIPart(p),
                );
              if (hasVisibleAssistantContent) return null;
              return (
                <div className="flex items-center gap-2 px-3">
                  <GridLoader size={3} color="var(--primary)" />
                  <span className="animate-pulse text-sm text-neutral-400">
                    Thinking...
                  </span>
                </div>
              );
            })()}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="px-2 pb-2">
        {hasNoProviders && (
          <div className="border-border flex items-center justify-center rounded-lg border border-dashed px-3 py-4">
            <p className="text-muted-foreground text-center text-xs">
              Add an API key in{" "}
              <Link
                to="/settings"
                className="text-primary font-medium underline underline-offset-2"
              >
                Settings
              </Link>{" "}
              to start chatting.
            </p>
          </div>
        )}
        {!hasNoProviders && (
          <div
            className={`relative ${isStreaming ? "chat-input-shimmer" : ""}`}
          >
            <div className="bg-primary/10 dark:bg-primary/20 pointer-events-none absolute -inset-6 rounded-full blur-3xl" />
            <div className="relative">
              <PromptInputProvider
                key={conversationId}
                initialInput={initialDraft}
              >
                <DraftPersister conversationId={conversationId} />
                <PromptInput onSubmit={handleSubmit}>
                  <PromptInputBody>
                    <PromptInputTextarea
                      placeholder={
                        questionsLocked
                          ? "Answer the questions above to continue..."
                          : "Ask anything..."
                      }
                      disabled={questionsLocked}
                    />
                  </PromptInputBody>
                  <PromptInputFooter>
                    <PromptInputTools>
                      {isModelLocked ? (
                        <PromptInputButton
                          disabled
                          size="sm"
                          className="h-7 cursor-default px-2 text-xs opacity-60"
                        >
                          {selectedModelData?.name && (
                            <ModelSelectorName>
                              {selectedModelData.name}
                            </ModelSelectorName>
                          )}
                        </PromptInputButton>
                      ) : (
                        <ModelSelector
                          onOpenChange={setModelSelectorOpen}
                          open={modelSelectorOpen}
                        >
                          <ModelSelectorTrigger asChild>
                            <PromptInputButton
                              size="sm"
                              className="h-7 px-2 text-xs"
                            >
                              {selectedModelData?.name && (
                                <ModelSelectorName>
                                  {selectedModelData.name}
                                </ModelSelectorName>
                              )}
                            </PromptInputButton>
                          </ModelSelectorTrigger>
                          <ModelSelectorContent showCloseButton={false}>
                            <ModelSelectorInput placeholder="Search models..." />
                            <ModelSelectorList>
                              <ModelSelectorEmpty>
                                No models found.
                              </ModelSelectorEmpty>
                              {availableProviders.map((provider) => (
                                <ModelSelectorGroup
                                  heading={provider}
                                  key={provider}
                                >
                                  {availableModels
                                    .filter((m) => m.provider === provider)
                                    .map((m) => (
                                      <ModelSelectorItem
                                        key={m.id}
                                        onSelect={() => handleModelSelect(m.id)}
                                        value={m.id}
                                      >
                                        <ModelSelectorLogo
                                          provider={m.providerSlug}
                                        />
                                        <ModelSelectorName>
                                          {m.name}
                                        </ModelSelectorName>
                                        {model === m.id ? (
                                          <CheckIcon className="ml-auto size-4" />
                                        ) : (
                                          <div className="ml-auto size-4" />
                                        )}
                                      </ModelSelectorItem>
                                    ))}
                                </ModelSelectorGroup>
                              ))}
                            </ModelSelectorList>
                          </ModelSelectorContent>
                        </ModelSelector>
                      )}
                      {selectedModelData?.supportsReasoning && (
                        <Select
                          value={effort}
                          onValueChange={(v) =>
                            handleEffortChange(v as EffortLevel)
                          }
                        >
                          <SelectTrigger
                            size="sm"
                            // Override the size variant with a matching variant so
                            // tailwind-merge actually strips the base's
                            // data-[size=sm]:h-8 instead of letting both apply.
                            className="text-muted-foreground hover:bg-muted dark:hover:bg-muted/50 w-auto gap-1 rounded-4xl border-transparent bg-transparent bg-clip-padding px-2 py-0 text-xs font-medium shadow-none focus:ring-0 data-[size=sm]:h-7 [&>svg]:hidden"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent align="start">
                            {EFFORT_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {usedTokens > 0 && (
                        <Context
                          maxTokens={maxTokens}
                          usedTokens={usedTokens}
                          usage={contextUsage}
                          pricing={selectedModelData?.pricing}
                        >
                          <ContextTrigger className="h-7 gap-1 px-2 text-xs font-medium" />
                          <ContextContent>
                            <ContextContentHeader />
                            <ContextContentBody>
                              <ContextInputUsage />
                              <ContextOutputUsage />
                              <ContextReasoningUsage />
                              <ContextCacheUsage />
                              <ContextCacheWriteUsage />
                            </ContextContentBody>
                            <ContextContentFooter />
                          </ContextContent>
                        </Context>
                      )}
                    </PromptInputTools>
                    <div className="flex items-center gap-1">
                      <Popover
                        open={attachmentSelectorOpen}
                        onOpenChange={setAttachmentSelectorOpen}
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="relative flex shrink-0 items-center justify-center rounded p-1.5 text-neutral-400 transition-colors hover:bg-neutral-50 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                          >
                            <PlusIcon className="size-4" />
                            {selectedDocumentIds.size > 0 && (
                              <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-medium">
                                {selectedDocumentIds.size}
                              </span>
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-64 gap-1 p-2">
                          <div className="mb-2 flex items-center justify-between px-2">
                            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                              Attach Documents
                            </span>
                          </div>
                          <TooltipProvider
                            delayDuration={300}
                            skipDelayDuration={0}
                          >
                            <div className="flex max-h-60 flex-col gap-0.5 overflow-y-auto">
                              {(() => {
                                const groups = documents.reduce<
                                  Record<string, DocumentData[]>
                                >((acc, doc) => {
                                  const dir = doc.directory ?? "user";
                                  (acc[dir] ??= []).push(doc);

                                  return acc;
                                }, {});
                                const sortedDirs = Object.keys(groups).sort(
                                  (a, b) => {
                                    if (a === "user") {
                                      return -1;
                                    }

                                    if (b === "user") {
                                      return 1;
                                    }

                                    return a.localeCompare(b);
                                  },
                                );

                                return sortedDirs.map((dir) => (
                                  <div key={dir}>
                                    <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-neutral-400 uppercase dark:text-neutral-500">
                                      {dir === "user" ? "Your Documents" : dir}
                                    </div>
                                    {groups[dir].map((doc) => (
                                      <Tooltip key={doc.id}>
                                        <TooltipTrigger
                                          asChild
                                          onFocus={(e) => e.preventDefault()}
                                        >
                                          <button
                                            type="button"
                                            onClick={() =>
                                              toggleDocument(doc.id)
                                            }
                                            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800 ${
                                              selectedDocumentIds.has(doc.id)
                                                ? "bg-neutral-50 dark:bg-neutral-900"
                                                : ""
                                            }`}
                                          >
                                            <div
                                              className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                                                selectedDocumentIds.has(doc.id)
                                                  ? "border-primary bg-primary text-primary-foreground"
                                                  : "border-neutral-300 dark:border-neutral-600"
                                              }`}
                                            >
                                              {selectedDocumentIds.has(
                                                doc.id,
                                              ) && (
                                                <CheckIcon className="size-3" />
                                              )}
                                            </div>
                                            <FileTextIcon className="size-4 shrink-0 text-neutral-400" />
                                            <span className="truncate">
                                              {doc.name}
                                            </span>
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="left">
                                          {doc.name}
                                        </TooltipContent>
                                      </Tooltip>
                                    ))}
                                  </div>
                                ));
                              })()}
                              {documents.length === 0 && (
                                <p className="px-2 py-1.5 text-sm text-neutral-400">
                                  No documents
                                </p>
                              )}
                            </div>
                          </TooltipProvider>
                        </PopoverContent>
                      </Popover>
                      <PromptInputSubmit
                        status={status}
                        onStop={handleStop}
                        disabled={!isStreaming && questionsLocked}
                      />
                    </div>
                  </PromptInputFooter>
                </PromptInput>
              </PromptInputProvider>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

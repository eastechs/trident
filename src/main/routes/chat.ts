import { Router, type Request } from 'express';
import { streamText, generateText, convertToModelMessages, stepCountIs, generateId, type UIMessage, type ToolSet } from 'ai';
import { eq, asc, sql, inArray, and } from 'drizzle-orm';
import { getDb } from '../database.js';
import { conversations, messages, documents, projects } from '../db/schema.js';
import { resolveModel, getProviderOptions, modelLabel, isEffortLevel, DEFAULT_EFFORT } from '../ai/providers.js';
import { loadInstructions } from '../ai/instructions.js';
import { createTools } from '../ai/tools/index.js';
import { showNotification } from '../native/notifications.js';
import { getApiKey } from '../settings.js';

const router = Router({ mergeParams: true });

type ProjectRequest = Request<{ projectId: string }>;

// ─── Send message (streaming) ──────────────────────────────

router.post('/', async (req: ProjectRequest, res) => {
  const db = getDb();
  const { projectId } = req.params;
  const { messages: requestMessages, model_id, conversation_id, side, document_ids } = req.body;

  if (!model_id || !conversation_id) {
    res.status(422).json({ error: 'model_id and conversation_id are required' });
    return;
  }

  // Load project + conversation (we need conversation.effort).
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }

  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, conversation_id));
  if (!conversation) { res.status(404).json({ error: 'Conversation not found' }); return; }
  // Validate at read time — column is plain text with no DB-level CHECK,
  // and downstream provider mappers rely on the value being a known level.
  const effort = isEffortLevel(conversation.effort) ? conversation.effort : DEFAULT_EFFORT;

  // The client (useChat) sends the full UIMessage[] including the new user message.
  // Use that directly; the DB history would miss the new message.
  const history: UIMessage[] = Array.isArray(requestMessages) ? requestMessages : [];

  if (history.length === 0) {
    res.status(422).json({ error: 'messages must not be empty' });
    return;
  }

  // Attached documents are prepended to the last user message as text parts
  // wrapped in <attached_document> delimiters. This persists naturally in
  // message history (so future turns still see what the user attached) and
  // works on every provider since text parts are universal — no file-part
  // media-type juggling.
  if (document_ids?.length) {
    const attachedDocs = await db
      .select({ id: documents.id, name: documents.name, content: documents.content })
      .from(documents)
      .where(and(eq(documents.projectId, projectId), inArray(documents.id, document_ids)));

    if (attachedDocs.length > 0) {
      let lastUserIndex = -1;
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].role === 'user') { lastUserIndex = i; break; }
      }
      if (lastUserIndex >= 0) {
        const lastUser = history[lastUserIndex];
        const docParts = attachedDocs.map((d) => {
          // Escape XML-special characters in attributes so a doc titled
          // e.g. `Bob's "Notes" <draft>` doesn't break the delimiter.
          const safeName = (d.name ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
          // Disarm any literal closing tag inside the content so it doesn't
          // visually terminate the block early to the model. We zero-width-
          // space the `</` so the model still sees the text but the pattern
          // doesn't match the delimiter.
          const safeContent = (d.content ?? '').replace(/<\/attached_document>/g, '<​/attached_document>');
          // Include the doc id so the agent can call EditDocument directly.
          // Without this it would have to call SearchDocuments first, which
          // is scoped to the calling agent's own directory and won't find
          // docs created by a different model.
          return {
            type: 'text' as const,
            text: `<attached_document id="${d.id}" name="${safeName}">\n${safeContent}\n</attached_document>`,
          };
        });
        history[lastUserIndex] = {
          ...lastUser,
          parts: [...docParts, ...lastUser.parts],
        };
      }
    }
  }

  // Resolve model and create tools
  const model = resolveModel(model_id);
  const baseTools = createTools(projectId, project.path, model_id, project.filesystemRoot);

  // Add a provider-native web search tool so the agent can look up current info.
  const provider = model_id.startsWith('claude-')
    ? 'anthropic'
    : model_id.startsWith('gemini-')
      ? 'gemini'
      : 'openai';

  let WebSearch: ToolSet[string] | undefined = undefined;
  if (provider === 'anthropic') {
    const anthropicKey = getApiKey('anthropic');
    if (anthropicKey) {
      const { createAnthropic } = await import('@ai-sdk/anthropic');
      WebSearch = createAnthropic({ apiKey: anthropicKey }).tools.webSearch_20260209({ maxUses: 5 });
    }
  } else if (provider === 'openai') {
    const openaiKey = getApiKey('openai');
    if (openaiKey) {
      const { createOpenAI } = await import('@ai-sdk/openai');
      WebSearch = createOpenAI({ apiKey: openaiKey }).tools.webSearch();
    }
  }

  const allTools = WebSearch ? { ...baseTools, WebSearch } : baseTools;

  // The workspace pointer goes in the system prompt: it tells the agent the
  // project has a local working directory and points it at the workspace
  // tools. Without this, the agent doesn't know the tools exist or what root
  // they're scoped to.
  let systemPrompt = loadInstructions();
  if (project.filesystemRoot) {
    systemPrompt += `\n\n## Local Workspace\n\nThis project has a local working directory at:\n\`${project.filesystemRoot}\`\n\nUse ListDirectory, ReadFile, and SearchFiles to explore it. Paths passed to those tools are relative to the workspace root above. Use them whenever the user references their project code or asks you to investigate the codebase.`;
  }

  // Anthropic caches up to four breakpoints; mark the system prompt and the
  // last tool definition so the entire stable prefix (system + tools) becomes
  // a cache hit on every subsequent turn within the 1h TTL window. Cache
  // markers on non-Anthropic providers are silently ignored.
  const tools: ToolSet = (() => {
    if (provider !== 'anthropic') return allTools;
    const entries = Object.entries(allTools);
    if (entries.length === 0) return allTools;
    const [lastKey, lastTool] = entries[entries.length - 1];
    const existingAnthropic = (lastTool.providerOptions?.anthropic as Record<string, unknown> | undefined) ?? {};
    return {
      ...allTools,
      [lastKey]: {
        ...lastTool,
        providerOptions: {
          ...lastTool.providerOptions,
          anthropic: {
            ...existingAnthropic,
            cacheControl: { type: 'ephemeral', ttl: '1h' },
          },
        },
      },
    };
  })();

  try {
    const convertedMessages = await convertToModelMessages(history, { tools });

    // Pass the system prompt as a message rather than the top-level `system`
    // string so we can attach providerOptions to it. For Anthropic this marks
    // the first cache breakpoint (the second is on the last tool above). The
    // 1h TTL is the max Anthropic offers and survives short user breaks.
    const modelMessages = [
      {
        role: 'system' as const,
        content: systemPrompt,
        ...(provider === 'anthropic' && {
          providerOptions: {
            anthropic: { cacheControl: { type: 'ephemeral' as const, ttl: '1h' as const } },
          },
        }),
      },
      ...convertedMessages,
    ];

    const result = streamText({
      model,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(25),
      providerOptions: getProviderOptions(model_id, { projectId, effort }),
    });

    // Per-request accumulator for Anthropic's per-step cache_creation count
    // (see messageMetadata below).
    let anthropicCacheWrites = 0;

    // Pipe the UI message stream directly to the Express response.
    // This hands lifecycle to the AI SDK so onFinish reliably runs before
    // the response closes, avoiding a race where the last assistant message
    // wouldn't get persisted.
    result.pipeUIMessageStreamToResponse(res, {
      sendReasoning: true,
      originalMessages: history,
      generateMessageId: generateId,
      // Attach token usage to assistant messages on finish so the client can
      // render the usage widget. Without this the AI SDK doesn't ship usage
      // data through the UI stream and `metadata.usage` stays undefined.
      //
      // Anthropic doesn't populate the standard inputTokenDetails.cacheWriteTokens;
      // they expose cacheCreationInputTokens via providerMetadata on each
      // finish-step. Accumulate it across steps so the widget shows accurate
      // cache-write counts for Claude conversations too.
      messageMetadata: ({ part }) => {
        if (part.type === 'finish-step') {
          const anthropicMeta = part.providerMetadata?.anthropic as
            | { cacheCreationInputTokens?: number }
            | undefined;
          const writes = anthropicMeta?.cacheCreationInputTokens;
          if (typeof writes === 'number') anthropicCacheWrites += writes;
          return undefined;
        }
        if (part.type === 'finish') {
          const u = part.totalUsage;
          return {
            model: model_id,
            usage: {
              prompt_tokens: u.inputTokens,
              completion_tokens: u.outputTokens,
              cache_read_input_tokens: u.inputTokenDetails?.cacheReadTokens,
              cache_write_input_tokens: u.inputTokenDetails?.cacheWriteTokens
                ?? (anthropicCacheWrites > 0 ? anthropicCacheWrites : undefined),
              reasoning_tokens: u.outputTokenDetails?.reasoningTokens,
            },
          };
        }
        return undefined;
      },
      onFinish: async ({ messages: allMessages, responseMessage }) => {
        try {
          const [maxOrder] = await db
            .select({ max: sql<number>`COALESCE(MAX(order_index), -1)` })
            .from(messages)
            .where(eq(messages.conversationId, conversation_id));

          let nextIndex = (maxOrder?.max ?? -1) + 1;

          for (const msg of allMessages) {
            const existing = await db
              .select({ id: messages.id })
              .from(messages)
              .where(eq(messages.id, msg.id));

            if (existing.length === 0) {
              await db.insert(messages).values({
                id: msg.id,
                conversationId: conversation_id,
                role: msg.role,
                parts: msg.parts as unknown as Record<string, unknown>,
                // Assistant messages have usage attached via messageMetadata.
                // User messages don't, so fall back to recording the model.
                metadata: (msg.metadata as Record<string, unknown> | undefined) ?? { model: model_id },
                orderIndex: nextIndex++,
              });
            } else if (msg.id === responseMessage.id) {
              // The response message may extend an existing assistant message
              // (isContinuation). Update parts + metadata to the latest state.
              await db
                .update(messages)
                .set({
                  parts: msg.parts as unknown as Record<string, unknown>,
                  metadata: (msg.metadata as Record<string, unknown> | undefined) ?? { model: model_id },
                })
                .where(eq(messages.id, msg.id));
            }
          }

          // Update conversation title on first message
          const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversation_id));
          if (conv?.title === 'New Chat') {
            const firstUserMsg = allMessages.find((m) => m.role === 'user');
            const title = await generateConversationTitle(firstUserMsg);
            await db
              .update(conversations)
              .set({ title, model: model_id, side: side ?? conv.side, updatedAt: new Date() })
              .where(eq(conversations.id, conversation_id));
          } else {
            await db
              .update(conversations)
              .set({ updatedAt: new Date() })
              .where(eq(conversations.id, conversation_id));
          }

          // Show notification with model ID as title and first 3 lines of response as body
          const assistantText = responseMessage.parts
            ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
            .map((p) => p.text)
            .join('\n') ?? '';
          const preview = assistantText.split('\n').slice(0, 3).join('\n');
          showNotification(modelLabel(model_id), preview || 'Agent response complete');
        } catch (err) {
          console.error('Error persisting messages:', err);
        }
      },
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Get messages for a conversation ───────────────────────

router.get('/messages', async (req, res) => {
  const db = getDb();
  const conversationId = req.query.conversation_id as string;
  if (!conversationId) { res.json([]); return; }

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.orderIndex));

  // Return as UIMessage[] — no transformation needed
  res.json(
    msgs.map((m) => ({
      id: m.id,
      role: m.role,
      parts: m.parts,
      ...(m.metadata ? { metadata: m.metadata } : {}),
    })),
  );
});

// ─── Clear messages in all project conversations ─────────
// Matches Laravel: deletes messages but keeps the conversation records.

router.delete('/', async (req: ProjectRequest, res) => {
  const db = getDb();
  const { projectId } = req.params;
  const { projects } = await import('../db/schema.js');

  const convIds = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.projectId, projectId));

  for (const { id } of convIds) {
    await db.delete(messages).where(eq(messages.conversationId, id));
  }

  // Touch project updated_at (like Laravel's $project->touch())
  await db
    .update(projects)
    .set({ updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  res.status(204).end();
});

// ─── Title generation helper ───────────────────────────────

async function generateConversationTitle(firstUserMessage?: UIMessage): Promise<string> {
  if (!firstUserMessage) return 'New Chat';

  const textPart = firstUserMessage.parts?.find(
    (p): p is { type: 'text'; text: string } => p.type === 'text',
  );
  const userText = textPart?.text ?? '';
  if (!userText) return 'New Chat';

  try {
    const openaiKey = getApiKey('openai');
    if (openaiKey) {
      const { createOpenAI } = await import('@ai-sdk/openai');
      const openai = createOpenAI({ apiKey: openaiKey });
      const { text } = await generateText({
        model: openai('gpt-5.5-nano'),
        system: 'Generate a short, descriptive title for a conversation based on the user\'s first message. Max 50 characters. No quotes. Just the title.',
        prompt: userText,
      });
      const title = text.trim();
      if (title) return title;
    }
  } catch {
    // Fall back to truncation
  }

  return userText.length > 50 ? userText.substring(0, 47) + '...' : userText;
}

export default router;

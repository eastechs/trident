import { Router, type Request } from 'express';
import { streamText, generateText, convertToModelMessages, stepCountIs, generateId, type UIMessage, type ToolSet } from 'ai';
import { eq, asc, sql, inArray, and } from 'drizzle-orm';
import { getDb } from '../database.js';
import { conversations, messages, documents, projects } from '../db/schema.js';
import { resolveModel, getProviderOptions, modelLabel } from '../ai/providers.js';
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

  // Load project
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }

  // The client (useChat) sends the full UIMessage[] including the new user message.
  // Use that directly; the DB history would miss the new message.
  const history: UIMessage[] = Array.isArray(requestMessages) ? requestMessages : [];

  if (history.length === 0) {
    res.status(422).json({ error: 'messages must not be empty' });
    return;
  }

  // Load document attachments if provided (only the requested IDs)
  let systemSuffix = '';
  if (document_ids?.length) {
    const attachedDocs = await db
      .select({ id: documents.id, name: documents.name, content: documents.content })
      .from(documents)
      .where(and(eq(documents.projectId, projectId), inArray(documents.id, document_ids)));

    if (attachedDocs.length > 0) {
      systemSuffix = '\n\n## Attached Documents\n\n' +
        attachedDocs.map((d) => `### ${d.name}\n${d.content}`).join('\n\n');
    }
  }

  // Resolve model and create tools
  const model = resolveModel(model_id);
  const baseTools = createTools(projectId, project.path, model_id);

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

  const tools = WebSearch ? { ...baseTools, WebSearch } : baseTools;
  const systemPrompt = loadInstructions() + systemSuffix;

  try {
    const modelMessages = await convertToModelMessages(history, { tools });

    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(25),
      providerOptions: getProviderOptions(model_id),
    });

    // Pipe the UI message stream directly to the Express response.
    // This hands lifecycle to the AI SDK so onFinish reliably runs before
    // the response closes, avoiding a race where the last assistant message
    // wouldn't get persisted.
    result.pipeUIMessageStreamToResponse(res, {
      sendReasoning: true,
      originalMessages: history,
      generateMessageId: generateId,
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
                metadata: { model: model_id },
                orderIndex: nextIndex++,
              });
            } else if (msg.id === responseMessage.id) {
              // The response message may extend an existing assistant message
              // (isContinuation). Update parts to the latest state.
              await db
                .update(messages)
                .set({ parts: msg.parts as unknown as Record<string, unknown> })
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
        model: openai('gpt-5.4-nano'),
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

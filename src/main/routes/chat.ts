import { Router } from 'express';
import { streamText, generateText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai';
import { eq, asc, sql, inArray, and } from 'drizzle-orm';
import { getDb } from '../database.js';
import { conversations, messages, documents, projects } from '../db/schema.js';
import { resolveModel, getProviderOptions } from '../ai/providers.js';
import { loadInstructions } from '../ai/instructions.js';
import { createTools } from '../ai/tools/index.js';
import { showNotification } from '../native/notifications.js';
import { getApiKey } from '../settings.js';

const router = Router({ mergeParams: true });

// ─── Send message (streaming) ──────────────────────────────

router.post('/', async (req, res) => {
  const db = getDb();
  const projectId = req.params.projectId;
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
  const tools = createTools(projectId, project.path, model_id);
  const systemPrompt = loadInstructions() + systemSuffix;

  try {
    const modelMessages = await convertToModelMessages(history);

    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(25),
      providerOptions: getProviderOptions(model_id),
    });

    // Use toUIMessageStreamResponse which:
    // 1. Streams to the client via Data Stream Protocol
    // 2. Provides UIMessage[] (not CoreMessage[]) in onFinish
    const stream = result.toUIMessageStreamResponse({
      sendReasoning: true,
      originalMessages: history,
      onFinish: async ({ messages: allMessages }) => {
        try {
          // allMessages is the complete UIMessage[] including history + new messages
          // Persist only messages that aren't already in the DB
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
            }
          }

          // Update conversation title on first message
          const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversation_id));
          if (conv?.title === 'New Chat') {
            // Find the first user message in this batch for title generation
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
          const lastAssistant = [...allMessages].reverse().find((m) => m.role === 'assistant');
          const assistantText = lastAssistant?.parts
            ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
            .map((p) => p.text)
            .join('\n') ?? '';
          const preview = assistantText.split('\n').slice(0, 3).join('\n');
          showNotification(model_id, preview || 'Agent response complete');
        } catch (err) {
          console.error('Error persisting messages:', err);
        }
      },
    });

    // Forward the ReadableStream response to Express
    res.writeHead(stream.status, Object.fromEntries(stream.headers.entries()));
    const reader = stream.body?.getReader();
    if (reader) {
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { res.end(); break; }
          res.write(value);
        }
      };
      pump().catch(() => res.end());
    }
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

router.delete('/', async (req, res) => {
  const db = getDb();
  const { projects } = await import('../db/schema.js');

  const convIds = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.projectId, req.params.projectId));

  for (const { id } of convIds) {
    await db.delete(messages).where(eq(messages.conversationId, id));
  }

  // Touch project updated_at (like Laravel's $project->touch())
  await db
    .update(projects)
    .set({ updatedAt: new Date() })
    .where(eq(projects.id, req.params.projectId));

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

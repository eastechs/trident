import { Router, type Request } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { getDb } from '../database.js';
import { conversations, messages } from '../db/schema.js';

const router = Router({ mergeParams: true });

type ProjectRequest = Request<{ projectId: string }>;
type ConversationRequest = Request<{ projectId: string; conversationId: string }>;

type ConversationRow = typeof conversations.$inferSelect;

function serializeConversation(
  c: ConversationRow,
  messageCount = 0,
): Record<string, unknown> {
  return {
    id: c.id,
    project_id: c.projectId,
    title: c.title,
    side: c.side,
    model: c.model,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
    message_count: messageCount,
  };
}

// ─── Index ─────────────────────────────────────────────────

router.get('/', async (req: ProjectRequest, res) => {
  const db = getDb();
  const projectConversations = await db
    .select()
    .from(conversations)
    .where(eq(conversations.projectId, req.params.projectId))
    .orderBy(desc(conversations.updatedAt));

  const result = await Promise.all(
    projectConversations.map(async (conv) => {
      const [count] = await db
        .select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(eq(messages.conversationId, conv.id));
      return serializeConversation(conv, count?.count ?? 0);
    }),
  );

  res.json(result);
});

// ─── Store ─────────────────────────────────────────────────

router.post('/', async (req: ProjectRequest, res) => {
  const db = getDb();
  const { title, side, model } = req.body;

  const [conversation] = await db.insert(conversations).values({
    projectId: req.params.projectId,
    title: title ?? 'New Chat',
    side: side ?? null,
    model: model ?? null,
  }).returning();

  res.json(serializeConversation(conversation, 0));
});

// ─── Update ────────────────────────────────────────────────

router.patch('/:conversationId', async (req: ConversationRequest, res) => {
  const db = getDb();
  const { title, side, model } = req.body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (title !== undefined) updates.title = title;
  if (side !== undefined) updates.side = side;
  if (model !== undefined) updates.model = model;

  const [updated] = await db
    .update(conversations)
    .set(updates)
    .where(and(
      eq(conversations.id, req.params.conversationId),
      eq(conversations.projectId, req.params.projectId),
    ))
    .returning();

  if (!updated) { res.status(404).json({ error: 'Not found' }); return; }

  const [count] = await db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(eq(messages.conversationId, updated.id));

  res.json(serializeConversation(updated, count?.count ?? 0));
});

// ─── Destroy ───────────────────────────────────────────────

router.delete('/:conversationId', async (req: ConversationRequest, res) => {
  const db = getDb();
  // Cascade delete handles messages
  await db.delete(conversations).where(and(
    eq(conversations.id, req.params.conversationId),
    eq(conversations.projectId, req.params.projectId),
  ));

  res.json({ success: true });
});

export default router;

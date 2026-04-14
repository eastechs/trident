import { Router } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { getDb } from '../database.js';
import { conversations, messages } from '../db/schema.js';

const router = Router({ mergeParams: true });

// ─── Index ─────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const db = getDb();
  const projectConversations = await db
    .select()
    .from(conversations)
    .where(eq(conversations.projectId, req.params.projectId))
    .orderBy(desc(conversations.updatedAt));

  // Attach message counts
  const result = await Promise.all(
    projectConversations.map(async (conv) => {
      const [count] = await db
        .select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(eq(messages.conversationId, conv.id));

      return {
        ...conv,
        message_count: count?.count ?? 0,
      };
    }),
  );

  res.json(result);
});

// ─── Store ─────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const db = getDb();
  const { title, side, model } = req.body;

  const [conversation] = await db.insert(conversations).values({
    projectId: req.params.projectId,
    title: title ?? 'New Chat',
    side: side ?? null,
    model: model ?? null,
  }).returning();

  res.json(conversation);
});

// ─── Update ────────────────────────────────────────────────

router.patch('/:conversationId', async (req, res) => {
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

  res.json(updated);
});

// ─── Destroy ───────────────────────────────────────────────

router.delete('/:conversationId', async (req, res) => {
  const db = getDb();
  // Cascade delete handles messages
  await db.delete(conversations).where(and(
    eq(conversations.id, req.params.conversationId),
    eq(conversations.projectId, req.params.projectId),
  ));

  res.json({ success: true });
});

export default router;

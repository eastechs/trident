import { Router, type Request } from "express";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { getDb } from "../database.js";
import { conversations, messages } from "../db/schema.js";
import { isEffortLevel, EFFORT_LEVELS } from "../ai/providers.js";

const router = Router({ mergeParams: true });

type ProjectRequest = Request<{ projectId: string }>;
type ConversationRequest = Request<{
  projectId: string;
  conversationId: string;
}>;

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
    effort: c.effort,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
    message_count: messageCount,
  };
}

// ─── Index ─────────────────────────────────────────────────

router.get("/", async (req: ProjectRequest, res) => {
  const db = getDb();
  const projectConversations = await db
    .select()
    .from(conversations)
    .where(eq(conversations.projectId, req.params.projectId))
    .orderBy(desc(conversations.updatedAt));

  if (projectConversations.length === 0) {
    res.json([]);
    return;
  }

  // Single GROUP BY query for message counts instead of one per conversation.
  const counts = await db
    .select({
      conversationId: messages.conversationId,
      count: sql<number>`count(*)::int`,
    })
    .from(messages)
    .where(
      inArray(
        messages.conversationId,
        projectConversations.map((c) => c.id),
      ),
    )
    .groupBy(messages.conversationId);

  const countByConv = new Map(counts.map((c) => [c.conversationId, c.count]));

  res.json(
    projectConversations.map((conv) =>
      serializeConversation(conv, countByConv.get(conv.id) ?? 0),
    ),
  );
});

// ─── Store ─────────────────────────────────────────────────

router.post("/", async (req: ProjectRequest, res) => {
  const db = getDb();
  const { title, side, model } = req.body;

  const [conversation] = await db
    .insert(conversations)
    .values({
      projectId: req.params.projectId,
      title: title ?? "New Chat",
      side: side ?? null,
      model: model ?? null,
    })
    .returning();

  res.json(serializeConversation(conversation, 0));
});

// ─── Update ────────────────────────────────────────────────

router.patch("/:conversationId", async (req: ConversationRequest, res) => {
  const db = getDb();
  const { title, side, model, effort } = req.body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (title !== undefined) updates.title = title;
  if (side !== undefined) updates.side = side;
  if (model !== undefined) updates.model = model;
  if (effort !== undefined) {
    if (!isEffortLevel(effort)) {
      res
        .status(422)
        .json({ error: `effort must be one of: ${EFFORT_LEVELS.join(", ")}` });
      return;
    }
    updates.effort = effort;
  }

  const [updated] = await db
    .update(conversations)
    .set(updates)
    .where(
      and(
        eq(conversations.id, req.params.conversationId),
        eq(conversations.projectId, req.params.projectId),
      ),
    )
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [count] = await db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(eq(messages.conversationId, updated.id));

  res.json(serializeConversation(updated, count?.count ?? 0));
});

// ─── Destroy ───────────────────────────────────────────────

router.delete("/:conversationId", async (req: ConversationRequest, res) => {
  const db = getDb();
  // Cascade delete handles messages
  await db
    .delete(conversations)
    .where(
      and(
        eq(conversations.id, req.params.conversationId),
        eq(conversations.projectId, req.params.projectId),
      ),
    );

  res.json({ success: true });
});

export default router;

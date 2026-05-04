import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core/columns/vector_extension/vector";

// ─── Projects ──────────────────────────────────────────────

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  path: text("path").notNull(),
  filesystemRoot: text("filesystem_root"),
  initialPrompt: text("initial_prompt"),
  embeddingsEnabled: boolean("embeddings_enabled").default(true).notNull(),
  // Per-project default agent for new conversations. Null means fall back
  // to the panel-side defaults wired in the project view.
  defaultAgent: text("default_agent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Documents ─────────────────────────────────────────────

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  path: text("path").notNull(),
  content: text("content").default("").notNull(),
  directory: text("directory").default("user").notNull(),
  createdBy: text("created_by"),
  lastEditedBy: text("last_edited_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Images ────────────────────────────────────────────────

export const images = pgTable("images", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  path: text("path").notNull(),
  mimeType: text("mime_type").default("image/png").notNull(),
  createdBy: text("created_by").notNull(),
  metadata: jsonb("metadata"), // { prompt, size, quality, model }
  // Single embedding per image (name + prompt is short enough that no
  // chunking is needed). Nullable so an image can exist before its embed
  // call lands; rows without an embedding are skipped by semantic search.
  embedding: vector("embedding", { dimensions: 1536 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Conversations ─────────────────────────────────────────

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").default("New Chat").notNull(),
  side: text("side"), // 'left' | 'right'
  model: text("model"), // model ID used in this conversation
  // Reasoning effort for this conversation. Sticky once changed: default
  // 'medium' on creation, the user can dial it via the prompt input dropdown
  // and the new value persists for follow-up messages until they change it.
  effort: text("effort").notNull().default("medium"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Messages (UIMessage-native format) ────────────────────
//
// Stores messages in Vercel AI SDK's UIMessage format directly.
// The `parts` column is a JSONB array preserving tool call ordering:
//
//   [
//     { "type": "text", "text": "Let me create that..." },
//     { "type": "tool-invocation", "toolCallId": "abc", "toolName": "CreateDocument",
//       "state": "output-available", "input": {...}, "output": {...} },
//     { "type": "text", "text": "Done!" }
//   ]
//
// No reconstruction or stitching needed — load from DB, send to frontend.

export const messages = pgTable("messages", {
  id: text("id").primaryKey(), // UIMessage.id — client-generated for user, server-generated for assistant
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user' | 'assistant' | 'system'
  parts: jsonb("parts").notNull(), // UIMessage.parts[] — ordered array
  metadata: jsonb("metadata"), // usage stats, model info, etc.
  orderIndex: integer("order_index").notNull(), // explicit ordering within conversation
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Document chunks (vector embeddings) ───────────────────
//
// Each row is a heading-aware chunk of a document plus its 1536-dim OpenAI
// embedding. Re-embedding a document is a delete-then-insert in a single
// transaction, so chunkIndex is only meaningful within a single embedding pass.
//
// FK CASCADE means deleting a doc (or its parent project) wipes its chunks.

export const documentChunks = pgTable("document_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  headingPath: jsonb("heading_path").notNull().default([]), // string[]
  text: text("text").notNull(),
  tokenCount: integer("token_count").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

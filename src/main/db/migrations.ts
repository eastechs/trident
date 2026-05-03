import type { PGlite } from '@electric-sql/pglite';

interface Migration {
  id: string;
  description: string;
  sql: string;
}

// Each migration runs exactly once per database, tracked in `_migrations`.
//
// Rules of engagement:
//   - Migrations are applied in array order. Don't reorder them.
//   - Once a migration is in use, NEVER edit it. Add a new one.
//   - Each id must be unique. Zero-padded numeric prefixes keep the array
//     visually sorted.
//   - Each migration's SQL runs inside a transaction so a partial failure
//     rolls back and leaves the migration unmarked.
const MIGRATIONS: Migration[] = [
  {
    id: '001_initial',
    description: 'Initial schema: projects, documents, images, conversations, messages',
    sql: `
      CREATE TABLE projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        path TEXT NOT NULL,
        filesystem_root TEXT,
        initial_prompt TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        directory TEXT NOT NULL DEFAULT 'user',
        created_by TEXT,
        last_edited_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE images (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        mime_type TEXT NOT NULL DEFAULT 'image/png',
        created_by TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT 'New Chat',
        side TEXT,
        model TEXT,
        effort TEXT NOT NULL DEFAULT 'medium',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        parts JSONB NOT NULL,
        metadata JSONB,
        order_index INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX idx_documents_project ON documents(project_id);
      CREATE INDEX idx_images_project ON images(project_id);
      CREATE INDEX idx_conversations_project ON conversations(project_id);
      CREATE INDEX idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX idx_messages_order ON messages(conversation_id, order_index);
    `,
  },
  {
    id: '002_embeddings',
    description: 'pgvector extension, document_chunks table, per-project embeddings toggle',
    sql: `
      CREATE EXTENSION IF NOT EXISTS vector;

      ALTER TABLE projects
        ADD COLUMN embeddings_enabled BOOLEAN NOT NULL DEFAULT TRUE;

      CREATE TABLE document_chunks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        heading_path JSONB NOT NULL DEFAULT '[]'::jsonb,
        text TEXT NOT NULL,
        token_count INTEGER NOT NULL,
        embedding VECTOR(1536) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX idx_document_chunks_document ON document_chunks(document_id);
      CREATE INDEX idx_document_chunks_embedding
        ON document_chunks USING hnsw (embedding vector_cosine_ops);
    `,
  },
  {
    id: '003_image_embeddings',
    description: 'Add nullable embedding column on images for semantic search',
    sql: `
      ALTER TABLE images
        ADD COLUMN embedding VECTOR(1536);

      CREATE INDEX idx_images_embedding
        ON images USING hnsw (embedding vector_cosine_ops);
    `,
  },
];

export async function runMigrations(pglite: PGlite): Promise<void> {
  // The tracking table must exist before we can read applied migrations.
  // Ironically the only "always-runs" SQL — bootstraps everything else.
  await pglite.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const applied = await pglite.query<{ id: string }>('SELECT id FROM _migrations');
  const appliedIds = new Set(applied.rows.map((r) => r.id));

  for (const migration of MIGRATIONS) {
    if (appliedIds.has(migration.id)) continue;

    console.log(`[migrations] Applying ${migration.id}: ${migration.description}`);

    await pglite.transaction(async (tx) => {
      await tx.exec(migration.sql);
      await tx.query('INSERT INTO _migrations (id) VALUES ($1)', [migration.id]);
    });
  }
}

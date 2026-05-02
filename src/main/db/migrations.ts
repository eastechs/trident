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
//   - Once a migration ships to a real user, NEVER edit it. Add a new one.
//   - Each id must be unique. Prefix numbers (zero-padded) keep the array
//     ordered visually too.
//   - Each migration's SQL runs inside a transaction so a partial failure
//     rolls back and leaves the migration marked unapplied.
//   - SQL should be idempotent where reasonable (IF NOT EXISTS) so a
//     pre-existing schema produced by the previous "run-everything-each-
//     boot" approach can be reconciled cleanly the first time the user
//     upgrades.
const MIGRATIONS: Migration[] = [
  {
    id: '001_initial',
    description: 'Initial schema: projects, documents, images, conversations, messages',
    sql: `
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        path TEXT NOT NULL,
        filesystem_root TEXT,
        initial_prompt TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS documents (
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

      CREATE TABLE IF NOT EXISTS images (
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

      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT 'New Chat',
        side TEXT,
        model TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        parts JSONB NOT NULL,
        metadata JSONB,
        order_index INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
      CREATE INDEX IF NOT EXISTS idx_images_project ON images(project_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_order ON messages(conversation_id, order_index);
    `,
  },
  {
    id: '002_conversation_effort',
    description: 'Per-conversation reasoning effort dial (low/medium/high/max)',
    sql: `
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS effort TEXT NOT NULL DEFAULT 'medium';
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

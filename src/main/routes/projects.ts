import { Router } from "express";
import { eq, desc, sql, and } from "drizzle-orm";
import fs from "fs";
import os from "os";
import path from "path";
import { shell } from "electron";
import { getDb } from "../database.js";
import {
  projects,
  documents,
  images,
  conversations,
  messages,
} from "../db/schema.js";
import { getConfiguredProviders, getSetting } from "../settings.js";

const router = Router();

// Normalize a project name for use as a filesystem directory name.
// Preserves the human-readable form (spaces, mixed case) and only strips
// characters that are unsafe on common filesystems.
function projectDirName(text: string): string {
  return (
    text
      .replace(/[/\\:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim() || "Untitled Project"
  );
}

function resolveProvider(modelId: string): string {
  if (modelId.startsWith("claude-")) return "anthropic";
  if (modelId.startsWith("gemini-")) return "gemini";
  return "openai";
}

type ProjectRow = typeof projects.$inferSelect;

function serializeProject(p: ProjectRow): Record<string, unknown> {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    path: p.path,
    filesystem_root: p.filesystemRoot,
    initial_prompt: p.initialPrompt,
    embeddings_enabled: p.embeddingsEnabled,
    default_agent: p.defaultAgent,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

// ─── List all projects ─────────────────────────────────────

router.get("/", async (_req, res) => {
  const db = getDb();

  const allProjects = await db
    .select()
    .from(projects)
    .orderBy(desc(projects.createdAt));

  const projectsPayload = await Promise.all(
    allProjects.map(async (project) => {
      const [docCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(documents)
        .where(eq(documents.projectId, project.id));
      const [imgCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(images)
        .where(eq(images.projectId, project.id));

      const usedModels = await db
        .selectDistinct({ model: conversations.model })
        .from(conversations)
        .where(eq(conversations.projectId, project.id));

      const usedProviders = usedModels
        .map((m) => m.model)
        .filter(Boolean)
        .map((model) => resolveProvider(model!))
        .filter((v, i, a) => a.indexOf(v) === i);

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        filesystem_root: project.filesystemRoot,
        path: project.path,
        created_at: project.createdAt,
        updated_at: project.updatedAt,
        document_count: docCount?.count ?? 0,
        image_count: imgCount?.count ?? 0,
        used_providers: usedProviders,
      };
    }),
  );

  res.json({
    projects: projectsPayload,
    configuredProviders: getConfiguredProviders(),
  });
});

// ─── Show project with related data ────────────────────────

router.get("/:id", async (req, res) => {
  const db = getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, req.params.id));
  if (!project) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const projectDocs = await db
    .select({
      id: documents.id,
      name: documents.name,
      createdBy: documents.createdBy,
      lastEditedBy: documents.lastEditedBy,
      directory: documents.directory,
    })
    .from(documents)
    .where(eq(documents.projectId, project.id));

  const projectImages = await db
    .select({
      id: images.id,
      name: images.name,
      createdBy: images.createdBy,
      mimeType: images.mimeType,
      metadata: images.metadata,
      createdAt: images.createdAt,
    })
    .from(images)
    .where(eq(images.projectId, project.id))
    .orderBy(desc(images.createdAt));

  const projectConversations = await db
    .select()
    .from(conversations)
    .where(eq(conversations.projectId, project.id))
    .orderBy(desc(conversations.updatedAt));

  const convoPayload = await Promise.all(
    projectConversations.map(async (c) => {
      const [count] = await db
        .select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(eq(messages.conversationId, c.id));
      return {
        id: c.id,
        project_id: c.projectId,
        title: c.title,
        side: c.side,
        model: c.model,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
        message_count: count?.count ?? 0,
      };
    }),
  );

  res.json({
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      path: project.path,
      filesystem_root: project.filesystemRoot,
      initial_prompt: project.initialPrompt,
      embeddings_enabled: project.embeddingsEnabled,
      default_agent: project.defaultAgent,
      created_at: project.createdAt,
      updated_at: project.updatedAt,
    },
    documents: projectDocs.map((d) => ({
      id: d.id,
      name: d.name,
      created_by: d.createdBy,
      last_edited_by: d.lastEditedBy,
      directory: d.directory,
    })),
    images: projectImages.map((i) => ({
      id: i.id,
      name: i.name,
      created_by: i.createdBy,
      mime_type: i.mimeType,
      metadata: i.metadata,
      created_at: i.createdAt,
    })),
    conversations: convoPayload,
    configuredProviders: getConfiguredProviders(),
    shouldShowTour: !getSetting("projectTourCompleted"),
  });
});

// ─── Store ─────────────────────────────────────────────────

router.post("/", async (req, res) => {
  const db = getDb();
  const { name, description, filesystem_root, initial_prompt } = req.body;

  const dirName = projectDirName(name);
  const directoryPath = `Trident/Projects/${dirName}`;
  const fullPath = path.join(os.homedir(), directoryPath);

  fs.mkdirSync(path.join(fullPath, "documents", "user"), { recursive: true });

  let resolvedRoot: string | null = null;
  if (filesystem_root) {
    try {
      const resolved = fs.realpathSync(filesystem_root);
      if (fs.statSync(resolved).isDirectory()) {
        resolvedRoot = resolved;
      }
    } catch {
      /* ignore */
    }
  }

  const [project] = await db
    .insert(projects)
    .values({
      name,
      description: description ?? "",
      path: directoryPath,
      filesystemRoot: resolvedRoot,
      initialPrompt: initial_prompt ?? null,
    })
    .returning();

  fs.writeFileSync(
    path.join(fullPath, "project.json"),
    JSON.stringify(
      {
        uuid: project.id,
        name: project.name,
        description: project.description,
        path: directoryPath,
      },
      null,
      2,
    ),
  );

  res.json(serializeProject(project));
});

// ─── Update ────────────────────────────────────────────────

router.patch("/:id", async (req, res) => {
  const db = getDb();
  const { name, description, filesystem_root, embeddings_enabled, default_agent } = req.body;

  const [existing] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, req.params.id));
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  let resolvedRoot: string | null = null;
  if (filesystem_root) {
    try {
      const resolved = fs.realpathSync(filesystem_root);
      if (fs.statSync(resolved).isDirectory()) {
        resolvedRoot = resolved;
      }
    } catch {
      /* ignore */
    }
  }

  // If the name changed, rename the project directory and update all paths
  let newProjectPath = existing.path;
  if (name && name !== existing.name) {
    const oldDirName = existing.path.split("/").pop() ?? "";
    let newDirName = projectDirName(name);
    let candidatePath = `Trident/Projects/${newDirName}`;
    let counter = 2;
    while (
      newDirName !== oldDirName &&
      fs.existsSync(path.join(os.homedir(), candidatePath))
    ) {
      newDirName = `${projectDirName(name)} (${counter})`;
      candidatePath = `Trident/Projects/${newDirName}`;
      counter++;
    }

    if (candidatePath !== existing.path) {
      const oldFullPath = path.join(os.homedir(), existing.path);
      const newFullPath = path.join(os.homedir(), candidatePath);

      try {
        if (fs.existsSync(oldFullPath)) {
          fs.renameSync(oldFullPath, newFullPath);
        }
      } catch (err) {
        console.error("Failed to rename project directory:", err);
        res.status(500).json({ error: "Failed to rename project directory" });
        return;
      }

      newProjectPath = candidatePath;

      // Update document and image paths that lived under the old project path
      const projectDocs = await db
        .select()
        .from(documents)
        .where(eq(documents.projectId, existing.id));
      for (const doc of projectDocs) {
        if (doc.path.startsWith(existing.path)) {
          await db
            .update(documents)
            .set({
              path: candidatePath + doc.path.substring(existing.path.length),
            })
            .where(eq(documents.id, doc.id));
        }
      }

      const projectImages = await db
        .select()
        .from(images)
        .where(eq(images.projectId, existing.id));
      for (const img of projectImages) {
        if (img.path.startsWith(existing.path)) {
          await db
            .update(images)
            .set({
              path: candidatePath + img.path.substring(existing.path.length),
            })
            .where(eq(images.id, img.id));
        }
      }
    }
  }

  const [updated] = await db
    .update(projects)
    .set({
      name,
      description: description ?? "",
      filesystemRoot: resolvedRoot,
      path: newProjectPath,
      ...(typeof embeddings_enabled === "boolean"
        ? { embeddingsEnabled: embeddings_enabled }
        : {}),
      // null/'' clears the project default; an explicit string id sets it.
      // undefined leaves the existing value untouched (PATCH semantics).
      ...(default_agent !== undefined
        ? { defaultAgent: default_agent || null }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(projects.id, req.params.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const fullPath = path.join(os.homedir(), updated.path);
  fs.writeFileSync(
    path.join(fullPath, "project.json"),
    JSON.stringify(
      {
        uuid: updated.id,
        name: updated.name,
        description: updated.description,
        path: updated.path,
      },
      null,
      2,
    ),
  );

  res.json(serializeProject(updated));
});

// ─── Duplicate ─────────────────────────────────────────────

router.post("/:id/duplicate", async (req, res) => {
  const db = getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, req.params.id));
  if (!project) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  let newName = `${project.name} Copy`;
  let newDirName = projectDirName(newName);
  let newPath = `Trident/Projects/${newDirName}`;
  let counter = 2;

  while (fs.existsSync(path.join(os.homedir(), newPath))) {
    newName = `${project.name} Copy ${counter}`;
    newDirName = projectDirName(newName);
    newPath = `Trident/Projects/${newDirName}`;
    counter++;
  }

  const srcDir = path.join(os.homedir(), project.path);
  const destDir = path.join(os.homedir(), newPath);
  fs.cpSync(srcDir, destDir, { recursive: true });

  const [newProject] = await db
    .insert(projects)
    .values({
      name: newName,
      description: project.description,
      path: newPath,
      filesystemRoot: project.filesystemRoot,
      initialPrompt: project.initialPrompt,
    })
    .returning();

  const projectDocs = await db
    .select()
    .from(documents)
    .where(eq(documents.projectId, project.id));
  for (const doc of projectDocs) {
    const newDocPath = newPath + doc.path.substring(project.path.length);
    await db.insert(documents).values({
      projectId: newProject.id,
      name: doc.name,
      path: newDocPath,
      content: doc.content,
      directory: doc.directory,
      createdBy: doc.createdBy,
      lastEditedBy: doc.lastEditedBy,
    });
  }

  const projectImages = await db
    .select()
    .from(images)
    .where(eq(images.projectId, project.id));
  for (const img of projectImages) {
    const newImgPath = newPath + img.path.substring(project.path.length);
    await db.insert(images).values({
      projectId: newProject.id,
      name: img.name,
      path: newImgPath,
      mimeType: img.mimeType,
      createdBy: img.createdBy,
      metadata: img.metadata,
    });
  }

  fs.writeFileSync(
    path.join(destDir, "project.json"),
    JSON.stringify(
      {
        uuid: newProject.id,
        name: newProject.name,
        description: newProject.description,
        path: newPath,
      },
      null,
      2,
    ),
  );

  res.json(serializeProject(newProject));
});

// ─── Destroy ───────────────────────────────────────────────

router.delete("/:id", async (req, res) => {
  const db = getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, req.params.id));
  if (!project) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const fullPath = path.join(os.homedir(), project.path);

  if (getSetting("useTrash")) {
    try {
      await shell.trashItem(fullPath);
    } catch {
      // Directory might not exist
    }
  } else {
    fs.rmSync(fullPath, { recursive: true, force: true });
  }

  await db.delete(projects).where(eq(projects.id, req.params.id));

  res.json({ success: true });
});

export default router;

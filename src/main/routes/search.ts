import { Router, type Request } from "express";
import { z } from "zod";
import {
  searchProject,
  searchImagesProject,
  NoOpenAIKeyError,
} from "../ai/embeddings.js";

const router = Router({ mergeParams: true });

type ProjectRequest = Request<{ projectId: string }>;

const searchBody = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().max(50).optional(),
});

// POST /api/projects/:projectId/search
//
// Returns ranked semantic results split into `documents` and `images`. The
// two are ranked independently (different corpora) so the UI can group or
// interleave however it wants. 409 + { error: 'no-openai-key' } when no key
// is configured so the UI can render its inline configure-key state without
// polling the settings endpoint.
router.post("/", async (req: ProjectRequest, res) => {
  const parse = searchBody.safeParse(req.body);
  if (!parse.success) {
    res.status(422).json({ error: "invalid-body", issues: parse.error.issues });
    return;
  }
  const { query, topK } = parse.data;

  try {
    const [documents, images] = await Promise.all([
      searchProject(req.params.projectId, query, { topK }),
      searchImagesProject(req.params.projectId, query, { topK }),
    ]);
    res.json({ documents, images });
  } catch (err) {
    if (err instanceof NoOpenAIKeyError) {
      res.status(409).json({ error: "no-openai-key" });
      return;
    }
    console.error("[search] failed:", err);
    res.status(500).json({ error: "search-failed" });
  }
});

export default router;

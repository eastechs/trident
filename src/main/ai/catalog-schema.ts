import { z } from "zod";

export const CATALOG_URL = "https://models.dev/api.json";
export const CATALOG_PROVIDERS = [
  "anthropic",
  "openai",
  "google",
  "amazon-bedrock",
  "google-vertex",
  "google-vertex-anthropic",
  "azure",
] as const;
export type CatalogProvider = (typeof CATALOG_PROVIDERS)[number];

const rate = z.number().finite().nonnegative();
const tokens = z.number().int().nonnegative();
const modelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  reasoning: z.boolean().optional(),
  tool_call: z.boolean().optional(),
  status: z.string().optional(),
  modalities: z
    .object({
      input: z.array(z.string()),
      output: z.array(z.string()),
    })
    .optional(),
  limit: z
    .object({ context: tokens.optional(), output: tokens.optional() })
    .optional(),
  cost: z
    .object({
      input: rate.optional(),
      output: rate.optional(),
      cache_read: rate.optional(),
      cache_write: rate.optional(),
    })
    .optional(),
});
export type CatalogModel = z.infer<typeof modelSchema>;
const providerSchema = z.object({
  models: z
    .record(modelSchema)
    .refine(
      (models) =>
        Object.keys(models).length > 0 &&
        Object.entries(models).every(([id, model]) => id === model.id),
      "Expected nonempty models keyed by their native IDs",
    ),
});
// Strip unused providers and fields with the same parser at build time and runtime.
export const catalogSchema = z.object({
  anthropic: providerSchema,
  openai: providerSchema,
  google: providerSchema,
  "amazon-bedrock": providerSchema,
  "google-vertex": providerSchema,
  "google-vertex-anthropic": providerSchema,
  azure: providerSchema,
});
export const snapshotSchema = z.object({
  source: z.literal(CATALOG_URL),
  fetched_at: z.string().datetime(),
  providers: catalogSchema,
});
export type CatalogSnapshot = z.infer<typeof snapshotSchema>;

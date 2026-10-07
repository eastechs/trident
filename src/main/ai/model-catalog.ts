import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { BUNDLED_CATALOG } from "./catalog/bundled-catalog.js";
import {
  CATALOG_URL,
  catalogSchema,
  snapshotSchema,
  type CatalogProvider,
} from "./catalog-schema.js";
import {
  capabilityModelIdFor,
  capabilitySlugForFamily,
  excludesOpenAIReasoning,
  isBedrockAnthropicModelId,
  modelFamilyFor,
  supportsImageInput,
  supportsReasoning,
  type ProviderId,
} from "./provider-config.js";

export interface ModelPricing {
  inputPerMTokens: number;
  outputPerMTokens: number;
  cacheReadPerMTokens?: number;
  cacheWritePerMTokens?: number;
}

let activeData = BUNDLED_CATALOG;
let initialization: Promise<void> | undefined;

export function initModelCatalog(): Promise<void> {
  return (initialization ??= (async () => {
    const cachePath = path.join(app.getPath("userData"), "model-catalog.json");
    try {
      const cached = snapshotSchema.parse(
        JSON.parse(await fs.readFile(cachePath, "utf8")),
      );
      if (Date.parse(cached.fetched_at) > Date.parse(activeData.fetched_at))
        activeData = cached;
    } catch {
      // Missing or invalid cache: the bundled snapshot is already available.
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(CATALOG_URL, {
        signal: controller.signal,
        headers: { "User-Agent": "Trident" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const providers = catalogSchema.parse(await response.json());
      activeData = {
        source: CATALOG_URL,
        fetched_at: new Date().toISOString(),
        providers,
      };
      await fs.writeFile(`${cachePath}.tmp`, JSON.stringify(activeData));
      await fs.rename(`${cachePath}.tmp`, cachePath);
    } catch (error) {
      console.warn(
        "[model-catalog] Refresh failed; retaining last valid catalog:",
        error,
      );
    } finally {
      clearTimeout(timeout);
    }
  })());
}

function catalogProvider(
  providerId: ProviderId,
  modelId: string,
  baseModelId?: string,
): CatalogProvider {
  if (providerId === "gemini") return "google";
  if (providerId === "bedrock") return "amazon-bedrock";
  if (providerId === "vertex") {
    return modelFamilyFor(modelId, baseModelId) === "anthropic"
      ? "google-vertex-anthropic"
      : "google-vertex";
  }
  return providerId;
}

export function lookupCatalogModel(
  providerId: ProviderId,
  modelId: string,
  baseModelId?: string,
) {
  const models =
    activeData.providers[catalogProvider(providerId, modelId, baseModelId)]
      .models;
  const roots = [
    modelId,
    baseModelId,
    capabilityModelIdFor(modelId, baseModelId),
  ].filter((id): id is string => !!id);
  // Exact native IDs win, including region-specific Bedrock entries.
  for (const id of roots) if (Object.hasOwn(models, id)) return models[id];
  const candidates = new Set<string>();
  for (const root of roots) {
    const unscoped = root.replace(
      /^(?:[a-z]{2}(?:-gov)?|apac|global)\.(?=anthropic\.)/,
      "",
    );
    for (const id of [root, unscoped]) {
      const revisionless = id
        .replace(/-v\d+(?::\d+)?$/, "")
        .replace(/@default$/, "");
      const undated = revisionless
        .replace(/(?:-|@)\d{8}$/, "")
        .replace(/-\d{4}-\d{2}-\d{2}$/, "");
      for (const variant of [id, revisionless, undated]) {
        candidates.add(variant);
        if (providerId === "bedrock" && variant.startsWith("claude-"))
          candidates.add(`anthropic.${variant}`);
        if (providerId === "vertex") {
          candidates.add(`${variant}@default`);
          candidates.add(variant.replace(/-(\d{8})$/, "@$1"));
        }
      }
    }
  }
  for (const id of candidates) if (Object.hasOwn(models, id)) return models[id];
  return undefined;
}

export function resolveModelMetadata(
  providerId: ProviderId,
  modelId: string,
  baseModelId?: string,
) {
  const model = lookupCatalogModel(providerId, modelId, baseModelId);
  const family = modelFamilyFor(modelId, baseModelId);
  const slug = capabilitySlugForFamily(family);
  const capabilityId = capabilityModelIdFor(modelId, baseModelId);
  // A reasoning flag does not imply that Trident's installed adapter can send
  // its effort controls. Keep unknown families and opaque Bedrock profiles safe.
  const reasoningAllowed =
    !!slug &&
    !(slug === "openai" && excludesOpenAIReasoning(capabilityId)) &&
    !(
      providerId === "bedrock" &&
      family === "anthropic" &&
      !isBedrockAnthropicModelId(modelId)
    );
  const cost = model?.cost;
  const pricing: ModelPricing | undefined =
    cost?.input != null && cost.output != null
      ? {
          inputPerMTokens: cost.input,
          outputPerMTokens: cost.output,
          ...(cost.cache_read != null
            ? { cacheReadPerMTokens: cost.cache_read }
            : {}),
          ...(cost.cache_write != null
            ? { cacheWritePerMTokens: cost.cache_write }
            : {}),
        }
      : undefined;
  return {
    name: model?.name,
    supportsReasoning:
      reasoningAllowed &&
      (model?.reasoning ?? supportsReasoning(capabilityId, slug!)),
    supportsImages: model?.modalities
      ? model.modalities.input.includes("image")
      : slug
        ? supportsImageInput(capabilityId, slug)
        : true,
    contextWindow: model?.limit?.context || undefined,
    maxOutputTokens: model?.limit?.output || undefined,
    pricing,
  };
}

export function fallbackCatalogModels(
  providerId: "anthropic" | "openai" | "gemini",
) {
  return Object.values(
    activeData.providers[catalogProvider(providerId, "")].models,
  ).filter(
    (model) =>
      model.status !== "deprecated" &&
      model.tool_call === true &&
      model.modalities?.output.includes("text") &&
      !model.modalities.output.includes("image"),
  );
}

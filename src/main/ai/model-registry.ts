import {
  getApiKey,
  getConfiguredProviders,
  getGatewayProviderModels,
} from "../settings.js";
import {
  PROVIDER_LABELS,
  capabilityModelIdFor,
  capabilitySlugForFamily,
  logoSlugForFamily,
  supportsImageInput,
  supportsReasoning,
  decodeGatewayModelRef,
  gatewayModelRef,
  isBedrockAnthropicModelId,
  isDirectProviderId,
  modelFamilyFor,
  type GatewayModelConfig,
  type ModelFamily,
  type ProviderId,
} from "./provider-config.js";

export interface ModelInfo {
  // Persisted reference. Direct models retain their native IDs; gateway
  // models use a provider-qualified, browser-decodable reference.
  id: string;
  providerId: ProviderId;
  modelId: string;
  baseModelId?: string;
  modelFamily: ModelFamily;
  provider: (typeof PROVIDER_LABELS)[ProviderId];
  // The logo reflects the underlying model family while `providerId` and
  // `provider` retain the connection grouping (for example, Vertex Claude).
  providerSlug: string;
  name: string;
  // True when the model exposes a reasoning/thinking knob the chat surfaces
  // as the effort selector. Hidden in the UI and skipped server-side when
  // false so we don't 4xx by sending reasoning_effort to a chat-only model.
  supportsReasoning: boolean;
  // True when the model accepts image file parts as conversational input.
  // This is separate from image generation: it controls whether saved project
  // images may be attached to a user message for visual analysis.
  supportsImages: boolean;
}

type ProviderKey = "anthropic" | "openai" | "gemini";

const FETCH_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 5 * 60_000;

const cache = new Map<ProviderKey, { at: number; models: ModelInfo[] }>();

// Intermediate row used by FALLBACK and the per-provider fetchers; the
// reasoning capability is stamped in one place after fetch so we don't
// have to repeat the predicate at every construction site.
type ModelDescriptor = Pick<ModelInfo, "id" | "provider" | "name"> &
  Partial<
    Pick<
      ModelInfo,
      "providerId" | "providerSlug" | "modelId" | "baseModelId" | "modelFamily"
    >
  >;

function directProviderIdForSlug(providerSlug: string): ProviderKey {
  if (providerSlug === "anthropic") return "anthropic";
  if (providerSlug === "google") return "gemini";
  return "openai";
}

function stampCapabilities(models: ModelDescriptor[]): ModelInfo[] {
  return models.map((model) => {
    const providerId =
      model.providerId ?? directProviderIdForSlug(model.providerSlug ?? "");
    const modelId = model.modelId ?? model.id;
    const capabilityModelId = capabilityModelIdFor(modelId, model.baseModelId);
    const modelFamily =
      model.modelFamily ?? modelFamilyFor(modelId, model.baseModelId);
    const capabilitySlug = capabilitySlugForFamily(modelFamily);
    const supportsModelReasoning = capabilitySlug
      ? supportsReasoning(capabilityModelId, capabilitySlug)
      : false;
    return {
      ...model,
      providerId,
      modelId,
      modelFamily,
      providerSlug: logoSlugForFamily(modelFamily, providerId),
      supportsReasoning:
        supportsModelReasoning &&
        !(
          providerId === "bedrock" &&
          modelFamily === "anthropic" &&
          !isBedrockAnthropicModelId(modelId)
        ),
      // Only claim a model can't accept images when the family is one whose
      // image support we can actually evaluate. A gateway deployment with an
      // opaque name — which is what an unclassifiable family means — may well
      // be vision-capable, and refusing on a guess makes that capability
      // unreachable. Reasoning stays conservative in the other direction:
      // omitting an optional parameter costs nothing, while sending one to a
      // chat-only model is an error.
      supportsImages: capabilitySlug
        ? supportsImageInput(capabilityModelId, capabilitySlug)
        : true,
    };
  });
}

/**
 * Hardcoded fallback — used when a provider's model-list API is unreachable or
 * the response can't be parsed. Kept as a last-known-good snapshot.
 */
const FALLBACK: Record<ProviderKey, ModelDescriptor[]> = {
  anthropic: [
    {
      id: "claude-opus-4-8",
      provider: "Anthropic",
      providerSlug: "anthropic",
      name: "Opus 4.8",
    },
    {
      id: "claude-opus-4-7",
      provider: "Anthropic",
      providerSlug: "anthropic",
      name: "Opus 4.7",
    },
    {
      id: "claude-sonnet-4-6",
      provider: "Anthropic",
      providerSlug: "anthropic",
      name: "Sonnet 4.6",
    },
    {
      id: "claude-haiku-4-5",
      provider: "Anthropic",
      providerSlug: "anthropic",
      name: "Haiku 4.5",
    },
  ],
  openai: [
    {
      id: "gpt-5.5",
      provider: "OpenAI",
      providerSlug: "openai",
      name: "GPT-5.5",
    },
    {
      id: "gpt-5-mini",
      provider: "OpenAI",
      providerSlug: "openai",
      name: "GPT-5 Mini",
    },
    {
      id: "gpt-5-nano",
      provider: "OpenAI",
      providerSlug: "openai",
      name: "GPT-5 Nano",
    },
  ],
  gemini: [
    {
      id: "gemini-3.1-pro-preview",
      provider: "Gemini",
      providerSlug: "google",
      name: "Gemini 3.1 Pro Preview",
    },
    {
      id: "gemini-3-flash-preview",
      provider: "Gemini",
      providerSlug: "google",
      name: "Gemini 3 Flash Preview",
    },
  ],
};

export async function fetchAvailableModels(): Promise<ModelInfo[]> {
  const providers: ProviderKey[] = ["anthropic", "openai", "gemini"];
  // Presence check only — listing models must not decrypt credentials.
  const stored = getConfiguredProviders();
  const configured = providers.filter((provider) => stored[provider]);

  const results = await Promise.all(
    configured.map(async (provider) => {
      const cached = cache.get(provider);
      if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        return cached.models;
      }

      const { models, isFallback } = await fetchForProvider(provider);
      // Don't cache fallback results — otherwise a brief provider outage
      // masks recovery for the full TTL after the next successful fetch.
      if (!isFallback) {
        cache.set(provider, { at: Date.now(), models });
      }
      return models;
    }),
  );

  const gatewayModels = (["bedrock", "vertex", "azure"] as const).flatMap(
    (providerId) => {
      const models = getGatewayProviderModels(providerId);
      if (!models) return [];

      // Names come from the base model when one is recorded, so several
      // deployments or profiles of the same model would otherwise be
      // indistinguishable in the picker. Qualify those with the ID that tells
      // them apart.
      const nameCounts = new Map<string, number>();
      for (const model of models) {
        const name = gatewayModelName(model);
        nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
      }

      return stampCapabilities(
        models.map((model) => {
          const name = gatewayModelName(model);
          return {
            id: gatewayModelRef(providerId, model),
            providerId,
            modelId: model.id,
            ...(model.baseModelId ? { baseModelId: model.baseModelId } : {}),
            modelFamily: modelFamilyFor(model.id, model.baseModelId),
            provider: PROVIDER_LABELS[providerId],
            name:
              (nameCounts.get(name) ?? 0) > 1 ? `${name} (${model.id})` : name,
          };
        }),
      );
    },
  );

  return [...results.flat(), ...gatewayModels];
}

export function invalidateModelCache(provider?: ProviderId): void {
  if (provider && isDirectProviderId(provider)) {
    cache.delete(provider);
  } else if (!provider) {
    cache.clear();
  }
}

// Sync display-name lookup. Used anywhere a human-readable model name is
// needed without going async (e.g. notification titles). Prefers a name from
// the in-memory registry cache (which mirrors what the dropdown shows), then
// falls back to a derivation from the model id, and finally returns the raw
// id if nothing else matches.
export function displayNameFor(modelId: string): string {
  for (const cached of cache.values()) {
    const m = cached.models.find((x) => x.id === modelId);
    if (m) return m.name;
  }
  const gateway = decodeGatewayModelRef(modelId);
  if (gateway) {
    const family = modelFamilyFor(gateway.id, gateway.baseModelId);
    return deriveGatewayName(
      capabilityModelIdFor(gateway.id, gateway.baseModelId),
      family,
    );
  }
  if (modelId.startsWith("claude-")) return deriveAnthropicName(modelId);
  if (modelId.startsWith("gemini-")) return deriveGeminiName(modelId);
  if (/^(gpt-|o\d)/.test(modelId)) return deriveOpenAIName(modelId);
  return modelId;
}

function gatewayModelName(model: GatewayModelConfig): string {
  return deriveGatewayName(
    capabilityModelIdFor(model.id, model.baseModelId),
    modelFamilyFor(model.id, model.baseModelId),
  );
}

function deriveGatewayName(id: string, family: ModelFamily): string {
  if (family === "anthropic") return deriveAnthropicName(id);
  if (family === "google") return deriveGeminiName(id);
  if (family === "openai") return deriveOpenAIName(id);
  return id
    .replace(/-v\d+(?::\d+)?$/, "")
    .split(/[._/:@-]+/)
    .filter(Boolean)
    .map(capitalize)
    .join(" ");
}

async function fetchForProvider(
  provider: ProviderKey,
): Promise<{ models: ModelInfo[]; isFallback: boolean }> {
  const key = getApiKey(provider);
  if (!key) return { models: [], isFallback: false };

  try {
    switch (provider) {
      case "anthropic":
        return {
          models: stampCapabilities(await fetchAnthropic(key)),
          isFallback: false,
        };
      case "openai":
        return {
          models: stampCapabilities(await fetchOpenAI(key)),
          isFallback: false,
        };
      case "gemini":
        return {
          models: stampCapabilities(await fetchGemini(key)),
          isFallback: false,
        };
    }
  } catch (err) {
    console.warn(
      `[model-registry] ${provider} fetch failed, using fallback:`,
      err,
    );
    return { models: stampCapabilities(FALLBACK[provider]), isFallback: true };
  }
}

// ─── Anthropic ──────────────────────────────────────────────

interface AnthropicModel {
  id: string;
  type: string;
  display_name?: string;
}

async function fetchAnthropic(key: string): Promise<ModelDescriptor[]> {
  const data = await getJson<{ data: AnthropicModel[] }>(
    "https://api.anthropic.com/v1/models?limit=1000",
    {
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
    },
  );

  return data.data
    .filter((m) => m.type === "model" && m.id.startsWith("claude-"))
    .map((m) => ({
      id: m.id,
      provider: "Anthropic" as const,
      providerSlug: "anthropic" as const,
      name:
        m.display_name?.replace(/^Claude\s+/i, "") ?? deriveAnthropicName(m.id),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function deriveAnthropicName(id: string): string {
  const family = id.includes("opus")
    ? "Opus"
    : id.includes("sonnet")
      ? "Sonnet"
      : id.includes("haiku")
        ? "Haiku"
        : "Claude";
  const versionMatch = id.match(/(\d+[-.]?\d*)/);
  const version = versionMatch ? versionMatch[1].replace(/-/g, ".") : "";
  return version ? `${family} ${version}` : family;
}

// ─── OpenAI ─────────────────────────────────────────────────

interface OpenAIModel {
  id: string;
  object: string;
}

async function fetchOpenAI(key: string): Promise<ModelDescriptor[]> {
  const data = await getJson<{ data: OpenAIModel[] }>(
    "https://api.openai.com/v1/models",
    {
      headers: { Authorization: `Bearer ${key}` },
    },
  );

  return data.data
    .filter((m) => isOpenAIChatModel(m.id))
    .map((m) => ({
      id: m.id,
      provider: "OpenAI" as const,
      providerSlug: "openai" as const,
      name: deriveOpenAIName(m.id),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function isOpenAIChatModel(id: string): boolean {
  // Include: gpt-N, o1/o3/o4/o5 reasoning models
  if (!/^(gpt-\d|o\d)/.test(id)) return false;

  // Exclude dated snapshots (YYYY-MM-DD or YYYYMMDD suffixes) — keep only family versions
  if (/-\d{4}-\d{2}-\d{2}$/.test(id)) return false;
  if (/-\d{8}$/.test(id)) return false;

  // Exclude non-chat variants
  const blocklist = [
    "instruct",
    "audio",
    "realtime",
    "transcribe",
    "tts",
    "whisper",
    "search",
    "embedding",
    "moderation",
    "image",
  ];
  if (blocklist.some((word) => id.includes(word))) return false;

  return true;
}

function deriveOpenAIName(id: string): string {
  if (id.startsWith("gpt-")) {
    // "gpt-5-mini" → "GPT-5 Mini"
    const rest = id.slice(4);
    return (
      "GPT-" +
      rest
        .split("-")
        .map((seg, i) => (i === 0 ? seg : capitalize(seg)))
        .join(" ")
    );
  }
  if (/^o\d/.test(id)) {
    // "o3-mini" → "o3 Mini"
    return id
      .split("-")
      .map((seg, i) => (i === 0 ? seg : capitalize(seg)))
      .join(" ");
  }
  return id;
}

// ─── Gemini ─────────────────────────────────────────────────

interface GeminiModel {
  name: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
}

function isGeminiChatModel(id: string): boolean {
  // Image generation models — `gemini-*-image-*` (e.g. gemini-2.5-flash-image,
  // gemini-3-flash-image-preview) and the marketing alias `nano-banana[*]`
  // (Google's image model codename) — share the generateContent method but
  // can't be used as conversational agents.
  if (id.includes("image")) return false;
  if (id.includes("nano-banana")) return false;
  // Vision/embedding/tts/aqa variants shouldn't appear in the chat picker.
  const blocklist = ["vision", "embedding", "tts", "aqa"];
  if (blocklist.some((word) => id.includes(word))) return false;
  return true;
}

async function fetchGemini(key: string): Promise<ModelDescriptor[]> {
  const url = new URL(
    "https://generativelanguage.googleapis.com/v1beta/models",
  );
  url.searchParams.set("key", key);
  url.searchParams.set("pageSize", "1000");

  const data = await getJson<{ models: GeminiModel[] }>(url.toString());

  return (
    data.models
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .filter((m) => m.name.includes("gemini"))
      // Image / vision-only models share the generateContent method but aren't
      // chat agents — gemini-*-image-*, the "nano-banana" image-gen aliases,
      // gemini-*-vision, etc. Exclude them so they don't pollute the picker.
      .filter((m) => isGeminiChatModel(m.name.replace(/^models\//, "")))
      .map((m) => {
        const id = m.name.replace(/^models\//, "");
        return {
          id,
          provider: "Gemini" as const,
          providerSlug: "google" as const,
          name: m.displayName ?? deriveGeminiName(id),
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id))
  );
}

function deriveGeminiName(id: string): string {
  // "gemini-3.1-pro-preview" → "Gemini 3.1 Pro Preview"
  if (!id.startsWith("gemini-")) return id;
  const rest = id.slice(7);
  return (
    "Gemini " +
    rest
      .split("-")
      .map((seg, i) => (i === 0 ? seg : capitalize(seg)))
      .join(" ")
  );
}

// ─── Helpers ────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

import { getApiKey } from "../settings.js";

export interface ModelInfo {
  id: string;
  provider: "Anthropic" | "OpenAI" | "Gemini";
  providerSlug: "anthropic" | "openai" | "google";
  name: string;
  // True when the model exposes a reasoning/thinking knob the chat surfaces
  // as the effort selector. Hidden in the UI and skipped server-side when
  // false so we don't 4xx by sending reasoning_effort to a chat-only model.
  supportsReasoning: boolean;
}

type ProviderKey = "anthropic" | "openai" | "gemini";

// Family-based capability check. Patterns:
//   - OpenAI: o-series (o1/o3/o4...) and the GPT-5 line all support
//     reasoning_effort. GPT-4 and earlier do not.
//   - Anthropic: extended thinking is on Claude 3.7 (legacy `claude-3-7-...`
//     ids) and the Claude 4+ family-first ids (`claude-(opus|sonnet|haiku)-N-x`).
//     Older claude-3-5-* / claude-2 / claude-instant don't support thinking.
//   - Gemini: thinking is on 2.5+ (and any 3+ family). Earlier 1.x / 2.0 don't.
export function supportsReasoning(
  modelId: string,
  providerSlug: "anthropic" | "openai" | "google",
): boolean {
  if (providerSlug === "openai") {
    return /^o\d/.test(modelId) || /^gpt-5/.test(modelId);
  }
  if (providerSlug === "anthropic") {
    return (
      /^claude-(opus|sonnet|haiku)-/.test(modelId) ||
      /^claude-3-7/.test(modelId)
    );
  }
  if (providerSlug === "google") {
    return /^gemini-(2[-.]5|[3-9])/.test(modelId);
  }
  return false;
}

const FETCH_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 5 * 60_000;

const cache = new Map<ProviderKey, { at: number; models: ModelInfo[] }>();

// Intermediate row used by FALLBACK and the per-provider fetchers; the
// reasoning capability is stamped in one place after fetch so we don't
// have to repeat the predicate at every construction site.
type ModelDescriptor = Omit<ModelInfo, "supportsReasoning">;

function stampCapabilities(models: ModelDescriptor[]): ModelInfo[] {
  return models.map((m) => ({
    ...m,
    supportsReasoning: supportsReasoning(m.id, m.providerSlug),
  }));
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
  const configured = providers.filter((p) => !!getApiKey(p));

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

  return results.flat();
}

export function invalidateModelCache(provider?: ProviderKey): void {
  if (provider) {
    cache.delete(provider);
  } else {
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
  if (modelId.startsWith("claude-")) return deriveAnthropicName(modelId);
  if (modelId.startsWith("gemini-")) return deriveGeminiName(modelId);
  if (/^(gpt-|o\d)/.test(modelId)) return deriveOpenAIName(modelId);
  return modelId;
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

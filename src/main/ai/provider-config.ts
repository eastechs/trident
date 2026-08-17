import { createHash } from "crypto";

export const PROVIDER_IDS = [
  "anthropic",
  "openai",
  "gemini",
  "bedrock",
  "vertex",
  "azure",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];
export type DirectProviderId = "anthropic" | "openai" | "gemini";
export type GatewayProviderId = "bedrock" | "vertex" | "azure";

export const DIRECT_PROVIDER_IDS: readonly DirectProviderId[] = [
  "anthropic",
  "openai",
  "gemini",
];
export const GATEWAY_PROVIDER_IDS: readonly GatewayProviderId[] = [
  "bedrock",
  "vertex",
  "azure",
];

export interface GatewayModelConfig {
  id: string;
  baseModelId?: string;
}

export const GATEWAY_MODEL_ID_MAX_LENGTH = 1_024;
export const GATEWAY_MODEL_COUNT_MAX = 100;

export function containsControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
}

export function isGatewayModelConfigArray(
  value: unknown,
): value is GatewayModelConfig[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > GATEWAY_MODEL_COUNT_MAX
  ) {
    return false;
  }

  const ids = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return false;
    }
    const model = entry as Record<string, unknown>;
    if (
      typeof model.id !== "string" ||
      model.id.length === 0 ||
      model.id.length > GATEWAY_MODEL_ID_MAX_LENGTH ||
      model.id.trim() !== model.id ||
      containsControlCharacters(model.id) ||
      ids.has(model.id)
    ) {
      return false;
    }
    if (
      model.baseModelId !== undefined &&
      (typeof model.baseModelId !== "string" ||
        model.baseModelId.length === 0 ||
        model.baseModelId.length > GATEWAY_MODEL_ID_MAX_LENGTH ||
        model.baseModelId.trim() !== model.baseModelId ||
        containsControlCharacters(model.baseModelId))
    ) {
      return false;
    }
    ids.add(model.id);
  }
  return true;
}

export interface BedrockProviderConfig {
  provider: "bedrock";
  authType: "accessKey" | "profile" | "apiKey";
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  apiKey?: string;
  models: GatewayModelConfig[];
}

export interface VertexProviderConfig {
  provider: "vertex";
  authType: "apiKey" | "serviceAccount" | "adc";
  apiKey?: string;
  serviceAccountJson?: string;
  project?: string;
  location: string;
  models: GatewayModelConfig[];
}

export interface AzureProviderConfig {
  provider: "azure";
  apiKey: string;
  endpoint: string;
  apiVersion?: string;
  deployments: GatewayModelConfig[];
}

export type GatewayProviderConfig =
  | BedrockProviderConfig
  | VertexProviderConfig
  | AzureProviderConfig;

export type ModelFamily =
  | "anthropic"
  | "openai"
  | "google"
  | "amazon"
  | "meta"
  | "mistral"
  | "cohere"
  | "deepseek"
  | "unknown";

export interface DecodedGatewayModelRef extends GatewayModelConfig {
  providerId: GatewayProviderId;
}

export interface ResolvedModelReference {
  id: string;
  providerId: ProviderId;
  modelId: string;
  baseModelId?: string;
  modelFamily: ModelFamily;
  capabilityModelId: string;
  agentBucket: string;
  author: string;
}

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Gemini",
  bedrock: "Amazon Bedrock",
  vertex: "Google Vertex AI",
  azure: "Azure OpenAI",
};

export const PROVIDER_LOGO_SLUGS: Record<ProviderId, string> = {
  anthropic: "anthropic",
  openai: "openai",
  gemini: "google",
  bedrock: "amazon-bedrock",
  vertex: "google-vertex",
  azure: "azure",
};

export function isProviderId(value: unknown): value is ProviderId {
  return (
    typeof value === "string" &&
    (PROVIDER_IDS as readonly string[]).includes(value)
  );
}

export function isDirectProviderId(value: unknown): value is DirectProviderId {
  return (
    typeof value === "string" &&
    (DIRECT_PROVIDER_IDS as readonly string[]).includes(value)
  );
}

export function isGatewayProviderId(
  value: unknown,
): value is GatewayProviderId {
  return (
    typeof value === "string" &&
    (GATEWAY_PROVIDER_IDS as readonly string[]).includes(value)
  );
}

function normalizedModelConfig(model: GatewayModelConfig): GatewayModelConfig {
  const id = model.id.trim();
  const baseModelId = model.baseModelId?.trim();
  return {
    id,
    ...(baseModelId ? { baseModelId } : {}),
  };
}

/**
 * Stable persisted reference for a model configured through a cloud gateway.
 * The JSON payload preserves provider-facing IDs exactly while base64url keeps
 * the reference browser-decodable and free of path separators.
 */
export function gatewayModelRef(
  providerId: GatewayProviderId,
  model: GatewayModelConfig,
): string {
  const normalized = normalizedModelConfig(model);
  const payload = {
    modelId: normalized.id,
    ...(normalized.baseModelId ? { baseModelId: normalized.baseModelId } : {}),
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  return `trident-${providerId}-${encoded}`;
}

export function decodeGatewayModelRef(
  value: string,
): DecodedGatewayModelRef | null {
  for (const providerId of GATEWAY_PROVIDER_IDS) {
    const prefix = `trident-${providerId}-`;
    if (!value.startsWith(prefix)) continue;

    const encoded = value.slice(prefix.length);
    if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;

    try {
      const parsed = JSON.parse(
        Buffer.from(encoded, "base64url").toString("utf8"),
      ) as Record<string, unknown>;
      if (typeof parsed.modelId !== "string" || !parsed.modelId.trim()) {
        return null;
      }
      if (
        parsed.baseModelId !== undefined &&
        (typeof parsed.baseModelId !== "string" || !parsed.baseModelId.trim())
      ) {
        return null;
      }

      const decoded = {
        providerId,
        id: parsed.modelId.trim(),
        ...(typeof parsed.baseModelId === "string"
          ? { baseModelId: parsed.baseModelId.trim() }
          : {}),
      };

      // Enforce one canonical serialization so equivalent forged refs cannot
      // create multiple identities for the same configured gateway model.
      return gatewayModelRef(providerId, decoded) === value ? decoded : null;
    } catch {
      return null;
    }
  }

  return null;
}

export function modelsForGatewayConfig(
  config: GatewayProviderConfig,
): GatewayModelConfig[] {
  return config.provider === "azure" ? config.deployments : config.models;
}

/**
 * Whether a persisted reference still points at a configured model.
 *
 * Identity is the provider-facing model ID alone. baseModelId is carried in
 * the reference only to resolve capabilities and pricing, so editing or
 * clearing it must not orphan conversations already pinned to the model:
 * matching the whole encoded reference would make any such edit permanently
 * unroutable for existing conversations.
 */
export function gatewayConfiguredModel(
  config: GatewayProviderConfig,
  modelReference: string,
): GatewayModelConfig | undefined {
  const decoded = decodeGatewayModelRef(modelReference);
  if (!decoded || decoded.providerId !== config.provider) return undefined;
  return modelsForGatewayConfig(config)
    .map(normalizedModelConfig)
    .find((model) => model.id === decoded.id);
}

export function gatewayConfigHasModelReference(
  config: GatewayProviderConfig,
  modelReference: string,
): boolean {
  return gatewayConfiguredModel(config, modelReference) !== undefined;
}

export function directProviderForModelId(modelId: string): DirectProviderId {
  if (modelId.startsWith("claude-")) return "anthropic";
  if (modelId.startsWith("gemini-")) return "gemini";
  return "openai";
}

export function modelFamilyFor(
  modelId: string,
  baseModelId?: string,
): ModelFamily {
  const familyForId = (value: string): ModelFamily => {
    const id = value.toLowerCase();
    if (id.startsWith("claude-") || id.includes("anthropic.claude")) {
      return "anthropic";
    }
    if (
      id.startsWith("gemini-") ||
      id.includes("/gemini-") ||
      id.startsWith("imagen-")
    ) {
      return "google";
    }
    if (
      /^(gpt-|o\d)/.test(id) ||
      id.includes("openai.gpt") ||
      id.includes("/gpt-")
    ) {
      return "openai";
    }
    if (
      id.includes("amazon.") ||
      id.includes("nova-") ||
      id.includes("titan-")
    ) {
      return "amazon";
    }
    if (id.includes("meta.") || id.includes("llama")) return "meta";
    if (id.includes("mistral")) return "mistral";
    if (id.includes("cohere") || id.includes("command-r")) return "cohere";
    if (id.includes("deepseek")) return "deepseek";
    return "unknown";
  };

  const modelFamily = familyForId(modelId);
  const baseFamily = baseModelId ? familyForId(baseModelId) : "unknown";
  // Vertex's Anthropic adapter is selected when either the provider-facing
  // model ID or its canonical base model identifies Claude.
  if (modelFamily === "anthropic" || baseFamily === "anthropic") {
    return "anthropic";
  }
  return baseFamily !== "unknown" ? baseFamily : modelFamily;
}

function isAnthropicModel(modelId: string, baseModelId?: string): boolean {
  return (
    modelFamilyFor(modelId) === "anthropic" ||
    (!!baseModelId && modelFamilyFor(baseModelId) === "anthropic")
  );
}

/**
 * Which Vertex serving surface a model is reached through. Google's own
 * publishers use the Gemini surface and Claude uses Anthropic's, both under
 * `publishers/<name>`. Partner (Model-as-a-Service) families are served from a
 * separate OpenAI-compatible endpoint and are not reachable under
 * `publishers/google` at all.
 *
 * Unrecognized IDs stay on the Gemini surface: that is where Vertex's own
 * model IDs live, so it is the safer default for an ID we cannot classify.
 */
export type VertexSurface = "gemini" | "anthropic" | "partner";

const VERTEX_PARTNER_FAMILIES: readonly ModelFamily[] = [
  "meta",
  "mistral",
  "deepseek",
  "cohere",
];

export function vertexSurfaceFor(
  modelId: string,
  baseModelId?: string,
): VertexSurface {
  if (isAnthropicModel(modelId, baseModelId)) return "anthropic";
  return VERTEX_PARTNER_FAMILIES.includes(modelFamilyFor(modelId, baseModelId))
    ? "partner"
    : "gemini";
}

export function capabilityModelIdFor(
  modelId: string,
  baseModelId?: string,
): string {
  let id = (baseModelId || modelId).trim();
  id = id.replace(/^(?:us|eu|apac|global)\./, "");
  const anthropicMarker = "anthropic.";
  const markerIndex = id.indexOf(anthropicMarker);
  if (markerIndex >= 0) id = id.slice(markerIndex + anthropicMarker.length);
  return id.replace(/@(?=\d{8}$)/, "-");
}

function readableModelName(modelId: string, baseModelId?: string): string {
  return capabilityModelIdFor(modelId, baseModelId)
    .replace(/-v\d+(?::\d+)?$/, "")
    .replace(/[._/@:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Document bucket for a gateway model. Derived from the connection and the
 * provider-facing model ID only — never baseModelId — so that editing the
 * capability hint on an existing connection leaves the agent's own documents
 * where it can still find them.
 */
function gatewayAgentBucket(
  providerId: GatewayProviderId,
  modelId: string,
): string {
  const readable = readableModelName(modelId)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const digest = createHash("sha256")
    .update(`${providerId}:${modelId}`)
    .digest("hex")
    .slice(0, 12);
  return `${providerId}-${readable || "model"}-${digest}`;
}

export function resolvedDirectModelReference(
  modelId: string,
): ResolvedModelReference {
  const providerId = directProviderForModelId(modelId);
  const family = modelFamilyFor(modelId);
  return {
    id: modelId,
    providerId,
    modelId,
    modelFamily: family,
    capabilityModelId: capabilityModelIdFor(modelId),
    // Preserve existing document buckets and authors for direct-provider data.
    agentBucket: modelId,
    author: modelId,
  };
}

export function resolvedGatewayModelReference(
  decoded: DecodedGatewayModelRef,
): ResolvedModelReference {
  const id = gatewayModelRef(decoded.providerId, decoded);
  const readable = readableModelName(decoded.id, decoded.baseModelId);
  return {
    id,
    providerId: decoded.providerId,
    modelId: decoded.id,
    ...(decoded.baseModelId ? { baseModelId: decoded.baseModelId } : {}),
    modelFamily: modelFamilyFor(decoded.id, decoded.baseModelId),
    capabilityModelId: capabilityModelIdFor(decoded.id, decoded.baseModelId),
    agentBucket: gatewayAgentBucket(decoded.providerId, decoded.id),
    author: `${PROVIDER_LABELS[decoded.providerId]} / ${readable || decoded.id}`,
  };
}

export function normalizeAzureEndpoint(endpoint: string): string {
  const parsed = new URL(endpoint.trim());
  parsed.hash = "";
  parsed.search = "";
  let pathname = parsed.pathname.replace(/\/+$/, "");
  if (pathname.endsWith("/v1")) pathname = pathname.slice(0, -3);
  if (!pathname && parsed.hostname.endsWith(".openai.azure.com")) {
    pathname = "/openai";
  }
  parsed.pathname = pathname;
  return parsed.toString().replace(/\/$/, "");
}

export function bedrockRuntimeEndpoint(region: string): string {
  const suffix = region.startsWith("cn-")
    ? "amazonaws.com.cn"
    : "amazonaws.com";
  return `https://bedrock-runtime.${region}.${suffix}`;
}

// Adaptive thinking (`type: "adaptive"`) and the companion effort knob arrived
// with the Claude 4.5 generation. Earlier thinking-capable models — Claude 3.7
// and the 4.0/4.1 family — only accept budget-based extended thinking and
// reject the adaptive shape. Budget-based thinking is accepted by every
// thinking-capable Claude, so returning false here is always the safe answer.
// Expects a capability model ID (see capabilityModelIdFor).
export function supportsAdaptiveThinking(capabilityModelId: string): boolean {
  const match = capabilityModelId.match(
    /^claude-(?:opus|sonnet|haiku)-(\d+)(?:-(\d{1,2}))?(?:-|$)/,
  );
  if (!match) return false;
  const major = Number(match[1]);
  const minor = match[2] ? Number(match[2]) : 0;
  return major > 4 || (major === 4 && minor >= 5);
}

// The installed Bedrock adapter selects Anthropic's request shape from the
// provider-facing model ID. An opaque inference-profile alias cannot safely
// receive Claude-specific reasoning options even when baseModelId identifies
// the underlying family.
export function isBedrockAnthropicModelId(modelId: string): boolean {
  return modelId.toLowerCase().includes("anthropic");
}

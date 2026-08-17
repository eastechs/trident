import type { ModelInfo } from "@/types/api";

export type ModelReferenceInfo = {
  providerId:
    | "anthropic"
    | "openai"
    | "gemini"
    | "bedrock"
    | "vertex"
    | "azure";
  providerSlug:
    | "anthropic"
    | "openai"
    | "google"
    | "amazon-bedrock"
    | "google-vertex"
    | "azure";
  modelId: string;
  baseModelId?: string;
};

const GATEWAY_META = {
  bedrock: { prefix: "trident-bedrock-", providerSlug: "amazon-bedrock" },
  vertex: { prefix: "trident-vertex-", providerSlug: "google-vertex" },
  azure: { prefix: "trident-azure-", providerSlug: "azure" },
} as const;

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(padded), (character) =>
    character.charCodeAt(0),
  );
  return new TextDecoder().decode(bytes);
}

export function parseModelReference(modelRef: string): ModelReferenceInfo {
  for (const [providerId, meta] of Object.entries(GATEWAY_META) as Array<
    [
      keyof typeof GATEWAY_META,
      (typeof GATEWAY_META)[keyof typeof GATEWAY_META],
    ]
  >) {
    if (!modelRef.startsWith(meta.prefix)) continue;

    try {
      const parsed = JSON.parse(
        decodeBase64Url(modelRef.slice(meta.prefix.length)),
      ) as { modelId?: unknown; baseModelId?: unknown };
      if (typeof parsed.modelId === "string" && parsed.modelId) {
        return {
          providerId,
          providerSlug: meta.providerSlug,
          modelId: parsed.modelId,
          ...(typeof parsed.baseModelId === "string" && parsed.baseModelId
            ? { baseModelId: parsed.baseModelId }
            : {}),
        };
      }
    } catch {
      break;
    }
  }

  if (modelRef.startsWith("claude-")) {
    return {
      providerId: "anthropic",
      providerSlug: "anthropic",
      modelId: modelRef,
    };
  }
  if (modelRef.startsWith("gemini-")) {
    return {
      providerId: "gemini",
      providerSlug: "google",
      modelId: modelRef,
    };
  }
  return {
    providerId: "openai",
    providerSlug: "openai",
    modelId: modelRef,
  };
}

const PROVIDER_LABELS: Record<
  ModelReferenceInfo["providerId"],
  ModelInfo["provider"]
> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Gemini",
  bedrock: "Amazon Bedrock",
  vertex: "Google Vertex AI",
  azure: "Azure OpenAI",
};

/**
 * Stand-in entry for a model reference the fetched list doesn't contain, so a
 * conversation pinned to it stays usable. Capabilities are reported as absent
 * because nothing here can establish them; the server is the authority on
 * whether the reference still routes.
 */
export function placeholderModelInfo(modelRef: string): ModelInfo {
  const parsed = parseModelReference(modelRef);
  return {
    id: modelRef,
    providerId: parsed.providerId,
    modelId: parsed.modelId,
    ...(parsed.baseModelId ? { baseModelId: parsed.baseModelId } : {}),
    provider: PROVIDER_LABELS[parsed.providerId],
    providerSlug: parsed.providerSlug,
    name: modelReferenceDisplayName(modelRef),
    supportsReasoning: false,
    supportsImages: false,
  };
}

// Gateway document buckets are built as <provider>-<readable>-<digest>.
const GATEWAY_BUCKET = /^(bedrock|vertex|azure)-(.+)-[0-9a-f]{12}$/;

/**
 * Human-readable heading for a group of documents. Documents are filed under
 * whoever created them: the person, a direct model ID, or a generated bucket
 * for a gateway model. That bucket is a storage key rather than a name, so
 * unpack it instead of showing the raw slug.
 */
export function documentDirectoryLabel(directory: string): string {
  if (directory === "user") return "Your Documents";

  const bucket = GATEWAY_BUCKET.exec(directory);
  if (!bucket) return modelReferenceDisplayName(directory);

  const providerId = bucket[1] as "bedrock" | "vertex" | "azure";
  return `${PROVIDER_LABELS[providerId]} · ${modelReferenceDisplayName(bucket[2])}`;
}

function capitalize(value: string): string {
  return value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;
}

export function modelReferenceDisplayName(modelRef: string): string {
  const parsed = parseModelReference(modelRef);
  let modelId = parsed.baseModelId ?? parsed.modelId;

  // Strip cloud routing prefixes before deriving a human-readable family.
  modelId = modelId.replace(/^(?:global|us|eu|apac)\./, "");
  modelId = modelId.replace(/^(?:anthropic|amazon|meta|mistral|cohere)\./, "");

  if (modelId.startsWith("claude-")) {
    return modelId
      .slice("claude-".length)
      .replace(/-v\d+(?::\d+)?$/, "")
      .split("-")
      .map(capitalize)
      .join(" ");
  }
  if (modelId.startsWith("gpt-")) {
    const [version, ...rest] = modelId.slice("gpt-".length).split("-");
    return `GPT-${version}${rest.length > 0 ? ` ${rest.map(capitalize).join(" ")}` : ""}`;
  }
  if (modelId.startsWith("gemini-")) {
    return `Gemini ${modelId
      .slice("gemini-".length)
      .split("-")
      .map(capitalize)
      .join(" ")}`;
  }

  return modelId;
}

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

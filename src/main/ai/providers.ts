import { createHash } from "crypto";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createAzure } from "@ai-sdk/azure";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createVertex } from "@ai-sdk/google-vertex";
import { createVertexAnthropic } from "@ai-sdk/google-vertex/anthropic";
import { createVertexMaas } from "@ai-sdk/google-vertex/maas";
import { createOpenAI } from "@ai-sdk/openai";
import type { ProviderOptions } from "@ai-sdk/provider-utils";
import type { LanguageModel } from "ai";
import { getApiKey, getGatewayProviderConfig } from "../settings.js";
import {
  bedrockRuntimeEndpoint,
  containsControlCharacters,
  decodeGatewayModelRef,
  gatewayConfiguredModel,
  isBedrockAnthropicModelId,
  resolvedDirectModelReference,
  resolvedGatewayModelReference,
  supportsAdaptiveThinking,
  vertexSurfaceFor,
  type GatewayProviderConfig,
  type GatewayProviderId,
  type ProviderId,
  type ResolvedModelReference,
  type VertexProviderConfig,
} from "./provider-config.js";
import { supportsReasoning } from "./model-registry.js";

export const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];
export const DEFAULT_EFFORT: EffortLevel = "medium";

export function isEffortLevel(value: unknown): value is EffortLevel {
  return (
    typeof value === "string" &&
    (EFFORT_LEVELS as readonly string[]).includes(value)
  );
}

export type ProviderName = ProviderId;

export class ModelReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelReferenceError";
  }
}

/**
 * Resolves persisted model identity and rejects route-qualified references
 * unless their exact provider/model pair is still configured. This prevents a
 * client from forging a Bedrock, Vertex, or Azure route in the request body.
 */
export function resolveModelReference(
  modelReference: string,
): ResolvedModelReference {
  if (
    !modelReference ||
    modelReference.length > 16_384 ||
    containsControlCharacters(modelReference)
  ) {
    throw new ModelReferenceError("The selected model reference is invalid.");
  }

  const decoded = decodeGatewayModelRef(modelReference);
  if (decoded) {
    const config = getGatewayProviderConfig(decoded.providerId);
    if (!config) {
      throw new ModelReferenceError(
        `The ${decoded.providerId} provider is not configured.`,
      );
    }
    const configured = gatewayConfiguredModel(config, modelReference);
    if (!configured) {
      throw new ModelReferenceError(
        "The selected gateway model is not configured.",
      );
    }
    // Resolve from the current configuration rather than the persisted
    // reference so an edited capability hint takes effect on conversations
    // that were pinned before the edit.
    return resolvedGatewayModelReference({
      providerId: decoded.providerId,
      ...configured,
    });
  }

  // A route-looking value that does not decode canonically must never fall
  // through to OpenAI as a legacy direct model ID.
  if (modelReference.startsWith("trident-")) {
    throw new ModelReferenceError("The selected gateway model is invalid.");
  }

  // Direct IDs are also used as legacy document directory names, so keep the
  // existing raw form while rejecting path separators and unsafe segments.
  if (
    modelReference.length > 255 ||
    modelReference === "." ||
    modelReference === ".." ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(modelReference) ||
    /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(modelReference)
  ) {
    throw new ModelReferenceError("The selected direct model ID is invalid.");
  }
  return resolvedDirectModelReference(modelReference);
}

export function resolveProviderName(modelReference: string): ProviderName {
  return resolveModelReference(modelReference).providerId;
}

// Re-exported so existing callers keep importing from one place. The
// underlying lookup lives in model-registry where the live cache of
// API-returned model names already exists.
export { displayNameFor as modelLabel } from "./model-registry.js";

function vertexGoogleAuthOptions(config: VertexProviderConfig) {
  if (config.authType !== "serviceAccount") return undefined;
  return {
    credentials: JSON.parse(config.serviceAccountJson!) as Record<
      string,
      unknown
    >,
  };
}

type GatewayClient = (modelId: string) => LanguageModel;

/**
 * Gateway SDK clients are cached per connection because they own the
 * credential state that makes repeat requests cheap: the AWS provider chain
 * memoizes resolved credentials on the instance, and the Vertex SDK keys its
 * GoogleAuth — and therefore its OAuth token cache — on the identity of the
 * auth options object it was given. Rebuilding a client per request throws all
 * of that away, so every message re-read the AWS credential chain, or minted a
 * fresh access token before it could call the model.
 *
 * Keyed by a digest of the resolved configuration, so editing a connection
 * builds a new client and the old one is dropped.
 */
const gatewayClients = new Map<
  GatewayProviderId,
  { configDigest: string; clients: Map<string, GatewayClient> }
>();

function gatewayClient(
  providerId: GatewayProviderId,
  config: GatewayProviderConfig,
  surface: string,
  build: () => GatewayClient,
): GatewayClient {
  const configDigest = createHash("sha256")
    .update(JSON.stringify(config))
    .digest("hex");

  let entry = gatewayClients.get(providerId);
  if (!entry || entry.configDigest !== configDigest) {
    entry = { configDigest, clients: new Map() };
    gatewayClients.set(providerId, entry);
  }

  let client = entry.clients.get(surface);
  if (!client) {
    client = build();
    entry.clients.set(surface, client);
  }
  return client;
}

export function resolveModel(modelReference: string): LanguageModel {
  const resolved = resolveModelReference(modelReference);

  if (resolved.providerId === "anthropic") {
    const key = getApiKey("anthropic");
    if (!key) throw new ModelReferenceError("Anthropic API key not configured");
    return createAnthropic({ apiKey: key })(resolved.modelId);
  }

  if (resolved.providerId === "gemini") {
    const key = getApiKey("gemini");
    if (!key) throw new ModelReferenceError("Gemini API key not configured");
    return createGoogleGenerativeAI({ apiKey: key })(resolved.modelId);
  }

  if (resolved.providerId === "openai") {
    const key = getApiKey("openai");
    if (!key) throw new ModelReferenceError("OpenAI API key not configured");
    return createOpenAI({ apiKey: key })(resolved.modelId);
  }

  const config = getGatewayProviderConfig(resolved.providerId);
  if (!config) {
    throw new ModelReferenceError(
      `The ${resolved.providerId} provider is not configured.`,
    );
  }

  if (config.provider === "bedrock") {
    return gatewayClient(config.provider, config, "bedrock", () => {
      const common = {
        region: config.region,
        baseURL: bedrockRuntimeEndpoint(config.region),
      };
      if (config.authType === "apiKey") {
        return createAmazonBedrock({ ...common, apiKey: config.apiKey });
      }
      if (config.authType === "profile") {
        return createAmazonBedrock({
          ...common,
          credentialProvider: fromNodeProviderChain(),
        });
      }
      return createAmazonBedrock({
        ...common,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        ...(config.sessionToken ? { sessionToken: config.sessionToken } : {}),
      });
    })(resolved.modelId);
  }

  if (config.provider === "vertex") {
    const surface = vertexSurfaceFor(resolved.modelId, resolved.baseModelId);
    // Neither Anthropic nor the partner endpoint is reachable with an
    // Express-mode API key.
    if (surface !== "gemini" && config.authType === "apiKey") {
      throw new ModelReferenceError(
        surface === "anthropic"
          ? "Vertex Claude models require service-account or application-default credentials."
          : "Vertex partner models require service-account or application-default credentials.",
      );
    }

    return gatewayClient(config.provider, config, surface, () => {
      // Built once per connection so the SDK keeps reusing one GoogleAuth,
      // and with it one cached access token.
      const authOptions = vertexGoogleAuthOptions(config);
      const common = {
        ...(config.authType !== "apiKey" ? { project: config.project! } : {}),
        location: config.location,
        ...(authOptions ? { googleAuthOptions: authOptions } : {}),
      };
      if (surface === "anthropic") return createVertexAnthropic(common);
      if (surface === "partner") return createVertexMaas(common);
      return createVertex({
        ...common,
        ...(config.authType === "apiKey" ? { apiKey: config.apiKey } : {}),
      });
    })(resolved.modelId);
  }

  return gatewayClient(config.provider, config, "azure", () =>
    createAzure({
      apiKey: config.apiKey,
      baseURL: config.endpoint,
      ...(config.apiVersion ? { apiVersion: config.apiVersion } : {}),
      useDeploymentBasedUrls: false,
    }),
  )(resolved.modelId);
}

/** Map the unified effort level to each provider's accepted range. */
function effortToOpenAI(
  level: EffortLevel,
): "low" | "medium" | "high" | "xhigh" {
  return level === "max" ? "xhigh" : level;
}

function effortToGemini(level: EffortLevel): "low" | "medium" | "high" {
  if (level === "max" || level === "xhigh") return "high";
  return level;
}

/**
 * Token budgets for models that predate adaptive thinking. Both the Anthropic
 * and Bedrock adapters add the budget on top of the request's max output
 * tokens, so these stay well inside the smallest thinking-capable model's
 * output ceiling.
 */
const THINKING_BUDGET_BY_EFFORT: Record<EffortLevel, number> = {
  low: 4_096,
  medium: 8_192,
  high: 16_384,
  xhigh: 24_576,
  max: 32_768,
};

/**
 * Anthropic-shaped thinking options for a Claude model, whatever route it is
 * reached through. Claude 4.5 and newer take adaptive thinking plus the effort
 * knob; older thinking-capable models reject that shape and take an explicit
 * budget instead.
 */
function anthropicThinkingOptions(
  capabilityModelId: string,
  effort: EffortLevel,
): Record<string, unknown> {
  if (supportsAdaptiveThinking(capabilityModelId)) {
    return {
      thinking: { type: "adaptive", display: "summarized" },
      effort,
    };
  }
  return {
    thinking: {
      type: "enabled",
      budgetTokens: THINKING_BUDGET_BY_EFFORT[effort],
    },
  };
}

/**
 * Whether the route reaches Anthropic's own request builder, which is what
 * turns `providerOptions.anthropic.cacheControl` into a prompt-cache
 * breakpoint. Direct Anthropic and Vertex Claude share that builder, so both
 * honor the markers.
 *
 * Bedrock is deliberately excluded: its adapter builds a Converse request and
 * takes cache points through `providerOptions.bedrock.cachePoint` instead,
 * with its own per-model token minimums. Anthropic-shaped markers are dropped
 * there rather than misapplied.
 */
export function supportsAnthropicCacheControl(
  resolved: ResolvedModelReference,
): boolean {
  if (resolved.providerId === "anthropic") return true;
  return (
    resolved.providerId === "vertex" && resolved.modelFamily === "anthropic"
  );
}

function reasoningSupported(resolved: ResolvedModelReference): boolean {
  if (resolved.modelFamily === "anthropic") {
    return supportsReasoning(resolved.capabilityModelId, "anthropic");
  }
  if (resolved.modelFamily === "openai") {
    return supportsReasoning(resolved.capabilityModelId, "openai");
  }
  if (resolved.modelFamily === "google") {
    return supportsReasoning(resolved.capabilityModelId, "google");
  }
  return false;
}

/**
 * Per-provider options applied to chat calls. Gateway options are deliberately
 * conservative: only the options supported by their installed SDK adapter are
 * sent, and direct-provider cache/context behavior remains unchanged.
 */
export function getProviderOptions(
  modelReference: string,
  context?: { projectId?: string; effort?: EffortLevel },
): ProviderOptions {
  const resolved = resolveModelReference(modelReference);
  const provider = resolved.providerId;
  const effort = context?.effort ?? DEFAULT_EFFORT;
  const reasoningOk = reasoningSupported(resolved);

  if (provider === "anthropic") {
    return {
      anthropic: {
        ...(reasoningOk
          ? anthropicThinkingOptions(resolved.capabilityModelId, effort)
          : {}),
        sendReasoning: true,
        contextManagement: {
          edits: [
            {
              type: "clear_tool_uses_20250919",
              trigger: { type: "input_tokens", value: 100_000 },
              keep: { type: "tool_uses", value: 20 },
            },
          ],
        },
      },
    };
  }

  if (provider === "openai") {
    return {
      openai: {
        ...(reasoningOk
          ? {
              reasoningEffort: effortToOpenAI(effort),
              reasoningSummary: "auto",
            }
          : {}),
        truncation: "auto",
        promptCacheRetention: "24h",
        ...(context?.projectId ? { promptCacheKey: context.projectId } : {}),
      },
    };
  }

  if (provider === "gemini") {
    if (!reasoningOk) return {};
    return {
      google: {
        thinkingConfig: {
          thinkingLevel: effortToGemini(effort),
          includeThoughts: true,
        },
      },
    };
  }

  if (provider === "bedrock") {
    if (
      !reasoningOk ||
      (resolved.modelFamily === "anthropic" &&
        !isBedrockAnthropicModelId(resolved.modelId))
    ) {
      return {};
    }
    if (resolved.modelFamily !== "anthropic") {
      return { bedrock: { reasoningConfig: { maxReasoningEffort: effort } } };
    }
    // maxReasoningEffort becomes `output_config.effort` for Claude on Bedrock,
    // which models older than 4.5 reject alongside adaptive thinking, so the
    // budget path omits it.
    return supportsAdaptiveThinking(resolved.capabilityModelId)
      ? {
          bedrock: {
            reasoningConfig: {
              type: "adaptive" as const,
              display: "summarized" as const,
              maxReasoningEffort: effort,
            },
          },
        }
      : {
          bedrock: {
            reasoningConfig: {
              type: "enabled" as const,
              budgetTokens: THINKING_BUDGET_BY_EFFORT[effort],
            },
          },
        };
  }

  if (provider === "vertex") {
    if (!reasoningOk) return {};
    if (resolved.modelFamily === "anthropic") {
      return {
        anthropic: {
          ...anthropicThinkingOptions(resolved.capabilityModelId, effort),
          sendReasoning: true,
        },
      };
    }
    if (resolved.modelFamily === "google") {
      return {
        vertex: {
          thinkingConfig: {
            thinkingLevel: effortToGemini(effort),
            includeThoughts: true,
          },
        },
      };
    }
    return {};
  }

  if (provider === "azure" && reasoningOk) {
    return {
      openai: {
        forceReasoning: true,
        reasoningEffort: effortToOpenAI(effort),
        reasoningSummary: "auto",
      },
    };
  }

  return {};
}

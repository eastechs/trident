import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { GoogleAuth } from "google-auth-library";
import { AwsClient } from "aws4fetch";
import { z } from "zod";
import type {
  BedrockProviderConfig,
  DirectProviderId,
  GatewayModelConfig,
  GatewayProviderConfig,
  GatewayProviderId,
  VertexProviderConfig,
} from "./provider-config.js";
import {
  GATEWAY_MODEL_COUNT_MAX,
  GATEWAY_MODEL_ID_MAX_LENGTH,
  containsControlCharacters,
  awsDnsSuffix,
  gatewayModelRef,
  parseServiceAccountJson,
  normalizeAzureEndpoint,
  vertexSurfaceFor,
} from "./provider-config.js";
import { validateApiKey } from "./validate-key.js";

export type FieldErrors = Record<string, string[]>;

const SECRET_MAX_LENGTH = 1_048_576;
const VALIDATION_TIMEOUT_MS = 10_000;

const modelIdentifier = z
  .string()
  .trim()
  .min(1, "A model ID is required.")
  .max(
    GATEWAY_MODEL_ID_MAX_LENGTH,
    `Model IDs must be ${GATEWAY_MODEL_ID_MAX_LENGTH} characters or fewer.`,
  )
  .refine(
    (value) => !containsControlCharacters(value),
    "Model IDs cannot contain control characters or newlines.",
  );

const modelEntry = z.object({
  id: modelIdentifier,
  baseModelId: modelIdentifier.optional(),
});

const modelEntries = z
  .array(modelEntry)
  .min(1, "Configure at least one chat model.")
  .max(
    GATEWAY_MODEL_COUNT_MAX,
    `Configure no more than ${GATEWAY_MODEL_COUNT_MAX} models per provider.`,
  );

const optionalSecret = z
  .string()
  .max(SECRET_MAX_LENGTH, "Credential value is too large.")
  .optional()
  .transform((value) => value?.trim() || undefined);

const bedrockPayload = z.object({
  authType: z.enum(["accessKey", "profile", "apiKey"]),
  region: z
    .string()
    .trim()
    .min(1, "AWS region is required.")
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Enter a valid AWS region."),
  accessKeyId: optionalSecret,
  secretAccessKey: optionalSecret,
  sessionToken: optionalSecret,
  apiKey: optionalSecret,
  models: modelEntries,
});

const vertexPayload = z.object({
  authType: z.enum(["apiKey", "serviceAccount", "adc"]),
  apiKey: optionalSecret,
  serviceAccountJson: optionalSecret,
  project: z
    .string()
    .trim()
    .max(256)
    .refine(
      (value) => !containsControlCharacters(value),
      "Project cannot contain control characters.",
    )
    .optional()
    .transform((value) => value || undefined),
  location: z
    .string()
    .trim()
    .min(1, "Vertex location is required.")
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Enter a valid Vertex location."),
  models: modelEntries,
});

const azurePayload = z.object({
  apiKey: optionalSecret,
  endpoint: z.string().trim().min(1, "Azure endpoint is required.").max(2_048),
  apiVersion: z
    .string()
    .trim()
    .max(128)
    .refine(
      (value) => !containsControlCharacters(value),
      "API version cannot contain control characters.",
    )
    .optional()
    .transform((value) => value || undefined),
  deployments: modelEntries,
});

function zodErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".") || "provider";
    (errors[field] ??= []).push(issue.message);
  }
  return errors;
}

function duplicateModelErrors(
  provider: GatewayProviderId,
  models: GatewayModelConfig[],
  field: "models" | "deployments",
): FieldErrors {
  const ids = new Set<string>();
  const refs = new Set<string>();
  for (const model of models) {
    const ref = gatewayModelRef(provider, model);
    if (ids.has(model.id) || refs.has(ref)) {
      return {
        [field]: ["Model and deployment IDs must be unique."],
      };
    }
    ids.add(model.id);
    refs.add(ref);
  }
  return {};
}

export function parseGatewayProviderPayload(
  provider: GatewayProviderId,
  payload: unknown,
): { config?: GatewayProviderConfig; errors: FieldErrors } {
  if (provider === "bedrock") {
    const parsed = bedrockPayload.safeParse(payload);
    if (!parsed.success) return { errors: zodErrors(parsed.error) };
    const config: BedrockProviderConfig = {
      provider,
      ...parsed.data,
      ...(parsed.data.authType === "accessKey"
        ? {
            accessKeyId: parsed.data.accessKeyId,
            secretAccessKey: parsed.data.secretAccessKey,
            sessionToken: parsed.data.sessionToken,
          }
        : {}),
      ...(parsed.data.authType === "apiKey"
        ? { apiKey: parsed.data.apiKey }
        : {}),
    };
    const errors = duplicateModelErrors(provider, config.models, "models");
    if (config.authType === "accessKey") {
      if (!config.accessKeyId)
        errors.accessKeyId = ["AWS access key ID is required."];
      if (!config.secretAccessKey)
        errors.secretAccessKey = ["AWS secret access key is required."];
    } else if (config.authType === "apiKey" && !config.apiKey) {
      errors.apiKey = ["Bedrock API key is required."];
    }
    return Object.keys(errors).length > 0 ? { errors } : { config, errors: {} };
  }

  if (provider === "vertex") {
    const parsed = vertexPayload.safeParse(payload);
    if (!parsed.success) return { errors: zodErrors(parsed.error) };
    const config: VertexProviderConfig = {
      provider,
      ...parsed.data,
      ...(parsed.data.authType === "apiKey"
        ? { apiKey: parsed.data.apiKey }
        : {}),
      ...(parsed.data.authType === "serviceAccount"
        ? { serviceAccountJson: parsed.data.serviceAccountJson }
        : {}),
    };
    const errors = duplicateModelErrors(provider, config.models, "models");
    if (config.authType === "apiKey") {
      if (!config.apiKey) errors.apiKey = ["Vertex API key is required."];
      // Express-mode API keys only reach Google's own publishers; Claude and
      // the partner endpoint both require OAuth credentials.
      const unsupported = config.models.filter(
        (model) => vertexSurfaceFor(model.id, model.baseModelId) !== "gemini",
      );
      if (unsupported.length > 0) {
        errors.models = [
          `${
            unsupported.every(
              (model) =>
                vertexSurfaceFor(model.id, model.baseModelId) === "anthropic",
            )
              ? "Vertex Claude models"
              : "Vertex Claude and partner models"
          } require service-account or application-default credentials.`,
        ];
      }
    } else if (config.authType === "serviceAccount") {
      if (!config.serviceAccountJson) {
        errors.serviceAccountJson = [
          "Service-account credentials JSON is required.",
        ];
      } else {
        const credentials = parseServiceAccountJson(config.serviceAccountJson);
        if (!credentials) {
          errors.serviceAccountJson = [
            "Enter valid service-account JSON containing client_email and private_key.",
          ];
        } else if (!config.project && credentials.project_id) {
          config.project = credentials.project_id;
        }
      }
    }
    if (config.authType !== "apiKey" && !config.project) {
      errors.project = [
        "Google Cloud project ID is required for this authentication method.",
      ];
    }
    return Object.keys(errors).length > 0 ? { errors } : { config, errors: {} };
  }

  const parsed = azurePayload.safeParse(payload);
  if (!parsed.success) return { errors: zodErrors(parsed.error) };
  let endpoint: string;
  try {
    endpoint = normalizeAzureEndpoint(parsed.data.endpoint);
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password) {
      return {
        errors: {
          endpoint: [
            "Azure endpoint must be an HTTPS URL without credentials.",
          ],
        },
      };
    }
  } catch {
    return { errors: { endpoint: ["Enter a valid Azure endpoint URL."] } };
  }
  const config: GatewayProviderConfig = {
    provider,
    apiKey: parsed.data.apiKey || "",
    endpoint,
    ...(parsed.data.apiVersion ? { apiVersion: parsed.data.apiVersion } : {}),
    deployments: parsed.data.deployments,
  };
  const errors = duplicateModelErrors(
    provider,
    config.deployments,
    "deployments",
  );
  if (!config.apiKey) errors.apiKey = ["Azure API key is required."];
  return Object.keys(errors).length > 0 ? { errors } : { config, errors: {} };
}

async function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Provider validation timed out.")),
          VALIDATION_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function responseText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 1_000);
  } catch {
    return "";
  }
}

/**
 * Every validation probe is a one-shot request with the same deadline, so the
 * timer wiring lives here rather than being repeated at each call site.
 * Accepts an AwsClient-style fetcher for the signed Bedrock probes.
 */
async function fetchWithTimeout(
  url: string | URL,
  init: RequestInit = {},
  fetcher: (
    input: string | URL,
    init?: RequestInit,
  ) => Promise<Response> = fetch,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);
  try {
    return await fetcher(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function vertexOAuthValidationRequest({
  project,
  location,
  model,
}: {
  project: string;
  location: string;
  model: GatewayModelConfig;
}): { method: "GET" | "POST"; url: string; body?: Record<string, unknown> } {
  const host = `${location === "global" ? "" : `${location}-`}aiplatform.googleapis.com`;
  const root = `https://${host}/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}`;
  const surface = vertexSurfaceFor(model.id, model.baseModelId);

  if (surface === "anthropic") {
    return {
      method: "POST",
      url: `${root}/publishers/anthropic/models/count-tokens:rawPredict`,
      body: {
        model: model.id,
        messages: [{ role: "user", content: "Trident connection test" }],
      },
    };
  }

  // Partner models are served from an OpenAI-compatible endpoint that offers
  // no free probe, and they do not exist under `publishers/google`. Verify the
  // credentials reach the project and location instead; the model ID itself is
  // checked on first use.
  if (surface === "partner") {
    return { method: "GET", url: root };
  }

  return {
    method: "POST",
    url: `${root}/publishers/google/models/${encodeURIComponent(model.id)}:countTokens`,
    body: {
      contents: [
        { role: "user", parts: [{ text: "Trident connection test" }] },
      ],
    },
  };
}

function bedrockEndpoint(region: string): string {
  const suffix = awsDnsSuffix(region);
  return `https://bedrock.${region}.${suffix}/foundation-models?byOutputModality=TEXT`;
}

function stsEndpoint(region: string): string {
  return `https://sts.${region}.${awsDnsSuffix(region)}/?Action=GetCallerIdentity&Version=2011-06-15`;
}

async function validateBedrock(
  config: BedrockProviderConfig,
): Promise<FieldErrors> {
  try {
    let response: Response;
    if (config.authType === "apiKey") {
      const url = bedrockEndpoint(config.region);
      response = await fetchWithTimeout(url, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });
    } else {
      const credentials =
        config.authType === "accessKey"
          ? {
              accessKeyId: config.accessKeyId!,
              secretAccessKey: config.secretAccessKey!,
              ...(config.sessionToken
                ? { sessionToken: config.sessionToken }
                : {}),
            }
          : await withTimeout(fromNodeProviderChain()());
      const client = new AwsClient({
        ...credentials,
        region: config.region,
        // GetCallerIdentity validates AWS credentials without requiring the
        // unrelated bedrock:ListFoundationModels permission. Runtime access
        // remains scoped by the user's own Bedrock IAM policy.
        service: "sts",
        retries: 0,
      });
      response = await fetchWithTimeout(
        stsEndpoint(config.region),
        {},
        (input, requestInit) => client.fetch(input, requestInit),
      );
    }

    if (response.ok) return {};
    const body = await responseText(response);
    if (
      config.authType === "apiKey" &&
      response.status === 403 &&
      /not authorized to perform(?: action)?:?\s*bedrock:ListFoundationModels/i.test(
        body,
      )
    ) {
      // The service authenticated the bearer token but its principal follows
      // a least-privilege runtime-only policy. Catalog access is not required
      // for the explicitly configured models used by Trident.
      return {};
    }
    if (response.status === 401 || response.status === 403) {
      const field =
        config.authType === "accessKey"
          ? "accessKeyId"
          : config.authType === "apiKey"
            ? "apiKey"
            : "authType";
      return {
        [field]: [
          config.authType === "apiKey"
            ? "AWS rejected this Bedrock API key or its permissions."
            : "AWS rejected these credentials.",
        ],
      };
    }
    const failureField =
      config.authType === "apiKey"
        ? "region"
        : config.authType === "accessKey"
          ? "accessKeyId"
          : "authType";
    return {
      [failureField]: [
        `${config.authType === "apiKey" ? "Bedrock" : "AWS credential"} validation failed with HTTP ${response.status}${body ? `: ${body}` : "."}`,
      ],
    };
  } catch (error) {
    return {
      authType: [
        error instanceof Error
          ? error.message
          : "Could not validate the Bedrock connection.",
      ],
    };
  }
}

async function validateVertex(
  config: VertexProviderConfig,
): Promise<FieldErrors> {
  try {
    if (config.authType === "apiKey") {
      const modelId = encodeURIComponent(config.models[0].id);
      const url = new URL(
        `https://aiplatform.googleapis.com/v1/publishers/google/models/${modelId}:countTokens`,
      );
      url.searchParams.set("key", config.apiKey!);
      const response = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: "Trident connection test" }] },
          ],
        }),
      });
      if (response.ok) return {};
      const body = await responseText(response);
      if (
        response.status === 401 ||
        response.status === 403 ||
        /API_KEY_INVALID|API key not valid/i.test(body)
      ) {
        return {
          apiKey: ["Google rejected this Vertex API key or its permissions."],
        };
      }
      if (
        response.status === 400 ||
        response.status === 404 ||
        response.status === 405
      ) {
        return {
          models: [
            "Vertex could not validate the configured model with this API key.",
          ],
        };
      }
      return {
        apiKey: [`Vertex validation failed with HTTP ${response.status}.`],
      };
    }

    const credentials =
      config.authType === "serviceAccount"
        ? parseServiceAccountJson(config.serviceAccountJson!)
        : undefined;
    const auth = new GoogleAuth({
      ...(config.project ? { projectId: config.project } : {}),
      ...(credentials ? { credentials } : {}),
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const token = await withTimeout(auth.getAccessToken());
    if (!token) throw new Error("Google did not return an access token.");

    // Probe one model per serving surface rather than only the first
    // configured model. Each surface has its own endpoint and credential
    // requirements, so a connection whose only partner or Claude model sits
    // further down the list would otherwise save with that surface unchecked
    // and fail on first use.
    const bySurface = new Map<string, GatewayModelConfig>();
    for (const model of config.models) {
      const surface = vertexSurfaceFor(model.id, model.baseModelId);
      if (!bySurface.has(surface)) bySurface.set(surface, model);
    }

    const credentialField =
      config.authType === "serviceAccount" ? "serviceAccountJson" : "authType";

    for (const model of bySurface.values()) {
      const request = vertexOAuthValidationRequest({
        project: config.project!,
        location: config.location,
        model,
      });
      const response = await fetchWithTimeout(request.url, {
        method: request.method,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      });

      if (response.ok) continue;
      if (response.status === 401 || response.status === 403) {
        return {
          [credentialField]: [
            "Google rejected these Vertex credentials or their permissions.",
          ],
        };
      }
      if (
        response.status === 400 ||
        response.status === 404 ||
        response.status === 405
      ) {
        return {
          models: [
            `Vertex could not validate ${model.id} in project ${config.project} and location ${config.location} (HTTP ${response.status}).`,
          ],
        };
      }
      return {
        [credentialField]: [
          `Vertex validation failed with HTTP ${response.status}.`,
        ],
      };
    }
    return {};
  } catch (error) {
    return {
      [config.authType === "serviceAccount"
        ? "serviceAccountJson"
        : "authType"]: [
        error instanceof Error
          ? error.message
          : "Could not validate the Vertex credentials.",
      ],
    };
  }
}

async function validateAzure(
  config: Extract<GatewayProviderConfig, { provider: "azure" }>,
): Promise<FieldErrors> {
  const url = new URL(`${config.endpoint}/v1/models`);
  if (config.apiVersion) url.searchParams.set("api-version", config.apiVersion);
  try {
    const response = await fetchWithTimeout(url, {
      headers: { "api-key": config.apiKey },
    });
    if (response.ok) return {};
    if (response.status === 401 || response.status === 403) {
      return { apiKey: ["Azure rejected this API key."] };
    }
    return {
      endpoint: [`Azure validation failed with HTTP ${response.status}.`],
    };
  } catch (error) {
    return {
      endpoint: [
        error instanceof Error
          ? error.message
          : "Could not validate the Azure endpoint.",
      ],
    };
  }
}

export async function validateGatewayProviderConnection(
  config: GatewayProviderConfig,
): Promise<FieldErrors> {
  if (config.provider === "bedrock") return validateBedrock(config);
  if (config.provider === "vertex") return validateVertex(config);
  return validateAzure(config);
}

export async function validateDirectProviderConnection(
  provider: DirectProviderId,
  apiKey: string,
): Promise<FieldErrors> {
  return (await validateApiKey(provider, apiKey))
    ? {}
    : { apiKey: [`The ${provider} API key is invalid.`] };
}

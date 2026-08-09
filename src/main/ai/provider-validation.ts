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
  gatewayModelRef,
  isAnthropicModel,
  normalizeAzureEndpoint,
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

function parseServiceAccountJson(
  value: string,
): { client_email: string; private_key: string; project_id?: string } | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (
      typeof parsed.client_email !== "string" ||
      !parsed.client_email.trim() ||
      typeof parsed.private_key !== "string" ||
      !parsed.private_key.trim()
    ) {
      return null;
    }
    const projectId =
      typeof parsed.project_id === "string" && parsed.project_id.trim()
        ? parsed.project_id.trim()
        : undefined;
    if (
      projectId &&
      (projectId.length > 256 || containsControlCharacters(projectId))
    ) {
      return null;
    }
    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
      ...(projectId ? { project_id: projectId } : {}),
    };
  } catch {
    return null;
  }
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
      if (
        config.models.some((model) =>
          isAnthropicModel(model.id, model.baseModelId),
        )
      ) {
        errors.models = [
          "Vertex Claude models require service-account or application-default credentials.",
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

export function vertexOAuthValidationRequest({
  project,
  location,
  model,
}: {
  project: string;
  location: string;
  model: GatewayModelConfig;
}): { url: string; body: Record<string, unknown> } {
  const host = `${location === "global" ? "" : `${location}-`}aiplatform.googleapis.com`;
  const root = `https://${host}/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}`;

  if (isAnthropicModel(model.id, model.baseModelId)) {
    return {
      url: `${root}/publishers/anthropic/models/count-tokens:rawPredict`,
      body: {
        model: model.id,
        messages: [{ role: "user", content: "Trident connection test" }],
      },
    };
  }

  return {
    url: `${root}/publishers/google/models/${encodeURIComponent(model.id)}:countTokens`,
    body: {
      contents: [
        { role: "user", parts: [{ text: "Trident connection test" }] },
      ],
    },
  };
}

function awsDnsSuffix(region: string): string {
  return region.startsWith("cn-") ? "amazonaws.com.cn" : "amazonaws.com";
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
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        VALIDATION_TIMEOUT_MS,
      );
      try {
        response = await fetch(url, {
          headers: { Authorization: `Bearer ${config.apiKey}` },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
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
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        VALIDATION_TIMEOUT_MS,
      );
      try {
        response = await client.fetch(stsEndpoint(config.region), {
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
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
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        VALIDATION_TIMEOUT_MS,
      );
      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ text: "Trident connection test" }] },
            ],
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
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

    const request = vertexOAuthValidationRequest({
      project: config.project!,
      location: config.location,
      model: config.models[0],
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(request.url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(request.body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.ok) return {};
    const credentialField =
      config.authType === "serviceAccount" ? "serviceAccountJson" : "authType";
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
          `Vertex could not validate the configured model in project ${config.project} and location ${config.location} (HTTP ${response.status}).`,
        ],
      };
    }
    return {
      [credentialField]: [
        `Vertex validation failed with HTTP ${response.status}.`,
      ],
    };
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { "api-key": config.apiKey },
      signal: controller.signal,
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
  } finally {
    clearTimeout(timeout);
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

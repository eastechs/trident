import assert from "node:assert/strict";
import test from "node:test";
import {
  bedrockRuntimeEndpoint,
  decodeGatewayModelRef,
  gatewayConfigHasModelReference,
  gatewayModelRef,
  isGatewayModelConfigArray,
  normalizeAzureEndpoint,
  resolvedGatewayModelReference,
  type BedrockProviderConfig,
} from "./provider-config.js";
import {
  parseGatewayProviderPayload,
  vertexOAuthValidationRequest,
} from "./provider-validation.js";
import { lookupPricing } from "./pricing.js";

test("gateway references use the canonical browser-decodable payload", () => {
  const model = {
    id: "arn:aws:bedrock:us-east-1:123456789012:inference-profile/example",
    baseModelId: "anthropic.claude-sonnet-4-6-v1:0",
  };
  const reference = gatewayModelRef("bedrock", model);
  assert.match(reference, /^trident-bedrock-[A-Za-z0-9_-]+$/);

  const encoded = reference.slice("trident-bedrock-".length);
  assert.deepEqual(
    JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")),
    {
      modelId: model.id,
      baseModelId: model.baseModelId,
    },
  );
  assert.deepEqual(decodeGatewayModelRef(reference), {
    providerId: "bedrock",
    ...model,
  });

  const noncanonical = `trident-bedrock-${Buffer.from(
    JSON.stringify({ modelId: model.id, extra: true }),
  ).toString("base64url")}`;
  assert.equal(decodeGatewayModelRef(noncanonical), null);
});

test("configured membership rejects forged and unlisted gateway references", () => {
  const config: BedrockProviderConfig = {
    provider: "bedrock",
    authType: "profile",
    region: "us-east-1",
    models: [{ id: "anthropic.claude-sonnet-4-6-v1:0" }],
  };
  const configured = gatewayModelRef("bedrock", config.models[0]);
  const unlisted = gatewayModelRef("bedrock", {
    id: "anthropic.claude-opus-4-7-v1:0",
  });
  const wrongProvider = gatewayModelRef("vertex", config.models[0]);

  assert.equal(gatewayConfigHasModelReference(config, configured), true);
  assert.equal(gatewayConfigHasModelReference(config, unlisted), false);
  assert.equal(gatewayConfigHasModelReference(config, wrongProvider), false);
  assert.equal(
    gatewayConfigHasModelReference(config, "trident-bedrock-not-base64"),
    false,
  );
});

test("gateway payload parsing enforces complete auth replacement", () => {
  const model = [{ id: "anthropic.claude-sonnet-4-6-v1:0" }];

  assert.ok(
    parseGatewayProviderPayload("bedrock", {
      authType: "profile",
      region: "us-east-1",
      models: model,
    }).config,
  );

  const missingAccessKey = parseGatewayProviderPayload("bedrock", {
    authType: "accessKey",
    region: "us-east-1",
    models: model,
  });
  assert.deepEqual(Object.keys(missingAccessKey.errors).sort(), [
    "accessKeyId",
    "secretAccessKey",
  ]);

  const accessKey = parseGatewayProviderPayload("bedrock", {
    authType: "accessKey",
    region: "us-east-1",
    accessKeyId: "AKIAEXAMPLE",
    secretAccessKey: "secret",
    sessionToken: "temporary",
    models: model,
  });
  assert.equal(accessKey.config?.provider, "bedrock");
  assert.equal(accessKey.errors.sessionToken, undefined);

  const missingBearer = parseGatewayProviderPayload("bedrock", {
    authType: "apiKey",
    region: "us-east-1",
    models: model,
  });
  assert.ok(missingBearer.errors.apiKey);
});

test("Vertex and Azure payloads enforce family-aware auth and normalization", () => {
  const vertexAdcWithoutProject = parseGatewayProviderPayload("vertex", {
    authType: "adc",
    location: "us-central1",
    models: [{ id: "claude-sonnet-4-6" }],
  });
  assert.ok(vertexAdcWithoutProject.errors.project);

  const vertexServiceAccountWithoutProject = parseGatewayProviderPayload(
    "vertex",
    {
      authType: "serviceAccount",
      serviceAccountJson: JSON.stringify({
        client_email: "trident@example.iam.gserviceaccount.com",
        private_key:
          "-----BEGIN PRIVATE KEY-----\nexample\n-----END PRIVATE KEY-----\n",
      }),
      location: "us-central1",
      models: [{ id: "claude-sonnet-4-6" }],
    },
  );
  assert.ok(vertexServiceAccountWithoutProject.errors.project);

  const vertexAdc = parseGatewayProviderPayload("vertex", {
    authType: "adc",
    project: "trident-project",
    location: "us-central1",
    models: [{ id: "claude-sonnet-4-6" }],
  });
  assert.equal(vertexAdc.config?.provider, "vertex");

  const vertexServiceAccount = parseGatewayProviderPayload("vertex", {
    authType: "serviceAccount",
    serviceAccountJson: JSON.stringify({
      client_email: "trident@example.iam.gserviceaccount.com",
      private_key:
        "-----BEGIN PRIVATE KEY-----\nexample\n-----END PRIVATE KEY-----\n",
      project_id: "trident-project",
    }),
    location: "us-central1",
    models: [{ id: "claude-sonnet-4-6" }],
  });
  assert.equal(
    vertexServiceAccount.config?.provider === "vertex"
      ? vertexServiceAccount.config.project
      : undefined,
    "trident-project",
  );

  const vertexApiKeyClaude = parseGatewayProviderPayload("vertex", {
    authType: "apiKey",
    apiKey: "example",
    location: "global",
    models: [{ id: "claude-sonnet-4-6" }],
  });
  assert.ok(vertexApiKeyClaude.errors.models);

  const vertexApiKeyGemini = parseGatewayProviderPayload("vertex", {
    authType: "apiKey",
    apiKey: "example",
    location: "global",
    models: [{ id: "gemini-3.1-pro-preview" }],
  });
  assert.equal(vertexApiKeyGemini.config?.provider, "vertex");

  const azure = parseGatewayProviderPayload("azure", {
    apiKey: "example",
    endpoint: "https://trident.openai.azure.com/",
    deployments: [{ id: "production", baseModelId: "gpt-5.5" }],
  });
  assert.equal(
    azure.config?.provider === "azure" ? azure.config.endpoint : undefined,
    "https://trident.openai.azure.com/openai",
  );
});

test("Vertex OAuth validation probes the configured project, location, and family", () => {
  assert.deepEqual(
    vertexOAuthValidationRequest({
      project: "trident-project",
      location: "us-central1",
      model: { id: "gemini-2.5-flash" },
    }),
    {
      url: "https://us-central1-aiplatform.googleapis.com/v1/projects/trident-project/locations/us-central1/publishers/google/models/gemini-2.5-flash:countTokens",
      body: {
        contents: [
          {
            role: "user",
            parts: [{ text: "Trident connection test" }],
          },
        ],
      },
    },
  );

  assert.deepEqual(
    vertexOAuthValidationRequest({
      project: "trident-project",
      location: "global",
      model: {
        id: "claude-sonnet-4-6",
        baseModelId: "claude-sonnet-4-6",
      },
    }),
    {
      url: "https://aiplatform.googleapis.com/v1/projects/trident-project/locations/global/publishers/anthropic/models/count-tokens:rawPredict",
      body: {
        model: "claude-sonnet-4-6",
        messages: [{ role: "user", content: "Trident connection test" }],
      },
    },
  );
});

test("model validation blocks duplicates and frontmatter control characters", () => {
  assert.equal(isGatewayModelConfigArray([{ id: "gpt-production" }]), true);
  assert.equal(
    isGatewayModelConfigArray([
      { id: "gpt-production" },
      { id: "gpt-production", baseModelId: "gpt-5.5" },
    ]),
    false,
  );
  assert.equal(
    isGatewayModelConfigArray([{ id: "gpt-5\n---\ncreated_by: injected" }]),
    false,
  );
});

test("agent buckets stay bounded even when persisted references do not", () => {
  const modelId = `arn:aws:bedrock:us-east-1:123456789012:inference-profile/${"long-profile-segment-".repeat(30)}`;
  const resolved = resolvedGatewayModelReference({
    providerId: "bedrock",
    id: modelId,
    baseModelId: "anthropic.claude-sonnet-4-6-v1:0",
  });

  assert.ok(Buffer.byteLength(resolved.id) > 255);
  assert.ok(Buffer.byteLength(resolved.agentBucket) < 80);
  assert.match(resolved.agentBucket, /^[a-z0-9._-]+$/);
  assert.equal(resolved.author.startsWith("Amazon Bedrock / "), true);
  assert.equal(resolved.author.includes(resolved.id), false);
});

test("Azure endpoint normalization strips v1, query, and fragment", () => {
  assert.equal(
    normalizeAzureEndpoint(
      "https://gateway.example.com/custom/v1?api-version=preview#fragment",
    ),
    "https://gateway.example.com/custom",
  );
});

test("Bedrock runtime endpoints use the AWS partition DNS suffix", () => {
  assert.equal(
    bedrockRuntimeEndpoint("us-east-1"),
    "https://bedrock-runtime.us-east-1.amazonaws.com",
  );
  assert.equal(
    bedrockRuntimeEndpoint("cn-north-1"),
    "https://bedrock-runtime.cn-north-1.amazonaws.com.cn",
  );
});

test("Bedrock revision-qualified model IDs resolve canonical pricing", () => {
  const reference = gatewayModelRef("bedrock", {
    id: "anthropic.claude-sonnet-4-6-v1:0",
  });
  const pricing = lookupPricing(reference);

  assert.equal(pricing?.inputPerMTokens, 3);
  assert.equal(pricing?.outputPerMTokens, 15);
  assert.equal(pricing?.contextWindow, 1_000_000);
});

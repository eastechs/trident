import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { createAzure } from "@ai-sdk/azure";
import { createOpenAI } from "@ai-sdk/openai";
import ts from "typescript";
import * as providerConfig from "./provider-config.js";
import {
  bedrockRuntimeEndpoint,
  capabilityModelIdFor,
  classifyModelReference,
  decodeGatewayModelRef,
  gatewayConfigHasModelReference,
  gatewayConfiguredModel,
  gatewayModelRef,
  isGatewayModelConfigArray,
  normalizeAzureEndpoint,
  resolvedDirectModelReference,
  resolvedGatewayModelReference,
  supportsAdaptiveThinking,
  supportsReasoning,
  supportsImageInput,
  type BedrockProviderConfig,
  type ResolvedModelReference,
} from "./provider-config.js";
import { getProviderOptions, type EffortLevel } from "./providers.js";
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

test("editing a capability hint keeps pinned references routable", () => {
  const modelId = "arn:aws:bedrock:us-east-1:123456789012:inference-profile/x";
  // A conversation pinned before any base model ID was recorded.
  const pinned = gatewayModelRef("bedrock", { id: modelId });

  const edited: BedrockProviderConfig = {
    provider: "bedrock",
    authType: "profile",
    region: "us-east-1",
    models: [{ id: modelId, baseModelId: "claude-opus-4-6" }],
  };
  assert.equal(gatewayConfigHasModelReference(edited, pinned), true);
  assert.deepEqual(gatewayConfiguredModel(edited, pinned), {
    id: modelId,
    baseModelId: "claude-opus-4-6",
  });

  // Removing the model itself must still revoke the reference.
  const removed: BedrockProviderConfig = {
    ...edited,
    models: [{ id: "anthropic.claude-sonnet-4-6-v1:0" }],
  };
  assert.equal(gatewayConfigHasModelReference(removed, pinned), false);

  // The document bucket must not move when only the hint changes.
  const before = resolvedGatewayModelReference({
    providerId: "bedrock",
    id: modelId,
  });
  const after = resolvedGatewayModelReference({
    providerId: "bedrock",
    id: modelId,
    baseModelId: "claude-opus-4-6",
  });
  assert.equal(before.agentBucket, after.agentBucket);
});

test("model reference classification gates the request path", () => {
  const gateway = gatewayModelRef("bedrock", {
    id: "anthropic.claude-sonnet-4-6-v1:0",
  });
  assert.equal(classifyModelReference(gateway).kind, "gateway");
  assert.deepEqual(classifyModelReference("claude-sonnet-4-6"), {
    kind: "direct",
    modelId: "claude-sonnet-4-6",
  });

  // A route-looking value that does not decode must never be treated as a
  // direct model — that would route it to a provider the user never selected.
  for (const forged of [
    "trident-bedrock-not-base64",
    "trident-bedrock-",
    "trident-openrouter-abc",
    `trident-bedrock-${Buffer.from(JSON.stringify({ modelId: "x", extra: 1 })).toString("base64url")}`,
  ]) {
    assert.equal(classifyModelReference(forged).kind, "invalid", forged);
  }

  // Direct IDs double as document directory names.
  for (const unsafe of [
    "",
    ".",
    "..",
    "../escape",
    "with/slash",
    "with\\backslash",
    "-leading-dash",
    "CON",
    "com1.txt",
    "a".repeat(256),
    "has space",
  ]) {
    assert.equal(
      classifyModelReference(unsafe).kind,
      "invalid",
      JSON.stringify(unsafe),
    );
  }
});

test("vendor-prefixed gateway IDs resolve to the underlying model", () => {
  // Capability predicates only recognize a model once the gateway's vendor
  // marker and region scope are off the front.
  assert.equal(
    capabilityModelIdFor("openai.gpt-oss-120b-1:0"),
    "gpt-oss-120b-1:0",
  );
  assert.equal(
    capabilityModelIdFor("us.anthropic.claude-opus-4-7-v1:0"),
    "claude-opus-4-7-v1:0",
  );
  assert.equal(capabilityModelIdFor("meta.llama-3-3-70b"), "llama-3-3-70b");

  // gpt-oss on Bedrock supports reasoning_effort; text-only, so no images.
  assert.equal(supportsReasoning("gpt-oss-120b-1:0", "openai"), true);
  assert.equal(supportsImageInput("gpt-oss-120b-1:0", "openai"), false);
});

test("OpenAI reasoning capabilities cover Astra, Sol, and later GPT versions", () => {
  for (const id of [
    "gpt-5",
    "gpt-5-mini",
    "gpt-5.5",
    "gpt-5.6-sol",
    "gpt-6-astra",
    "gpt-6-astra-2026-09-03",
    // Synthetic versions guard against another major-version cutoff.
    "gpt-7",
    "gpt-10.2-example",
    "o3",
    "o4-mini",
  ]) {
    assert.equal(supportsReasoning(id, "openai"), true, id);
    assert.equal(supportsImageInput(id, "openai"), true, id);
  }

  for (const id of [
    "gpt-3.5-turbo",
    "gpt-4o",
    "gpt-4.1",
    "gpt-5-chat-latest",
    "gpt-5.2-chat-latest",
    "gpt-5-search-api",
    "gpt-6-audio-preview",
    "gpt-image-2",
    "gpt-6unknown",
    "production",
  ]) {
    assert.equal(supportsReasoning(id, "openai"), false, id);
  }
});

test("the model catalog exposes reasoning for Astra and configured Azure deployments", async () => {
  // Execute the real registry with only settings and HTTP replaced. This
  // exercises the flag consumed by the selector without starting Electron.
  const exports = {} as typeof import("./model-registry.js");
  const source = readFileSync(
    new URL("./model-registry.ts", import.meta.url),
    "utf8",
  );
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      require: (id: string) => {
        if (id === "./provider-config.js") return providerConfig;
        assert.equal(id, "../settings.js");
        return {
          getConfiguredProviders: () => ({ openai: true }),
          getApiKey: () => "test-key",
          getGatewayProviderModels: (provider: string) =>
            provider === "azure"
              ? [{ id: "production", baseModelId: "gpt-6-astra" }]
              : [],
        };
      },
      AbortController,
      setTimeout,
      clearTimeout,
      console,
      fetch: async (url: string) => {
        assert.equal(url, "https://api.openai.com/v1/models");
        return Response.json({
          data: [
            "gpt-6-astra",
            "gpt-5.6-sol",
            "gpt-10.2-example",
            "gpt-4o",
            "gpt-5-chat-latest",
          ].map((id) => ({ id, object: "model" })),
        });
      },
    },
  );
  const models = await exports.fetchAvailableModels();
  assert.equal(models.length, 6);
  for (const id of [
    "gpt-6-astra",
    "gpt-5.6-sol",
    "gpt-10.2-example",
    "production",
  ]) {
    const model = models.find((row) => row.modelId === id);
    assert.equal(model?.supportsReasoning, true, id);
    assert.equal(model?.supportsImages, true, id);
  }
  for (const id of ["gpt-4o", "gpt-5-chat-latest"]) {
    assert.equal(
      models.find((row) => row.id === id)?.supportsReasoning,
      false,
      id,
    );
  }
});

async function openAIStreamRequest(
  resolved: ResolvedModelReference,
  effort: EffortLevel,
) {
  let body: Record<string, any> | undefined;
  const settings = {
    apiKey: "test-key",
    fetch: async (url: RequestInfo | URL, init?: RequestInit) => {
      assert.ok(String(url).includes("/responses"));
      assert.ok(typeof init?.body === "string");
      body = JSON.parse(init.body);
      return new Response("data: [DONE]\n\n", {
        headers: { "content-type": "text/event-stream" },
      });
    },
  };
  const model =
    resolved.providerId === "azure"
      ? createAzure({ ...settings, resourceName: "test-resource" })(
          resolved.modelId,
        )
      : createOpenAI(settings)(resolved.modelId);
  const result = await model.doStream({
    prompt: [
      { role: "system", content: "Contract test" },
      { role: "user", content: [{ type: "text", text: "Hello" }] },
    ],
    providerOptions: getProviderOptions(resolved, {
      effort,
      projectId: "project-test",
    }),
  });
  await result.stream.pipeTo(new WritableStream());
  assert.ok(body);
  assert.equal(body.stream, true);
  assert.equal(body.model, resolved.modelId);
  return body;
}

test("the SDK sends every selected effort, including Max, for Astra and Sol", async () => {
  for (const id of [
    "gpt-6-astra",
    "gpt-5.6-sol",
    "gpt-5.6",
    "gpt-10.2-example",
  ]) {
    for (const effort of ["low", "medium", "high", "xhigh", "max"] as const) {
      const body = await openAIStreamRequest(
        resolvedDirectModelReference(id),
        effort,
      );
      assert.deepEqual(
        body.reasoning,
        { effort, summary: "auto" },
        `${id}: ${effort}`,
      );
      assert.equal(body.input[0].role, "developer", id);
      assert.equal(body.prompt_cache_key, "project-test");
      // GPT-5.6+ defaults to the new 30-minute cache lifetime.
      assert.equal(body.prompt_cache_retention, undefined, id);
    }
  }
});

test("Azure uses the base model's reasoning capabilities for opaque deployments", async () => {
  const resolved = resolvedGatewayModelReference({
    providerId: "azure",
    id: "production",
    baseModelId: "gpt-6-astra",
  });
  const body = await openAIStreamRequest(resolved, "max");
  assert.deepEqual(body.reasoning, { effort: "max", summary: "auto" });
  assert.equal(body.input[0].role, "developer");
});

test("legacy models retain their effort mapping and chat-only models omit reasoning", async () => {
  const legacy = await openAIStreamRequest(
    resolvedDirectModelReference("gpt-5.5"),
    "max",
  );
  assert.deepEqual(legacy.reasoning, { effort: "xhigh", summary: "auto" });
  assert.equal(legacy.prompt_cache_retention, "24h");

  for (const id of ["gpt-4o", "gpt-5-chat-latest", "gpt-5.2-chat-latest"]) {
    const body = await openAIStreamRequest(
      resolvedDirectModelReference(id),
      "max",
    );
    assert.equal(body.reasoning, undefined, id);
  }
  const unknown = await openAIStreamRequest(
    resolvedGatewayModelReference({
      providerId: "azure",
      id: "production",
    }),
    "max",
  );
  assert.equal(unknown.reasoning, undefined);
});

test("adaptive thinking is limited to Claude 4.5 and newer", () => {
  // 4.5-generation and later accept adaptive thinking plus the effort knob.
  for (const id of [
    "claude-sonnet-4-5-20250929",
    "claude-haiku-4-5",
    "claude-sonnet-4-6",
    "claude-opus-4-7",
    "claude-opus-4-8",
    "claude-opus-5",
  ]) {
    assert.equal(supportsAdaptiveThinking(id), true, id);
  }

  // Older thinking-capable models take budget-based thinking only. Dated
  // Claude 4 IDs must not read their date suffix as a minor version.
  for (const id of [
    "claude-3-7-sonnet-20250219-v1:0",
    "claude-3-7-sonnet",
    "claude-opus-4-1",
    "claude-sonnet-4-20250514",
    "claude-3-5-sonnet-20241022",
    "prod-deployment",
  ]) {
    assert.equal(supportsAdaptiveThinking(id), false, id);
  }
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

  // AI Foundry and AI Services resources serve the same surface under the same
  // path, and the portal shows their origins without it.
  for (const host of [
    "trident.cognitiveservices.azure.com",
    "trident.services.ai.azure.com",
  ]) {
    assert.equal(
      normalizeAzureEndpoint(`https://${host}/`),
      `https://${host}/openai`,
    );
  }

  // An explicit path is always preserved as given.
  assert.equal(
    normalizeAzureEndpoint(
      "https://trident.cognitiveservices.azure.com/custom",
    ),
    "https://trident.cognitiveservices.azure.com/custom",
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
      method: "POST",
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

  // Partner models are not served under publishers/google, so probing there
  // would 404 a perfectly valid connection. Check the project and location.
  assert.deepEqual(
    vertexOAuthValidationRequest({
      project: "trident-project",
      location: "us-central1",
      model: { id: "meta/llama-3.3-70b-instruct-maas" },
    }),
    {
      method: "GET",
      url: "https://us-central1-aiplatform.googleapis.com/v1/projects/trident-project/locations/us-central1",
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
      method: "POST",
      url: "https://aiplatform.googleapis.com/v1/projects/trident-project/locations/global/publishers/anthropic/models/count-tokens:rawPredict",
      body: {
        model: "claude-sonnet-4-6",
        messages: [{ role: "user", content: "Trident connection test" }],
      },
    },
  );
});

test("Vertex Express-mode keys reject models they cannot reach", () => {
  const partner = parseGatewayProviderPayload("vertex", {
    authType: "apiKey",
    apiKey: "example",
    location: "us-central1",
    models: [{ id: "meta/llama-3.3-70b-instruct-maas" }],
  });
  assert.ok(partner.errors.models);

  // Google's own publishers remain reachable with an Express-mode key.
  const gemini = parseGatewayProviderPayload("vertex", {
    authType: "apiKey",
    apiKey: "example",
    location: "us-central1",
    models: [{ id: "gemini-2.5-flash" }],
  });
  assert.equal(gemini.errors.models, undefined);
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

test("a model listed under two catalogs is priced by the one in use", () => {
  // The unprefixed Gemini keys carry Vertex rates; AI Studio rates live under
  // the gemini/ prefix. A direct connection must not be billed at Vertex's.
  const direct = lookupPricing("gemini-2.0-flash-001");
  const viaVertex = lookupPricing(
    gatewayModelRef("vertex", { id: "gemini-2.0-flash-001" }),
  );

  assert.ok(direct);
  assert.ok(viaVertex);
  // Per-million conversion is a float multiply, so compare with tolerance.
  assert.ok(Math.abs(direct.inputPerMTokens - 0.1) < 1e-9);
  assert.ok(Math.abs(viaVertex.inputPerMTokens - 0.15) < 1e-9);
});

test("region-scoped Bedrock profiles price as the model they route to", () => {
  // The snapshot carries keys for some region scopes but not every one; an
  // APAC profile must not lose its pricing just because its scoped key is
  // missing.
  const scoped = lookupPricing(
    gatewayModelRef("bedrock", {
      id: "apac.anthropic.claude-sonnet-4-5-20250929-v1:0",
    }),
  );
  const unscoped = lookupPricing(
    gatewayModelRef("bedrock", {
      id: "anthropic.claude-sonnet-4-5-20250929-v1:0",
    }),
  );

  assert.ok(scoped, "region-scoped profile should resolve pricing");
  assert.deepEqual(scoped, unscoped);
});

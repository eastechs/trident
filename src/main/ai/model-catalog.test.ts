import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import {
  CATALOG_URL,
  CATALOG_PROVIDERS,
  catalogSchema,
  snapshotSchema,
  type CatalogModel,
  type CatalogSnapshot,
} from "./catalog-schema.js";
import { BUNDLED_CATALOG } from "./catalog/bundled-catalog.js";

const require = createRequire(import.meta.url);
// Reuse the existing VM testing approach to isolate Electron, disk, and HTTP.
function loadModule<T>(
  file: string,
  replacements: Record<string, unknown>,
  globals: Record<string, unknown> = {},
): T {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      require: (id: string) => replacements[id] ?? require(id),
      console: { warn() {} },
      AbortController,
      setTimeout,
      clearTimeout,
      fetch,
      URL,
      ...globals,
    },
  );
  return exports as T;
}

function model(id: string, extra: Partial<CatalogModel> = {}): CatalogModel {
  return {
    id,
    name: id,
    reasoning: true,
    tool_call: true,
    modalities: { input: ["text", "image"], output: ["text"] },
    limit: { context: 100_000, output: 10_000 },
    cost: { input: 2, output: 8 },
    ...extra,
  };
}
function fixture(): CatalogSnapshot {
  const providers: Record<string, { models: Record<string, CatalogModel> }> =
    Object.fromEntries(
      CATALOG_PROVIDERS.map((p) => [
        p,
        { models: { sentinel: model("sentinel") } },
      ]),
    );
  Object.assign(providers.openai.models, {
    "gpt-5": model("gpt-5"),
    "gpt-5-text": model("gpt-5-text", {
      reasoning: false,
      modalities: { input: ["text"], output: ["text"] },
    }),
    "gpt-5-free": model("gpt-5-free", {
      cost: { input: 0, output: 0, cache_read: 0, cache_write: 0 },
    }),
    "gpt-5-unknown-price": model("gpt-5-unknown-price", { cost: { input: 2 } }),
    "gpt-5-old": model("gpt-5-old", { status: "deprecated" }),
    "gpt-5-image": model("gpt-5-image", {
      modalities: { input: ["text"], output: ["image"] },
    }),
  });
  providers.google.models["gemini-2.0-flash"] = model("gemini-2.0-flash", {
    cost: { input: 0.1, output: 0.4 },
  });
  providers["google-vertex"].models["gemini-2.0-flash"] = model(
    "gemini-2.0-flash",
    { cost: { input: 0.15, output: 0.6 } },
  );
  providers["amazon-bedrock"].models["anthropic.claude-sonnet-4-6"] = model(
    "anthropic.claude-sonnet-4-6",
    { cost: { input: 3.3, output: 16.5 } },
  );
  providers["amazon-bedrock"].models["us.anthropic.claude-sonnet-4-6"] = model(
    "us.anthropic.claude-sonnet-4-6",
    { cost: { input: 4, output: 20 } },
  );
  providers["google-vertex-anthropic"].models["claude-sonnet-4-6@default"] =
    model("claude-sonnet-4-6@default");
  providers.azure.models["gpt-5"] = model("gpt-5", {
    cost: { input: 3, output: 9 },
  });
  return snapshotSchema.parse({
    source: CATALOG_URL,
    fetched_at: "2026-01-01T00:00:00.000Z",
    providers,
  });
}
function catalogHarness(
  options: {
    cache?: string;
    response?: unknown;
    fail?: boolean;
    status?: number;
    timeout?: boolean;
  } = {},
) {
  const writes: [string, string][] = [];
  const renames: [string, string][] = [];
  let requests = 0;
  const api = loadModule<typeof import("./model-catalog.js")>(
    "./model-catalog.ts",
    {
      electron: { app: { getPath: () => "/test" } },
      "./catalog/bundled-catalog.js": { BUNDLED_CATALOG: fixture() },
      "node:fs/promises": {
        readFile: async (file: string) => {
          assert.equal(file, "/test/model-catalog.json");
          return options.cache ?? "invalid";
        },
        writeFile: async (file: string, value: string) => {
          writes.push([file, value]);
        },
        rename: async (from: string, to: string) => {
          renames.push([from, to]);
        },
      },
    },
    {
      fetch: async (url: string, init: RequestInit) => {
        requests++;
        assert.equal(url, CATALOG_URL);
        assert.equal(init.headers && Object.keys(init.headers).length, 1);
        if (options.timeout)
          return new Promise((_resolve, reject) =>
            init.signal?.addEventListener("abort", () =>
              reject(new Error("aborted")),
            ),
          );
        if (options.fail) throw new Error("offline");
        return Response.json(options.response ?? fixture().providers, {
          status: options.status ?? 200,
        });
      },
      setTimeout: (fn: () => void, ms: number) => {
        assert.equal(ms, 8_000);
        return setTimeout(fn, options.timeout ? 1 : ms);
      },
    },
  );
  return { api, writes, renames, requests: () => requests };
}

test("the complete bundled catalog validates; unused fields/providers are stripped", () => {
  assert.deepEqual(snapshotSchema.parse(BUNDLED_CATALOG), BUNDLED_CATALOG);
  assert.equal(Object.keys(BUNDLED_CATALOG.providers).length, 7);
  const data = fixture().providers;
  assert.equal("extra" in catalogSchema.parse({ ...data, extra: {} }), false);
  assert.throws(() => catalogSchema.parse({ ...data, azure: { models: {} } }));
  data.openai.models["gpt-5"].cost = { input: -1, output: 1 };
  assert.throws(() => catalogSchema.parse(data));
});

test("provider prices, aliases, zero/missing prices and limits remain distinct", () => {
  const { api } = catalogHarness();
  const lookup = api.resolveModelMetadata;
  assert.equal(api.lookupCatalogModel("azure", "constructor"), undefined);
  assert.equal(api.lookupCatalogModel("azure", "__proto__"), undefined);
  assert.equal(
    lookup("gemini", "gemini-2.0-flash").pricing?.inputPerMTokens,
    0.1,
  );
  assert.equal(
    lookup("vertex", "gemini-2.0-flash").pricing?.inputPerMTokens,
    0.15,
  );
  assert.equal(
    lookup("azure", "deployment", "gpt-5").pricing?.inputPerMTokens,
    3,
  );
  assert.equal(
    lookup("bedrock", "anthropic.claude-sonnet-4-6-v1:0").pricing
      ?.inputPerMTokens,
    3.3,
  );
  assert.equal(
    lookup("bedrock", "apac.anthropic.claude-sonnet-4-6-v1:0").pricing
      ?.inputPerMTokens,
    3.3,
  );
  assert.equal(
    lookup("bedrock", "us.anthropic.claude-sonnet-4-6").pricing
      ?.inputPerMTokens,
    4,
  );
  assert.equal(lookup("vertex", "claude-sonnet-4-6").contextWindow, 100_000);
  assert.equal(lookup("openai", "gpt-5-20260101").pricing?.outputPerMTokens, 8);
  assert.equal(lookup("openai", "gpt-5-free").pricing?.inputPerMTokens, 0);
  assert.equal(lookup("openai", "gpt-5-free").pricing?.cacheReadPerMTokens, 0);
  const unknownPrice = lookup("openai", "gpt-5-unknown-price");
  assert.equal(unknownPrice.pricing, undefined);
  assert.equal(unknownPrice.contextWindow, 100_000);
  assert.equal(unknownPrice.maxOutputTokens, 10_000);
  assert.equal(lookup("azure", "deployment", "gpt-5-free").pricing, undefined);
  assert.equal(lookup("openai", "gpt-10-future").supportsReasoning, true);
  assert.equal(lookup("openai", "gpt-5-text").supportsReasoning, false);
  assert.equal(lookup("openai", "gpt-5-text").supportsImages, false);
  assert.equal(
    lookup("bedrock", "opaque", "claude-sonnet-4-6").supportsReasoning,
    false,
  );
  assert.equal(lookup("bedrock", "opaque").supportsImages, true);
  assert.equal(lookup("bedrock", "opaque").supportsReasoning, false);
});

test("refresh preserves valid metadata on offline, HTTP, parse and timeout failures", async () => {
  for (const options of [
    { fail: true },
    { status: 403 },
    { response: {} },
    { timeout: true },
  ]) {
    const h = catalogHarness(options);
    assert.equal(
      h.api.resolveModelMetadata("openai", "gpt-5").pricing?.inputPerMTokens,
      2,
    );
    await h.api.initModelCatalog();
    assert.equal(
      h.api.resolveModelMetadata("openai", "gpt-5").pricing?.inputPerMTokens,
      2,
    );
    assert.equal(h.writes.length, 0);
  }
});

test("newer valid cache loads offline; corrupt/older caches do not replace the bundle", async () => {
  const cached = fixture();
  cached.fetched_at = "2026-02-01T00:00:00.000Z";
  cached.providers.openai.models["gpt-5"].cost!.input = 7;
  const good = catalogHarness({ cache: JSON.stringify(cached), fail: true });
  await good.api.initModelCatalog();
  assert.equal(
    good.api.resolveModelMetadata("openai", "gpt-5").pricing?.inputPerMTokens,
    7,
  );
  cached.fetched_at = "2025-01-01T00:00:00.000Z";
  for (const cache of [
    "{broken",
    JSON.stringify(cached),
    JSON.stringify({ providers: {} }),
  ]) {
    const h = catalogHarness({ cache, fail: true });
    await h.api.initModelCatalog();
    assert.equal(
      h.api.resolveModelMetadata("openai", "gpt-5").pricing?.inputPerMTokens,
      2,
    );
  }
});

test("successful refresh is single-flight and atomically persists validated slim data", async () => {
  const updated = fixture().providers;
  updated.openai.models["gpt-5"].cost!.input = 9;
  const h = catalogHarness({ response: updated });
  await Promise.all([h.api.initModelCatalog(), h.api.initModelCatalog()]);
  assert.equal(h.requests(), 1);
  assert.equal(
    h.api.resolveModelMetadata("openai", "gpt-5").pricing?.inputPerMTokens,
    9,
  );
  assert.equal(h.writes[0][0], "/test/model-catalog.json.tmp");
  assert.deepEqual(h.renames, [
    ["/test/model-catalog.json.tmp", "/test/model-catalog.json"],
  ]);
  snapshotSchema.parse(JSON.parse(h.writes[0][1]));
});

test("discovery preserves unknown and empty lists, falls back on failures, and re-enriches cached descriptors", async () => {
  const updated = fixture().providers;
  updated.openai.models["gpt-5"].name = "Updated name";
  updated.openai.models["gpt-5"].reasoning = false;
  const h = catalogHarness({ response: updated });
  let now = 0;
  let mode = "ok";
  let requests = 0;
  const registry = loadModule<typeof import("./model-registry.js")>(
    "./model-registry.ts",
    {
      "./model-catalog.js": h.api,
      "../settings.js": {
        getConfiguredProviders: () => ({ openai: true }),
        getApiKey: () => "fixture-key",
        getGatewayProviderModels: () => [],
      },
    },
    {
      Date: { now: () => now },
      fetch: async () => {
        requests++;
        if (mode === "fail") throw new Error("offline");
        if (mode === "invalid") return Response.json({});
        return Response.json({
          data:
            mode === "empty"
              ? []
              : [
                  "gpt-5",
                  "gpt-10-future",
                  "gpt-5-text",
                  "gpt-5-unknown-price",
                ].map((id) => ({ id })),
        });
      },
    },
  );
  const first = await registry.fetchAvailableModels();
  assert.equal(first.length, 4);
  assert.equal(first.find((m) => m.id === "gpt-10-future")?.pricing, undefined);
  assert.equal(first.find((m) => m.id === "gpt-5-text")?.supportsImages, false);
  assert.equal(
    first.find((m) => m.id === "gpt-5-unknown-price")?.contextWindow,
    100_000,
  );
  await h.api.initModelCatalog();
  const refreshed = await registry.fetchAvailableModels();
  assert.equal(requests, 1);
  assert.equal(refreshed.find((m) => m.id === "gpt-5")?.name, "Updated name");
  assert.equal(
    refreshed.find((m) => m.id === "gpt-5")?.supportsReasoning,
    false,
  );
  const providers = loadModule<typeof import("./providers.js")>(
    "./providers.ts",
    { "./model-catalog.js": h.api },
  );
  const config =
    require("./provider-config.js") as typeof import("./provider-config.js");
  assert.equal(
    providers.getProviderOptions(config.resolvedDirectModelReference("gpt-5"))
      .openai?.reasoningEffort,
    undefined,
  );
  for (mode of ["fail", "invalid"]) {
    now += 300_001;
    assert.equal((await registry.fetchAvailableModels()).length, 4);
  }
  registry.invalidateModelCache();
  mode = "fail";
  const fallback = await registry.fetchAvailableModels();
  assert.ok(fallback.some((m) => m.id === "gpt-5"));
  assert.ok(
    !fallback.some((m) => m.id === "gpt-5-old" || m.id === "gpt-5-image"),
  );
  mode = "empty";
  assert.equal((await registry.fetchAvailableModels()).length, 0);
  now += 300_001;
  mode = "fail";
  assert.equal((await registry.fetchAvailableModels()).length, 0);
});

test("chat image validation honors explicit catalog capabilities before reading image files", async () => {
  const { api } = catalogHarness();
  const config =
    require("./provider-config.js") as typeof import("./provider-config.js");
  const providers =
    require("./providers.js") as typeof import("./providers.js");
  const schema = require("../db/schema.js") as typeof import("../db/schema.js");
  let handler: (req: any, res: any) => Promise<void> = async () =>
    assert.fail("missing route");
  let imageQueries = 0;
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: async () => {
          if (table === schema.projects)
            return [{ id: "project", path: "/unused" }];
          if (table === schema.conversations)
            return [{ id: "conversation", effort: "medium" }];
          if (table === schema.images) imageQueries++;
          return [];
        },
      }),
    }),
  };
  loadModule("../routes/chat.ts", {
    express: {
      Router: () => ({
        post: (_path: string, fn: typeof handler) => {
          handler = fn;
        },
        get() {},
        delete() {},
      }),
    },
    "../database.js": { getDb: () => db },
    "../ai/model-catalog.js": api,
    "../ai/providers.js": {
      ...providers,
      resolveModel: () => ({}),
      resolveModelReference: config.resolvedDirectModelReference,
    },
    "../ai/tools/index.js": {},
    "../native/notifications.js": {},
  });
  for (const id of ["gpt-5-text", "gpt-5"]) {
    let status: number | undefined;
    let body: { error: string } | undefined;
    const res = {
      status(value: number) {
        status = value;
        return res;
      },
      json(value: { error: string }) {
        body = value;
      },
    };
    await handler(
      {
        params: { projectId: "project" },
        body: {
          model_id: id,
          conversation_id: "conversation",
          messages: [
            {
              id: "message",
              role: "user",
              parts: [{ type: "text", text: "test" }],
            },
          ],
          image_ids: ["12345678-1234-4123-8123-123456789012"],
        },
      },
      res,
    );
    assert.equal(status, 422);
    assert.match(
      body!.error,
      id === "gpt-5-text"
        ? /does not support image input/
        : /no longer available/,
    );
  }
  assert.equal(imageQueries, 1);
});

test("context UI shows unknown costs as unavailable and retains explicit zero rates", () => {
  const { createElement } = require("react") as typeof import("react");
  const { renderToStaticMarkup } =
    require("react-dom/server") as typeof import("react-dom/server");
  const wrapper = ({ children }: { children: import("react").ReactNode }) =>
    createElement("div", null, children);
  const ui = loadModule<
    typeof import("../../renderer/components/ai-elements/context.js")
  >("../../renderer/components/ai-elements/context.tsx", {
    "@/components/ui/button": { Button: wrapper },
    "@/components/ui/hover-card": {
      HoverCard: wrapper,
      HoverCardContent: wrapper,
      HoverCardTrigger: wrapper,
    },
    "@/components/ui/progress": { Progress: wrapper },
    "@/lib/utils": { cn: () => "" },
  });
  const usage = {
    inputTokens: 20,
    outputTokens: 10,
    inputTokenDetails: { cacheReadTokens: 5, cacheWriteTokens: 5 },
  } as import("ai").LanguageModelUsage;
  const render = (pricing?: import("./model-catalog.js").ModelPricing) =>
    renderToStaticMarkup(
      createElement(
        ui.Context,
        { usedTokens: 30, maxTokens: 100_000, usage, pricing },
        createElement(ui.ContextContentFooter),
        createElement(ui.ContextCacheUsage),
        createElement(ui.ContextCacheWriteUsage),
      ),
    );
  assert.match(render(), /Unavailable/);
  assert.match(
    render({ inputPerMTokens: 1, outputPerMTokens: 2 }),
    /Unavailable/,
  );
  const free = render({
    inputPerMTokens: 0,
    outputPerMTokens: 0,
    cacheReadPerMTokens: 0,
    cacheWritePerMTokens: 0,
  });
  assert.doesNotMatch(free, /Unavailable/);
  assert.equal((free.match(/\$0\.000/g) ?? []).length, 3);
});

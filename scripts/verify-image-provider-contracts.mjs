import assert from "node:assert/strict";
import { experimental_generateImage as generateImage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

function parseJsonBody(init) {
  assert.equal(typeof init?.body, "string");
  return JSON.parse(init.body);
}

async function verifyOpenAIRequests() {
  const requests = [];
  const openai = createOpenAI({
    apiKey: "test-key",
    fetch: async (url, init) => {
      requests.push({ url: String(url), body: parseJsonBody(init) });
      return new Response(
        JSON.stringify({
          created: 1,
          data: [{ b64_json: "AA==" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  const models = [
    "gpt-image-2",
    "gpt-image-1.5",
    "gpt-image-1",
    "gpt-image-1-mini",
  ];

  for (const model of models) {
    const result = await generateImage({
      model: openai.image(model),
      prompt: "contract test",
      size: "1536x1024",
      providerOptions: { openai: { quality: "high" } },
    });
    assert.equal(result.images.length, 1);
  }

  assert.equal(requests.length, models.length);
  requests.forEach(({ url, body }, index) => {
    assert.ok(url.endsWith("/images/generations"));
    assert.equal(body.model, models[index]);
    assert.equal(body.size, "1536x1024");
    assert.equal(body.quality, "high");
    assert.equal(Object.hasOwn(body, "response_format"), false);
  });
}

async function verifyGeminiRequests() {
  const requests = [];
  const google = createGoogleGenerativeAI({
    apiKey: "test-key",
    fetch: async (url, init) => {
      requests.push({ url: String(url), body: parseJsonBody(init) });
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  { inlineData: { mimeType: "image/png", data: "AA==" } },
                ],
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 1,
            candidatesTokenCount: 1,
            totalTokenCount: 2,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  const cases = [
    {
      model: "gemini-3.1-flash-image",
      aspectRatio: "3:2",
      imageSize: "4K",
    },
    {
      model: "gemini-3.1-flash-lite-image",
      aspectRatio: "1:8",
      imageSize: "1K",
    },
    {
      model: "gemini-3-pro-image",
      aspectRatio: "16:9",
      imageSize: "2K",
    },
  ];

  for (const { model, aspectRatio, imageSize } of cases) {
    const result = await generateImage({
      model: google.image(model),
      prompt: "contract test",
      aspectRatio,
      providerOptions: {
        google: { imageConfig: { aspectRatio, imageSize } },
      },
    });
    assert.equal(result.images.length, 1);
  }

  assert.equal(requests.length, cases.length);
  requests.forEach(({ url, body }, index) => {
    const expected = cases[index];
    assert.ok(url.includes(`/models/${expected.model}:generateContent`));
    assert.deepEqual(body.generationConfig.responseModalities, ["IMAGE"]);
    assert.deepEqual(body.generationConfig.imageConfig, {
      aspectRatio: expected.aspectRatio,
      imageSize: expected.imageSize,
    });
  });
}

await verifyOpenAIRequests();
await verifyGeminiRequests();

console.log("Image provider request contracts verified.");

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import type { ProviderOptions } from "@ai-sdk/provider-utils";
import { getApiKey } from "../settings.js";

export const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];
export const DEFAULT_EFFORT: EffortLevel = "medium";

export function isEffortLevel(value: unknown): value is EffortLevel {
  return (
    typeof value === "string" &&
    (EFFORT_LEVELS as readonly string[]).includes(value)
  );
}

export type ProviderName = "anthropic" | "openai" | "gemini";

export function resolveProviderName(modelId: string): ProviderName {
  if (modelId.startsWith("claude-")) return "anthropic";
  if (modelId.startsWith("gemini-")) return "gemini";
  return "openai";
}

const MODEL_LABELS: Record<string, string> = {
  "claude-opus-4-7": "Opus 4.7",
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-haiku-4-5": "Haiku 4.5",
  "gpt-5.5": "GPT-5.5",
  "gpt-5-mini": "GPT-5 Mini",
  "gpt-5-nano": "GPT-5 Nano",
  "gemini-3.1-pro-preview": "Gemini 3.1 Pro Preview",
  "gemini-3-flash-preview": "Gemini 3 Flash Preview",
};

export function modelLabel(modelId: string): string {
  return MODEL_LABELS[modelId] ?? modelId;
}

export function resolveModel(modelId: string): LanguageModel {
  const provider = resolveProviderName(modelId);

  if (provider === "anthropic") {
    const key = getApiKey("anthropic");
    if (!key) throw new Error("Anthropic API key not configured");
    return createAnthropic({ apiKey: key })(modelId);
  }

  if (provider === "gemini") {
    const key = getApiKey("gemini");
    if (!key) throw new Error("Gemini API key not configured");
    return createGoogleGenerativeAI({ apiKey: key })(modelId);
  }

  const key = getApiKey("openai");
  if (!key) throw new Error("OpenAI API key not configured");
  return createOpenAI({ apiKey: key })(modelId);
}

/**
 * Map our unified effort level to each provider's native value range.
 *
 * Provider native ranges (verified against installed AI SDK provider zod enums):
 *   - Anthropic:  low | medium | high | xhigh | max   (full set, passes through)
 *   - OpenAI:     low | medium | high | xhigh         (no 'max'; clamp down)
 *   - Gemini:     minimal | low | medium | high       (no 'xhigh' or 'max'; clamp down)
 *
 * 'max' and 'xhigh' clamp to the highest available rung where unsupported.
 */
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
 * Per-provider options applied to every chat call. Effort comes from the
 * conversation (sticky once dialed; defaults to 'medium' on a new chat).
 *
 *   - Anthropic: extended thinking with adaptive budget + summarized display;
 *                contextManagement.clear_tool_uses_20250919 drops old tool-use
 *                blocks when input tokens exceed 100k, keeping the last 20 so
 *                long sessions don't blow past the model's context window.
 *   - OpenAI:    auto reasoning summaries; truncation 'auto' so the Responses
 *                API drops oldest turns instead of failing when the prompt
 *                nears the model's context limit; promptCacheRetention '24h'
 *                (max) for stickier auto-caching; promptCacheKey scoped per
 *                project so requests in the same project route to the same
 *                cache instance.
 *   - Gemini:    thinkingConfig with summaries, level dialed per conversation.
 */
export function getProviderOptions(
  modelId: string,
  context?: { projectId?: string; effort?: EffortLevel },
): ProviderOptions {
  const provider = resolveProviderName(modelId);
  const effort = context?.effort ?? DEFAULT_EFFORT;

  if (provider === "anthropic") {
    return {
      anthropic: {
        thinking: { type: "adaptive", display: "summarized" },
        effort,
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
        reasoningEffort: effortToOpenAI(effort),
        reasoningSummary: "auto",
        truncation: "auto",
        promptCacheRetention: "24h",
        ...(context?.projectId ? { promptCacheKey: context.projectId } : {}),
      },
    };
  }

  if (provider === "gemini") {
    return {
      google: {
        thinkingConfig: {
          thinkingLevel: effortToGemini(effort),
          includeThoughts: true,
        },
      },
    };
  }

  return {};
}

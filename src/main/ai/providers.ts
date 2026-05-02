import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import type { ProviderOptions } from '@ai-sdk/provider-utils';
import { getApiKey } from '../settings.js';

export type ProviderName = 'anthropic' | 'openai' | 'gemini';

export function resolveProviderName(modelId: string): ProviderName {
  if (modelId.startsWith('claude-')) return 'anthropic';
  if (modelId.startsWith('gemini-')) return 'gemini';
  return 'openai';
}

const MODEL_LABELS: Record<string, string> = {
  'claude-opus-4-7': 'Opus 4.7',
  'claude-sonnet-4-6': 'Sonnet 4.6',
  'claude-haiku-4-5': 'Haiku 4.5',
  'gpt-5.4': 'GPT-5.4',
  'gpt-5.4-mini': 'GPT-5.4 Mini',
  'gpt-5.4-nano': 'GPT-5.4 Nano',
  'gemini-3.1-pro-preview': 'Gemini 3.1 Pro Preview',
  'gemini-3-flash-preview': 'Gemini 3 Flash Preview',
};

export function modelLabel(modelId: string): string {
  return MODEL_LABELS[modelId] ?? modelId;
}

export function resolveModel(modelId: string): LanguageModel {
  const provider = resolveProviderName(modelId);

  if (provider === 'anthropic') {
    const key = getApiKey('anthropic');
    if (!key) throw new Error('Anthropic API key not configured');
    return createAnthropic({ apiKey: key })(modelId);
  }

  if (provider === 'gemini') {
    const key = getApiKey('gemini');
    if (!key) throw new Error('Gemini API key not configured');
    return createGoogleGenerativeAI({ apiKey: key })(modelId);
  }

  const key = getApiKey('openai');
  if (!key) throw new Error('OpenAI API key not configured');
  return createOpenAI({ apiKey: key })(modelId);
}

/**
 * Per-provider options applied to every chat call.
 *
 *   - Anthropic: extended thinking with adaptive budget + summarized display.
 *   - OpenAI:    high reasoning effort + auto reasoning summaries; truncation
 *                'auto' so the Responses API drops oldest turns instead of
 *                failing when the prompt nears the model's context limit.
 *   - Gemini:    thinkingConfig 'high' with summaries, mirroring the other
 *                providers' reasoning configuration.
 *
 * Applied by provider (not by model name prefix) so every OpenAI model
 * receives reasoning options, not just the ones starting with "o".
 */
export function getProviderOptions(modelId: string): ProviderOptions {
  const provider = resolveProviderName(modelId);

  if (provider === 'anthropic') {
    return {
      anthropic: {
        thinking: { type: 'adaptive', display: 'summarized' },
        effort: 'high',
        sendReasoning: true,
      },
    };
  }

  if (provider === 'openai') {
    return {
      openai: {
        reasoningEffort: 'high',
        reasoningSummary: 'auto',
        truncation: 'auto',
      },
    };
  }

  if (provider === 'gemini') {
    return {
      google: {
        thinkingConfig: {
          thinkingLevel: 'high',
          includeThoughts: true,
        },
      },
    };
  }

  return {};
}

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import { getApiKey } from '../settings.js';

export type ProviderName = 'anthropic' | 'openai' | 'gemini';

export function resolveProviderName(modelId: string): ProviderName {
  if (modelId.startsWith('claude-')) return 'anthropic';
  if (modelId.startsWith('gemini-')) return 'gemini';
  return 'openai';
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
 * Per-provider options for the DocumentCollaborator agent.
 *
 * Matches Laravel's DocumentCollaborator::providerOptions():
 *   - Anthropic: thinking (enabled, 10k budget tokens)
 *   - OpenAI:    reasoning (effort=high, summary=auto)
 *   - Gemini:    no options
 *
 * Applied by provider (not by model name prefix) so every OpenAI model
 * receives reasoning options, not just the ones starting with "o".
 */
export function getProviderOptions(modelId: string): Record<string, unknown> {
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
      },
    };
  }

  return {};
}

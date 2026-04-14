import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import { getApiKey } from '../settings.js';

export function resolveModel(modelId: string): LanguageModel {
  if (modelId.startsWith('claude-')) {
    const key = getApiKey('anthropic');
    if (!key) throw new Error('Anthropic API key not configured');
    return anthropic(modelId, { apiKey: key });
  }

  if (modelId.startsWith('gemini-')) {
    const key = getApiKey('gemini');
    if (!key) throw new Error('Gemini API key not configured');
    return google(modelId, { apiKey: key });
  }

  // Default to OpenAI
  const key = getApiKey('openai');
  if (!key) throw new Error('OpenAI API key not configured');
  return openai(modelId, { apiKey: key });
}

export function resolveProviderName(modelId: string): string {
  if (modelId.startsWith('claude-')) return 'anthropic';
  if (modelId.startsWith('gemini-')) return 'gemini';
  return 'openai';
}

export function getProviderOptions(modelId: string): Record<string, unknown> {
  if (modelId.startsWith('claude-')) {
    return {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 10_000 },
      },
    };
  }

  if (modelId.startsWith('o') || modelId.includes('reasoning')) {
    return {
      openai: {
        reasoning: { effort: 'high', summary: 'auto' },
      },
    };
  }

  return {};
}

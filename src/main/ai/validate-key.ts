/**
 * Validates an API key by making a lightweight authenticated request to the provider.
 *
 * Returns true on a successful (2xx) response OR on a request timeout —
 * so a slow/unreachable provider doesn't block a user from saving an
 * otherwise correct key. Definitive failures (4xx/5xx responses and
 * non-timeout connection errors) return false.
 */

const TIMEOUT_MS = 10_000;

export type Provider = 'anthropic' | 'openai' | 'gemini';

export async function validateApiKey(provider: Provider, key: string): Promise<boolean> {
  switch (provider) {
    case 'anthropic': return validateAnthropic(key);
    case 'openai': return validateOpenAi(key);
    case 'gemini': return validateGemini(key);
  }
}

async function validateAnthropic(key: string): Promise<boolean> {
  return safeRequest('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
  });
}

async function validateOpenAi(key: string): Promise<boolean> {
  return safeRequest('https://api.openai.com/v1/models', {
    headers: {
      Authorization: `Bearer ${key}`,
    },
  });
}

async function validateGemini(key: string): Promise<boolean> {
  const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
  url.searchParams.set('key', key);
  return safeRequest(url.toString());
}

async function safeRequest(url: string, init?: RequestInit): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res.ok;
  } catch (err) {
    // Treat timeouts as passing (so slow/unreachable providers don't block saving).
    // All other network errors are definitive failures.
    if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
      return true;
    }
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

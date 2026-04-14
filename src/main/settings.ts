import Store from 'electron-store';
import { safeStorage } from 'electron';

interface SettingsSchema {
  autosave: boolean;
  notifications: boolean;
  useTrash: boolean;
  onboardingCompleted: boolean;
  projectTourCompleted: boolean;
  // API keys stored encrypted
  apiKeys: {
    anthropic?: string;
    openai?: string;
    gemini?: string;
  };
}

const store = new Store<SettingsSchema>({
  defaults: {
    autosave: true,
    notifications: true,
    useTrash: true,
    onboardingCompleted: false,
    projectTourCompleted: false,
    apiKeys: {},
  },
});

// ─── Generic settings ──────────────────────────────────────

export function getSetting<K extends keyof SettingsSchema>(key: K): SettingsSchema[K] {
  return store.get(key);
}

export function setSetting<K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]): void {
  store.set(key, value);
}

// ─── Encrypted API keys ────────────────────────────────────

export function getApiKey(provider: 'anthropic' | 'openai' | 'gemini'): string | undefined {
  const encrypted = store.get('apiKeys')[provider];
  if (!encrypted) return undefined;

  try {
    const buffer = Buffer.from(encrypted, 'base64');
    return safeStorage.decryptString(buffer);
  } catch {
    return undefined;
  }
}

export function setApiKey(provider: 'anthropic' | 'openai' | 'gemini', key: string): void {
  const encrypted = safeStorage.encryptString(key).toString('base64');
  const keys = store.get('apiKeys');
  keys[provider] = encrypted;
  store.set('apiKeys', keys);
}

export function deleteApiKey(provider: 'anthropic' | 'openai' | 'gemini'): void {
  const keys = store.get('apiKeys');
  delete keys[provider];
  store.set('apiKeys', keys);
}

export function getConfiguredProviders(): { anthropic: boolean; openai: boolean; gemini: boolean } {
  const keys = store.get('apiKeys');
  return {
    anthropic: !!keys.anthropic,
    openai: !!keys.openai,
    gemini: !!keys.gemini,
  };
}

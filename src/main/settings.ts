import { safeStorage } from 'electron';

export type EffortLevel = 'low' | 'medium' | 'high' | 'max';
export const DEFAULT_EFFORT: EffortLevel = 'high';

interface SettingsSchema {
  autosave: boolean;
  notifications: boolean;
  agentChime: boolean;
  useTrash: boolean;
  onboardingCompleted: boolean;
  projectTourCompleted: boolean;
  apiKeys: {
    anthropic?: string;
    openai?: string;
    gemini?: string;
  };
  modelEffort: Record<string, EffortLevel>;
}

const DEFAULTS: SettingsSchema = {
  autosave: true,
  notifications: true,
  agentChime: true,
  useTrash: true,
  onboardingCompleted: false,
  projectTourCompleted: false,
  apiKeys: {},
  modelEffort: {},
};

type StoreLike = {
  get: <K extends keyof SettingsSchema>(key: K) => SettingsSchema[K];
  set: <K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]) => void;
};

let _store: StoreLike | null = null;
let _storePromise: Promise<StoreLike> | null = null;

export async function initSettings(): Promise<void> {
  if (_store) return;
  if (_storePromise) { await _storePromise; return; }

  _storePromise = (async () => {
    // Dynamic import — electron-store is ESM-only
    const { default: Store } = await import('electron-store');
    _store = new Store<SettingsSchema>({
      name: 'trident-settings',
      defaults: DEFAULTS,
    }) as unknown as StoreLike;
    return _store;
  })();

  await _storePromise;
}

function store(): StoreLike {
  if (!_store) {
    throw new Error('Settings not initialized. Call initSettings() first.');
  }
  return _store;
}

// ─── Generic settings ──────────────────────────────────────

export function getSetting<K extends keyof SettingsSchema>(key: K): SettingsSchema[K] {
  return store().get(key);
}

export function setSetting<K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]): void {
  store().set(key, value);
}

// ─── Encrypted API keys ────────────────────────────────────

export function getApiKey(provider: 'anthropic' | 'openai' | 'gemini'): string | undefined {
  const encrypted = store().get('apiKeys')[provider];
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
  const keys = store().get('apiKeys');
  keys[provider] = encrypted;
  store().set('apiKeys', keys);
}

export function deleteApiKey(provider: 'anthropic' | 'openai' | 'gemini'): void {
  const keys = store().get('apiKeys');
  delete keys[provider];
  store().set('apiKeys', keys);
}

export function getConfiguredProviders(): { anthropic: boolean; openai: boolean; gemini: boolean } {
  const keys = store().get('apiKeys');
  return {
    anthropic: !!keys.anthropic,
    openai: !!keys.openai,
    gemini: !!keys.gemini,
  };
}

// ─── Per-model reasoning effort ────────────────────────────

export function getModelEffort(modelId: string): EffortLevel {
  return (store().get('modelEffort') ?? {})[modelId] ?? DEFAULT_EFFORT;
}

export function setModelEffort(modelId: string, level: EffortLevel): void {
  const current = store().get('modelEffort') ?? {};
  store().set('modelEffort', { ...current, [modelId]: level });
}

export function resetModelEffort(modelId: string): void {
  const current = { ...(store().get('modelEffort') ?? {}) };
  delete current[modelId];
  store().set('modelEffort', current);
}

export function getAllModelEfforts(): Record<string, EffortLevel> {
  return store().get('modelEffort') ?? {};
}

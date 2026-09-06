import { safeStorage } from "electron";
import type {
  DirectProviderId,
  GatewayModelConfig,
  GatewayProviderConfig,
  GatewayProviderId,
  ProviderId,
} from "./ai/provider-config.js";
import {
  GATEWAY_PROVIDER_IDS,
  PROVIDER_IDS,
  containsControlCharacters,
  isDirectProviderId,
  isGatewayModelConfigArray,
  normalizeAzureEndpoint,
  parseServiceAccountJson,
} from "./ai/provider-config.js";

interface StoredGatewayProvider {
  config: Record<string, unknown>;
  encryptedSecrets?: string;
}

export type AppTheme = "system" | "light" | "dark";

interface SettingsSchema {
  theme: AppTheme;
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
  gatewayProviders: Partial<Record<GatewayProviderId, StoredGatewayProvider>>;
}

const DEFAULTS: SettingsSchema = {
  theme: "system",
  autosave: true,
  notifications: true,
  agentChime: true,
  useTrash: true,
  onboardingCompleted: false,
  projectTourCompleted: false,
  apiKeys: {},
  gatewayProviders: {},
};

type StoreLike = {
  get: <K extends keyof SettingsSchema>(key: K) => SettingsSchema[K];
  set: <K extends keyof SettingsSchema>(
    key: K,
    value: SettingsSchema[K],
  ) => void;
};

let _store: StoreLike | null = null;
let _storePromise: Promise<StoreLike> | null = null;

export async function initSettings(): Promise<void> {
  if (_store) return;
  if (_storePromise) {
    await _storePromise;
    return;
  }

  _storePromise = (async () => {
    // Dynamic import — electron-store is ESM-only
    const { default: Store } = await import("electron-store");
    _store = new Store<SettingsSchema>({
      name: "trident-settings",
      defaults: DEFAULTS,
    }) as unknown as StoreLike;
    return _store;
  })();

  await _storePromise;
}

function store(): StoreLike {
  if (!_store) {
    throw new Error("Settings not initialized. Call initSettings() first.");
  }
  return _store;
}

// ─── Generic settings ──────────────────────────────────────

export function getSetting<K extends keyof SettingsSchema>(
  key: K,
): SettingsSchema[K] {
  return store().get(key);
}

export function setSetting<K extends keyof SettingsSchema>(
  key: K,
  value: SettingsSchema[K],
): void {
  store().set(key, value);
}

// ─── Encrypted API keys ────────────────────────────────────

export function isApiKeyEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

function storedApiKeys(): SettingsSchema["apiKeys"] {
  const value = store().get("apiKeys") as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as SettingsSchema["apiKeys"];
}

export function getApiKey(provider: DirectProviderId): string | undefined {
  const encrypted = storedApiKeys()[provider];
  if (typeof encrypted !== "string" || !encrypted) return undefined;

  try {
    const buffer = Buffer.from(encrypted, "base64");
    return safeStorage.decryptString(buffer);
  } catch {
    return undefined;
  }
}

export function setApiKey(provider: DirectProviderId, key: string): void {
  // Without an OS-level keyring, safeStorage on Linux falls back to writing a
  // "v10"-prefixed plaintext buffer. Refuse rather than persist a key that
  // would land on disk effectively unencrypted.
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "OS keychain encryption is not available; refusing to store API key.",
    );
  }
  const encrypted = safeStorage.encryptString(key).toString("base64");
  const keys = storedApiKeys();
  store().set("apiKeys", { ...keys, [provider]: encrypted });
}

export function deleteApiKey(provider: DirectProviderId): void {
  const keys = { ...storedApiKeys() };
  delete keys[provider];
  store().set("apiKeys", keys);
}

/**
 * Whether a credential is stored for each direct provider. This deliberately
 * tests for the stored ciphertext rather than decrypting it: the OS keychain
 * can be temporarily unavailable (a locked Linux keyring, a denied macOS
 * prompt), and treating that as "no credentials" would report a configured
 * install as blank and trap the user behind onboarding. Decryption failures
 * surface at the point of use instead, where the error is actionable.
 */
export function getConfiguredProviders(): {
  anthropic: boolean;
  openai: boolean;
  gemini: boolean;
} {
  const keys = storedApiKeys();
  return {
    anthropic: !!keys.anthropic,
    openai: !!keys.openai,
    gemini: !!keys.gemini,
  };
}

// ─── Encrypted gateway credentials ─────────────────────────

function encryptSecretBundle(bundle: Record<string, string>): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "OS keychain encryption is not available; refusing to store provider credentials.",
    );
  }
  return safeStorage.encryptString(JSON.stringify(bundle)).toString("base64");
}

function decryptSecretBundle(
  encrypted: string | undefined,
): Record<string, string> | undefined {
  if (!encrypted) return {};
  try {
    const json = safeStorage.decryptString(Buffer.from(encrypted, "base64"));
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }
    const entries = Object.entries(parsed);
    if (entries.some(([, value]) => typeof value !== "string")) {
      return undefined;
    }
    return Object.fromEntries(entries) as Record<string, string>;
  } catch {
    return undefined;
  }
}

function gatewayStorageParts(config: GatewayProviderConfig): {
  plain: Record<string, unknown>;
  secrets: Record<string, string>;
} {
  if (config.provider === "bedrock") {
    const secrets: Record<string, string> = {};
    if (config.authType === "accessKey") {
      if (config.accessKeyId) secrets.accessKeyId = config.accessKeyId;
      if (config.secretAccessKey)
        secrets.secretAccessKey = config.secretAccessKey;
      if (config.sessionToken) secrets.sessionToken = config.sessionToken;
    } else if (config.authType === "apiKey" && config.apiKey) {
      secrets.apiKey = config.apiKey;
    }
    return {
      plain: {
        provider: config.provider,
        authType: config.authType,
        region: config.region,
        models: config.models,
      },
      secrets,
    };
  }

  if (config.provider === "vertex") {
    const secrets: Record<string, string> = {};
    if (config.authType === "apiKey" && config.apiKey) {
      secrets.apiKey = config.apiKey;
    } else if (
      config.authType === "serviceAccount" &&
      config.serviceAccountJson
    ) {
      secrets.serviceAccountJson = config.serviceAccountJson;
    }
    return {
      plain: {
        provider: config.provider,
        authType: config.authType,
        ...(config.project ? { project: config.project } : {}),
        location: config.location,
        models: config.models,
      },
      secrets,
    };
  }

  return {
    plain: {
      provider: config.provider,
      endpoint: config.endpoint,
      ...(config.apiVersion ? { apiVersion: config.apiVersion } : {}),
      deployments: config.deployments,
    },
    secrets: { apiKey: config.apiKey },
  };
}

function storedGatewayProviders(): Partial<
  Record<GatewayProviderId, StoredGatewayProvider>
> {
  const value = store().get("gatewayProviders") as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Partial<Record<GatewayProviderId, StoredGatewayProvider>>;
}

/**
 * Writes a complete gateway connection with one electron-store set. Validation
 * happens before this function is called, so a failed replacement never
 * destroys the last working configuration.
 */
export function setGatewayProviderConfig(config: GatewayProviderConfig): void {
  const { plain, secrets } = gatewayStorageParts(config);
  const encryptedSecrets =
    Object.keys(secrets).length > 0 ? encryptSecretBundle(secrets) : undefined;
  const current = storedGatewayProviders();
  store().set("gatewayProviders", {
    ...current,
    [config.provider]: {
      config: plain,
      ...(encryptedSecrets ? { encryptedSecrets } : {}),
    },
  });
}

export function getGatewayProviderConfig(
  provider: GatewayProviderId,
): GatewayProviderConfig | undefined {
  const stored = storedGatewayProviders()[provider];
  if (!stored || !stored.config || typeof stored.config !== "object") {
    return undefined;
  }
  const secrets = decryptSecretBundle(stored.encryptedSecrets);
  if (!secrets) return undefined;

  const plain = stored.config;
  if (provider === "bedrock") {
    if (
      plain.provider !== "bedrock" ||
      (plain.authType !== "accessKey" &&
        plain.authType !== "profile" &&
        plain.authType !== "apiKey") ||
      typeof plain.region !== "string" ||
      !plain.region ||
      plain.region.length > 64 ||
      !/^[a-z0-9-]+$/.test(plain.region) ||
      !isGatewayModelConfigArray(plain.models)
    ) {
      return undefined;
    }
    if (
      (plain.authType === "accessKey" &&
        (!secrets.accessKeyId || !secrets.secretAccessKey)) ||
      (plain.authType === "apiKey" && !secrets.apiKey)
    ) {
      return undefined;
    }
    return {
      provider,
      authType: plain.authType,
      region: plain.region,
      models: plain.models,
      ...(secrets.accessKeyId ? { accessKeyId: secrets.accessKeyId } : {}),
      ...(secrets.secretAccessKey
        ? { secretAccessKey: secrets.secretAccessKey }
        : {}),
      ...(secrets.sessionToken ? { sessionToken: secrets.sessionToken } : {}),
      ...(secrets.apiKey ? { apiKey: secrets.apiKey } : {}),
    };
  }

  if (provider === "vertex") {
    if (
      plain.provider !== "vertex" ||
      (plain.authType !== "apiKey" &&
        plain.authType !== "serviceAccount" &&
        plain.authType !== "adc") ||
      typeof plain.location !== "string" ||
      !plain.location ||
      plain.location.length > 64 ||
      !/^[a-z0-9-]+$/.test(plain.location) ||
      (plain.authType !== "apiKey" &&
        (typeof plain.project !== "string" || !plain.project.trim())) ||
      (plain.project !== undefined &&
        (typeof plain.project !== "string" ||
          plain.project.length > 256 ||
          containsControlCharacters(plain.project))) ||
      !isGatewayModelConfigArray(plain.models)
    ) {
      return undefined;
    }
    if (
      (plain.authType === "apiKey" && !secrets.apiKey) ||
      (plain.authType === "serviceAccount" &&
        !parseServiceAccountJson(secrets.serviceAccountJson))
    ) {
      return undefined;
    }
    return {
      provider,
      authType: plain.authType,
      ...(typeof plain.project === "string" ? { project: plain.project } : {}),
      location: plain.location,
      models: plain.models,
      ...(secrets.apiKey ? { apiKey: secrets.apiKey } : {}),
      ...(secrets.serviceAccountJson
        ? { serviceAccountJson: secrets.serviceAccountJson }
        : {}),
    };
  }

  if (
    plain.provider !== "azure" ||
    typeof plain.endpoint !== "string" ||
    plain.endpoint.length > 2_048 ||
    (plain.apiVersion !== undefined &&
      (typeof plain.apiVersion !== "string" ||
        plain.apiVersion.length > 128 ||
        containsControlCharacters(plain.apiVersion))) ||
    !isGatewayModelConfigArray(plain.deployments) ||
    !secrets.apiKey
  ) {
    return undefined;
  }
  // Normalize on read rather than requiring the stored value to already be
  // canonical: pinning it to the current normalizer would silently invalidate
  // every saved connection the next time that function learns a new endpoint
  // form, with the credentials still sitting in the store.
  let endpoint: string;
  try {
    endpoint = normalizeAzureEndpoint(plain.endpoint);
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password) {
      return undefined;
    }
  } catch {
    return undefined;
  }
  return {
    provider,
    apiKey: secrets.apiKey,
    endpoint,
    ...(typeof plain.apiVersion === "string"
      ? { apiVersion: plain.apiVersion }
      : {}),
    deployments: plain.deployments,
  };
}

export function deleteGatewayProviderConfig(provider: GatewayProviderId): void {
  const current = storedGatewayProviders();
  const next = { ...current };
  delete next[provider];
  store().set("gatewayProviders", next);
}

export interface ProviderStatus {
  configured: boolean;
  detail?: string;
  modelCount: number;
}

export interface ProviderStatusResponse {
  providers: Record<ProviderId, ProviderStatus>;
  anyConfigured: boolean;
}

/**
 * Connection status for a gateway provider, derived from the stored plain
 * configuration without touching the encrypted secret bundle. Like
 * getConfiguredProviders, status must not depend on the OS keychain being
 * readable right now — otherwise a locked keyring reports every configured
 * gateway as missing.
 */
/**
 * The models configured for a gateway connection, read from the plain half of
 * its stored configuration. Enumerating models needs no credentials, so this
 * deliberately avoids decrypting the secret bundle — that would put an OS
 * keychain round trip on a path the chat pane hits on every mount.
 */
export function getGatewayProviderModels(
  provider: GatewayProviderId,
): GatewayModelConfig[] | undefined {
  const plain = storedGatewayProviders()[provider]?.config;
  if (!plain || typeof plain !== "object" || plain.provider !== provider) {
    return undefined;
  }
  const models = provider === "azure" ? plain.deployments : plain.models;
  return isGatewayModelConfigArray(models) ? models : undefined;
}

function storedGatewayProviderStatus(
  provider: GatewayProviderId,
): ProviderStatus | undefined {
  const plain = storedGatewayProviders()[provider]?.config;
  if (!plain || typeof plain !== "object" || plain.provider !== provider) {
    return undefined;
  }
  const models = getGatewayProviderModels(provider);
  if (!models) return undefined;
  return {
    configured: true,
    detail: gatewayDetail(provider, plain),
    modelCount: models.length,
  };
}

// Summarizes a connection from the non-secret half of its stored configuration.
function gatewayDetail(
  provider: GatewayProviderId,
  plain: Record<string, unknown>,
): string {
  const text = (value: unknown): string =>
    typeof value === "string" ? value : "";

  if (provider === "bedrock") {
    const auth =
      plain.authType === "accessKey"
        ? "Access key"
        : plain.authType === "apiKey"
          ? "API key"
          : "AWS profile";
    return `${text(plain.region)} · ${auth}`;
  }
  if (provider === "vertex") {
    const auth =
      plain.authType === "serviceAccount"
        ? "Service account"
        : plain.authType === "apiKey"
          ? "API key"
          : "Application default credentials";
    const project = text(plain.project);
    return `${project ? `${project} · ` : ""}${text(plain.location)} · ${auth}`;
  }
  const endpoint = text(plain.endpoint);
  try {
    return new URL(endpoint).hostname;
  } catch {
    return endpoint;
  }
}

export function getProviderStatusResponse(): ProviderStatusResponse {
  const direct = getConfiguredProviders();
  const providers = Object.fromEntries(
    PROVIDER_IDS.map((provider) => {
      const configured = isDirectProviderId(provider) && direct[provider];
      return [
        provider,
        {
          configured,
          ...(configured ? { detail: "API key" } : {}),
          modelCount: 0,
        },
      ];
    }),
  ) as Record<ProviderId, ProviderStatus>;

  for (const provider of GATEWAY_PROVIDER_IDS) {
    const status = storedGatewayProviderStatus(provider);
    if (status) providers[provider] = status;
  }

  return {
    providers,
    anyConfigured: Object.values(providers).some((item) => item.configured),
  };
}

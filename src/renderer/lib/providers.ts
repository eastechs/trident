export const PROVIDER_IDS = [
  "anthropic",
  "openai",
  "gemini",
  "bedrock",
  "vertex",
  "azure",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];
export type ProviderGroupId = "direct" | "cloud";

export interface ProviderDefinition {
  id: ProviderId;
  label: string;
  description: string;
  group: ProviderGroupId;
  logo: string;
}

export interface ProviderConnectionStatus {
  configured: boolean;
  detail?: string;
  modelCount: number;
}

export interface ProviderSettingsResponse {
  providers: Record<ProviderId, ProviderConnectionStatus>;
  anyConfigured: boolean;
}

export const PROVIDER_CATALOG: Record<ProviderId, ProviderDefinition> = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    description: "Connect directly to Claude models with an Anthropic API key.",
    group: "direct",
    logo: "anthropic",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    description: "Connect directly to GPT models with an OpenAI API key.",
    group: "direct",
    logo: "openai",
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    description: "Connect directly to Gemini models with a Google AI API key.",
    group: "direct",
    logo: "google",
  },
  bedrock: {
    id: "bedrock",
    label: "Amazon Bedrock",
    description: "Use approved foundation models through your AWS account.",
    group: "cloud",
    logo: "amazon-bedrock",
  },
  vertex: {
    id: "vertex",
    label: "Google Vertex AI",
    description: "Use Gemini or partner models through Google Cloud.",
    group: "cloud",
    logo: "google-vertex",
  },
  azure: {
    id: "azure",
    label: "Azure OpenAI",
    description: "Use your Azure-hosted OpenAI model deployments.",
    group: "cloud",
    logo: "azure",
  },
};

export const PROVIDER_GROUPS: Array<{
  id: ProviderGroupId;
  label: string;
  description: string;
  providers: ProviderId[];
}> = [
  {
    id: "direct",
    label: "Direct APIs",
    description: "Connect with an API key from the model provider.",
    providers: ["anthropic", "openai", "gemini"],
  },
  {
    id: "cloud",
    label: "Cloud platforms",
    description: "Route models through your organization’s cloud account.",
    providers: ["bedrock", "vertex", "azure"],
  },
];

export function emptyProviderSettings(): ProviderSettingsResponse {
  return {
    providers: Object.fromEntries(
      PROVIDER_IDS.map((provider) => [
        provider,
        { configured: false, modelCount: 0 },
      ]),
    ) as Record<ProviderId, ProviderConnectionStatus>,
    anyConfigured: false,
  };
}

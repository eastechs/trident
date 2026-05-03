export interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  filesystem_root: string | null;
  initial_prompt: string | null;
  embeddings_enabled: boolean;
  path: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentData {
  id: string;
  name: string;
  created_by: string | null;
  last_edited_by: string | null;
  directory: string;
}

export interface ImageMetadata {
  prompt?: string;
  size?: string;
  quality?: string;
  model?: string;
}

export interface ImageData {
  id: string;
  name: string;
  created_by: string | null;
  mime_type?: string;
  metadata?: ImageMetadata | null;
  created_at?: string;
}

export type EffortLevel = "low" | "medium" | "high" | "xhigh" | "max";

export interface ConversationData {
  id: string;
  title: string;
  side: string | null;
  model: string | null;
  effort: EffortLevel;
  updated_at: string;
  message_count: number;
}

export interface ModelPricing {
  inputPerMTokens: number;
  outputPerMTokens: number;
  cacheReadPerMTokens?: number;
  cacheWritePerMTokens?: number;
  contextWindow?: number;
  maxOutputTokens?: number;
}

export interface ModelInfo {
  id: string;
  provider: "Anthropic" | "OpenAI" | "Gemini";
  providerSlug: "anthropic" | "openai" | "google";
  name: string;
  pricing?: ModelPricing;
}

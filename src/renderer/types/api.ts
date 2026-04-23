export interface ProjectData {
    id: string;
    name: string;
    description: string | null;
    filesystem_root: string | null;
    initial_prompt: string | null;
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

export interface ImageData {
    id: string;
    name: string;
    created_by: string | null;
}

export interface ConversationData {
    id: string;
    title: string;
    side: string | null;
    model: string | null;
    updated_at: string;
    message_count: number;
}

export interface ModelInfo {
    id: string;
    provider: 'Anthropic' | 'OpenAI' | 'Gemini';
    providerSlug: 'anthropic' | 'openai' | 'google';
    name: string;
}

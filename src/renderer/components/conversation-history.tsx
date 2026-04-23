import { MessageSquareIcon, MessageSquarePlusIcon } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { ModelSelectorLogo } from '@/components/ai-elements/model-selector';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ConversationData } from '@/types/api';

interface ConversationHistoryProps {
    conversations: ConversationData[];
    activeId: string | null;
    otherSideActiveId: string | null;
    onSelect: (id: string) => void;
    onRename: (id: string, title: string) => void;
    onDelete: (id: string) => void;
    onNewChat: () => void;
}

function getModelInfo(model: string | null): { providerSlug: string; displayName: string } | null {
    if (!model) {
        return null;
    }

    if (model.startsWith('claude-')) {
        const rest = model.replace('claude-', '');
        const parts = rest.split('-');
        const family = parts[0];
        const version = parts.slice(1).join('.');
        const familyCased = family.charAt(0).toUpperCase() + family.slice(1);

        return {
            providerSlug: 'anthropic',
            displayName: version ? `${familyCased} ${version}` : familyCased,
        };
    }

    if (model.startsWith('gpt-')) {
        const rest = model.replace('gpt-', '');
        const parts = rest.split('-');
        const version = parts[0];
        const variant = parts
            .slice(1)
            .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
            .join(' ');

        return {
            providerSlug: 'openai',
            displayName: variant ? `GPT-${version} ${variant}` : `GPT-${version}`,
        };
    }

    if (model.startsWith('gemini-')) {
        const rest = model.replace('gemini-', '');
        const parts = rest.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1));

        return {
            providerSlug: 'google',
            displayName: `Gemini ${parts.join(' ')}`,
        };
    }

    return {
        providerSlug: 'anthropic',
        displayName: model,
    };
}

function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) {
        return 'Just now';
    }

    if (diffMinutes < 60) {
        return `${diffMinutes}m ago`;
    }

    if (diffHours < 24) {
        return `${diffHours}h ago`;
    }

    if (diffDays < 7) {
        return `${diffDays}d ago`;
    }

    return date.toLocaleDateString();
}

export function ConversationHistory({ conversations, activeId, otherSideActiveId, onSelect, onRename, onDelete, onNewChat }: ConversationHistoryProps) {
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const renameInputRef = useRef<HTMLInputElement>(null);
    const renameStartTime = useRef<number>(0);

    const startRename = useCallback((id: string, currentTitle: string) => {
        setRenamingId(id);
        setRenameValue(currentTitle);
        renameStartTime.current = Date.now();
        setTimeout(() => {
            renameInputRef.current?.focus();
            renameInputRef.current?.select();
        }, 50);
    }, []);

    const submitRename = useCallback((id: string) => {
        const trimmed = renameValue.trim();

        if (trimmed) {
            onRename(id, trimmed);
        }

        setRenamingId(null);
    }, [renameValue, onRename]);

    const cancelRename = useCallback(() => {
        setRenamingId(null);
    }, []);

    return (
        <TooltipProvider delayDuration={300}>
            <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-1.5">
                {conversations.length === 0 && (
                    <div className="flex h-full flex-col items-center justify-center gap-3 px-4">
                        <button
                            type="button"
                            onClick={onNewChat}
                            className="flex items-center gap-2 rounded-lg border border-dashed border-muted-foreground/25 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:bg-muted/50 hover:text-foreground"
                        >
                            <MessageSquarePlusIcon className="size-4" />
                            New conversation
                        </button>
                    </div>
                )}
                {conversations.map((conversation) => {
                    const isActive = conversation.id === activeId;
                    const isOtherSide = conversation.id === otherSideActiveId;
                    const modelInfo = getModelInfo(conversation.model);

                    if (isOtherSide) {
                        return (
                            <Tooltip key={conversation.id}>
                                <TooltipTrigger asChild>
                                    <div className="flex cursor-not-allowed items-center rounded-md px-3 py-2 opacity-50">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex min-w-0 items-center gap-2">
                                                {modelInfo ? (
                                                    <ModelSelectorLogo provider={modelInfo.providerSlug} className="size-4 shrink-0" />
                                                ) : (
                                                    <MessageSquareIcon className="size-3.5 shrink-0 text-muted-foreground/60" />
                                                )}
                                                <div className="truncate text-sm text-muted-foreground">{conversation.title}</div>
                                            </div>
                                            <div className="text-xs text-muted-foreground/60">{formatRelativeTime(conversation.updated_at)}</div>
                                        </div>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="right">Open in other panel</TooltipContent>
                            </Tooltip>
                        );
                    }

                    return (
                        <ContextMenu key={conversation.id}>
                            <ContextMenuTrigger asChild>
                                <button
                                    type="button"
                                    onClick={() => onSelect(conversation.id)}
                                    className={`flex w-full items-center rounded-md px-3 py-2 text-left transition-colors ${
                                        isActive
                                            ? 'bg-muted text-foreground'
                                            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                                    }`}
                                >
                                    <div className="min-w-0 flex-1">
                                        {renamingId === conversation.id ? (
                                            <input
                                                ref={renameInputRef}
                                                type="text"
                                                value={renameValue}
                                                onChange={(e) => setRenameValue(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        submitRename(conversation.id);
                                                    }

                                                    if (e.key === 'Escape') {
                                                        cancelRename();
                                                    }
                                                }}
                                                onBlur={() => {
                                                    if (Date.now() - renameStartTime.current > 100) {
                                                        submitRename(conversation.id);
                                                    }
                                                }}
                                                className="w-full bg-transparent text-sm outline-none"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <div className="flex min-w-0 items-center gap-2">
                                                {modelInfo ? (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span
                                                                className="flex shrink-0 cursor-default items-center"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <ModelSelectorLogo provider={modelInfo.providerSlug} className="size-4" />
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="right">{modelInfo.displayName}</TooltipContent>
                                                    </Tooltip>
                                                ) : (
                                                    <MessageSquareIcon className="size-3.5 shrink-0 text-muted-foreground/60" />
                                                )}
                                                <div className="truncate text-sm font-medium">{conversation.title}</div>
                                            </div>
                                        )}
                                        <div className="text-xs text-muted-foreground/60">{formatRelativeTime(conversation.updated_at)}</div>
                                    </div>
                                </button>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                                <ContextMenuItem onSelect={() => startRename(conversation.id, conversation.title)}>
                                    Rename
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem onSelect={() => onDelete(conversation.id)} className="text-red-600 dark:text-red-400">
                                    Delete
                                </ContextMenuItem>
                            </ContextMenuContent>
                        </ContextMenu>
                    );
                })}
            </div>
        </TooltipProvider>
    );
}

import { ClockIcon, MessageSquareIcon, PlusIcon, XIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface ChatPanelHeaderProps {
    activeTab: 'chat' | 'history';
    onTabChange: (tab: 'chat' | 'history') => void;
    conversationTitle: string | null;
    onNewChat: () => void;
    onCloseChat: () => void;
}

export function ChatPanelHeader({ activeTab, onTabChange, conversationTitle, onNewChat, onCloseChat }: ChatPanelHeaderProps) {
    const hasConversation = conversationTitle !== null;

    return (
        <div className="flex items-center gap-1.5 border-b px-2 py-1.5">
            <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as 'chat' | 'history')} className="min-w-0 flex-1">
                <TabsList className="h-7 w-full justify-start bg-neutral-50 dark:bg-neutral-900">
                    <TabsTrigger value="history" className="h-full flex-none px-2">
                        <ClockIcon className="size-3.5" />
                    </TabsTrigger>
                    {hasConversation && (
                        <TabsTrigger value="chat" className="h-full min-w-0 flex-1 justify-start overflow-hidden px-2">
                            <MessageSquareIcon className="size-3.5 shrink-0" />
                            <span className="min-w-0 flex-1 truncate text-left text-xs">{conversationTitle}</span>
                            <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCloseChat();
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.stopPropagation();
                                        onCloseChat();
                                    }
                                }}
                                className="flex shrink-0 items-center justify-center rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                            >
                                <XIcon className="size-2.5" />
                            </span>
                        </TabsTrigger>
                    )}
                </TabsList>
            </Tabs>
            <TooltipProvider delayDuration={300}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={onNewChat}
                            className="flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <PlusIcon className="size-3.5" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        New conversation
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
}

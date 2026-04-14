import { CheckCircle2Icon, ChevronDownIcon, CircleIcon, ListTodoIcon, Loader2Icon } from 'lucide-react';
import { memo, useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface TaskItem {
    title: string;
    status: 'pending' | 'in_progress' | 'completed';
}

interface ProgressTasksProps {
    tasks: TaskItem[];
    isStreaming?: boolean;
    className?: string;
}

const statusConfig = {
    pending: {
        icon: CircleIcon,
        className: 'text-neutral-300 dark:text-neutral-600',
    },
    in_progress: {
        icon: Loader2Icon,
        className: 'text-primary animate-spin',
    },
    completed: {
        icon: CheckCircle2Icon,
        className: 'text-green-500',
    },
};

export const ProgressTasks = memo(({ tasks, isStreaming = false, className }: ProgressTasksProps) => {
    const completedCount = tasks.filter((t) => t.status === 'completed').length;
    const allDone = completedCount === tasks.length && !isStreaming;
    const [isOpen, setIsOpen] = useState(!allDone);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
            <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-t-lg border border-b-0 border-primary bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90">
                <ListTodoIcon className="size-3.5" />
                <span className="font-medium">
                    {allDone ? 'Tasks — done' : `Tasks — ${completedCount}/${tasks.length}`}
                </span>
                <ChevronDownIcon className={cn('ml-auto size-3.5 transition-transform', isOpen && 'rotate-180')} />
            </CollapsibleTrigger>
            <CollapsibleContent className="rounded-t-none border-x border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900">
                <div className="space-y-1">
                    {tasks.map((task, i) => {
                        const config = statusConfig[task.status];
                        const Icon = config.icon;

                        return (
                            <div key={i} className="flex items-center gap-2">
                                <Icon className={cn('size-3 shrink-0', config.className)} />
                                <span
                                    className={cn(
                                        'text-xs',
                                        task.status === 'completed'
                                            ? 'text-neutral-400 dark:text-neutral-500 line-through'
                                            : task.status === 'in_progress'
                                              ? 'text-foreground font-medium'
                                              : 'text-neutral-500 dark:text-neutral-400',
                                    )}
                                >
                                    {task.title}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
});

ProgressTasks.displayName = 'ProgressTasks';

import type { DragEndEvent } from '@dnd-kit/core';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link, useParams } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { api_get, api_post, api_put, api_patch, api_delete } from '@/lib/api';
import {
    ArrowLeftIcon,
    FileTextIcon,
    ImageIcon,
    MessageSquareIcon,
    XIcon,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HelpSidebarButton } from '@/components/help-sidebar-button';
import { ProjectSettingsDialog } from '@/components/project-settings-dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
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

import type { ImageData, ProjectData } from '@/types/api';

interface Tab {
    id: string;
    title: string;
}

interface Props {
    project: ProjectData;
    images: ImageData[];
}

interface SortableImageTabProps {
    tab: Tab;
    isActive: boolean;
    isRenaming: boolean;
    renameValue: string;
    renameInputRef: React.RefObject<HTMLInputElement | null>;
    renameStartTime: React.RefObject<number>;
    onSelect: (id: string) => void;
    onClose: (id: string, e: React.MouseEvent) => void;
    onRename: (id: string) => void;
    onDelete: (id: string) => void;
    onRenameValueChange: (value: string) => void;
    onSubmitRename: (id: string) => void;
    onCancelRename: () => void;
}

function SortableImageTab({
    tab,
    isActive,
    isRenaming,
    renameValue,
    renameInputRef,
    renameStartTime,
    onSelect,
    onClose,
    onRename,
    onDelete,
    onRenameValueChange,
    onSubmitRename,
    onCancelRename,
}: SortableImageTabProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id, disabled: isRenaming });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="flex">
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <button
                        onClick={() => onSelect(tab.id)}
                        className={`group flex w-48 min-w-0 shrink-0 items-center gap-1.5 border px-3 py-1.5 text-sm transition-colors ${
                            isActive
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-300'
                        }`}
                    >
                        {isRenaming ? (
                            <input
                                ref={renameInputRef}
                                type="text"
                                value={renameValue}
                                onChange={(e) => onRenameValueChange(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        onSubmitRename(tab.id);
                                    }

                                    if (e.key === 'Escape') {
                                        onCancelRename();
                                    }
                                }}
                                onBlur={() => {
                                    if (Date.now() - renameStartTime.current > 100) {
                                        onSubmitRename(tab.id);
                                    }
                                }}
                                autoFocus
                                onFocus={(e) => e.target.select()}
                                className="w-full bg-transparent text-sm outline-none"
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span className="min-w-0 flex-1 truncate text-left">
                                {tab.title}
                            </span>
                        )}
                        <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => onClose(tab.id, e)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    onClose(tab.id, e as unknown as React.MouseEvent);
                                }
                            }}
                            className="flex shrink-0 items-center justify-center rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                        >
                            <XIcon className="size-3" />
                        </span>
                    </button>
                </ContextMenuTrigger>
                <ContextMenuContent>
                    <ContextMenuItem onSelect={() => onRename(tab.id)}>
                        Rename
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => onClose(tab.id, { stopPropagation: () => {} } as React.MouseEvent)}>
                        Close
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onSelect={() => onDelete(tab.id)} className="text-red-600 dark:text-red-400">
                        Delete
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>
        </div>
    );
}

export default function Gallery() {
    const { id } = useParams<{ id: string }>();
    const [data, setData] = useState<{ project: ProjectData; images: ImageData[] } | null>(null);

    useEffect(() => {
        if (!id) return;
        api_get<{ project: ProjectData; images: ImageData[] }>(`/api/projects/${id}`)
            .then(setData)
            .catch(console.error);
    }, [id]);

    useDocumentTitle(data ? `Gallery - ${data.project.name}` : 'Gallery');

    if (!data) return null;

    return (
        <GalleryView
            key={data.project.id}
            project={data.project}
            images={data.images}
            onProjectUpdated={(updated) => setData((prev) => prev ? { ...prev, project: updated } : prev)}
        />
    );
}

function GalleryView({ project, images, onProjectUpdated }: { project: ProjectData; images: ImageData[]; onProjectUpdated: (p: ProjectData) => void }) {
    const [localImages, setLocalImages] = useState<ImageData[]>(images);
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [deletingTabId, setDeletingTabId] = useState<string | null>(null);
    const renameInputRef = useRef<HTMLInputElement>(null);
    const renameStartTime = useRef<number>(0);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setTabs((prev) => {
                const oldIndex = prev.findIndex((t) => t.id === active.id);
                const newIndex = prev.findIndex((t) => t.id === over.id);

                return arrayMove(prev, oldIndex, newIndex);
            });
        }
    }, []);

    const openImage = useCallback(
        (image: { id: string; name: string }) => {
            const existing = tabs.find((t) => t.id === image.id);

            if (existing) {
                setActiveTabId(image.id);

                return;
            }

            setTabs((prev) => [...prev, { id: image.id, title: image.name }]);
            setActiveTabId(image.id);
        },
        [tabs],
    );

    const closeTab = useCallback(
        (tabId: string, e: React.MouseEvent) => {
            e.stopPropagation();

            setTabs((prev) => {
                const next = prev.filter((t) => t.id !== tabId);

                if (activeTabId === tabId) {
                    const idx = prev.findIndex((t) => t.id === tabId);
                    const newActive =
                        next[Math.min(idx, next.length - 1)]?.id ?? null;
                    setActiveTabId(newActive);
                }

                return next;
            });
        },
        [activeTabId],
    );

    const startRename = useCallback(
        (tabId: string) => {
            const tab = tabs.find((t) => t.id === tabId);

            if (!tab) {
                const image = localImages.find((img) => img.id === tabId);

                if (image) {
                    openImage(image);
                }
            }

            const name =
                tab?.title ??
                localImages.find((img) => img.id === tabId)?.name ??
                '';
            setRenamingTabId(tabId);
            setRenameValue(name);
            renameStartTime.current = Date.now();
        },
        [tabs, localImages, openImage],
    );

    const submitRename = useCallback(
        (tabId: string) => {
            if (!renameValue.trim()) {
                setRenamingTabId(null);

                return;
            }

            api_patch<{ id: string; name: string }>(`/api/projects/${project.id}/images/${tabId}`, {
                    name: renameValue.trim(),
                })
                .then((data) => {
                    setTabs((prev) =>
                        prev.map((t) =>
                            t.id === tabId ? { ...t, title: data.name } : t,
                        ),
                    );
                    setLocalImages((prev) =>
                        prev.map((img) =>
                            img.id === tabId
                                ? { ...img, name: data.name }
                                : img,
                        ),
                    );
                })
                .catch((error) => {
                    console.error('Failed to rename:', error);
                })
                .finally(() => setRenamingTabId(null));
        },
        [renameValue, project.id],
    );

    const confirmDelete = useCallback(() => {
        if (!deletingTabId) {
            return;
        }

        const tabId = deletingTabId;
        setDeletingTabId(null);

        api_delete(`/api/projects/${project.id}/images/${tabId}`)
            .then(() => {
                setTabs((prev) => {
                    const next = prev.filter((t) => t.id !== tabId);

                    if (tabId === activeTabId) {
                        const idx = prev.findIndex((t) => t.id === tabId);
                        const newIdx = Math.min(idx, next.length - 1);
                        setActiveTabId(
                            next.length > 0 ? next[newIdx].id : null,
                        );
                    }

                    return next;
                });
                setLocalImages((prev) =>
                    prev.filter((img) => img.id !== tabId),
                );
            })
            .catch((error) => {
                console.error('Failed to delete:', error);
                window.alert('Failed to delete image.');
            });
    }, [deletingTabId, project.id, activeTabId]);

    const activeTab = tabs.find((t) => t.id === activeTabId);

    return (
        <div className="flex h-screen flex-col">
            <header className="title-bar" />
            <div className="flex flex-1 overflow-hidden bg-white select-none dark:bg-neutral-950">
                <TooltipProvider delayDuration={300}>
                    <aside className="flex w-12 flex-col items-center border-r border-border bg-white py-2 dark:bg-neutral-950">
                        <Link to={`/projects/${project.id}`}>
                            <div className="flex size-8 items-center justify-center rounded-lg bg-neutral-50 text-black dark:bg-neutral-900 dark:text-primary">
                                <ArrowLeftIcon className="size-4" />
                            </div>
                        </Link>

                        <nav className="mt-4 flex flex-col items-center gap-1">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Link to={`/projects/${project.id}`}>
                                        <Button variant="ghost" size="icon-sm">
                                            <MessageSquareIcon className="size-4" />
                                            <span className="sr-only">
                                                Chat
                                            </span>
                                        </Button>
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    Chat
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Link to={`/projects/${project.id}/docs`}>
                                        <Button variant="ghost" size="icon-sm">
                                            <FileTextIcon className="size-4" />
                                            <span className="sr-only">
                                                Docs
                                            </span>
                                        </Button>
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    Docs
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon-sm">
                                        <ImageIcon className="size-4" />
                                        <span className="sr-only">Gallery</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    Gallery
                                </TooltipContent>
                            </Tooltip>
                            <ProjectSettingsDialog project={project} onUpdated={onProjectUpdated} />
                        </nav>
                        <div className="mt-auto">
                            <HelpSidebarButton />
                        </div>
                    </aside>
                </TooltipProvider>

                <div className="flex flex-1 overflow-hidden">
                    {/* Image grid */}
                    <div className="flex w-80 shrink-0 flex-col border-r border-border">
                        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                            <ImageIcon className="size-5 text-neutral-400" />
                            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                                Gallery
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3">
                            {localImages.length === 0 ? (
                                <div className="flex h-full items-center justify-center text-sm text-neutral-400">
                                    No images yet
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    {localImages.map((image) => (
                                        <ContextMenu key={image.id}>
                                            <ContextMenuTrigger asChild>
                                                <button
                                                    onClick={() =>
                                                        openImage(image)
                                                    }
                                                    className={`overflow-hidden rounded-lg border transition-colors ${
                                                        image.id === activeTabId
                                                            ? 'border-primary ring-1 ring-primary'
                                                            : 'border-neutral-200 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500'
                                                    }`}
                                                >
                                                    <img
                                                        src={`/api/projects/${project.id}/images/${image.id}`}
                                                        alt={image.name}
                                                        className="aspect-square w-full object-cover"
                                                    />
                                                    <div className="truncate px-2 py-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                                                        {image.name}
                                                    </div>
                                                </button>
                                            </ContextMenuTrigger>
                                            <ContextMenuContent>
                                                <ContextMenuItem
                                                    onSelect={() =>
                                                        startRename(image.id)
                                                    }
                                                >
                                                    Rename
                                                </ContextMenuItem>
                                                <ContextMenuSeparator />
                                                <ContextMenuItem
                                                    onSelect={() =>
                                                        setDeletingTabId(
                                                            image.id,
                                                        )
                                                    }
                                                    className="text-red-600 dark:text-red-400"
                                                >
                                                    Delete
                                                </ContextMenuItem>
                                            </ContextMenuContent>
                                        </ContextMenu>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Image viewer */}
                    <div className="flex flex-1 flex-col overflow-hidden">
                        {/* Tab bar */}
                        <div className="flex min-h-9 items-center border-b border-border">
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                                modifiers={[restrictToHorizontalAxis]}
                            >
                                <SortableContext
                                    items={tabs.map((t) => t.id)}
                                    strategy={horizontalListSortingStrategy}
                                >
                                    <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-0 overflow-x-auto">
                                        {tabs.map((tab) => (
                                            <SortableImageTab
                                                key={tab.id}
                                                tab={tab}
                                                isActive={tab.id === activeTabId}
                                                isRenaming={renamingTabId === tab.id}
                                                renameValue={renameValue}
                                                renameInputRef={renameInputRef}
                                                renameStartTime={renameStartTime}
                                                onSelect={setActiveTabId}
                                                onClose={closeTab}
                                                onRename={startRename}
                                                onDelete={setDeletingTabId}
                                                onRenameValueChange={setRenameValue}
                                                onSubmitRename={submitRename}
                                                onCancelRename={() => setRenamingTabId(null)}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        </div>

                        {/* Image name */}
                        {activeTab && (
                            <div className="flex items-center gap-2 border-b border-border px-4 py-1">
                                <h2 className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                                    {activeTab.title}
                                </h2>
                            </div>
                        )}

                        {/* Image content */}
                        {activeTab ? (
                            <div className="flex flex-1 items-center justify-center overflow-hidden bg-neutral-50 p-8 dark:bg-neutral-950">
                                <img
                                    src={`/api/projects/${project.id}/images/${activeTab.id}`}
                                    alt={activeTab.title}
                                    className="max-h-full max-w-full object-contain"
                                />
                            </div>
                        ) : (
                            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-neutral-400 dark:text-neutral-500">
                                <ImageIcon className="size-12 stroke-1" />
                                <p className="text-sm">
                                    Select an image to preview
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <AlertDialog
                open={deletingTabId !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeletingTabId(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete image?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this image. This action
                            cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-red-600 text-white hover:bg-red-700"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

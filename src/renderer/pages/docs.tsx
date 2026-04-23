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
    ChevronRightIcon,
    FileTextIcon,
    FolderIcon,
    ImageIcon,
    MessageSquareIcon,
    PlusIcon,
    SaveIcon,
    Undo2Icon,
    XIcon,
} from 'lucide-react';
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import type { EditorHandle } from '@/components/editor';
import { MilkdownEditorWrapper } from '@/components/editor';
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
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Switch } from '@/components/ui/switch';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useNativeMenu, printDocumentContent } from '@/hooks/use-native-menu';

import type { DocumentData, ProjectData } from '@/types/api';

interface Tab {
    id: string;
    title: string;
}

interface Props {
    project: ProjectData;
    documents: DocumentData[];
}

interface SortableDocTabProps {
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

function SortableDocTab({
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
}: SortableDocTabProps) {
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

export default function Docs() {
    const { id } = useParams<{ id: string }>();
    const [data, setData] = useState<{ project: ProjectData; documents: DocumentData[] } | null>(null);

    useEffect(() => {
        if (!id) return;
        api_get<{ project: ProjectData; documents: DocumentData[] }>(`/api/projects/${id}`)
            .then(setData)
            .catch(console.error);
    }, [id]);

    useDocumentTitle(data ? `Docs - ${data.project.name}` : 'Docs');

    if (!data) return null;

    return (
        <DocsView
            key={data.project.id}
            project={data.project}
            documents={data.documents}
            onProjectUpdated={(updated) => setData((prev) => prev ? { ...prev, project: updated } : prev)}
        />
    );
}

function DocsView({ project, documents, onProjectUpdated }: { project: ProjectData; documents: DocumentData[]; onProjectUpdated: (p: ProjectData) => void }) {
    const [localDocuments, setLocalDocuments] = useState<DocumentData[]>(documents);
    const storageKey = `trident:project:${project.id}:docs:tabs`;
    const [tabs, setTabs] = useState<Tab[]>(() => {
        const saved = localStorage.getItem(storageKey);

        if (saved) {
            try {
                const { openTabs } = JSON.parse(saved) as {
                    openTabs?: Array<{ id: string }>;
                };
                const docMap = new Map(documents.map((d) => [d.id, d]));

                return (openTabs ?? [])
                    .filter((t) => docMap.has(t.id))
                    .map((t) => ({ id: t.id, title: docMap.get(t.id)!.name }));
            } catch {
                /* fall through */
            }
        }

        return [];
    });
    const [activeTabId, setActiveTabId] = useState<string | null>(() => {
        const saved = localStorage.getItem(storageKey);

        if (saved) {
            try {
                const { openTabs, activeTabId: savedActiveId } = JSON.parse(
                    saved,
                ) as {
                    openTabs?: Array<{ id: string }>;
                    activeTabId?: string | null;
                };
                const docIds = new Set(documents.map((d) => d.id));
                const validIds = (openTabs ?? [])
                    .map((t) => t.id)
                    .filter((id) => docIds.has(id));

                if (savedActiveId && validIds.includes(savedActiveId)) {
                    return savedActiveId;
                }

                if (validIds.length > 0) {
                    return validIds[0];
                }
            } catch {
                /* fall through */
            }
        }

        return null;
    });
    const [tabContent, setTabContent] = useState<Record<string, string>>({});
    const [dirtyTabs, setDirtyTabs] = useState<Record<string, boolean>>({});
    const [saveStatus, setSaveStatus] = useState<
        Record<string, 'idle' | 'saving' | 'saved'>
    >({});
    const [editorKeys, setEditorKeys] = useState<Record<string, number>>({});
    const [autosaveEnabled, setAutosaveEnabled] = useState(true);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const editorRefs = useRef<Record<string, EditorHandle | null>>({});
    const autosaveTimerRef = useRef<Record<string, NodeJS.Timeout>>({});
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

    useEffect(() => {
        setLocalDocuments(documents);
    }, [documents]);

    useEffect(() => {
        localStorage.setItem(
            storageKey,
            JSON.stringify({
                openTabs: tabs.map((t) => ({ id: t.id })),
                activeTabId,
            }),
        );
    }, [tabs, activeTabId, storageKey]);

    useEffect(() => {
        if (renamingId !== null) {
            const timer = setTimeout(() => {
                renameInputRef.current?.focus();
                renameInputRef.current?.select();
                renameStartTime.current = Date.now();
            }, 50);

            return () => clearTimeout(timer);
        }
    }, [renamingId]);

    useEffect(() => {
        api_get<{ enabled: boolean }>('/api/settings/autosave')
            .then((data) => setAutosaveEnabled(data.enabled))
            .catch(() => {});
    }, []);

    // Fetch content when a tab becomes active.
    // tabContent is intentionally omitted from deps — including it would refetch on every content change.
    useEffect(() => {
        if (!activeTabId || tabContent[activeTabId] !== undefined) {
            return;
        }

        api_get<{ content: string | null }>(`/api/projects/${project.id}/documents/${activeTabId}`)
            .then((data) => {
                setTabContent((prev) => ({
                    ...prev,
                    [activeTabId]: data.content ?? '',
                }));
            })
            .catch(console.error);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTabId, project.id]);

    const saveDocument = useCallback(
        (tabId: string) => {
            const editorRef = editorRefs.current[tabId];

            if (!editorRef) {
                return;
            }

            const content = editorRef.getMarkdown();
            setSaveStatus((prev) => ({ ...prev, [tabId]: 'saving' }));

            api_put(`/api/projects/${project.id}/documents/${tabId}/content`, {
                    content,
                })
                .then(() => {
                    setDirtyTabs((prev) => ({ ...prev, [tabId]: false }));
                    setTabContent((prev) => ({ ...prev, [tabId]: content }));
                    setSaveStatus((prev) => ({ ...prev, [tabId]: 'saved' }));
                    setTimeout(() => {
                        setSaveStatus((prev) => ({ ...prev, [tabId]: 'idle' }));
                    }, 2000);
                })
                .catch((error) => {
                    console.error('Failed to save:', error);
                    setSaveStatus((prev) => ({ ...prev, [tabId]: 'idle' }));
                });
        },
        [project.id],
    );

    const revertDocument = useCallback(
        (tabId: string) => {
            api_get<{ content: string | null }>(`/api/projects/${project.id}/documents/${tabId}`)
                .then((data) => {
                    setTabContent((prev) => ({
                        ...prev,
                        [tabId]: data.content ?? '',
                    }));
                    setDirtyTabs((prev) => ({ ...prev, [tabId]: false }));
                    setEditorKeys((prev) => ({
                        ...prev,
                        [tabId]: (prev[tabId] ?? 0) + 1,
                    }));
                })
                .catch(console.error);
        },
        [project.id],
    );

    const handleContentChange = useCallback(
        (tabId: string, markdown: string) => {
            const savedContent = tabContent[tabId] ?? '';
            const isDirty = markdown !== savedContent;

            setDirtyTabs((prev) => {
                if (prev[tabId] === isDirty) {
                    return prev;
                }

                return { ...prev, [tabId]: isDirty };
            });

            if (isDirty && autosaveEnabled) {
                if (autosaveTimerRef.current[tabId]) {
                    clearTimeout(autosaveTimerRef.current[tabId]);
                }

                autosaveTimerRef.current[tabId] = setTimeout(() => {
                    saveDocument(tabId);
                }, 2000);
            } else if (!isDirty && autosaveTimerRef.current[tabId]) {
                clearTimeout(autosaveTimerRef.current[tabId]);
                delete autosaveTimerRef.current[tabId];
            }
        },
        [autosaveEnabled, saveDocument, tabContent],
    );

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();

                if (activeTabId) {
                    saveDocument(activeTabId);
                }
            }
        };
        window.addEventListener('keydown', handler);

        return () => window.removeEventListener('keydown', handler);
    }, [activeTabId, saveDocument]);

    const toggleAutosave = useCallback((enabled: boolean) => {
        setAutosaveEnabled(enabled);
        api_put('/api/settings/autosave', { enabled }).catch(console.error);
    }, []);

    useEffect(() => {
        const timers = autosaveTimerRef.current;

        return () => {
            Object.values(timers).forEach(clearTimeout);
        };
    }, []);

    const openDocument = useCallback(
        (doc: { id: string; name: string }) => {
            const existing = tabs.find((t) => t.id === doc.id);

            if (existing) {
                setActiveTabId(doc.id);

                return;
            }

            setTabs((prev) => [...prev, { id: doc.id, title: doc.name }]);
            setActiveTabId(doc.id);
        },
        [tabs],
    );

    const addDocument = useCallback(() => {
        if (isCreating) {
            return;
        }

        setIsCreating(true);

        api_post<{ id: string; filename: string }>(
                `/api/projects/${project.id}/documents`,
            )
            .then((data) => {
                setTabs((prev) => [
                    ...prev,
                    { id: data.id, title: data.filename },
                ]);
                setActiveTabId(data.id);
                setRenamingId(data.id);
                setRenameValue(data.filename);
                setLocalDocuments((prev) => [
                    ...prev,
                    {
                        id: data.id,
                        name: data.filename,
                        created_by: 'user',
                        last_edited_by: 'user',
                        directory: 'user',
                    },
                ]);
            })
            .catch((error) => {
                console.error('Failed to create document:', error);
            })
            .finally(() => setIsCreating(false));
    }, [isCreating, project.id]);

    const closeTab = useCallback(
        (tabId: string, e: React.MouseEvent) => {
            e.stopPropagation();

            if (autosaveTimerRef.current[tabId]) {
                clearTimeout(autosaveTimerRef.current[tabId]);
                delete autosaveTimerRef.current[tabId];
            }

            delete editorRefs.current[tabId];

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
            setTabContent((prev) => {
                const next = { ...prev };
                delete next[tabId];

                return next;
            });
            setDirtyTabs((prev) => {
                const next = { ...prev };
                delete next[tabId];

                return next;
            });
            setSaveStatus((prev) => {
                const next = { ...prev };
                delete next[tabId];

                return next;
            });
            setEditorKeys((prev) => {
                const next = { ...prev };
                delete next[tabId];

                return next;
            });
        },
        [activeTabId],
    );

    const startRename = useCallback((id: string, name: string) => {
        setRenamingId(id);
        setRenameValue(name);
        renameStartTime.current = Date.now();
    }, []);

    const handleRenameById = useCallback(
        (id: string) => {
            const tab = tabs.find((t) => t.id === id);

            if (tab) {
                startRename(id, tab.title);
            }
        },
        [tabs, startRename],
    );

    const submitRename = useCallback(
        (docId: string) => {
            if (!renameValue.trim()) {
                setRenamingId(null);

                return;
            }

            api_patch<{ id: string; name: string }>(`/api/projects/${project.id}/documents/${docId}`, {
                    name: renameValue.trim(),
                })
                .then((data) => {
                    setTabs((prev) =>
                        prev.map((t) =>
                            t.id === docId ? { ...t, title: data.name } : t,
                        ),
                    );
                    setLocalDocuments((prev) =>
                        prev.map((d) =>
                            d.id === docId ? { ...d, name: data.name } : d,
                        ),
                    );
                })
                .catch((error) => {
                    console.error('Failed to rename:', error);
                })
                .finally(() => setRenamingId(null));
        },
        [renameValue, project.id],
    );

    const confirmDelete = useCallback(() => {
        if (!deletingId) {
            return;
        }

        const docId = deletingId;
        setDeletingId(null);

        api_delete(`/api/projects/${project.id}/documents/${docId}`)
            .then(() => {
                setTabs((prev) => {
                    const next = prev.filter((t) => t.id !== docId);

                    if (docId === activeTabId) {
                        const idx = prev.findIndex((t) => t.id === docId);
                        const newIdx = Math.min(idx, next.length - 1);
                        setActiveTabId(
                            next.length > 0 ? next[newIdx].id : null,
                        );
                    }

                    return next;
                });
                setLocalDocuments((prev) => prev.filter((d) => d.id !== docId));
            })
            .catch((error) => {
                console.error('Failed to delete:', error);
                window.alert('Failed to delete document.');
            });
    }, [deletingId, project.id, activeTabId]);

    const fileTree = useMemo(() => {
        const groups = localDocuments.reduce<Record<string, DocumentData[]>>(
            (acc, doc) => {
                const dir = doc.directory ?? 'user';
                (acc[dir] ??= []).push(doc);

                return acc;
            },
            {},
        );
        const sortedDirs = Object.keys(groups).sort((a, b) => {
            if (a === 'user') {
                return -1;
            }

            if (b === 'user') {
                return 1;
            }

            return a.localeCompare(b);
        });

        return sortedDirs.map((dir) => ({
            name: dir === 'user' ? 'Your Documents' : dir,
            items: groups[dir],
        }));
    }, [localDocuments]);

    useNativeMenu({
        onNewDocument: addDocument,
        onSave: () => {
            if (activeTabId) {
                saveDocument(activeTabId);
            }
        },
        onPrint: () => {
            const tab = tabs.find(t => t.id === activeTabId);

            if (tab) {
                printDocumentContent(tab.title);
            }
        },
        onClose: () => {
            if (activeTabId) {
                closeTab(activeTabId, { stopPropagation: () => {} } as React.MouseEvent);
            }
        },
        onDelete: () => {
            if (activeTabId) {
                setDeletingId(activeTabId);
            }
        },
    });

    const activeTab = tabs.find((t) => t.id === activeTabId);
    const activeDocument = activeTabId
        ? localDocuments.find((d) => d.id === activeTabId)
        : null;

    return (
        <div className="flex h-screen flex-col">
            <header className="title-bar flex justify-center">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                        {activeTab?.title}
                    </h2>
                    {activeDocument?.last_edited_by && (
                        <span className="rounded bg-neutral-50 px-1.5 py-0.5 text-[10px] text-neutral-400 dark:bg-neutral-900 dark:text-neutral-500">
                            {activeDocument.last_edited_by ===
                            'user'
                                ? 'You'
                                : activeDocument.last_edited_by}
                        </span>
                    )}
                </div>
            </header>
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
                                    <Button variant="ghost" size="icon-sm">
                                        <FileTextIcon className="size-4" />
                                        <span className="sr-only">Docs</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    Docs
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Link
                                        to={`/projects/${project.id}/gallery`}
                                    >
                                        <Button variant="ghost" size="icon-sm">
                                            <ImageIcon className="size-4" />
                                            <span className="sr-only">
                                                Gallery
                                            </span>
                                        </Button>
                                    </Link>
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
                    {/* File tree */}
                    <div className="flex w-80 shrink-0 flex-col border-r border-border">
                        <div className="flex items-center justify-between border-b border-border px-3 py-2">
                            <div className="flex items-center gap-2">
                                <FileTextIcon className="size-5 text-neutral-400" />
                                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                                    Documents
                                </span>
                            </div>
                            <button
                                onClick={addDocument}
                                className="flex items-center justify-center rounded p-0.5 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
                            >
                                <PlusIcon className="size-3.5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto py-1">
                            {localDocuments.length === 0 ? (
                                <div className="flex h-full items-center justify-center text-sm text-neutral-400">
                                    No documents yet
                                </div>
                            ) : (
                                <div className="flex flex-col gap-0.5">
                                    {fileTree.map((group) => (
                                        <Collapsible
                                            key={group.name}
                                            defaultOpen
                                        >
                                            <CollapsibleTrigger asChild>
                                                <button className="group flex w-full items-center gap-1 px-2 py-1 text-left text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300">
                                                    <ChevronRightIcon className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
                                                    <FolderIcon className="size-3.5" />
                                                    <span>{group.name}</span>
                                                </button>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                                <div className="ml-3 flex flex-col gap-0.5">
                                                    {group.items.map((doc) => (
                                                        <ContextMenu
                                                            key={doc.id}
                                                        >
                                                            <ContextMenuTrigger
                                                                asChild
                                                            >
                                                                <button
                                                                    onClick={() => {
                                                                        if (
                                                                            renamingId !==
                                                                            doc.id
                                                                        ) {
                                                                            openDocument(
                                                                                doc,
                                                                            );
                                                                        }
                                                                    }}
                                                                    className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800 ${
                                                                        doc.id ===
                                                                        activeTabId
                                                                            ? 'bg-neutral-50 font-medium dark:bg-neutral-900'
                                                                            : 'text-neutral-600 dark:text-neutral-400'
                                                                    }`}
                                                                >
                                                                    <FileTextIcon className="size-3.5 shrink-0 text-neutral-400" />
                                                                    {renamingId ===
                                                                    doc.id ? (
                                                                        <input
                                                                            ref={
                                                                                renameInputRef
                                                                            }
                                                                            type="text"
                                                                            value={
                                                                                renameValue
                                                                            }
                                                                            onChange={(
                                                                                e,
                                                                            ) =>
                                                                                setRenameValue(
                                                                                    e
                                                                                        .target
                                                                                        .value,
                                                                                )
                                                                            }
                                                                            onKeyDown={(
                                                                                e,
                                                                            ) => {
                                                                                if (
                                                                                    e.key ===
                                                                                    'Enter'
                                                                                ) {
                                                                                    submitRename(
                                                                                        doc.id,
                                                                                    );
                                                                                }

                                                                                if (
                                                                                    e.key ===
                                                                                    'Escape'
                                                                                ) {
                                                                                    setRenamingId(
                                                                                        null,
                                                                                    );
                                                                                }
                                                                            }}
                                                                            onBlur={() => {
                                                                                if (
                                                                                    Date.now() -
                                                                                        renameStartTime.current >
                                                                                    100
                                                                                ) {
                                                                                    submitRename(
                                                                                        doc.id,
                                                                                    );
                                                                                }
                                                                            }}
                                                                            onFocus={(
                                                                                e,
                                                                            ) =>
                                                                                e.target.select()
                                                                            }
                                                                            autoFocus
                                                                            className="w-full bg-transparent text-sm outline-none"
                                                                            onClick={(
                                                                                e,
                                                                            ) =>
                                                                                e.stopPropagation()
                                                                            }
                                                                        />
                                                                    ) : (
                                                                        <span className="truncate">
                                                                            {
                                                                                doc.name
                                                                            }
                                                                        </span>
                                                                    )}
                                                                </button>
                                                            </ContextMenuTrigger>
                                                            <ContextMenuContent>
                                                                <ContextMenuItem
                                                                    onSelect={() =>
                                                                        startRename(
                                                                            doc.id,
                                                                            doc.name,
                                                                        )
                                                                    }
                                                                >
                                                                    Rename
                                                                </ContextMenuItem>
                                                                <ContextMenuSeparator />
                                                                <ContextMenuItem
                                                                    onSelect={() =>
                                                                        setDeletingId(
                                                                            doc.id,
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
                                            </CollapsibleContent>
                                        </Collapsible>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Editor area */}
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
                                            <SortableDocTab
                                                key={tab.id}
                                                tab={tab}
                                                isActive={tab.id === activeTabId}
                                                isRenaming={renamingId === tab.id}
                                                renameValue={renameValue}
                                                renameInputRef={renameInputRef}
                                                renameStartTime={renameStartTime}
                                                onSelect={setActiveTabId}
                                                onClose={closeTab}
                                                onRename={handleRenameById}
                                                onDelete={setDeletingId}
                                                onRenameValueChange={setRenameValue}
                                                onSubmitRename={submitRename}
                                                onCancelRename={() => setRenamingId(null)}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>
                            <button
                                onClick={addDocument}
                                className="mx-1 flex shrink-0 items-center justify-center rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
                            >
                                <PlusIcon className="size-4" />
                            </button>
                        </div>

                        {/* Editor content */}
                        <main className="flex min-h-0 flex-1 flex-col overflow-auto">
                            {tabs.length === 0 ? (
                                <div className="flex h-full flex-col items-center justify-center gap-4 text-neutral-400 dark:text-neutral-500">
                                    <FileTextIcon className="size-12 stroke-1" />
                                    <p className="text-sm">No documents open</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={addDocument}
                                    >
                                        <PlusIcon className="size-4" />
                                        New Document
                                    </Button>
                                </div>
                            ) : (
                                tabs.map((tab) => (
                                    <div
                                        key={tab.id}
                                        className={
                                            tab.id === activeTabId
                                                ? 'flex flex-1 flex-col'
                                                : 'hidden'
                                        }
                                    >
                                        {tabContent[tab.id] !== undefined ? (
                                            <MilkdownEditorWrapper
                                                key={editorKeys[tab.id] ?? 0}
                                                ref={(el) => {
                                                    editorRefs.current[tab.id] =
                                                        el;
                                                }}
                                                defaultValue={
                                                    tabContent[tab.id]
                                                }
                                                onChange={(markdown) =>
                                                    handleContentChange(
                                                        tab.id,
                                                        markdown,
                                                    )
                                                }
                                                onReady={(markdown) => {
                                                    setTabContent((prev) => ({
                                                        ...prev,
                                                        [tab.id]: markdown,
                                                    }));
                                                }}
                                            />
                                        ) : (
                                            <div className="flex flex-1 items-center justify-center text-neutral-400">
                                                Loading...
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </main>

                        {/* Footer */}
                        {activeTab && (
                            <div className="h-8 flex items-center justify-between border-t border-border bg-neutral-50 px-2 py-1 dark:bg-neutral-950">
                                <div className="flex items-center gap-2">
                                    <label
                                        htmlFor="docs-autosave-toggle"
                                        className="text-xs text-neutral-400 dark:text-neutral-500"
                                    >
                                        Autosave
                                    </label>
                                    <Switch
                                        id="docs-autosave-toggle"
                                        size="sm"
                                        checked={autosaveEnabled}
                                        onCheckedChange={toggleAutosave}
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    {saveStatus[activeTabId!] === 'saving' ? (
                                        <span className="text-xs text-neutral-400">
                                            Saving...
                                        </span>
                                    ) : saveStatus[activeTabId!] === 'saved' ? (
                                        <span className="text-xs text-green-500">
                                            Saved
                                        </span>
                                    ) : dirtyTabs[activeTabId!] ? (
                                        <>
                                            <Button
                                                variant="icon"
                                                size="icon-xs"
                                                onClick={() =>
                                                    revertDocument(activeTabId!)
                                                }
                                                title="Revert changes"
                                            >
                                                <Undo2Icon />
                                                <span className="sr-only">
                                                    Revert changes
                                                </span>
                                            </Button>
                                            <Button
                                                variant="icon"
                                                size="icon-xs"
                                                onClick={() =>
                                                    saveDocument(activeTabId!)
                                                }
                                                title="Save"
                                            >
                                                <SaveIcon />
                                                <span className="sr-only">
                                                    Save
                                                </span>
                                            </Button>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <AlertDialog
                open={deletingId !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeletingId(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete document?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this document. This
                            action cannot be undone.
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

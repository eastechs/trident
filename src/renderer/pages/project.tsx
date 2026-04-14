import type { DragEndEvent} from '@dnd-kit/core';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { api_get, api_post, api_put, api_patch, api_delete } from '@/lib/api';
import {
    ArrowLeftIcon,
    FileTextIcon,
    FilesIcon,
    FolderClosedIcon,
    FolderOpenIcon,
    ImageIcon,
    MessageSquareIcon,
    PanelLeftIcon,
    PanelRightIcon,
    PlusIcon,
    SaveIcon,
    Settings2Icon,
    Undo2Icon,
    XIcon,
} from 'lucide-react';
import type { FormEvent } from 'react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDefaultLayout, usePanelRef } from 'react-resizable-panels';
import { ChatPanel } from '@/components/chat-panel';
import type { ConversationData } from '@/components/conversation-history';
import type { EditorHandle } from '@/components/editor';
import { MilkdownEditorWrapper } from '@/components/editor';
import { HelpSidebarButton } from '@/components/help-sidebar-button';
import { ProjectTour } from '@/components/project-tour';
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useNativeMenu, printDocumentContent } from '@/hooks/use-native-menu';

interface ProjectData {
    id: string;
    name: string;
    description: string | null;
    filesystem_root: string | null;
    initial_prompt: string | null;
    path: string;
    created_at: string;
    updated_at: string;
}

interface Tab {
    id: string;
    title: string;
    type: 'document' | 'image';
}

interface DocumentData {
    id: string;
    name: string;
    created_by: string | null;
    last_edited_by: string | null;
    directory: string;
}

interface ImageData {
    id: string;
    name: string;
    created_by: string | null;
}

interface Props {
    project: ProjectData;
    documents: DocumentData[];
    images: ImageData[];
    conversations: ConversationData[];
    configuredProviders: { anthropic: boolean; openai: boolean; gemini: boolean };
    shouldShowTour: boolean;
}

interface SortableTabProps {
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

function SortableTab({
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
}: SortableTabProps) {
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
                        className={`group flex w-40 min-w-0 shrink-0 items-center gap-1.5 border px-3 py-1.5 text-sm transition-colors ${
                            isActive
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-transparent text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-300'
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
                                className="w-full bg-transparent outline-none text-sm"
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

export default function Project() {
    const { id } = useParams<{ id: string }>();
    const [project, setProject] = useState<ProjectData | null>(null);
    const [documents, setDocuments] = useState<DocumentData[]>([]);
    const [images, setImages] = useState<ImageData[]>([]);
    const [conversations, setConversations] = useState<ConversationData[]>([]);
    const [configuredProviders, setConfiguredProviders] = useState<Props['configuredProviders']>({ anthropic: false, openai: false, gemini: false });
    const [shouldShowTour, setShouldShowTour] = useState(false);

    useEffect(() => {
        if (!id) return;
        api_get<{
            project: ProjectData;
            documents: DocumentData[];
            images: ImageData[];
            conversations: ConversationData[];
            configuredProviders: Props['configuredProviders'];
            shouldShowTour: boolean;
        }>(`/api/projects/${id}`)
            .then((data) => {
                setProject(data.project);
                setDocuments(data.documents);
                setImages(data.images);
                setConversations(data.conversations);
                setConfiguredProviders(data.configuredProviders);
                setShouldShowTour(data.shouldShowTour);
            });
    }, [id]);

    useDocumentTitle(project?.name);

    const leftPanelRef = usePanelRef();
    const rightPanelRef = usePanelRef();

    const [tabs, setTabs] = useState<Tab[]>(() => {
        if (!project) return [];
        const saved = localStorage.getItem(`trident:project:${project.id}:tabs`);

        if (saved) {
            try {
                const { openTabs: savedTabs, openTabIds } = JSON.parse(saved);
                const docMap = new Map(documents.map(d => [d.id, d]));
                const imgMap = new Map((images ?? []).map(img => [img.id, img]));

                // Support new format (openTabs with type) and legacy (openTabIds)
                const tabEntries: Array<{ id: string; type?: string }> = savedTabs
                    ?? openTabIds?.map((id: string) => ({ id, type: 'document' }))
                    ?? [];

                return tabEntries
                    .filter((t) => t.type === 'image' ? imgMap.has(t.id) : docMap.has(t.id))
                    .map((t) => t.type === 'image'
                        ? { id: t.id, title: imgMap.get(t.id)!.name, type: 'image' as const }
                        : { id: t.id, title: docMap.get(t.id)!.name, type: 'document' as const }
                    );
            } catch { /* fall through */ }
        }

        return documents.map((doc) => ({ id: doc.id, title: doc.name, type: 'document' as const }));
    });
    const [activeTabId, setActiveTabId] = useState(() => {
        const saved = localStorage.getItem(`trident:project:${project.id}:tabs`);

        if (saved) {
            try {
                const { openTabs: savedTabs, openTabIds, activeTabId: savedActiveId } = JSON.parse(saved);
                const docMap = new Map(documents.map(d => [d.id, d]));
                const imgMap = new Map((images ?? []).map(img => [img.id, img]));

                const tabEntries: Array<{ id: string; type?: string }> = savedTabs
                    ?? openTabIds?.map((id: string) => ({ id, type: 'document' }))
                    ?? [];

                const validIds = tabEntries
                    .filter((t) => t.type === 'image' ? imgMap.has(t.id) : docMap.has(t.id))
                    .map((t) => t.id);

                if (validIds.includes(savedActiveId)) {
                    return savedActiveId;
                }

                if (validIds.length > 0) {
                    return validIds[0];
                }
            } catch { /* fall through */ }
        }

        return documents[0]?.id ?? '';
    });
    const [isCreating, setIsCreating] = useState(false);
    const [deletingTabId, setDeletingTabId] = useState<string | null>(null);
    const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
    const [fileListOpen, setFileListOpen] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const renameInputRef = useRef<HTMLInputElement>(null);
    const renameStartTime = useRef<number>(0);
    const [fileListRenamingId, setFileListRenamingId] = useState<string | null>(null);
    const [fileListRenameValue, setFileListRenameValue] = useState('');
    const fileListRenameInputRef = useRef<HTMLInputElement>(null);
    const fileListRenameStartTime = useRef<number>(0);
    const [tabContent, setTabContent] = useState<Record<string, string>>({});
    const tabContentRef = useRef(tabContent);
    tabContentRef.current = tabContent;
    const tabsRef = useRef(tabs);
    tabsRef.current = tabs;
    const [dirtyTabs, setDirtyTabs] = useState<Record<string, boolean>>({});
    const [autosaveEnabled, setAutosaveEnabled] = useState(true);
    const [saveStatus, setSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});
    const [editorKeys, setEditorKeys] = useState<Record<string, number>>({});
    const [localDocuments, setLocalDocuments] = useState<DocumentData[]>(documents);
    const [localImages, setLocalImages] = useState<ImageData[]>(images ?? []);
    const [trashEnabled, setTrashEnabled] = useState(true);
    const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
    const [updateFormData, setUpdateFormData] = useState({
        name: project?.name ?? '',
        description: project?.description ?? '',
        filesystem_root: project?.filesystem_root ?? '',
    });
    const [updateFormProcessing, setUpdateFormProcessing] = useState(false);
    const [updateFormErrors, setUpdateFormErrors] = useState<Record<string, string>>({});
    const updateForm = {
        data: updateFormData,
        setData: (key: string, value: string) => setUpdateFormData((prev) => ({ ...prev, [key]: value })),
        errors: updateFormErrors,
        processing: updateFormProcessing,
        patch: (url: string, opts?: { onSuccess?: () => void }) => {
            setUpdateFormProcessing(true);
            api_patch(url, updateFormData)
                .then(() => opts?.onSuccess?.())
                .catch(console.error)
                .finally(() => setUpdateFormProcessing(false));
        },
    };

    useEffect(() => {
        setLocalDocuments(documents);
    }, [documents]);

    useEffect(() => {
        setLocalImages(images ?? []);
    }, [images]);

    useEffect(() => {
        api_get('/api/settings/trash')
            .then((data) => setTrashEnabled(data.enabled))
            .catch(() => {});
    }, []);

    function openUpdateDialog() {
        updateForm.clearErrors();
        updateForm.setData({
            name: project.name,
            description: project.description ?? '',
            filesystem_root: project.filesystem_root ?? '',
        });
        setIsUpdateDialogOpen(true);
    }

    async function handleSelectUpdateDirectory() {
        try {
            const { data } = await api_post('/api/select-directory');

            if (data.path) {
                updateForm.setData('filesystem_root', data.path);
            }
        } catch (error) {
            console.error('Failed to select directory:', error);
        }
    }

    function handleUpdateSubmit(e: FormEvent) {
        e.preventDefault();
        updateForm.patch(`/api/projects/${project.id}`, {
            onSuccess: () => {
                setIsUpdateDialogOpen(false);
            },
        });
    }

    const [localConversations, setLocalConversations] = useState<ConversationData[]>(conversations);

    useEffect(() => {
        setLocalConversations(conversations);
    }, [conversations]);

    // Auto-send initial prompt to both chats on first load (no conversations yet)
    const initialPromptRef = useRef(
        conversations.length === 0 && project.initial_prompt ? project.initial_prompt : undefined,
    );

    // Track active conversation IDs for dual-open prevention (updated via callback from ChatPanel)
    const [leftActiveId, setLeftActiveId] = useState<string | null>(null);
    const [rightActiveId, setRightActiveId] = useState<string | null>(null);

    const handleActiveIdChanged = useCallback((side: 'left' | 'right', id: string | null) => {
        if (side === 'left') {
            setLeftActiveId(id);
        } else {
            setRightActiveId(id);
        }
    }, []);

    const editorRefs = useRef<Record<string, EditorHandle | null>>({});
    const autosaveTimerRef = useRef<Record<string, NodeJS.Timeout>>({});

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    useEffect(() => {
        localStorage.setItem(
            `trident:project:${project.id}:tabs`,
            JSON.stringify({ openTabs: tabs.map(t => ({ id: t.id, type: t.type })), activeTabId })
        );
    }, [tabs, activeTabId, project.id]);

    useEffect(() => {
        if (renamingTabId !== null) {
            const timer = setTimeout(() => {
                renameInputRef.current?.focus();
                renameInputRef.current?.select();
                renameStartTime.current = Date.now();
            }, 50);

            return () => clearTimeout(timer);
        }
    }, [renamingTabId]);

    useEffect(() => {
        if (fileListRenamingId !== null) {
            const timer = setTimeout(() => {
                fileListRenameInputRef.current?.focus();
                fileListRenameInputRef.current?.select();
                fileListRenameStartTime.current = Date.now();
            }, 50);

            return () => clearTimeout(timer);
        }
    }, [fileListRenamingId]);

    useEffect(() => {
        api_get('/api/settings/autosave')
            .then((data) => setAutosaveEnabled(data.enabled))
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!activeTabId || tabContentRef.current[activeTabId] !== undefined) {
            return;
        }

        const activeTab = tabsRef.current.find(t => t.id === activeTabId);

        if (activeTab?.type === 'image') {
            return;
        }

        api_get(`/api/projects/${project.id}/documents/${activeTabId}`)
            .then((data) => {
                setTabContent(prev => ({ ...prev, [activeTabId]: data.content ?? '' }));
            })
            .catch(console.error);
    }, [activeTabId, project.id]);

    const saveDocument = useCallback((tabId: string) => {
        const editorRef = editorRefs.current[tabId];

        if (!editorRef) {
            return;
        }

        const content = editorRef.getMarkdown();
        setSaveStatus(prev => ({ ...prev, [tabId]: 'saving' }));

        api_put(`/api/projects/${project.id}/documents/${tabId}/content`, { content })
            .then(() => {
                setDirtyTabs(prev => ({ ...prev, [tabId]: false }));
                setTabContent(prev => ({ ...prev, [tabId]: content }));
                setSaveStatus(prev => ({ ...prev, [tabId]: 'saved' }));
                setTimeout(() => {
                    setSaveStatus(prev => ({ ...prev, [tabId]: 'idle' }));
                }, 2000);
            })
            .catch((error) => {
                console.error('Failed to save:', error);
                setSaveStatus(prev => ({ ...prev, [tabId]: 'idle' }));
            });
    }, [project.id]);

    const revertDocument = useCallback((tabId: string) => {
        api_get(`/api/projects/${project.id}/documents/${tabId}`)
            .then((data) => {
                setTabContent(prev => ({ ...prev, [tabId]: data.content ?? '' }));
                setDirtyTabs(prev => ({ ...prev, [tabId]: false }));
                setEditorKeys(prev => ({ ...prev, [tabId]: (prev[tabId] ?? 0) + 1 }));
            })
            .catch(console.error);
    }, [project.id]);

    const handleContentChange = useCallback((tabId: string, markdown: string) => {
        const savedContent = tabContent[tabId] ?? '';
        const isDirty = markdown !== savedContent;

        setDirtyTabs(prev => {
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
            // Content reverted — cancel pending autosave
            clearTimeout(autosaveTimerRef.current[tabId]);
            delete autosaveTimerRef.current[tabId];
        }
    }, [autosaveEnabled, saveDocument, tabContent]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();

                const active = tabsRef.current.find(t => t.id === activeTabId);

                if (active?.type === 'document') {
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

    const addTab = useCallback(() => {
        if (isCreating) {
            return;
        }

        setIsCreating(true);

        axios
            .post<{ id: string; filename: string }>(
                `/projects/${project.id}/documents`,
            )
            .then((data) => {
                setTabs((prev) => [...prev, { id: data.id, title: data.filename, type: 'document' }]);
                setActiveTabId(data.id);
                setRenamingTabId(data.id);
                setRenameValue(data.filename);
            })
            .catch((error) => {
                console.error('Failed to create document:', error);
                window.alert('Failed to create document. Please try again.');
            })
            .finally(() => setIsCreating(false));
    }, [isCreating, project.id]);

    const openDocument = useCallback((doc: { id: string; name: string }) => {
        const existing = tabs.find(t => t.id === doc.id);

        if (existing) {
            setActiveTabId(doc.id);

            return;
        }

        setTabs(prev => [...prev, { id: doc.id, title: doc.name, type: 'document' }]);
        setActiveTabId(doc.id);
    }, [tabs]);

    const openImage = useCallback((image: { id: string; name: string }) => {
        const existing = tabs.find(t => t.id === image.id);

        if (existing) {
            setActiveTabId(image.id);

            return;
        }

        setTabs(prev => [...prev, { id: image.id, title: image.name, type: 'image' }]);
        setActiveTabId(image.id);
    }, [tabs]);

    const closeTab = useCallback(
        (tabId: string, e: React.MouseEvent) => {
            e.stopPropagation();
            setTabs((prev) => {
                const next = prev.filter((t) => t.id !== tabId);

                if (tabId === activeTabId) {
                    if (next.length > 0) {
                        const idx = prev.findIndex((t) => t.id === tabId);
                        const newIdx = Math.min(idx, next.length - 1);
                        setActiveTabId(next[newIdx].id);
                    } else {
                        setActiveTabId('');
                    }
                }

                return next;
            });

            // Clear cached content so re-opening fetches fresh from server
            setTabContent((prev) => {
                const next = { ...prev };
                delete next[tabId];

                return next;
            });
        },
        [activeTabId],
    );

    const handleRename = useCallback((tabId: string) => {
        const tab = tabs.find(t => t.id === tabId);

        if (tab) {
            setRenamingTabId(tabId);
            setRenameValue(tab.title);
        }
    }, [tabs]);

    const submitRename = useCallback((tabId: string) => {
        if (!renameValue.trim()) {
            setRenamingTabId(null);

            return;
        }

        const tab = tabs.find(t => t.id === tabId);
        const endpoint = tab?.type === 'image'
            ? `/projects/${project.id}/images/${tabId}`
            : `/projects/${project.id}/documents/${tabId}`;

        api_patch(endpoint, { name: renameValue.trim() })
            .then((data) => {
                setTabs(prev => prev.map(t => t.id === tabId ? { ...t, title: data.name } : t));

                if (tab?.type === 'image') {
                    setLocalImages(prev => prev.map(img => img.id === tabId ? { ...img, name: data.name } : img));
                } else {
                    // TODO: refetch documents
                }
            })
            .catch((error) => {
                console.error('Failed to rename:', error);
            })
            .finally(() => setRenamingTabId(null));
    }, [renameValue, project.id, tabs]);

    const handleFileListRename = useCallback((docId: string, docName: string) => {
        setFileListRenamingId(docId);
        setFileListRenameValue(docName);
    }, []);

    const submitFileListRename = useCallback((itemId: string) => {
        if (!fileListRenameValue.trim()) {
            setFileListRenamingId(null);

            return;
        }

        const isImage = localImages.some(img => img.id === itemId);
        const endpoint = isImage
            ? `/projects/${project.id}/images/${itemId}`
            : `/projects/${project.id}/documents/${itemId}`;

        api_patch(endpoint, { name: fileListRenameValue.trim() })
            .then((data) => {
                setTabs(prev => prev.map(t => t.id === itemId ? { ...t, title: data.name } : t));

                if (isImage) {
                    setLocalImages(prev => prev.map(img => img.id === itemId ? { ...img, name: data.name } : img));
                } else {
                    // TODO: refetch documents
                }
            })
            .catch((error) => {
                console.error('Failed to rename:', error);
            })
            .finally(() => setFileListRenamingId(null));
    }, [fileListRenameValue, project.id, localImages]);

    const deleteTab = useCallback((tabId: string) => {
        setDeletingTabId(tabId);
    }, []);

    const confirmDelete = useCallback(() => {
        if (!deletingTabId) {
            return;
        }

        const tab = tabs.find(t => t.id === deletingTabId);
        const tabId = deletingTabId;
        setDeletingTabId(null);

        const endpoint = tab?.type === 'image'
            ? `/projects/${project.id}/images/${tabId}`
            : `/projects/${project.id}/documents/${tabId}`;

        api_delete(endpoint)
            .then(() => {
                setTabs(prev => {
                    const next = prev.filter(t => t.id !== tabId);

                    if (tabId === activeTabId) {
                        const idx = prev.findIndex(t => t.id === tabId);
                        const newIdx = Math.min(idx, next.length - 1);
                        setActiveTabId(next.length > 0 ? next[newIdx].id : '');
                    }

                    return next;
                });

                if (tab?.type === 'image') {
                    setLocalImages(prev => prev.filter(img => img.id !== tabId));
                } else {
                    // TODO: refetch documents
                }
            })
            .catch((error) => {
                console.error('Failed to delete:', error);
                window.alert(`Failed to delete ${tab?.type === 'image' ? 'image' : 'document'}.`);
            });
    }, [deletingTabId, project.id, activeTabId, tabs]);

    const fetchDocumentContent = useCallback((documentId: string) => {
        api_get(`/api/projects/${project.id}/documents/${documentId}`)
            .then((data) => {
                setTabContent(prev => ({ ...prev, [documentId]: data.content ?? '' }));
                setDirtyTabs(prev => ({ ...prev, [documentId]: false }));
                setEditorKeys(prev => ({ ...prev, [documentId]: (prev[documentId] ?? 0) + 1 }));
                setLocalDocuments(prev => prev.map(d => d.id === documentId ? { ...d, last_edited_by: data.last_edited_by } : d));
            })
            .catch(console.error);
    }, [project.id]);

    const handleDocumentEdited = useCallback((documentId: string) => {
        if (autosaveTimerRef.current[documentId]) {
            clearTimeout(autosaveTimerRef.current[documentId]);
            delete autosaveTimerRef.current[documentId];
        }

        fetchDocumentContent(documentId);
    }, [fetchDocumentContent]);

    const handleDocumentCreated = useCallback((documentId: string, documentName: string) => {
        setTabs(prev => {
            if (prev.some(t => t.id === documentId)) {
                return prev;
            }

            return [...prev, { id: documentId, title: documentName, type: 'document' }];
        });
        setActiveTabId(documentId);

        fetchDocumentContent(documentId);

        setLocalDocuments(prev => {
            if (prev.some(d => d.id === documentId)) {
                return prev;
            }

            return [...prev, { id: documentId, name: documentName, created_by: null, last_edited_by: null, directory: '' }];
        });
        // TODO: refetch documents
    }, [fetchDocumentContent]);

    const handleImageCreated = useCallback((imageId: string, imageName: string) => {
        setLocalImages(prev => {
            if (prev.some(img => img.id === imageId)) {
                return prev;
            }

            return [{ id: imageId, name: imageName, created_by: null }, ...prev];
        });
        openImage({ id: imageId, name: imageName });
    }, [openImage]);

    const handleConversationCreated = useCallback((conversation: ConversationData) => {
        setLocalConversations(prev => [conversation, ...prev]);
    }, []);

    const handleConversationUpdated = useCallback((id: string, updates: Partial<ConversationData>) => {
        setLocalConversations(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    }, []);

    const handleConversationDeleted = useCallback((id: string) => {
        setLocalConversations(prev => prev.filter(c => c.id !== id));
    }, []);

    const handleConversationsRefreshed = useCallback((freshConversations: ConversationData[]) => {
        setLocalConversations(freshConversations);
    }, []);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setTabs(prev => {
                const oldIndex = prev.findIndex(t => t.id === active.id);
                const newIndex = prev.findIndex(t => t.id === over.id);

                return arrayMove(prev, oldIndex, newIndex);
            });
        }
    }, []);

    const { defaultLayout, onLayoutChanged } = useDefaultLayout({
        id: `trident:project:${project.id}:layout`,
    });

    const toggleLeft = useCallback(() => {
        const panel = leftPanelRef.current;

        if (!panel) {
return;
}

        if (panel.isCollapsed()) {
            panel.resize('25%');
        } else {
            panel.collapse();
        }
    }, [leftPanelRef]);

    const toggleRight = useCallback(() => {
        const panel = rightPanelRef.current;

        if (!panel) {
return;
}

        if (panel.isCollapsed()) {
            panel.resize('25%');
        } else {
            panel.collapse();
        }
    }, [rightPanelRef]);

    useNativeMenu({
        onNewDocument: addTab,
        onSave: () => {
            const active = tabs.find(t => t.id === activeTabId);

            if (active?.type === 'document') {
                saveDocument(activeTabId);
            }
        },
        onPrint: () => {
            const active = tabs.find(t => t.id === activeTabId);

            if (active?.type === 'document') {
                printDocumentContent(active.title);
            }
        },
        onClose: () => {
            if (activeTabId) {
                closeTab(activeTabId, { stopPropagation: () => {} } as React.MouseEvent);
            }
        },
        onDelete: () => {
            if (activeTabId) {
                deleteTab(activeTabId);
            }
        },
    });

    const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

    if (!project) return null;

    return (
        <div className="flex h-screen flex-col">
            <ProjectTour shouldShowTour={shouldShowTour} />
            <header className="title-bar justify-between">
                <div className="no-drag flex items-center">
                    <Button variant="icon" size="icon-sm" onClick={toggleLeft}>
                        <PanelLeftIcon />
                        <span className="sr-only">Toggle left sidebar</span>
                    </Button>
                </div>
                {/*<div className="pt-1.5 text-sm font-bold text-black dark:text-white">*/}
                {/*    Trident*/}
                {/*</div>*/}
                <div className="no-drag flex items-center pr-2">
                    <Button variant="icon" size="icon-sm" onClick={toggleRight}>
                        <PanelRightIcon />
                        <span className="sr-only">Toggle right sidebar</span>
                    </Button>
                </div>
            </header>

            <div className="flex h-[calc(100vh-2rem)] w-full overflow-hidden">
                <TooltipProvider>
                    <aside className="flex w-12 flex-col items-center border-r border-neutral-100 bg-white py-2 dark:border-neutral-800 dark:bg-neutral-900">
                        <Link to="/">
                            {/*<img*/}
                            {/*    src={appIcon}*/}
                            {/*    alt="Trident"*/}
                            {/*    className="size-8 rounded-lg"*/}
                            {/*/>*/}

                            <div className="size-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-black dark:text-primary flex items-center justify-center">
                                <ArrowLeftIcon className="size-4" />
                            </div>
                        </Link>

                        <nav className="mt-4 flex flex-col items-center gap-1">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon-sm">
                                        <MessageSquareIcon className="size-4" />
                                        <span className="sr-only">Chat</span>
                                    </Button>
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
                                            <span className="sr-only">Docs</span>
                                        </Button>
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    Docs
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Link to={`/projects/${project.id}/gallery`}>
                                        <Button variant="ghost" size="icon-sm">
                                            <ImageIcon className="size-4" />
                                            <span className="sr-only">Gallery</span>
                                        </Button>
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    Gallery
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={openUpdateDialog}
                                    >
                                        <Settings2Icon className="size-4" />
                                        <span className="sr-only">Project Settings</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    Project Settings
                                </TooltipContent>
                            </Tooltip>
                        </nav>
                        <div data-tour="help" className="mt-auto">
                            <HelpSidebarButton />
                        </div>
                    </aside>
                </TooltipProvider>

                <ResizablePanelGroup
                    orientation="horizontal"
                    defaultLayout={defaultLayout}
                    onLayoutChanged={onLayoutChanged}
                    className="flex-1"
                >
                    <ResizablePanel
                        id="left-sidebar"
                        panelRef={leftPanelRef}
                        defaultSize="25%"
                        minSize="15%"
                        maxSize="30%"
                        collapsible
                        collapsedSize="0%"
                        className="bg-sidebar text-sidebar-foreground"
                    >
                        <div data-tour="chat-left" className="h-full w-full">
                            <ChatPanel
                                projectId={project.id}
                                side="left"
                                conversations={localConversations}
                                otherSideActiveId={rightActiveId}
                                documents={localDocuments}
                                defaultModel="claude-opus-4-6"
                                configuredProviders={configuredProviders}
                                initialPrompt={initialPromptRef.current}
                                onConversationCreated={handleConversationCreated}
                                onConversationUpdated={handleConversationUpdated}
                                onConversationDeleted={handleConversationDeleted}
                                onConversationsRefreshed={handleConversationsRefreshed}
                                onActiveIdChanged={handleActiveIdChanged}
                                onDocumentEdited={handleDocumentEdited}
                                onDocumentCreated={handleDocumentCreated}
                                onImageCreated={handleImageCreated}
                            />
                        </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    <ResizablePanel
                        id="main-content"
                        defaultSize="50%"
                        minSize="20%"
                    >
                        <div data-tour="main-content" className="flex h-full flex-col overflow-hidden">
                            <div className="flex min-h-9 items-center border-b border-neutral-100 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
                                    <Popover open={fileListOpen} onOpenChange={setFileListOpen}>
                                        <PopoverTrigger asChild>
                                            <button className="mx-1 flex shrink-0 items-center justify-center rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:hover:text-neutral-300">
                                                {fileListOpen ? <FolderOpenIcon className="size-4" /> : <FolderClosedIcon className="size-4" />}
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent align="start" className="w-64 gap-1 p-2">
                                            <Tabs defaultValue="documents">
                                                <TabsList className="mb-2 h-7 w-full">
                                                    <TabsTrigger value="documents" className="flex-1 text-xs">Documents</TabsTrigger>
                                                    <TabsTrigger value="images" className="flex-1 text-xs">Images</TabsTrigger>
                                                </TabsList>
                                                <TabsContent value="documents" className="mt-0">
                                                    <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
                                                        {(() => {
                                                            const groups = localDocuments.reduce<Record<string, DocumentData[]>>((acc, doc) => {
                                                                const dir = doc.directory ?? 'user';
                                                                (acc[dir] ??= []).push(doc);

                                                                return acc;
                                                            }, {});
                                                            const sortedDirs = Object.keys(groups).sort((a, b) => {
                                                                if (a === 'user') {
return -1;
}

                                                                if (b === 'user') {
return 1;
}

                                                                return a.localeCompare(b);
                                                            });

                                                            return sortedDirs.map((dir) => (
                                                                <div key={dir}>
                                                                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                                                                        {dir === 'user' ? 'Your Documents' : dir}
                                                                    </div>
                                                                    {groups[dir].map((doc) => (
                                                                        <ContextMenu key={doc.id}>
                                                                            <ContextMenuTrigger asChild>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        if (fileListRenamingId !== doc.id) {
                                                                                            openDocument(doc);
                                                                                        }
                                                                                    }}
                                                                                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                                                                                        doc.id === activeTabId
                                                                                            ? 'bg-neutral-100 dark:bg-neutral-800 font-medium'
                                                                                            : ''
                                                                                    }`}
                                                                                >
                                                                                    <FileTextIcon className="size-4 shrink-0 text-neutral-400" />
                                                                                    {fileListRenamingId === doc.id ? (
                                                                                        <input
                                                                                            ref={fileListRenameInputRef}
                                                                                            type="text"
                                                                                            value={fileListRenameValue}
                                                                                            onChange={(e) => setFileListRenameValue(e.target.value)}
                                                                                            onKeyDown={(e) => {
                                                                                                if (e.key === 'Enter') {
                                                                                                    submitFileListRename(doc.id);
                                                                                                }

                                                                                                if (e.key === 'Escape') {
                                                                                                    setFileListRenamingId(null);
                                                                                                }
                                                                                            }}
                                                                                            onBlur={() => {
                                                                                                if (Date.now() - fileListRenameStartTime.current > 100) {
                                                                                                    submitFileListRename(doc.id);
                                                                                                }
                                                                                            }}
                                                                                            onFocus={(e) => e.target.select()}
                                                                                            autoFocus
                                                                                            className="w-full bg-transparent outline-none text-sm"
                                                                                            onClick={(e) => e.stopPropagation()}
                                                                                        />
                                                                                    ) : (
                                                                                        <span className="truncate">{doc.name}</span>
                                                                                    )}
                                                                                </button>
                                                                            </ContextMenuTrigger>
                                                                            <ContextMenuContent>
                                                                                <ContextMenuItem onSelect={() => handleFileListRename(doc.id, doc.name)}>
                                                                                    Rename
                                                                                </ContextMenuItem>
                                                                                <ContextMenuSeparator />
                                                                                <ContextMenuItem onSelect={() => deleteTab(doc.id)} className="text-red-600 dark:text-red-400">
                                                                                    Delete
                                                                                </ContextMenuItem>
                                                                            </ContextMenuContent>
                                                                        </ContextMenu>
                                                                    ))}
                                                                </div>
                                                            ));
                                                        })()}
                                                        {localDocuments.length === 0 && (
                                                            <p className="px-2 py-1.5 text-sm text-neutral-400">No documents yet</p>
                                                        )}
                                                    </div>
                                                    <div className="mt-1 border-t border-neutral-100 dark:border-neutral-800 pt-1">
                                                        <button
                                                            onClick={addTab}
                                                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                                        >
                                                            <PlusIcon className="size-4" />
                                                            <span>New Document</span>
                                                        </button>
                                                    </div>
                                                </TabsContent>
                                                <TabsContent value="images" className="mt-0">
                                                    <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
                                                        {localImages.map((image) => (
                                                            <ContextMenu key={image.id}>
                                                                <ContextMenuTrigger asChild>
                                                                    <button
                                                                        onClick={() => {
                                                                            if (fileListRenamingId !== image.id) {
                                                                                openImage(image);
                                                                            }
                                                                        }}
                                                                        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                                                                            image.id === activeTabId
                                                                                ? 'bg-neutral-100 dark:bg-neutral-800 font-medium'
                                                                                : ''
                                                                        }`}
                                                                    >
                                                                        <ImageIcon className="size-4 shrink-0 text-neutral-400" />
                                                                        {fileListRenamingId === image.id ? (
                                                                            <input
                                                                                ref={fileListRenameInputRef}
                                                                                type="text"
                                                                                value={fileListRenameValue}
                                                                                onChange={(e) => setFileListRenameValue(e.target.value)}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter') {
                                                                                        submitFileListRename(image.id);
                                                                                    }

                                                                                    if (e.key === 'Escape') {
                                                                                        setFileListRenamingId(null);
                                                                                    }
                                                                                }}
                                                                                onBlur={() => {
                                                                                    if (Date.now() - fileListRenameStartTime.current > 100) {
                                                                                        submitFileListRename(image.id);
                                                                                    }
                                                                                }}
                                                                                onFocus={(e) => e.target.select()}
                                                                                autoFocus
                                                                                className="w-full bg-transparent outline-none text-sm"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                            />
                                                                        ) : (
                                                                            <span className="truncate">{image.name}</span>
                                                                        )}
                                                                    </button>
                                                                </ContextMenuTrigger>
                                                                <ContextMenuContent>
                                                                    <ContextMenuItem onSelect={() => handleFileListRename(image.id, image.name)}>
                                                                        Rename
                                                                    </ContextMenuItem>
                                                                    <ContextMenuSeparator />
                                                                    <ContextMenuItem onSelect={() => deleteTab(image.id)} className="text-red-600 dark:text-red-400">
                                                                        Delete
                                                                    </ContextMenuItem>
                                                                </ContextMenuContent>
                                                            </ContextMenu>
                                                        ))}
                                                        {localImages.length === 0 && (
                                                            <p className="px-2 py-1.5 text-sm text-neutral-400">No images yet</p>
                                                        )}
                                                    </div>
                                                </TabsContent>
                                            </Tabs>
                                        </PopoverContent>
                                    </Popover>
                                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToHorizontalAxis]}>
                                        <SortableContext items={tabs.map(t => t.id)} strategy={horizontalListSortingStrategy}>
                                            <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-0 overflow-x-auto">
                                                {tabs.map((tab) => (
                                                    <SortableTab
                                                        key={tab.id}
                                                        tab={tab}
                                                        isActive={tab.id === activeTabId}
                                                        isRenaming={renamingTabId === tab.id}
                                                        renameValue={renameValue}
                                                        renameInputRef={renameInputRef}
                                                        renameStartTime={renameStartTime}
                                                        onSelect={setActiveTabId}
                                                        onClose={closeTab}
                                                        onRename={handleRename}
                                                        onDelete={deleteTab}
                                                        onRenameValueChange={setRenameValue}
                                                        onSubmitRename={submitRename}
                                                        onCancelRename={() => setRenamingTabId(null)}
                                                    />
                                                ))}
                                            </div>
                                        </SortableContext>
                                    </DndContext>
                                    <button
                                        onClick={addTab}
                                        className="mx-1 flex shrink-0 items-center justify-center rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
                                    >
                                        <PlusIcon className="size-4" />
                                    </button>
                                </div>
                            {/* {activeTab && (
                                <div className="flex items-center justify-between border-b border-neutral-100 bg-white px-2 py-1.5 dark:border-neutral-800 dark:bg-neutral-900">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                                            {activeTab.title}
                                        </h2>
                                        {activeTab.type === 'document' && localDocuments.find((d) => d.id === activeTabId)?.last_edited_by && (
                                            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">
                                                {localDocuments.find((d) => d.id === activeTabId)?.last_edited_by === 'user'
                                                    ? 'You'
                                                    : localDocuments.find((d) => d.id === activeTabId)?.last_edited_by}
                                            </span>
                                        )}
                                    </div>
                                    {activeTab.type === 'document' && (
                                        <div className="flex items-center gap-2">
                                            {saveStatus[activeTabId] === 'saving' ? (
                                                <span className="text-xs text-neutral-400">Saving...</span>
                                            ) : saveStatus[activeTabId] === 'saved' ? (
                                                <span className="text-xs text-green-500">Saved</span>
                                            ) : dirtyTabs[activeTabId] ? (
                                                <>
                                                    <Button variant="icon" size="icon-xs" onClick={() => revertDocument(activeTabId)} title="Revert changes">
                                                        <Undo2Icon />
                                                        <span className="sr-only">Revert changes</span>
                                                    </Button>
                                                    <Button variant="icon" size="icon-xs" onClick={() => saveDocument(activeTabId)} title="Save">
                                                        <SaveIcon />
                                                        <span className="sr-only">Save</span>
                                                    </Button>
                                                </>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            )} */}
                            <main className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
                                {tabs.length === 0 ? (
                                    <div className="flex h-full flex-col items-center justify-center gap-4 text-neutral-400 dark:text-neutral-500">
                                        <FilesIcon className="size-12 stroke-1" />
                                        <p className="text-sm">
                                            No documents open
                                        </p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={addTab}
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
                                            {tab.type === 'image' ? (
                                                <div className="flex flex-1 items-center justify-center overflow-hidden bg-neutral-50 p-8 dark:bg-neutral-950">
                                                    <img
                                                        src={`/projects/${project.id}/images/${tab.id}`}
                                                        alt={tab.title}
                                                        className="max-h-full max-w-full object-contain"
                                                    />
                                                </div>
                                            ) : tabContent[tab.id] !== undefined ? (
                                                <MilkdownEditorWrapper
                                                    key={editorKeys[tab.id] ?? 0}
                                                    ref={(el) => {
 editorRefs.current[tab.id] = el; 
}}
                                                    defaultValue={tabContent[tab.id]}
                                                    onChange={(markdown) => handleContentChange(tab.id, markdown)}
                                                    onReady={(markdown) => {
                                                        setTabContent(prev => ({ ...prev, [tab.id]: markdown }));
                                                    }}
                                                />
                                            ) : (
                                                <div className="flex flex-1 items-center justify-center text-neutral-400">Loading...</div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </main>
                            {activeTab?.type === 'document' && (() => {
                                const activeDoc = localDocuments.find(d => d.id === activeTabId);

                                return (
                                    <div className="h-8 flex items-center justify-between border-t border-neutral-100 bg-neutral-50 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
                                        <div className="flex items-center gap-2">
                                            <label htmlFor="autosave-toggle" className="text-xs text-neutral-400 dark:text-neutral-500">
                                                Autosave
                                            </label>
                                            <Switch
                                                id="autosave-toggle"
                                                size="sm"
                                                checked={autosaveEnabled}
                                                onCheckedChange={toggleAutosave}
                                            />
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {activeDoc && (activeDoc.created_by || activeDoc.last_edited_by) && (
                                                <div className="flex items-center gap-3 text-xs text-neutral-400 dark:text-neutral-500">
                                                    {activeDoc.created_by && (
                                                        <span>Created by {activeDoc.created_by}</span>
                                                    )}
                                                    {activeDoc.last_edited_by && (
                                                        <span>Last edited by {activeDoc.last_edited_by}</span>
                                                    )}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2">
                                                {saveStatus[activeTabId] === 'saving' ? (
                                                    <span className="text-xs text-neutral-400">Saving...</span>
                                                ) : saveStatus[activeTabId] === 'saved' ? (
                                                    <span className="text-xs text-green-500">Saved</span>
                                                ) : dirtyTabs[activeTabId] ? (
                                                    <>
                                                        <Button variant="icon" size="icon-xs" onClick={() => revertDocument(activeTabId)} title="Revert changes">
                                                            <Undo2Icon />
                                                            <span className="sr-only">Revert changes</span>
                                                        </Button>
                                                        <Button variant="icon" size="icon-xs" onClick={() => saveDocument(activeTabId)} title="Save">
                                                            <SaveIcon />
                                                            <span className="sr-only">Save</span>
                                                        </Button>
                                                    </>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    <ResizablePanel
                        id="right-sidebar"
                        panelRef={rightPanelRef}
                        defaultSize="25%"
                        minSize="15%"
                        maxSize="30%"
                        collapsible
                        collapsedSize="0%"
                        className="bg-sidebar text-sidebar-foreground"
                    >
                        <div data-tour="chat-right" className="h-full w-full">
                            <ChatPanel
                                projectId={project.id}
                                side="right"
                                conversations={localConversations}
                                otherSideActiveId={leftActiveId}
                                documents={localDocuments}
                                defaultModel="gpt-5.4"
                                configuredProviders={configuredProviders}
                                initialPrompt={initialPromptRef.current}
                                onConversationCreated={handleConversationCreated}
                                onConversationUpdated={handleConversationUpdated}
                                onConversationDeleted={handleConversationDeleted}
                                onConversationsRefreshed={handleConversationsRefreshed}
                                onActiveIdChanged={handleActiveIdChanged}
                                onDocumentEdited={handleDocumentEdited}
                                onDocumentCreated={handleDocumentCreated}
                                onImageCreated={handleImageCreated}
                            />
                        </div>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
            <AlertDialog open={deletingTabId !== null} onOpenChange={(open) => {
 if (!open) {
setDeletingTabId(null);
}
}}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{trashEnabled ? 'Move to Trash?' : 'Delete document?'}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {trashEnabled
                                ? 'This document will be moved to the system trash.'
                                : 'This will permanently delete this document. This action cannot be undone.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => confirmDelete()} className="bg-red-600 hover:bg-red-700 text-white">
                            {trashEnabled ? 'Move to Trash' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {/* Clear conversation dialog hidden — replaced by per-conversation delete in history panel */}

            <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Project Settings</DialogTitle>
                        <DialogDescription>
                            Update this project's name, description, and workspace directory.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpdateSubmit} className="grid gap-4">
                        <div className="grid gap-2">
                            <label
                                htmlFor="update-name"
                                className="text-sm font-medium"
                            >
                                Name
                            </label>
                            <Input
                                id="update-name"
                                value={updateForm.data.name}
                                onChange={(e) =>
                                    updateForm.setData('name', e.target.value)
                                }
                                placeholder="My Project"
                                required
                            />
                            {updateForm.errors.name && (
                                <p className="text-sm text-destructive">
                                    {updateForm.errors.name}
                                </p>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <label
                                htmlFor="update-description"
                                className="text-sm font-medium"
                            >
                                Description
                            </label>
                            <Textarea
                                id="update-description"
                                value={updateForm.data.description}
                                onChange={(e) =>
                                    updateForm.setData(
                                        'description',
                                        e.target.value,
                                    )
                                }
                                placeholder="A short description of the project"
                            />
                            {updateForm.errors.description && (
                                <p className="text-sm text-destructive">
                                    {updateForm.errors.description}
                                </p>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">
                                Workspace Directory{' '}
                                <span className="font-normal text-neutral-400">(optional)</span>
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    value={updateForm.data.filesystem_root}
                                    readOnly
                                    placeholder="No directory selected"
                                    className="flex-1"
                                />
                                {updateForm.data.filesystem_root && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => updateForm.setData('filesystem_root', '')}
                                        title="Clear workspace directory"
                                    >
                                        <XIcon className="size-4" />
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={handleSelectUpdateDirectory}
                                >
                                    <FolderOpenIcon className="size-4" />
                                </Button>
                            </div>
                            {updateForm.errors.filesystem_root && (
                                <p className="text-sm text-destructive">
                                    {updateForm.errors.filesystem_root}
                                </p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsUpdateDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={updateForm.processing}
                            >
                                Save
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

import type { DragEndEvent } from "@dnd-kit/core";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link, useLocation, useParams } from "react-router-dom";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useAuthedImage } from "@/hooks/use-authed-image";
import { api_get, api_patch, api_delete } from "@/lib/api";
import {
  ArrowLeftIcon,
  FileTextIcon,
  ImageIcon,
  MessageSquareIcon,
  XIcon,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ProjectSearchTrigger } from "@/components/command-palette";
import { HelpSidebarButton } from "@/components/help-sidebar-button";
import {
  ImagePreview,
  ModelSelectorLogo,
  PROVIDER_NAMES,
  aspectInfo,
  imageProviderFor,
  qualityLabel,
} from "@/components/image-preview";
import { ProjectSettingsDialog } from "@/components/project-settings-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type {
  DocumentData,
  ImageData,
  ImageMetadata,
  ProjectData,
} from "@/types/api";

interface Tab {
  id: string;
  title: string;
}

// Anything wider than ~16:9 (1.78) gets pulled out of the masonry column flow
// and rendered full-width, since cramming an ultra-wide thumbnail into one of
// two narrow columns leaves a thin sliver of an image surrounded by dead space.
const WIDE_RATIO_THRESHOLD = 1.7;

// ─── Polished image card ────────────────────────────────────

function ImageCard({
  image,
  projectId,
  isActive,
  onClick,
}: {
  image: ImageData;
  projectId: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const meta: ImageMetadata = image.metadata ?? {};
  const provider = imageProviderFor(meta.model);
  const aspect = aspectInfo(meta.size);
  const quality = qualityLabel(meta.quality);
  const imageSrc = useAuthedImage(
    `/api/projects/${projectId}/images/${image.id}`,
  );

  return (
    <button
      onClick={onClick}
      data-active={isActive}
      className="group focus-visible:ring-primary/40 data-[active=true]:border-primary relative block w-full overflow-hidden rounded-xl border border-neutral-200 bg-white text-left transition-colors duration-150 ease-out hover:border-neutral-300 hover:shadow-sm focus-visible:ring-2 focus-visible:outline-none data-[active=true]:shadow-[0_0_0_1px_var(--color-primary)] dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700"
    >
      {/* Thumbnail keeps the image's natural aspect ratio when known so
          portrait/landscape generations don't all look square. */}
      <div
        className="relative w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900"
        style={{ aspectRatio: aspect.cssRatio ?? "1 / 1" }}
      >
        {imageSrc && (
          <img
            src={imageSrc}
            alt={image.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
          />
        )}
        {provider !== "unknown" && (
          <span
            title={PROVIDER_NAMES[provider]}
            className="absolute top-1.5 left-1.5 flex translate-y-1 items-center justify-center rounded-full bg-black/60 p-1.5 opacity-0 backdrop-blur-sm transition-[opacity,transform] duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100"
          >
            {/* Chip background is always dark, so the brand SVG (dark by
                default) needs to be inverted in both light and dark mode —
                hence `invert` rather than ModelSelectorLogo's default
                theme-aware `dark:invert`. */}
            <ModelSelectorLogo provider={provider} className="!size-4 invert" />
          </span>
        )}
        {(aspect.label || quality) && (
          <div className="absolute bottom-1.5 left-1.5 flex translate-y-1 items-center gap-1 text-[10px] font-medium text-white opacity-0 transition-[opacity,transform] duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100">
            {aspect.label && (
              <span className="rounded bg-black/60 px-1.5 py-0.5 tabular-nums backdrop-blur-sm">
                {aspect.label}
              </span>
            )}
            {quality && (
              <span className="rounded bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
                {quality}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id, disabled: isRenaming });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex"
    >
      <Tooltip>
        <ContextMenu>
          <TooltipTrigger asChild>
            <ContextMenuTrigger asChild>
              <button
                onClick={() => onSelect(tab.id)}
                className={`group flex w-48 min-w-0 shrink-0 items-center gap-1.5 border px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                }`}
              >
                {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameValue}
                    onChange={(e) => onRenameValueChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onSubmitRename(tab.id);
                      }

                      if (e.key === "Escape") {
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
                    if (e.key === "Enter" || e.key === " ") {
                      onClose(tab.id, e as unknown as React.MouseEvent);
                    }
                  }}
                  className="flex shrink-0 items-center justify-center rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                >
                  <XIcon className="size-3" />
                </span>
              </button>
            </ContextMenuTrigger>
          </TooltipTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={() => onRename(tab.id)}>
              Rename
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() =>
                onClose(tab.id, {
                  stopPropagation: () => {},
                } as React.MouseEvent)
              }
            >
              Close
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => onDelete(tab.id)}
              className="text-red-600 dark:text-red-400"
            >
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <TooltipContent side="bottom">{tab.title}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export default function Gallery() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    project: ProjectData;
    images: ImageData[];
    documents: DocumentData[];
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    api_get<{
      project: ProjectData;
      images: ImageData[];
      documents: DocumentData[];
    }>(`/api/projects/${id}`)
      .then(setData)
      .catch(console.error);
  }, [id]);

  useDocumentTitle(data ? `Gallery - ${data.project.name}` : "Gallery");

  if (!data) return null;

  return (
    <GalleryView
      key={data.project.id}
      project={data.project}
      images={data.images}
      documents={data.documents}
      onProjectUpdated={(updated) =>
        setData((prev) => (prev ? { ...prev, project: updated } : prev))
      }
    />
  );
}

function GalleryView({
  project,
  images,
  documents,
  onProjectUpdated,
}: {
  project: ProjectData;
  images: ImageData[];
  documents: DocumentData[];
  onProjectUpdated: (p: ProjectData) => void;
}) {
  const [localImages, setLocalImages] = useState<ImageData[]>(images);
  const storageKey = `trident:project:${project.id}:gallery:tabs`;
  const [tabs, setTabs] = useState<Tab[]>(() => {
    const saved = localStorage.getItem(storageKey);

    if (saved) {
      try {
        const { openTabs } = JSON.parse(saved) as {
          openTabs?: Array<{ id: string }>;
        };
        const imgMap = new Map(images.map((img) => [img.id, img]));

        return (openTabs ?? [])
          .filter((t) => imgMap.has(t.id))
          .map((t) => ({ id: t.id, title: imgMap.get(t.id)!.name }));
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
        const { openTabs, activeTabId: savedActiveId } = JSON.parse(saved) as {
          openTabs?: Array<{ id: string }>;
          activeTabId?: string | null;
        };
        const imgIds = new Set(images.map((img) => img.id));
        const validIds = (openTabs ?? [])
          .map((t) => t.id)
          .filter((id) => imgIds.has(id));

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
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingTabId, setDeletingTabId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const renameStartTime = useRef<number>(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
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
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        openTabs: tabs.map((t) => ({ id: t.id })),
        activeTabId,
      }),
    );
  }, [tabs, activeTabId, storageKey]);

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

  // Deep-link from the project command palette: navigate(...) is called with
  // location.state.focusImageId; on first arrival we look the image up and
  // open it as a tab. consumedRef stops the same id from re-firing if the
  // images list changes while the state is still set.
  const location = useLocation();
  const focusImageId =
    (location.state as { focusImageId?: string } | null)?.focusImageId ?? null;
  const consumedFocusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusImageId || consumedFocusRef.current === focusImageId) return;
    const image = localImages.find((i) => i.id === focusImageId);
    if (image) {
      openImage({ id: image.id, name: image.name });
      consumedFocusRef.current = focusImageId;
    }
  }, [focusImageId, localImages, openImage]);

  const closeTab = useCallback(
    (tabId: string, e: React.MouseEvent) => {
      e.stopPropagation();

      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== tabId);

        if (activeTabId === tabId) {
          const idx = prev.findIndex((t) => t.id === tabId);
          const newActive = next[Math.min(idx, next.length - 1)]?.id ?? null;
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
        tab?.title ?? localImages.find((img) => img.id === tabId)?.name ?? "";
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

      api_patch<{ id: string; name: string }>(
        `/api/projects/${project.id}/images/${tabId}`,
        {
          name: renameValue.trim(),
        },
      )
        .then((data) => {
          setTabs((prev) =>
            prev.map((t) => (t.id === tabId ? { ...t, title: data.name } : t)),
          );
          setLocalImages((prev) =>
            prev.map((img) =>
              img.id === tabId ? { ...img, name: data.name } : img,
            ),
          );
        })
        .catch((error) => {
          console.error("Failed to rename:", error);
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
    setDeleteError(null);

    api_delete(`/api/projects/${project.id}/images/${tabId}`)
      .then(() => {
        setTabs((prev) => {
          const next = prev.filter((t) => t.id !== tabId);

          if (tabId === activeTabId) {
            const idx = prev.findIndex((t) => t.id === tabId);
            const newIdx = Math.min(idx, next.length - 1);
            setActiveTabId(next.length > 0 ? next[newIdx].id : null);
          }

          return next;
        });
        setLocalImages((prev) => prev.filter((img) => img.id !== tabId));
      })
      .catch((error) => {
        console.error("Failed to delete:", error);
        setDeleteError("Failed to delete image. Please try again.");
      });
  }, [deletingTabId, project.id, activeTabId]);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeImage = useMemo(
    () => localImages.find((img) => img.id === activeTabId) ?? null,
    [localImages, activeTabId],
  );

  return (
    <div className="flex h-screen flex-col">
      <header className="title-bar" />
      <div className="flex flex-1 overflow-hidden bg-white select-none dark:bg-neutral-950">
        <TooltipProvider delayDuration={300}>
          <aside className="border-border flex w-12 flex-col items-center border-r bg-white py-2 dark:bg-neutral-950">
            <Link to={`/projects/${project.id}`}>
              <div className="dark:text-primary flex size-8 items-center justify-center rounded-lg bg-neutral-50 text-black dark:bg-neutral-900">
                <ArrowLeftIcon className="size-4" />
              </div>
            </Link>

            <nav className="mt-4 flex flex-col items-center gap-1">
              <ProjectSearchTrigger
                projectId={project.id}
                documents={documents}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link to={`/projects/${project.id}`}>
                    <Button variant="ghost" size="icon-sm">
                      <MessageSquareIcon className="size-4" />
                      <span className="sr-only">Chat</span>
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Chat</TooltipContent>
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
                <TooltipContent side="right">Docs</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <ImageIcon className="size-4" />
                    <span className="sr-only">Gallery</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Gallery</TooltipContent>
              </Tooltip>
              <ProjectSettingsDialog
                project={project}
                onUpdated={onProjectUpdated}
              />
            </nav>
            <div className="mt-auto">
              <HelpSidebarButton />
            </div>
          </aside>

          <div className="flex flex-1 overflow-hidden">
            {/* Image grid */}
            <div className="border-border flex w-80 shrink-0 flex-col border-r bg-neutral-50/40 dark:bg-neutral-950/40">
              <div className="border-border flex items-center gap-2 border-b px-3 py-2">
                <ImageIcon className="size-5 text-neutral-400" />
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  Gallery
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {localImages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-neutral-400">
                    <ImageIcon className="size-8 stroke-1" />
                    <p>No images yet</p>
                  </div>
                ) : (
                  <div className="columns-2 gap-2.5">
                    {localImages.map((image) => {
                      const ratio = aspectInfo(image.metadata?.size).ratio;
                      const isWide =
                        ratio !== undefined && ratio >= WIDE_RATIO_THRESHOLD;

                      return (
                        <ContextMenu key={image.id}>
                          <ContextMenuTrigger asChild>
                            <div
                              className={`mb-2.5 break-inside-avoid ${isWide ? "[column-span:all]" : ""}`}
                            >
                              <ImageCard
                                image={image}
                                projectId={project.id}
                                isActive={image.id === activeTabId}
                                onClick={() => openImage(image)}
                              />
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem
                              onSelect={() => startRename(image.id)}
                            >
                              Rename
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              onSelect={() => setDeletingTabId(image.id)}
                              className="text-red-600 dark:text-red-400"
                            >
                              Delete
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Image viewer */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {deleteError && (
                <div
                  role="alert"
                  className="border-destructive/30 bg-destructive/10 text-destructive flex items-center justify-between gap-3 border-b px-4 py-2 text-sm"
                >
                  <span>{deleteError}</span>
                  <button
                    type="button"
                    onClick={() => setDeleteError(null)}
                    className="hover:bg-destructive/10 rounded p-0.5"
                  >
                    <XIcon className="size-3.5" />
                    <span className="sr-only">Dismiss error</span>
                  </button>
                </div>
              )}
              {/* Tab bar */}
              <div className="border-border flex min-h-9 items-center border-b">
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
                <div className="border-border flex items-center gap-2 border-b px-4 py-1">
                  <h2 className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    {activeTab.title}
                  </h2>
                </div>
              )}

              {/* Image content */}
              {activeTab && activeImage ? (
                <ImagePreview image={activeImage} projectId={project.id} />
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 text-neutral-400 dark:text-neutral-500">
                  <ImageIcon className="size-12 stroke-1" />
                  <p className="text-sm">Select an image to preview</p>
                </div>
              )}
            </div>
          </div>
        </TooltipProvider>
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
              This will permanently delete this image. This action cannot be
              undone.
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

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
import { Link, useParams } from "react-router-dom";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { api_get, api_post, api_put, api_patch, api_delete } from "@/lib/api";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  FileTextIcon,
  ImageIcon,
  MaximizeIcon,
  MessageSquareIcon,
  MinusIcon,
  PlusIcon,
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
import { ModelSelectorLogo } from "@/components/ai-elements/model-selector";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

interface Props {
  project: ProjectData;
  images: ImageData[];
}

// ─── Image metadata helpers ────────────────────────────────
//
// Provider/aspect-ratio derivations are intentionally permissive: image
// model id naming is messy (gpt-image-1, dall-e-3, gemini-3-pro-image,
// imagen-4, etc.) and we'd rather show a best-effort label than nothing.

type ImageProvider = "openai" | "anthropic" | "google" | "unknown";

function imageProviderFor(modelId: string | undefined): ImageProvider {
  if (!modelId) return "unknown";
  if (modelId.startsWith("claude-")) return "anthropic";
  if (modelId.startsWith("gemini-") || modelId.startsWith("imagen"))
    return "google";
  if (
    modelId.startsWith("gpt-image") ||
    modelId.startsWith("dall-e") ||
    modelId.startsWith("gpt-")
  ) {
    return "openai";
  }
  return "unknown";
}

const PROVIDER_NAMES: Record<ImageProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  unknown: "Unknown",
};

// Normalize the size field (which can be either "WxH" pixels or "W:H" ratio)
// into both a compact label like "16:9" and a CSS aspect-ratio string. We
// reduce by GCD so 1024x768 displays as 4:3 instead of 1024:768.
function aspectInfo(size: string | undefined): {
  label: string | undefined;
  cssRatio: string | undefined;
} {
  if (!size) return { label: undefined, cssRatio: undefined };
  if (size.includes(":")) {
    const [w, h] = size.split(":").map((s) => parseInt(s, 10));
    if (!w || !h) return { label: size, cssRatio: undefined };
    return { label: `${w}:${h}`, cssRatio: `${w} / ${h}` };
  }
  const m = size.match(/^(\d+)x(\d+)$/i);
  if (!m) return { label: size, cssRatio: undefined };
  const w = parseInt(m[1], 10);
  const h = parseInt(m[2], 10);
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(w, h);
  return { label: `${w / g}:${h / g}`, cssRatio: `${w} / ${h}` };
}

function qualityLabel(q: string | undefined): string | undefined {
  if (!q) return undefined;
  return q.charAt(0).toUpperCase() + q.slice(1);
}

function formatCreatedAt(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

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

  return (
    <button
      onClick={onClick}
      data-active={isActive}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white text-left transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700 data-[active=true]:border-primary data-[active=true]:shadow-[0_0_0_1px_var(--color-primary)]"
    >
      {/* Thumbnail keeps the image's natural aspect ratio when known so
          portrait/landscape generations don't all look square. */}
      <div
        className="relative w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900"
        style={{ aspectRatio: aspect.cssRatio ?? "1 / 1" }}
      >
        <img
          src={`/api/projects/${projectId}/images/${image.id}`}
          alt={image.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
        />
        {provider !== "unknown" && (
          <span
            title={PROVIDER_NAMES[provider]}
            className="absolute top-1.5 left-1.5 flex items-center justify-center rounded-full bg-black/60 p-1.5 backdrop-blur-sm"
          >
            {/* Chip background is always dark, so the brand SVG (dark by
                default) needs to be inverted in both light and dark mode —
                hence `invert` rather than ModelSelectorLogo's default
                theme-aware `dark:invert`. */}
            <ModelSelectorLogo provider={provider} className="!size-4 invert" />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 p-2">
        <span className="truncate text-xs font-medium text-neutral-800 dark:text-neutral-200">
          {image.name}
        </span>
        {(aspect.label || quality) && (
          <div className="flex items-center gap-1 text-[10px] font-medium text-neutral-500 dark:text-neutral-400">
            {aspect.label && (
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 tabular-nums dark:bg-neutral-900">
                {aspect.label}
              </span>
            )}
            {quality && (
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-900">
                {quality}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Zoomable / pannable image canvas ───────────────────────

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 12;
const WHEEL_STEP = 1.12;
const BUTTON_STEP = 1.25;

function ZoomableImage({
  src,
  alt,
  resetKey,
}: {
  src: string;
  alt: string;
  // Bumping this externally (e.g. when the active tab changes) snaps the
  // viewport back to a centered, fit-to-screen state for the new image.
  resetKey: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{
    pointerX: number;
    pointerY: number;
    tx: number;
    ty: number;
  } | null>(null);

  const reset = useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

  // Snap back to fit on image change.
  useEffect(() => {
    reset();
  }, [resetKey, reset]);

  // Anchor zoom to the cursor so the pixel under the mouse stays under the
  // mouse during a wheel zoom — the standard Figma/Photoshop behavior. The
  // math: in screen space, point P maps to (P - center) under transform
  // translate(t)+scale(s); after zoom by k we want the same source point
  // under the same screen pixel, which gives t' = c - (c - t)·k.
  const zoomAtPoint = useCallback(
    (factor: number, screenX?: number, screenY?: number) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const cx =
        (screenX ?? rect.left + rect.width / 2) - rect.left - rect.width / 2;
      const cy =
        (screenY ?? rect.top + rect.height / 2) - rect.top - rect.height / 2;
      setScale((prevScale) => {
        const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prevScale * factor));
        if (next === prevScale) return prevScale;
        const k = next / prevScale;
        setTx((prev) => cx - (cx - prev) * k);
        setTy((prev) => cy - (cy - prev) * k);
        return next;
      });
    },
    [],
  );

  // React's onWheel is passive in modern React, so preventDefault is a no-op
  // and the canvas would scroll its parent during zoom. Attach a native
  // non-passive listener so we can suppress the browser's default scroll.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP;
      zoomAtPoint(factor, e.clientX, e.clientY);
    };
    container.addEventListener("wheel", handler, { passive: false });
    return () => container.removeEventListener("wheel", handler);
  }, [zoomAtPoint]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Primary button only; pan is allowed at any zoom level so users can
      // reposition a fit-to-screen image (e.g. to inspect it under the
      // floating toolbar) without first having to zoom in.
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
      dragStart.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        tx,
        ty,
      };
    },
    [tx, ty],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging || !dragStart.current) return;
      setTx(dragStart.current.tx + (e.clientX - dragStart.current.pointerX));
      setTy(dragStart.current.ty + (e.clientY - dragStart.current.pointerY));
    },
    [dragging],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Capture may have been lost (e.g. element reparented); ignore.
      }
      setDragging(false);
      dragStart.current = null;
    },
    [dragging],
  );

  const cursor = dragging ? "grabbing" : "grab";

  return (
    <div className="relative flex flex-1 overflow-hidden bg-neutral-50 dark:bg-neutral-950">
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={reset}
        className="relative flex flex-1 items-center justify-center overflow-hidden select-none"
        style={{ cursor }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          // Smooth easing on wheel zoom, but no transition while dragging —
          // otherwise each pointermove queues an animated tween that lags
          // behind the cursor.
          className={`max-h-full max-w-full object-contain ${dragging ? "" : "transition-[transform] duration-75 ease-out"}`}
          style={{
            transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
            transformOrigin: "center center",
          }}
        />
      </div>

      <div className="absolute top-3 right-3 flex items-center gap-0.5 rounded-full border border-neutral-200/80 bg-white/85 px-1 py-1 shadow-sm backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-900/85">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7"
              onClick={() => zoomAtPoint(1 / BUTTON_STEP)}
              aria-label="Zoom out"
            >
              <MinusIcon className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Zoom out</TooltipContent>
        </Tooltip>
        <span className="min-w-[3.5rem] text-center font-mono text-[11px] tabular-nums text-neutral-600 dark:text-neutral-400">
          {Math.round(scale * 100)}%
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7"
              onClick={() => zoomAtPoint(BUTTON_STEP)}
              aria-label="Zoom in"
            >
              <PlusIcon className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Zoom in</TooltipContent>
        </Tooltip>
        <div className="mx-1 h-4 w-px bg-neutral-200 dark:bg-neutral-800" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7"
              onClick={reset}
              aria-label="Fit to screen"
            >
              <MaximizeIcon className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Fit (double-click)</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// ─── Metadata panel (prompt + stats) ────────────────────────

function MetadataPill({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | undefined;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5 px-2.5 py-1">
      <span className="text-[10px] font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-500">
        {label}
      </span>
      <span
        className={`text-xs text-neutral-800 dark:text-neutral-200 ${mono ? "font-mono tabular-nums" : "font-medium"}`}
      >
        {value}
      </span>
    </div>
  );
}

function MetadataPanel({ image }: { image: ImageData }) {
  const meta: ImageMetadata = image.metadata ?? {};
  const aspect = aspectInfo(meta.size);
  const provider = imageProviderFor(meta.model);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(true);

  const copyPrompt = useCallback(
    (e: React.MouseEvent) => {
      // The copy button lives inside the prompt block of the collapsible
      // content, but a click anywhere there shouldn't toggle the drawer.
      e.stopPropagation();
      if (!meta.prompt) return;
      navigator.clipboard
        .writeText(meta.prompt)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
        .catch(() => {
          // Clipboard may be unavailable (insecure context, missing permission)
        });
    },
    [meta.prompt],
  );

  const createdAt = formatCreatedAt(image.created_at);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="flex max-h-[40vh] shrink-0 flex-col border-t border-border bg-white dark:bg-neutral-950 data-[state=closed]:max-h-none"
    >
      {/* Header doubles as the trigger so users can click anywhere on the
          row to toggle, while the chevron makes the affordance explicit. */}
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="group flex w-full items-center justify-between border-b border-border px-4 py-2 text-left transition-colors hover:bg-neutral-50/60 dark:hover:bg-neutral-900/40"
        >
          <span className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase dark:text-neutral-500">
            Generation details
          </span>
          <ChevronDownIcon className="size-4 text-neutral-400 transition-transform duration-200 group-data-[state=closed]:-rotate-90 dark:text-neutral-500" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {meta.prompt ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-500">
                  Prompt
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-[11px]"
                  onClick={copyPrompt}
                  aria-label="Copy prompt"
                >
                  {copied ? (
                    <CheckIcon className="size-3" />
                  ) : (
                    <CopyIcon className="size-3" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="font-serif text-[13px] leading-relaxed whitespace-pre-wrap text-neutral-800 dark:text-neutral-200">
                {meta.prompt}
              </p>
            </div>
          ) : (
            <p className="text-xs text-neutral-400">
              No prompt recorded for this image.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1.5 border-t border-border px-4 py-3 sm:grid-cols-3 lg:grid-cols-[auto_auto_auto_auto_auto_1fr]">
          <MetadataPill
            label="Provider"
            value={
              provider !== "unknown" ? PROVIDER_NAMES[provider] : undefined
            }
          />
          <MetadataPill label="Model" value={meta.model} mono />
          <MetadataPill label="Aspect" value={aspect.label} mono />
          <MetadataPill label="Quality" value={qualityLabel(meta.quality)} />
          <MetadataPill
            label="Format"
            value={image.mime_type?.replace("image/", "")}
            mono
          />
          <MetadataPill label="Created" value={createdAt} />
        </div>
      </CollapsibleContent>
    </Collapsible>
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
      <ContextMenu>
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
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => onRename(tab.id)}>
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() =>
              onClose(tab.id, { stopPropagation: () => {} } as React.MouseEvent)
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
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingTabId, setDeletingTabId] = useState<string | null>(null);
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
        window.alert("Failed to delete image.");
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
          <aside className="flex w-12 flex-col items-center border-r border-border bg-white py-2 dark:bg-neutral-950">
            <Link to={`/projects/${project.id}`}>
              <div className="flex size-8 items-center justify-center rounded-lg bg-neutral-50 text-black dark:bg-neutral-900 dark:text-primary">
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
            <div className="flex w-80 shrink-0 flex-col border-r border-border bg-neutral-50/40 dark:bg-neutral-950/40">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
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
                  <div className="grid grid-cols-2 gap-2.5">
                    {localImages.map((image) => (
                      <ContextMenu key={image.id}>
                        <ContextMenuTrigger asChild>
                          <div>
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
              {activeTab && activeImage ? (
                <>
                  <ZoomableImage
                    src={`/api/projects/${project.id}/images/${activeTab.id}`}
                    alt={activeTab.title}
                    resetKey={activeTab.id}
                  />
                  <MetadataPanel image={activeImage} />
                </>
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

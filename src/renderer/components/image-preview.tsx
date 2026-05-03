import {
    CheckIcon,
    ChevronDownIcon,
    CopyIcon,
    MaximizeIcon,
    MinusIcon,
    PlusIcon,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ModelSelectorLogo } from '@/components/ai-elements/model-selector';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ImageData, ImageMetadata } from '@/types/api';

// ─── Image metadata helpers ────────────────────────────────
//
// Provider/aspect-ratio derivations are intentionally permissive: image
// model id naming is messy (gpt-image-1, dall-e-3, gemini-3-pro-image,
// imagen-4, etc.) and we'd rather show a best-effort label than nothing.

export type ImageProvider = 'openai' | 'anthropic' | 'google' | 'unknown';

export function imageProviderFor(modelId: string | undefined): ImageProvider {
    if (!modelId) return 'unknown';
    if (modelId.startsWith('claude-')) return 'anthropic';
    if (modelId.startsWith('gemini-') || modelId.startsWith('imagen'))
        return 'google';
    if (
        modelId.startsWith('gpt-image') ||
        modelId.startsWith('dall-e') ||
        modelId.startsWith('gpt-')
    ) {
        return 'openai';
    }
    return 'unknown';
}

export const PROVIDER_NAMES: Record<ImageProvider, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    unknown: 'Unknown',
};

// Normalize the size field (which can be either "WxH" pixels or "W:H" ratio)
// into both a compact label like "16:9" and a CSS aspect-ratio string. We
// reduce by GCD so 1024x768 displays as 4:3 instead of 1024:768.
export function aspectInfo(size: string | undefined): {
    label: string | undefined;
    cssRatio: string | undefined;
    ratio: number | undefined;
} {
    if (!size) return { label: undefined, cssRatio: undefined, ratio: undefined };
    if (size.includes(':')) {
        const [w, h] = size.split(':').map((s) => parseInt(s, 10));
        if (!w || !h) return { label: size, cssRatio: undefined, ratio: undefined };
        return { label: `${w}:${h}`, cssRatio: `${w} / ${h}`, ratio: w / h };
    }
    const m = size.match(/^(\d+)x(\d+)$/i);
    if (!m) return { label: size, cssRatio: undefined, ratio: undefined };
    const w = parseInt(m[1], 10);
    const h = parseInt(m[2], 10);
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const g = gcd(w, h);
    return { label: `${w / g}:${h / g}`, cssRatio: `${w} / ${h}`, ratio: w / h };
}

export function qualityLabel(q: string | undefined): string | undefined {
    if (!q) return undefined;
    return q.charAt(0).toUpperCase() + q.slice(1);
}

function formatCreatedAt(iso: string | undefined): string | undefined {
    if (!iso) return undefined;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
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
        container.addEventListener('wheel', handler, { passive: false });
        return () => container.removeEventListener('wheel', handler);
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

    const cursor = dragging ? 'grabbing' : 'grab';

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
                    className={`max-h-full max-w-full object-contain ${dragging ? '' : 'transition-[transform] duration-75 ease-out'}`}
                    style={{
                        transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
                        transformOrigin: 'center center',
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
            <span className="text-xs text-neutral-400 dark:text-neutral-500">
                {label}
            </span>
            <span
                className={`text-xs text-neutral-800 dark:text-neutral-200 ${mono ? 'font-mono tabular-nums' : 'font-medium'}`}
            >
                {value}
            </span>
        </div>
    );
}

function MetadataPanel({
    image,
    defaultOpen,
}: {
    image: ImageData;
    defaultOpen: boolean;
}) {
    const meta: ImageMetadata = image.metadata ?? {};
    const aspect = aspectInfo(meta.size);
    const provider = imageProviderFor(meta.model);
    const [copied, setCopied] = useState(false);
    const [open, setOpen] = useState(defaultOpen);

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
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">
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
                                <span className="text-xs text-neutral-400 dark:text-neutral-500">
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
                                    {copied ? 'Copied' : 'Copy'}
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
                            provider !== 'unknown' ? PROVIDER_NAMES[provider] : undefined
                        }
                    />
                    <MetadataPill label="Model" value={meta.model} mono />
                    <MetadataPill label="Aspect" value={aspect.label} mono />
                    <MetadataPill label="Quality" value={qualityLabel(meta.quality)} />
                    <MetadataPill
                        label="Format"
                        value={image.mime_type?.replace('image/', '')}
                        mono
                    />
                    <MetadataPill label="Created" value={createdAt} />
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

// ─── Public composite ──────────────────────────────────────
//
// Renders the zoom/pan canvas above and the collapsible details panel below.
// Wraps in its own TooltipProvider so callers don't need to set one up; the
// component returns both children directly so it must be dropped into a flex
// column parent (which the tooltip provider does not introduce a wrapper for).

export function ImagePreview({
    image,
    projectId,
    defaultDetailsOpen = true,
}: {
    image: ImageData;
    projectId: string;
    // Whether the generation-details drawer starts expanded. The gallery
    // surfaces details prominently (true), the project's chat view defers
    // to the image itself and starts collapsed (false).
    defaultDetailsOpen?: boolean;
}) {
    return (
        <TooltipProvider>
            <ZoomableImage
                src={`/api/projects/${projectId}/images/${image.id}`}
                alt={image.name}
                resetKey={image.id}
            />
            <MetadataPanel image={image} defaultOpen={defaultDetailsOpen} />
        </TooltipProvider>
    );
}

// `ModelSelectorLogo` is re-exported so callers building image cards can show
// the same provider chip the preview uses without reaching into another file.
export { ModelSelectorLogo };

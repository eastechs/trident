// Copyright 2023 Vercel, Inc. SPDX-License-Identifier: Apache-2.0
// Adapted from AI Elements and modified for Trident. See CREDITS.md.
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { LanguageModelUsage } from "ai";
import type { ComponentProps } from "react";
import { createContext, useContext, useMemo } from "react";
import type { ModelPricing } from "@/types/api";

const PERCENT_MAX = 100;
const ICON_RADIUS = 10;
const ICON_VIEWBOX = 24;
const ICON_CENTER = 12;
const ICON_STROKE_WIDTH = 2;

const calcCost = (tokens: number, perMTokens: number) =>
  (tokens / 1_000_000) * perMTokens;

const formatUSD = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    currency: "USD",
    minimumFractionDigits: 3,
    style: "currency",
  }).format(amount);

interface ContextSchema {
  usedTokens: number;
  maxTokens: number;
  usage?: LanguageModelUsage;
  // Pricing is sourced from LiteLLM via /api/settings/models and passed in
  // by the caller. When undefined, cost lines render as token counts only.
  pricing?: ModelPricing;
}

const ContextContext = createContext<ContextSchema | null>(null);

const useContextValue = () => {
  const context = useContext(ContextContext);

  if (!context) {
    throw new Error("Context components must be used within Context");
  }

  return context;
};

const usePricing = () => {
  const { pricing } = useContextValue();
  return pricing;
};

export type ContextProps = ComponentProps<typeof HoverCard> & ContextSchema;

export const Context = ({
  usedTokens,
  maxTokens,
  usage,
  pricing,
  ...props
}: ContextProps) => {
  const contextValue = useMemo(
    () => ({ maxTokens, pricing, usage, usedTokens }),
    [maxTokens, pricing, usage, usedTokens],
  );

  return (
    <ContextContext.Provider value={contextValue}>
      <HoverCard closeDelay={0} openDelay={0} {...props} />
    </ContextContext.Provider>
  );
};

const ContextIcon = () => {
  const { usedTokens, maxTokens } = useContextValue();
  const circumference = 2 * Math.PI * ICON_RADIUS;
  const usedPercent = usedTokens / maxTokens;
  const dashOffset = circumference * (1 - usedPercent);

  return (
    <svg
      aria-label="Model context usage"
      height="20"
      role="img"
      style={{ color: "currentcolor" }}
      viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
      width="20"
    >
      <circle
        cx={ICON_CENTER}
        cy={ICON_CENTER}
        fill="none"
        opacity="0.25"
        r={ICON_RADIUS}
        stroke="currentColor"
        strokeWidth={ICON_STROKE_WIDTH}
      />
      <circle
        cx={ICON_CENTER}
        cy={ICON_CENTER}
        fill="none"
        opacity="0.7"
        r={ICON_RADIUS}
        stroke="currentColor"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        strokeWidth={ICON_STROKE_WIDTH}
        style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
      />
    </svg>
  );
};

export type ContextTriggerProps = ComponentProps<typeof Button>;

export const ContextTrigger = ({ children, ...props }: ContextTriggerProps) => {
  const { usedTokens, maxTokens } = useContextValue();
  const usedPercent = usedTokens / maxTokens;
  const renderedPercent = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    style: "percent",
  }).format(usedPercent);

  return (
    <HoverCardTrigger asChild>
      {children ?? (
        <Button type="button" variant="ghost" {...props}>
          <span className="text-muted-foreground font-medium">
            {renderedPercent}
          </span>
          <ContextIcon />
        </Button>
      )}
    </HoverCardTrigger>
  );
};

export type ContextContentProps = ComponentProps<typeof HoverCardContent>;

export const ContextContent = ({
  className,
  ...props
}: ContextContentProps) => (
  <HoverCardContent
    className={cn("min-w-60 divide-y overflow-hidden p-0", className)}
    {...props}
  />
);

export type ContextContentHeaderProps = ComponentProps<"div">;

export const ContextContentHeader = ({
  children,
  className,
  ...props
}: ContextContentHeaderProps) => {
  const { usedTokens, maxTokens } = useContextValue();
  const usedPercent = usedTokens / maxTokens;
  const displayPct = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    style: "percent",
  }).format(usedPercent);
  const used = new Intl.NumberFormat("en-US", {
    notation: "compact",
  }).format(usedTokens);
  const total = new Intl.NumberFormat("en-US", {
    notation: "compact",
  }).format(maxTokens);

  return (
    <div className={cn("w-full space-y-2 p-3", className)} {...props}>
      {children ?? (
        <>
          <div className="flex items-center justify-between gap-3 text-xs">
            <p>{displayPct}</p>
            <p className="text-muted-foreground font-mono">
              {used} / {total}
            </p>
          </div>
          <div className="space-y-2">
            <Progress className="bg-muted" value={usedPercent * PERCENT_MAX} />
          </div>
        </>
      )}
    </div>
  );
};

export type ContextContentBodyProps = ComponentProps<"div">;

export const ContextContentBody = ({
  children,
  className,
  ...props
}: ContextContentBodyProps) => (
  <div className={cn("w-full p-3", className)} {...props}>
    {children}
  </div>
);

export type ContextContentFooterProps = ComponentProps<"div">;

export const ContextContentFooter = ({
  children,
  className,
  ...props
}: ContextContentFooterProps) => {
  const { usage } = useContextValue();
  const pricing = usePricing();

  // The AI SDK's `inputTokens` is the GRAND TOTAL: noCache + cacheRead +
  // cacheWrite. Billing each at the same rate would massively overcount cache
  // tokens (cache reads are ~10x cheaper, cache writes ~1.25x more expensive).
  // Subtract the cached portions so each line item gets its own rate.
  const totalInput = usage?.inputTokens ?? 0;
  const cacheReadTokens = usage?.inputTokenDetails?.cacheReadTokens ?? 0;
  const cacheWriteTokens = usage?.inputTokenDetails?.cacheWriteTokens ?? 0;
  const noCacheInput = Math.max(
    0,
    totalInput - cacheReadTokens - cacheWriteTokens,
  );

  let totalCostUSD = 0;
  if (pricing) {
    totalCostUSD += calcCost(noCacheInput, pricing.inputPerMTokens);
    totalCostUSD += calcCost(
      usage?.outputTokens ?? 0,
      pricing.outputPerMTokens,
    );
    if (pricing.cacheReadPerMTokens) {
      totalCostUSD += calcCost(cacheReadTokens, pricing.cacheReadPerMTokens);
    }
    if (pricing.cacheWritePerMTokens) {
      totalCostUSD += calcCost(cacheWriteTokens, pricing.cacheWritePerMTokens);
    }
  }

  return (
    <div
      className={cn(
        "bg-secondary flex w-full items-center justify-between gap-3 p-3 text-xs",
        className,
      )}
      {...props}
    >
      {children ?? (
        <>
          <span className="text-muted-foreground">Total cost</span>
          <span>{formatUSD(totalCostUSD)}</span>
        </>
      )}
    </div>
  );
};

const TokensWithCost = ({
  tokens,
  costText,
}: {
  tokens?: number;
  costText?: string;
}) => (
  <span>
    {tokens === undefined
      ? "\u2014"
      : new Intl.NumberFormat("en-US", {
          notation: "compact",
        }).format(tokens)}
    {costText ? (
      <span className="text-muted-foreground ml-2">&bull; {costText}</span>
    ) : null}
  </span>
);

export type ContextInputUsageProps = ComponentProps<"div">;

export const ContextInputUsage = ({
  className,
  children,
  ...props
}: ContextInputUsageProps) => {
  const { usage } = useContextValue();
  const pricing = usePricing();
  // Show only the non-cached portion of input tokens here; cache reads and
  // writes have their own rows + line items in the footer total.
  const totalInput = usage?.inputTokens ?? 0;
  const cacheReadTokens = usage?.inputTokenDetails?.cacheReadTokens ?? 0;
  const cacheWriteTokens = usage?.inputTokenDetails?.cacheWriteTokens ?? 0;
  const noCacheInput = Math.max(
    0,
    totalInput - cacheReadTokens - cacheWriteTokens,
  );

  if (children) {
    return children;
  }

  if (!noCacheInput) {
    return null;
  }

  const costText = pricing
    ? formatUSD(calcCost(noCacheInput, pricing.inputPerMTokens))
    : undefined;

  return (
    <div
      className={cn("flex items-center justify-between text-xs", className)}
      {...props}
    >
      <span className="text-muted-foreground">Input</span>
      <TokensWithCost costText={costText} tokens={noCacheInput} />
    </div>
  );
};

export type ContextOutputUsageProps = ComponentProps<"div">;

export const ContextOutputUsage = ({
  className,
  children,
  ...props
}: ContextOutputUsageProps) => {
  const { usage } = useContextValue();
  const pricing = usePricing();
  const outputTokens = usage?.outputTokens ?? 0;

  if (children) {
    return children;
  }

  if (!outputTokens) {
    return null;
  }

  const costText = pricing
    ? formatUSD(calcCost(outputTokens, pricing.outputPerMTokens))
    : undefined;

  return (
    <div
      className={cn("flex items-center justify-between text-xs", className)}
      {...props}
    >
      <span className="text-muted-foreground">Output</span>
      <TokensWithCost costText={costText} tokens={outputTokens} />
    </div>
  );
};

export type ContextReasoningUsageProps = ComponentProps<"div">;

export const ContextReasoningUsage = ({
  className,
  children,
  ...props
}: ContextReasoningUsageProps) => {
  const { usage } = useContextValue();
  const pricing = usePricing();
  // The renderer's contextUsage shape exposes reasoning under
  // outputTokenDetails (matching the AI SDK's modern shape). The deprecated
  // top-level `reasoningTokens` is kept as a fallback for older snapshots.
  const reasoningTokens =
    usage?.outputTokenDetails?.reasoningTokens ?? usage?.reasoningTokens ?? 0;

  if (children) {
    return children;
  }

  if (!reasoningTokens) {
    return null;
  }

  // Reasoning tokens are typically priced the same as output tokens
  const costText = pricing
    ? formatUSD(calcCost(reasoningTokens, pricing.outputPerMTokens))
    : undefined;

  return (
    <div
      className={cn("flex items-center justify-between text-xs", className)}
      {...props}
    >
      <span className="text-muted-foreground">Reasoning</span>
      <TokensWithCost costText={costText} tokens={reasoningTokens} />
    </div>
  );
};

export type ContextCacheUsageProps = ComponentProps<"div">;

export const ContextCacheUsage = ({
  className,
  children,
  ...props
}: ContextCacheUsageProps) => {
  const { usage } = useContextValue();
  const pricing = usePricing();
  // Read from inputTokenDetails (AI SDK's modern shape). Fall back to the
  // deprecated top-level `cachedInputTokens` for older snapshots.
  const cacheTokens =
    usage?.inputTokenDetails?.cacheReadTokens ?? usage?.cachedInputTokens ?? 0;

  if (children) {
    return children;
  }

  if (!cacheTokens) {
    return null;
  }

  const costText = pricing?.cacheReadPerMTokens
    ? formatUSD(calcCost(cacheTokens, pricing.cacheReadPerMTokens))
    : undefined;

  return (
    <div
      className={cn("flex items-center justify-between text-xs", className)}
      {...props}
    >
      <span className="text-muted-foreground">Cache read</span>
      <TokensWithCost costText={costText} tokens={cacheTokens} />
    </div>
  );
};

export type ContextCacheWriteUsageProps = ComponentProps<"div">;

export const ContextCacheWriteUsage = ({
  className,
  children,
  ...props
}: ContextCacheWriteUsageProps) => {
  const { usage } = useContextValue();
  const pricing = usePricing();
  const cacheWriteTokens = usage?.inputTokenDetails?.cacheWriteTokens ?? 0;

  if (children) {
    return children;
  }

  if (!cacheWriteTokens) {
    return null;
  }

  const costText = pricing?.cacheWritePerMTokens
    ? formatUSD(calcCost(cacheWriteTokens, pricing.cacheWritePerMTokens))
    : undefined;

  return (
    <div
      className={cn("flex items-center justify-between text-xs", className)}
      {...props}
    >
      <span className="text-muted-foreground">Cache write</span>
      <TokensWithCost costText={costText} tokens={cacheWriteTokens} />
    </div>
  );
};

import { cn } from "@/lib/utils";
import { authedFetch } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";
import type { ImageData } from "@/types/api";

interface ImageModel {
  id: string;
  name: string;
  provider: "openai" | "gemini";
  dimensions: string[];
  qualityOptions: { value: string; label: string }[];
  qualityLabel: string;
}

const imageModels: ImageModel[] = [
  {
    id: "gpt-image-2",
    name: "GPT Image 2",
    provider: "openai",
    dimensions: ["1:1", "3:2", "2:3"],
    qualityOptions: [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
    ],
    qualityLabel: "Quality",
  },
  {
    id: "gpt-image-1.5",
    name: "GPT Image 1.5",
    provider: "openai",
    dimensions: ["1:1", "3:2", "2:3"],
    qualityOptions: [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
    ],
    qualityLabel: "Quality",
  },
  {
    id: "gpt-image-1",
    name: "GPT Image 1",
    provider: "openai",
    dimensions: ["1:1", "3:2", "2:3"],
    qualityOptions: [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
    ],
    qualityLabel: "Quality",
  },
  {
    id: "gpt-image-1-mini",
    name: "GPT Image 1 Mini",
    provider: "openai",
    dimensions: ["1:1", "3:2", "2:3"],
    qualityOptions: [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
    ],
    qualityLabel: "Quality",
  },
  {
    id: "gemini-3.1-flash-image-preview",
    name: "Nano Banana 2",
    provider: "gemini",
    dimensions: [
      "1:1",
      "2:3",
      "3:2",
      "3:4",
      "4:3",
      "4:5",
      "5:4",
      "9:16",
      "16:9",
      "1:4",
      "4:1",
      "1:8",
      "8:1",
      "21:9",
    ],
    qualityOptions: [
      { value: "1K", label: "1K" },
      { value: "2K", label: "2K" },
      { value: "4K", label: "4K" },
    ],
    qualityLabel: "Resolution",
  },
  {
    id: "gemini-3-pro-image-preview",
    name: "Nano Banana Pro",
    provider: "gemini",
    dimensions: [
      "1:1",
      "2:3",
      "3:2",
      "3:4",
      "4:3",
      "4:5",
      "5:4",
      "9:16",
      "16:9",
      "21:9",
    ],
    qualityOptions: [
      { value: "1K", label: "1K" },
      { value: "2K", label: "2K" },
      { value: "4K", label: "4K" },
    ],
    qualityLabel: "Resolution",
  },
];

export interface ImageGenerationResult {
  image_id: string;
  image_name: string;
  mime_type: string;
  prompt: string;
  // The settings the user picked on the card. Echoed back from the
  // endpoint so the chat can pass them to the agent via addToolOutput
  // — without these the model has no signal that the user already made
  // their selections, and tends to instruct them to do so post-hoc.
  model: string;
  size: string;
  quality: string;
  // Full image record so the parent can drop it into its local list
  // without a follow-up fetch.
  image: ImageData;
}

interface ImageConfigCardProps {
  projectId: string;
  prompt: string;
  name: string;
  onGenerated: (result: ImageGenerationResult) => void | Promise<void>;
  onGeneratingChange: (generating: boolean) => void;
  onCancel: () => void;
}

export function ImageConfigCard({
  projectId,
  prompt,
  name,
  onGenerated,
  onGeneratingChange,
  onCancel,
}: ImageConfigCardProps) {
  const [selectedModelId, setSelectedModelId] = useState<string>(
    imageModels[0].id,
  );
  const [selectedDimension, setSelectedDimension] = useState<string>("1:1");
  const [selectedQuality, setSelectedQuality] = useState<string>(
    imageModels[0].qualityOptions[0].value,
  );
  const [editableName, setEditableName] = useState<string>(name);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onGeneratingChange(generating);
    return () => {
      if (generating) onGeneratingChange(false);
    };
  }, [generating, onGeneratingChange]);

  const selectedModel =
    imageModels.find((m) => m.id === selectedModelId) ?? imageModels[0];

  const handleModelChange = useCallback(
    (modelId: string) => {
      setSelectedModelId(modelId);
      const model = imageModels.find((m) => m.id === modelId);
      if (model) {
        if (!model.dimensions.includes(selectedDimension)) {
          setSelectedDimension(model.dimensions[0]);
        }
        setSelectedQuality(model.qualityOptions[0].value);
      }
    },
    [selectedDimension],
  );

  const handleSubmit = useCallback(async () => {
    const trimmedName = editableName.trim() || name;
    setGenerating(true);
    setError(null);

    try {
      const response = await authedFetch(
        `/api/projects/${projectId}/images/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            name: trimmedName,
            model: selectedModelId,
            size: selectedDimension,
            quality: selectedQuality,
          }),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message =
          body && typeof body.error === "string"
            ? body.error
            : `Generation failed (${response.status})`;
        setError(message);
        setGenerating(false);
        return;
      }

      const result = (await response.json()) as ImageGenerationResult;
      await onGenerated(result);
      setGenerating(false);
    } catch (err) {
      const message = (err as Error).message || "Network error";
      setError(message);
      setGenerating(false);
    }
  }, [
    editableName,
    name,
    prompt,
    projectId,
    selectedModelId,
    selectedDimension,
    selectedQuality,
    onGenerated,
  ]);

  return (
    <div className="not-prose border-border bg-card w-full rounded-xl border p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Image Generation
        </span>
      </div>

      {/* Prompt (read-only) */}
      <div className="mb-4">
        <label className="text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase">
          Prompt
        </label>
        <p className="border-border bg-muted/40 text-foreground rounded-lg border p-3 text-sm">
          {prompt}
        </p>
      </div>

      {/* Name (editable) */}
      <div className="mb-4">
        <label className="text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase">
          Name
        </label>
        <input
          type="text"
          value={editableName}
          onChange={(e) => setEditableName(e.target.value)}
          disabled={generating}
          className="border-border bg-background text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none disabled:opacity-60"
        />
      </div>

      {/* Model Selector */}
      <div className="mb-4">
        <label className="text-foreground mb-2 block text-sm font-medium">
          Model
        </label>
        <div className="flex flex-col gap-2">
          {imageModels.map((model) => {
            const isSelected = model.id === selectedModelId;
            return (
              <button
                key={model.id}
                type="button"
                onClick={() => handleModelChange(model.id)}
                disabled={generating}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors disabled:opacity-60",
                  isSelected
                    ? "border-green-500 bg-green-500/5 dark:border-green-400 dark:bg-green-400/5"
                    : "border-border hover:border-muted-foreground/30 hover:bg-accent/50",
                )}
              >
                <div
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    isSelected
                      ? "border-green-500 bg-green-500 dark:border-green-400 dark:bg-green-400"
                      : "border-muted-foreground/40",
                  )}
                >
                  {isSelected && (
                    <div className="size-1.5 rounded-full bg-white" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "text-sm font-semibold",
                      isSelected
                        ? "text-green-700 dark:text-green-300"
                        : "text-foreground",
                    )}
                  >
                    {model.name}
                  </div>
                  <div
                    className={cn(
                      "text-xs",
                      isSelected
                        ? "text-green-600 dark:text-green-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {model.provider === "openai" ? "OpenAI" : "Google Gemini"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dimensions */}
      <div className="mb-4">
        <label className="text-foreground mb-2 block text-sm font-medium">
          Dimensions
        </label>
        <div className="flex flex-wrap gap-2">
          {selectedModel.dimensions.map((dim) => (
            <button
              key={dim}
              type="button"
              onClick={() => setSelectedDimension(dim)}
              disabled={generating}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
                dim === selectedDimension
                  ? "border-green-500 bg-green-500/10 text-green-700 dark:border-green-400 dark:bg-green-400/10 dark:text-green-300"
                  : "border-border text-muted-foreground hover:border-muted-foreground/30 hover:bg-accent/50",
              )}
            >
              {dim}
            </button>
          ))}
        </div>
      </div>

      {/* Quality / Resolution */}
      <div className="mb-5">
        <label className="text-foreground mb-2 block text-sm font-medium">
          {selectedModel.qualityLabel}
        </label>
        <div className="flex flex-wrap gap-2">
          {selectedModel.qualityOptions.map((opt) => {
            const isSelected = selectedQuality === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelectedQuality(opt.value)}
                disabled={generating}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
                  isSelected
                    ? "border-green-500 bg-green-500/10 text-green-700 dark:border-green-400 dark:bg-green-400/10 dark:text-green-300"
                    : "border-border text-muted-foreground hover:border-muted-foreground/30 hover:bg-accent/50",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive mb-4 rounded-lg border p-3 text-sm">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={generating}
          className="text-muted-foreground hover:bg-accent rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={generating}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {generating ? "Generating…" : "Generate"}
        </button>
      </div>
    </div>
  );
}

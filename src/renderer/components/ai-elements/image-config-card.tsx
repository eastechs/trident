import { cn } from '@/lib/utils';
import { useCallback, useState } from 'react';

interface ImageModel {
    id: string;
    name: string;
    provider: 'openai' | 'gemini';
    dimensions: string[];
    qualityOptions: { value: string; label: string }[];
    qualityLabel: string;
}

const imageModels: ImageModel[] = [
    {
        id: 'gpt-image-1.5',
        name: 'GPT Image 1.5',
        provider: 'openai',
        dimensions: ['1:1', '3:2', '2:3'],
        qualityOptions: [
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
        ],
        qualityLabel: 'Quality',
    },
    {
        id: 'gpt-image-1',
        name: 'GPT Image 1',
        provider: 'openai',
        dimensions: ['1:1', '3:2', '2:3'],
        qualityOptions: [
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
        ],
        qualityLabel: 'Quality',
    },
    {
        id: 'gpt-image-1-mini',
        name: 'GPT Image 1 Mini',
        provider: 'openai',
        dimensions: ['1:1', '3:2', '2:3'],
        qualityOptions: [
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
        ],
        qualityLabel: 'Quality',
    },
    {
        id: 'gemini-3.1-flash-image-preview',
        name: 'Nano Banana 2',
        provider: 'gemini',
        dimensions: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '1:4', '4:1', '1:8', '8:1', '21:9'],
        qualityOptions: [
            { value: '1K', label: '1K' },
            { value: '2K', label: '2K' },
            { value: '4K', label: '4K' },
        ],
        qualityLabel: 'Resolution',
    },
    {
        id: 'gemini-3-pro-image-preview',
        name: 'Nano Banana Pro',
        provider: 'gemini',
        dimensions: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
        qualityOptions: [
            { value: '1K', label: '1K' },
            { value: '2K', label: '2K' },
            { value: '4K', label: '4K' },
        ],
        qualityLabel: 'Resolution',
    },
];

interface ImageConfigCardProps {
    onSubmit: (answers: Array<{ question: string; answer: string }>) => void;
    submitted?: boolean;
}

export function ImageConfigCard({ onSubmit, submitted }: ImageConfigCardProps) {
    const [selectedModelId, setSelectedModelId] = useState<string>(imageModels[0].id);
    const [selectedDimension, setSelectedDimension] = useState<string>('1:1');
    const [selectedQuality, setSelectedQuality] = useState<string>(imageModels[0].qualityOptions[0].value);

    const selectedModel = imageModels.find((m) => m.id === selectedModelId) ?? imageModels[0];

    const handleModelChange = useCallback((modelId: string) => {
        setSelectedModelId(modelId);
        const model = imageModels.find((m) => m.id === modelId);
        if (model) {
            if (!model.dimensions.includes(selectedDimension)) {
                setSelectedDimension(model.dimensions[0]);
            }
            setSelectedQuality(model.qualityOptions[0].value);
        }
    }, [selectedDimension]);

    const handleSubmit = useCallback(() => {
        onSubmit([
            { question: 'Image Model', answer: selectedModelId },
            { question: 'Dimensions', answer: selectedDimension },
            { question: selectedModel.qualityLabel, answer: selectedQuality },
        ]);
    }, [onSubmit, selectedModelId, selectedDimension, selectedQuality, selectedModel]);

    if (submitted) {
        return null;
    }

    return (
        <div className="not-prose w-full rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Image Generation
                </span>
            </div>

            {/* Model Selector */}
            <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-foreground">Model</label>
                <div className="flex flex-col gap-2">
                    {imageModels.map((model) => {
                        const isSelected = model.id === selectedModelId;
                        return (
                            <button
                                key={model.id}
                                type="button"
                                onClick={() => handleModelChange(model.id)}
                                className={cn(
                                    'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                                    isSelected
                                        ? 'border-green-500 bg-green-500/5 dark:border-green-400 dark:bg-green-400/5'
                                        : 'border-border hover:border-muted-foreground/30 hover:bg-accent/50',
                                )}
                            >
                                <div className={cn(
                                    'flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                                    isSelected
                                        ? 'border-green-500 bg-green-500 dark:border-green-400 dark:bg-green-400'
                                        : 'border-muted-foreground/40',
                                )}>
                                    {isSelected && <div className="size-1.5 rounded-full bg-white" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className={cn(
                                        'text-sm font-semibold',
                                        isSelected ? 'text-green-700 dark:text-green-300' : 'text-foreground',
                                    )}>
                                        {model.name}
                                    </div>
                                    <div className={cn(
                                        'text-xs',
                                        isSelected ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground',
                                    )}>
                                        {model.provider === 'openai' ? 'OpenAI' : 'Google Gemini'}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Dimensions */}
            <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-foreground">Dimensions</label>
                <div className="flex flex-wrap gap-2">
                    {selectedModel.dimensions.map((dim) => (
                        <button
                            key={dim}
                            type="button"
                            onClick={() => setSelectedDimension(dim)}
                            className={cn(
                                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                                dim === selectedDimension
                                    ? 'border-green-500 bg-green-500/10 text-green-700 dark:border-green-400 dark:bg-green-400/10 dark:text-green-300'
                                    : 'border-border text-muted-foreground hover:border-muted-foreground/30 hover:bg-accent/50',
                            )}
                        >
                            {dim}
                        </button>
                    ))}
                </div>
            </div>

            {/* Quality / Resolution */}
            <div className="mb-5">
                <label className="mb-2 block text-sm font-medium text-foreground">{selectedModel.qualityLabel}</label>
                <div className="flex flex-wrap gap-2">
                    {selectedModel.qualityOptions.map((opt) => {
                        const isSelected = selectedQuality === opt.value;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setSelectedQuality(opt.value)}
                                className={cn(
                                    'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                                    isSelected
                                        ? 'border-green-500 bg-green-500/10 text-green-700 dark:border-green-400 dark:bg-green-400/10 dark:text-green-300'
                                        : 'border-border text-muted-foreground hover:border-muted-foreground/30 hover:bg-accent/50',
                                )}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={handleSubmit}
                    className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                    Generate
                </button>
            </div>
        </div>
    );
}

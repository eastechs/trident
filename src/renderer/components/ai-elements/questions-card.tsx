import { cn } from '@/lib/utils';
import { useCallback, useState } from 'react';

interface Question {
    question: string;
    options: Array<{ label: string; description: string }>;
}

interface Answer {
    type: 'option' | 'custom';
    value: string;
}

interface QuestionsCardProps {
    questions: Question[];
    onSubmit: (answers: Array<{ question: string; answer: string }>) => void;
    submitted?: boolean;
}

export function QuestionsCard({ questions, onSubmit, submitted }: QuestionsCardProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Map<number, Answer>>(new Map());
    const [customTexts, setCustomTexts] = useState<Map<number, string>>(new Map());

    const currentQuestion = questions[currentIndex];
    const currentAnswer = answers.get(currentIndex);
    const isLastQuestion = currentIndex === questions.length - 1;
    const canProceed = currentAnswer !== undefined &&
        (currentAnswer.type === 'option' || (currentAnswer.type === 'custom' && currentAnswer.value.trim().length > 0));

    const selectOption = useCallback((label: string) => {
        setAnswers(prev => {
            const next = new Map(prev);
            next.set(currentIndex, { type: 'option', value: label });
            return next;
        });
    }, [currentIndex]);

    const selectCustom = useCallback(() => {
        const text = customTexts.get(currentIndex) ?? '';
        setAnswers(prev => {
            const next = new Map(prev);
            next.set(currentIndex, { type: 'custom', value: text });
            return next;
        });
    }, [currentIndex, customTexts]);

    const updateCustomText = useCallback((text: string) => {
        setCustomTexts(prev => {
            const next = new Map(prev);
            next.set(currentIndex, text);
            return next;
        });
        setAnswers(prev => {
            const next = new Map(prev);
            next.set(currentIndex, { type: 'custom', value: text });
            return next;
        });
    }, [currentIndex]);

    const handleNext = useCallback(() => {
        if (isLastQuestion) {
            const formatted = questions.map((q, i) => {
                const ans = answers.get(i);
                return {
                    question: q.question,
                    answer: ans
                        ? (ans.type === 'custom' ? `Something else: ${ans.value}` : ans.value)
                        : '(skipped)',
                };
            });
            onSubmit(formatted);
        } else {
            setCurrentIndex(prev => prev + 1);
        }
    }, [isLastQuestion, questions, answers, onSubmit]);

    const handleBack = useCallback(() => {
        setCurrentIndex(prev => Math.max(0, prev - 1));
    }, []);

    if (submitted) {
        return null;
    }

    if (!currentQuestion) {
        return null;
    }

    const isCustomSelected = currentAnswer?.type === 'custom';

    return (
        <div className="not-prose w-full rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Question
                </span>
                {questions.length > 1 && (
                    <span className="text-xs text-muted-foreground">
                        {currentIndex + 1} of {questions.length}
                    </span>
                )}
            </div>

            <h3 className="mb-5 font-semibold leading-snug text-foreground">
                {currentQuestion.question}
            </h3>

            <div className="flex flex-col gap-3">
                {currentQuestion.options.map((option) => {
                    const isSelected = currentAnswer?.type === 'option' && currentAnswer.value === option.label;

                    return (
                        <button
                            key={option.label}
                            type="button"
                            onClick={() => selectOption(option.label)}
                            className={cn(
                                'flex items-start gap-3 rounded-lg border p-4 text-left transition-colors',
                                isSelected
                                    ? 'border-green-500 bg-green-500/5 dark:border-green-400 dark:bg-green-400/5'
                                    : 'border-border hover:border-muted-foreground/30 hover:bg-accent/50',
                            )}
                        >
                            <div className={cn(
                                'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                                isSelected
                                    ? 'border-green-500 bg-green-500 dark:border-green-400 dark:bg-green-400'
                                    : 'border-muted-foreground/40',
                            )}>
                                {isSelected && (
                                    <div className="size-1.5 rounded-full bg-white" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className={cn(
                                    'text-xs font-semibold',
                                    isSelected
                                        ? 'text-green-700 dark:text-green-300'
                                        : 'text-foreground',
                                )}>
                                    {option.label}
                                </div>
                                <div className={cn(
                                    'mt-0.5 text-xs leading-relaxed',
                                    isSelected
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-muted-foreground',
                                )}>
                                    {option.description}
                                </div>
                            </div>
                        </button>
                    );
                })}

                {/* Something else option */}
                <button
                    type="button"
                    onClick={selectCustom}
                    className={cn(
                        'flex items-start gap-3 rounded-lg border p-4 text-left transition-colors',
                        isCustomSelected
                            ? 'border-green-500 bg-green-500/5 dark:border-green-400 dark:bg-green-400/5'
                            : 'border-border hover:border-muted-foreground/30 hover:bg-accent/50',
                    )}
                >
                    <div className={cn(
                        'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                        isCustomSelected
                            ? 'border-green-500 bg-green-500 dark:border-green-400 dark:bg-green-400'
                            : 'border-muted-foreground/40',
                    )}>
                        {isCustomSelected && (
                            <div className="size-1.5 rounded-full bg-white" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className={cn(
                            'text-xs font-semibold',
                            isCustomSelected
                                ? 'text-green-700 dark:text-green-300'
                                : 'text-foreground',
                        )}>
                            Something else
                        </div>
                        {isCustomSelected && (
                            <textarea
                                value={customTexts.get(currentIndex) ?? ''}
                                onChange={(e) => updateCustomText(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Explain your answer..."
                                rows={2}
                                className="mt-2 w-full resize-none rounded-md border border-border bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
                            />
                        )}
                    </div>
                </button>
            </div>

            {/* Navigation */}
            <div className="mt-5 flex items-center justify-between">
                {currentIndex > 0 ? (
                    <button
                        type="button"
                        onClick={handleBack}
                        className="rounded-lg border border-border px-5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                    >
                        Back
                    </button>
                ) : (
                    <div />
                )}
                <button
                    type="button"
                    onClick={handleNext}
                    disabled={!canProceed}
                    className={cn(
                        'rounded-lg px-5 py-2 text-xs font-semibold transition-colors',
                        canProceed
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                            : 'cursor-not-allowed bg-muted text-muted-foreground',
                    )}
                >
                    {isLastQuestion ? 'Submit' : 'Next'}
                </button>
            </div>
        </div>
    );
}

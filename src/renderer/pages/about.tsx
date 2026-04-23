import { useSearchParams } from 'react-router-dom';
import type { CSSProperties } from 'react';

import { useDocumentTitle } from '@/hooks/use-document-title';
import { ModelSelectorLogo } from '@/components/ai-elements/model-selector';
import appIcon from '../../images/app-icon.png';

const dragStyle = { WebkitAppRegion: 'drag' } as unknown as CSSProperties;

export default function About() {
    useDocumentTitle('About Trident');
    const [searchParams] = useSearchParams();
    const version = searchParams.get('version') ?? '0.0.0';
    const year = new Date().getFullYear();

    return (
        <div
            className="relative flex h-screen flex-col overflow-hidden bg-white dark:bg-neutral-950"
            style={dragStyle}
        >
            <div className="pointer-events-none absolute left-1/2 top-16 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl dark:bg-primary/20" />

            <div className="relative z-10 flex flex-1 flex-col items-center px-10 pt-20 pb-9 animate-in fade-in duration-500">
                <div className="relative mb-7 animate-in fade-in zoom-in-95 duration-700">
                    <div className="absolute -inset-5 rounded-[30%] bg-primary/25 blur-2xl dark:bg-primary/40" />
                    <img
                        src={appIcon}
                        alt="Trident"
                        className="relative size-20 rounded-[22%] shadow-[0_12px_32px_-8px_rgb(0_0_0_/_0.2),_0_4px_10px_-4px_rgb(0_0_0_/_0.12)] dark:shadow-[0_12px_32px_-8px_rgb(0_0_0_/_0.65),_0_4px_10px_-4px_rgb(0_0_0_/_0.5)]"
                    />
                </div>

                <h1
                    className="text-[34px] font-semibold leading-none text-foreground"
                    style={{ letterSpacing: '-0.025em' }}
                >
                    Trident
                </h1>

                <p
                    className="mt-3.5 text-[10px] font-medium uppercase text-muted-foreground"
                    style={{ letterSpacing: '0.26em' }}
                >
                    Multi&#8209;model&nbsp;&nbsp;workspace
                </p>

                <div className="mt-7 h-px w-10 bg-primary/50" />

                <div className="mt-6 font-mono text-[12px] tabular-nums text-foreground/75">
                    Version {version}
                </div>

                <div className="mt-auto flex flex-col items-center gap-4">
                    <div className="flex items-center gap-6 text-neutral-500 dark:text-neutral-400">
                        <ModelSelectorLogo provider="anthropic" className="size-[18px]" />
                        <ModelSelectorLogo provider="openai" className="size-[18px]" />
                        <ModelSelectorLogo provider="gemini" className="size-[18px]" />
                    </div>
                    <p className="text-[10.5px] text-muted-foreground/75">
                        © {year} Eastechs
                    </p>
                </div>
            </div>
        </div>
    );
}

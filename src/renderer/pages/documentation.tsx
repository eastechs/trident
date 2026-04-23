import { useDocumentTitle } from '@/hooks/use-document-title';
import { useEffect, useRef, useState } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import appIcon from '../../images/app-icon.png';
import { SECTIONS } from './documentation/sections';

export default function Documentation() {
    useDocumentTitle('Documentation');
    const [activeSlug, setActiveSlug] = useState(SECTIONS[0].slug);
    const scrollRef = useRef<HTMLDivElement>(null);
    const activeSection = SECTIONS.find((s) => s.slug === activeSlug) ?? SECTIONS[0];
    const ActiveComponent = activeSection.component;

    useEffect(() => {
        const viewport = scrollRef.current?.querySelector('[data-slot="scroll-area-viewport"]');
        viewport?.scrollTo(0, 0);
    }, [activeSlug]);

    return (
        <div className="flex h-screen flex-col">
            <header className="title-bar justify-center">
                <div className="text-black dark:text-white">Documentation</div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <nav className="flex w-52 shrink-0 flex-col border-r border-border bg-neutral-50 py-4 dark:bg-neutral-950">
                    <div className="flex items-center gap-2 px-4 pb-4">
                        <img src={appIcon} alt="Trident" className="size-6 rounded-md" />
                        <span className="text-sm font-semibold text-foreground">Trident</span>
                    </div>
                    <div className="px-4 pb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Documentation
                    </div>
                    {SECTIONS.map((s) => (
                        <button
                            key={s.slug}
                            onClick={() => setActiveSlug(s.slug)}
                            className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                                s.slug === activeSlug
                                    ? 'border-l-2 border-primary bg-white font-medium text-foreground dark:bg-neutral-900'
                                    : 'border-l-2 border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <s.icon className="size-4" />
                            {s.title}
                        </button>
                    ))}
                </nav>

                <ScrollArea ref={scrollRef} className="flex-1">
                    <article className="prose prose-neutral dark:prose-invert mx-auto max-w-3xl px-8 py-6">
                        <ActiveComponent />
                    </article>
                </ScrollArea>
            </div>
        </div>
    );
}

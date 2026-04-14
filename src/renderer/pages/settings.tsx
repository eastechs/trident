import { Link } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { api_get, api_post, api_put, api_patch, api_delete } from '@/lib/api';
import {
    BellIcon,
    BotIcon,
    CheckIcon,
    EyeIcon,
    EyeOffIcon,
    FolderIcon,
    KeyRoundIcon,
    Settings2Icon,
    Trash2Icon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ModelSelectorLogo } from '@/components/ai-elements/model-selector';
import type { EditorHandle } from '@/components/editor';
import { MilkdownEditorWrapper } from '@/components/editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import appIcon from '../../images/app-icon.png';

export default function Settings() {
    useDocumentTitle('Settings');
    const [anthropicKey, setAnthropicKey] = useState('');
    const [openaiKey, setOpenaiKey] = useState('');
    const [geminiKey, setGeminiKey] = useState('');
    const [showAnthropic, setShowAnthropic] = useState(false);
    const [showOpenai, setShowOpenai] = useState(false);
    const [showGemini, setShowGemini] = useState(false);
    const [hasAnthropic, setHasAnthropic] = useState(false);
    const [hasOpenai, setHasOpenai] = useState(false);
    const [hasGemini, setHasGemini] = useState(false);
    const [keyErrors, setKeyErrors] = useState<{
        anthropic: string | null;
        openai: string | null;
        gemini: string | null;
    }>({ anthropic: null, openai: null, gemini: null });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [trashEnabled, setTrashEnabled] = useState(true);

    // Side menu state
    const [activeSection, setActiveSection] = useState<'preferences' | 'providers' | 'agents'>('preferences');

    // Agent instructions state
    const [selectedAgent, setSelectedAgent] = useState<'collaborator'>('collaborator');
    const [agentInstructions, setAgentInstructions] = useState('');
    const [agentIsCustom, setAgentIsCustom] = useState(false);
    const [agentLoading, setAgentLoading] = useState(false);
    const [agentSaving, setAgentSaving] = useState(false);
    const [agentSaved, setAgentSaved] = useState(false);
    const [agentDirty, setAgentDirty] = useState(false);
    const [editorKey, setEditorKey] = useState(0);
    const editorRef = useRef<EditorHandle>(null);
    const lastSavedInstructions = useRef('');

    useEffect(() => {
        api_get('/api/settings/notifications')
            .then((data) => setNotificationsEnabled(data.enabled))
            .catch(() => {});
    }, []);

    useEffect(() => {
        api_get('/api/settings/trash')
            .then((data) => setTrashEnabled(data.enabled))
            .catch(() => {});
    }, []);

    useEffect(() => {
        api_get('/api/settings/api-keys')
            .then((data) => {
                setHasAnthropic(data.anthropic);
                setHasOpenai(data.openai);
                setHasGemini(data.gemini);
            })
            .catch(() => {});
    }, []);

    const handleSaveKeys = async () => {
        if (!anthropicKey.trim() && !openaiKey.trim() && !geminiKey.trim()) {
            return;
        }

        setSaving(true);
        setSaved(false);
        setKeyErrors({ anthropic: null, openai: null, gemini: null });

        try {
            const { data } = await axios.put<{
                success: boolean;
                saved: Array<'anthropic' | 'openai' | 'gemini'>;
                invalid: Array<'anthropic' | 'openai' | 'gemini'>;
            }>('/api/settings/api-keys', {
                anthropic_key: anthropicKey.trim() || null,
                openai_key: openaiKey.trim() || null,
                gemini_key: geminiKey.trim() || null,
            });

            if (data.saved.includes('anthropic')) {
                setHasAnthropic(true);
                setAnthropicKey('');
            }

            if (data.saved.includes('openai')) {
                setHasOpenai(true);
                setOpenaiKey('');
            }

            if (data.saved.includes('gemini')) {
                setHasGemini(true);
                setGeminiKey('');
            }

            if (data.invalid.length > 0) {
                setKeyErrors({
                    anthropic: data.invalid.includes('anthropic')
                        ? 'Invalid API key. Please check the key and try again.'
                        : null,
                    openai: data.invalid.includes('openai')
                        ? 'Invalid API key. Please check the key and try again.'
                        : null,
                    gemini: data.invalid.includes('gemini')
                        ? 'Invalid API key. Please check the key and try again.'
                        : null,
                });
            }

            if (data.saved.length > 0) {
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            }
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 422) {
                const responseErrors = (error.response.data as {
                    errors?: Record<string, string[]>;
                }).errors ?? {};
                setKeyErrors({
                    anthropic: responseErrors.anthropic_key?.[0] ?? null,
                    openai: responseErrors.openai_key?.[0] ?? null,
                    gemini: responseErrors.gemini_key?.[0] ?? null,
                });
            }
        } finally {
            setSaving(false);
        }
    };

    const handleClearKey = async (provider: 'anthropic' | 'openai' | 'gemini') => {
        try {
            await api_delete('/api/settings/api-keys', { data: { provider } });

            if (provider === 'anthropic') {
                setHasAnthropic(false);
                setAnthropicKey('');
            } else if (provider === 'openai') {
                setHasOpenai(false);
                setOpenaiKey('');
            } else {
                setHasGemini(false);
                setGeminiKey('');
            }
        } catch {
            // Handle error silently
        }
    };

    // Agent instructions handlers
    const fetchAgentInstructions = useCallback((agentKey: string) => {
        setAgentLoading(true);
        setAgentDirty(false);
        setAgentSaved(false);
        api_get(`/api/settings/agent-instructions/${agentKey}`)
            .then((data) => {
                setAgentInstructions(data.instructions);
                setAgentIsCustom(data.isCustom);
                lastSavedInstructions.current = data.instructions;
                setEditorKey(prev => prev + 1);
            })
            .catch(() => {})
            .finally(() => setAgentLoading(false));
    }, []);

    useEffect(() => {
        fetchAgentInstructions(selectedAgent);
    }, [selectedAgent, fetchAgentInstructions]);

    const handleSaveInstructions = async () => {
        const content = editorRef.current?.getMarkdown() ?? '';
        setAgentSaving(true);
        setAgentSaved(false);

        try {
            await api_put(`/api/settings/agent-instructions/${selectedAgent}`, {
                instructions: content,
            });
            lastSavedInstructions.current = content;
            setAgentIsCustom(true);
            setAgentDirty(false);
            setAgentSaved(true);
            setTimeout(() => setAgentSaved(false), 3000);
        } catch {
            // Handle error silently
        } finally {
            setAgentSaving(false);
        }
    };

    const handleResetInstructions = async () => {
        try {
            await api_delete(`/api/settings/agent-instructions/${selectedAgent}`);
            fetchAgentInstructions(selectedAgent);
        } catch {
            // Handle error silently
        }
    };

    const handleEditorChange = useCallback((markdown: string) => {
        const isDirty = markdown !== lastSavedInstructions.current;
        setAgentDirty(prev => prev === isDirty ? prev : isDirty);
    }, []);

    const handleEditorReady = useCallback((markdown: string) => {
        lastSavedInstructions.current = markdown;
    }, []);

    return (
        <div className="flex h-screen flex-col">
            <header className="title-bar justify-center">
                <div className="text-black dark:text-white">Trident</div>
            </header>

            <div className="flex h-[calc(100vh-2rem)] w-full overflow-hidden">
                <TooltipProvider>
                    <aside className="flex w-12 flex-col items-center border-r border-neutral-100 bg-white py-2 dark:border-neutral-800 dark:bg-neutral-900">
                        <Link to="/">
                            <img
                                src={appIcon}
                                alt="Trident"
                                className="size-8 rounded-lg"
                            />
                        </Link>
                        <nav className="mt-4 flex flex-col items-center gap-1">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Link to="/">
                                        <Button variant="ghost" size="icon-sm">
                                            <FolderIcon className="size-4" />
                                            <span className="sr-only">
                                                Projects
                                            </span>
                                        </Button>
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    Projects
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon-sm">
                                        <Settings2Icon className="size-4" />
                                        <span className="sr-only">
                                            Settings
                                        </span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    Settings
                                </TooltipContent>
                            </Tooltip>
                        </nav>
                    </aside>
                </TooltipProvider>

                <div className="flex min-h-0 flex-1">
                    {/* Settings side menu */}
                    <nav className="flex w-44 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 py-4 dark:border-neutral-800 dark:bg-neutral-900/50">
                        <div className="px-4 pb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Settings
                        </div>
                        <button
                            onClick={() => setActiveSection('preferences')}
                            className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                                activeSection === 'preferences'
                                    ? 'border-l-2 border-primary bg-white font-medium text-foreground dark:bg-neutral-800'
                                    : 'border-l-2 border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <BellIcon className="size-4" />
                            Preferences
                        </button>
                        <button
                            onClick={() => setActiveSection('providers')}
                            className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                                activeSection === 'providers'
                                    ? 'border-l-2 border-primary bg-white font-medium text-foreground dark:bg-neutral-800'
                                    : 'border-l-2 border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <KeyRoundIcon className="size-4" />
                            Providers
                        </button>
                        <button
                            onClick={() => setActiveSection('agents')}
                            className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                                activeSection === 'agents'
                                    ? 'border-l-2 border-primary bg-white font-medium text-foreground dark:bg-neutral-800'
                                    : 'border-l-2 border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <BotIcon className="size-4" />
                            Agents
                        </button>
                    </nav>

                    {/* Content area */}
                    <main className={`min-h-0 flex-1 p-4 sm:p-6 lg:p-8 ${activeSection === 'agents' ? 'flex flex-col overflow-hidden' : 'overflow-auto'}`}>
                        {/* Preferences: Notifications + File Deletion */}
                        {activeSection === 'preferences' && (
                            <div className="space-y-12">
                                <div className="grid grid-cols-1 gap-x-8 gap-y-10 border-b border-neutral-200 pb-12 md:grid-cols-3 dark:border-neutral-800">
                                    <div>
                                        <h2 className="text-base/7 font-semibold text-foreground">Notifications</h2>
                                        <p className="mt-1 text-sm/6 text-muted-foreground">
                                            Configure how you receive notifications from Trident.
                                        </p>
                                    </div>

                                    <div className="max-w-2xl space-y-10 md:col-span-2">
                                        <fieldset>
                                            <legend className="text-sm/6 font-semibold text-foreground">Desktop notifications</legend>
                                            <div className="mt-6 space-y-6">
                                                <div className="flex items-center gap-x-3">
                                                    <input
                                                        checked={notificationsEnabled}
                                                        onChange={() => {
                                                            setNotificationsEnabled(true);
                                                            api_put('/api/settings/notifications', { enabled: true }).catch(() => {});
                                                        }}
                                                        id="notify-all"
                                                        name="notifications"
                                                        type="radio"
                                                        className="relative size-4 appearance-none rounded-full border border-neutral-300 bg-white before:absolute before:inset-1 before:rounded-full before:bg-white not-checked:before:hidden checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:border-neutral-600 dark:bg-neutral-800 dark:checked:border-primary dark:checked:bg-primary forced-colors:appearance-auto forced-colors:before:hidden"
                                                    />
                                                    <label htmlFor="notify-all" className="block text-sm/6 font-medium text-foreground">
                                                        All responses
                                                    </label>
                                                </div>
                                                <div className="flex items-center gap-x-3">
                                                    <input
                                                        checked={!notificationsEnabled}
                                                        onChange={() => {
                                                            setNotificationsEnabled(false);
                                                            api_put('/api/settings/notifications', { enabled: false }).catch(() => {});
                                                        }}
                                                        id="notify-none"
                                                        name="notifications"
                                                        type="radio"
                                                        className="relative size-4 appearance-none rounded-full border border-neutral-300 bg-white before:absolute before:inset-1 before:rounded-full before:bg-white not-checked:before:hidden checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:border-neutral-600 dark:bg-neutral-800 dark:checked:border-primary dark:checked:bg-primary forced-colors:appearance-auto forced-colors:before:hidden"
                                                    />
                                                    <label htmlFor="notify-none" className="block text-sm/6 font-medium text-foreground">
                                                        No notifications
                                                    </label>
                                                </div>
                                            </div>
                                        </fieldset>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-x-8 gap-y-10 pb-12 md:grid-cols-3">
                                    <div>
                                        <h2 className="text-base/7 font-semibold text-foreground">File Deletion</h2>
                                        <p className="mt-1 text-sm/6 text-muted-foreground">
                                            Choose whether deleted files are moved to the system trash or permanently removed.
                                        </p>
                                    </div>

                                    <div className="max-w-2xl space-y-10 md:col-span-2">
                                        <fieldset>
                                            <legend className="text-sm/6 font-semibold text-foreground">When deleting files</legend>
                                            <div className="mt-6 space-y-6">
                                                <div className="flex items-center gap-x-3">
                                                    <input
                                                        checked={trashEnabled}
                                                        onChange={() => {
                                                            setTrashEnabled(true);
                                                            api_put('/api/settings/trash', { enabled: true }).catch(() => {});
                                                        }}
                                                        id="trash-enabled"
                                                        name="trash"
                                                        type="radio"
                                                        className="relative size-4 appearance-none rounded-full border border-neutral-300 bg-white before:absolute before:inset-1 before:rounded-full before:bg-white not-checked:before:hidden checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:border-neutral-600 dark:bg-neutral-800 dark:checked:border-primary dark:checked:bg-primary forced-colors:appearance-auto forced-colors:before:hidden"
                                                    />
                                                    <label htmlFor="trash-enabled" className="block text-sm/6 font-medium text-foreground">
                                                        Move to Trash
                                                    </label>
                                                </div>
                                                <div className="flex items-center gap-x-3">
                                                    <input
                                                        checked={!trashEnabled}
                                                        onChange={() => {
                                                            setTrashEnabled(false);
                                                            api_put('/api/settings/trash', { enabled: false }).catch(() => {});
                                                        }}
                                                        id="trash-disabled"
                                                        name="trash"
                                                        type="radio"
                                                        className="relative size-4 appearance-none rounded-full border border-neutral-300 bg-white before:absolute before:inset-1 before:rounded-full before:bg-white not-checked:before:hidden checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:border-neutral-600 dark:bg-neutral-800 dark:checked:border-primary dark:checked:bg-primary forced-colors:appearance-auto forced-colors:before:hidden"
                                                    />
                                                    <label htmlFor="trash-disabled" className="block text-sm/6 font-medium text-foreground">
                                                        Delete permanently
                                                    </label>
                                                </div>
                                            </div>
                                        </fieldset>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Providers: API Keys */}
                        {activeSection === 'providers' && (
                            <div className="space-y-12">
                                <div className="grid grid-cols-1 gap-x-8 gap-y-10 pb-12 md:grid-cols-3">
                                    <div>
                                        <h2 className="text-base/7 font-semibold text-foreground">API Keys</h2>
                                        <p className="mt-1 text-sm/6 text-muted-foreground">
                                            Manage your API keys for AI providers. Keys are encrypted and stored locally on your device.
                                        </p>
                                    </div>

                                    <div className="max-w-2xl space-y-6 md:col-span-2">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                                                    <ModelSelectorLogo provider="anthropic" className="size-4" />
                                                    Anthropic
                                                    {hasAnthropic && (
                                                        <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                            <CheckIcon className="size-3" />
                                                            Configured
                                                        </span>
                                                    )}
                                                </label>
                                                {hasAnthropic && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleClearKey('anthropic')}
                                                        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
                                                    >
                                                        <Trash2Icon className="size-3" />
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <KeyRoundIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                                <Input
                                                    type={showAnthropic ? 'text' : 'password'}
                                                    value={anthropicKey}
                                                    onChange={(e) => {
                                                        setAnthropicKey(e.target.value);

                                                        if (keyErrors.anthropic) {
                                                            setKeyErrors((prev) => ({ ...prev, anthropic: null }));
                                                        }
                                                    }}
                                                    placeholder={hasAnthropic ? 'Enter new key to replace' : 'sk-ant-...'}
                                                    className={`pl-9 pr-9 ${keyErrors.anthropic ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20' : ''}`}
                                                    autoComplete="off"
                                                    spellCheck={false}
                                                    aria-invalid={keyErrors.anthropic ? true : undefined}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAnthropic(!showAnthropic)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                                                    tabIndex={-1}
                                                >
                                                    {showAnthropic ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                                                </button>
                                            </div>
                                            {keyErrors.anthropic && (
                                                <p className="text-xs text-destructive">{keyErrors.anthropic}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                                                    <ModelSelectorLogo provider="openai" className="size-4" />
                                                    OpenAI
                                                    {hasOpenai && (
                                                        <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                            <CheckIcon className="size-3" />
                                                            Configured
                                                        </span>
                                                    )}
                                                </label>
                                                {hasOpenai && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleClearKey('openai')}
                                                        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
                                                    >
                                                        <Trash2Icon className="size-3" />
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <KeyRoundIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                                <Input
                                                    type={showOpenai ? 'text' : 'password'}
                                                    value={openaiKey}
                                                    onChange={(e) => {
                                                        setOpenaiKey(e.target.value);

                                                        if (keyErrors.openai) {
                                                            setKeyErrors((prev) => ({ ...prev, openai: null }));
                                                        }
                                                    }}
                                                    placeholder={hasOpenai ? 'Enter new key to replace' : 'sk-...'}
                                                    className={`pl-9 pr-9 ${keyErrors.openai ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20' : ''}`}
                                                    autoComplete="off"
                                                    spellCheck={false}
                                                    aria-invalid={keyErrors.openai ? true : undefined}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowOpenai(!showOpenai)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                                                    tabIndex={-1}
                                                >
                                                    {showOpenai ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                                                </button>
                                            </div>
                                            {keyErrors.openai && (
                                                <p className="text-xs text-destructive">{keyErrors.openai}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                                                    <ModelSelectorLogo provider="gemini" className="size-4" />
                                                    Gemini
                                                    {hasGemini && (
                                                        <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                            <CheckIcon className="size-3" />
                                                            Configured
                                                        </span>
                                                    )}
                                                </label>
                                                {hasGemini && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleClearKey('gemini')}
                                                        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
                                                    >
                                                        <Trash2Icon className="size-3" />
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <KeyRoundIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                                <Input
                                                    type={showGemini ? 'text' : 'password'}
                                                    value={geminiKey}
                                                    onChange={(e) => {
                                                        setGeminiKey(e.target.value);

                                                        if (keyErrors.gemini) {
                                                            setKeyErrors((prev) => ({ ...prev, gemini: null }));
                                                        }
                                                    }}
                                                    placeholder={hasGemini ? 'Enter new key to replace' : 'AIza...'}
                                                    className={`pl-9 pr-9 ${keyErrors.gemini ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20' : ''}`}
                                                    autoComplete="off"
                                                    spellCheck={false}
                                                    aria-invalid={keyErrors.gemini ? true : undefined}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowGemini(!showGemini)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                                                    tabIndex={-1}
                                                >
                                                    {showGemini ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                                                </button>
                                            </div>
                                            {keyErrors.gemini && (
                                                <p className="text-xs text-destructive">{keyErrors.gemini}</p>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <Button
                                                onClick={handleSaveKeys}
                                                disabled={(!anthropicKey.trim() && !openaiKey.trim() && !geminiKey.trim()) || saving}
                                            >
                                                {saving ? 'Saving...' : 'Save Keys'}
                                            </Button>
                                            {saved && (
                                                <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                                                    <CheckIcon className="size-4" />
                                                    Saved
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Agents: Agent instructions editor */}
                        {activeSection === 'agents' && (
                            <div className="flex min-h-0 flex-1 flex-col">
                                <div className="mb-4 flex items-center justify-between">
                                    <select
                                        value={selectedAgent}
                                        onChange={(e) => setSelectedAgent(e.target.value as 'collaborator')}
                                        className="appearance-none rounded-md border border-neutral-300 bg-white bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23888%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-size-[16px] bg-position-[right_8px_center] bg-no-repeat py-1.5 pl-3 pr-8 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-neutral-700 dark:bg-neutral-800"
                                    >
                                        <option value="collaborator">Collaborator</option>
                                    </select>
                                    <div className="flex items-center gap-2">
                                        {agentSaved && (
                                            <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                                                <CheckIcon className="size-4" />
                                                Saved
                                            </span>
                                        )}
                                        {agentIsCustom && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleResetInstructions}
                                                disabled={agentLoading}
                                            >
                                                Reset to Default
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            onClick={handleSaveInstructions}
                                            disabled={!agentDirty || agentSaving}
                                        >
                                            {agentSaving ? 'Saving...' : 'Save'}
                                        </Button>
                                    </div>
                                </div>

                                <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
                                    {agentLoading ? (
                                        <div className="flex h-full items-center justify-center">
                                            <p className="text-sm text-muted-foreground">Loading...</p>
                                        </div>
                                    ) : (
                                        <MilkdownEditorWrapper
                                            key={editorKey}
                                            ref={editorRef}
                                            defaultValue={agentInstructions}
                                            onChange={handleEditorChange}
                                            onReady={handleEditorReady}
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
}

import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { Link, useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { api_get, api_post, api_put, api_patch, api_delete } from '@/lib/api';
import {
    AlertTriangleIcon,
    FilesIcon,
    FolderIcon,
    FolderOpenIcon,
    ImagesIcon,
    Settings2Icon,
    Ellipsis,
    PlusIcon,
} from 'lucide-react';
import type { FormEvent, MouseEvent } from 'react';
import { useEffect, useState } from 'react';

import { ModelSelectorLogo } from '@/components/ai-elements/model-selector';
import { HelpSidebarButton } from '@/components/help-sidebar-button';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import appIcon from '../../images/app-icon.png';

type UsedProvider = 'anthropic' | 'openai' | 'gemini';

interface Project {
    id: string;
    name: string;
    description: string | null;
    filesystem_root: string | null;
    path: string;
    created_at: string;
    updated_at: string;
    document_count: number;
    image_count: number;
    used_providers: UsedProvider[];
}

interface ConfiguredProviders {
    anthropic: boolean;
    openai: boolean;
    gemini: boolean;
}

const PROVIDER_LABELS: Record<keyof ConfiguredProviders, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    gemini: 'Gemini',
};

export default function Main() {
    useDocumentTitle('Home');
    const [projects, setProjects] = useState<Project[]>([]);
    const [configuredProviders, setConfiguredProviders] = useState<ConfiguredProviders>({ anthropic: false, openai: false, gemini: false });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api_get<{ projects: Project[]; configuredProviders: ConfiguredProviders }>('/api/projects')
            .then((data) => {
                setProjects(data.projects);
                setConfiguredProviders(data.configuredProviders);
            })
            .finally(() => setLoading(false));
    }, []);

    const missingProviders = (Object.keys(PROVIDER_LABELS) as Array<keyof ConfiguredProviders>)
        .filter((provider) => !configuredProviders[provider])
        .map((provider) => PROVIDER_LABELS[provider]);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
    const [trashEnabled, setTrashEnabled] = useState(true);
    const [formData, setFormData] = useState({ name: '', description: '', filesystem_root: '', initial_prompt: '' });
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [formProcessing, setFormProcessing] = useState(false);
    const navigate = useNavigate();

    // Provide form.data / form.setData / form.errors / form.processing compatibility
    const form = {
        data: formData,
        setData: (key: string, value: string) => setFormData((prev) => ({ ...prev, [key]: value })),
        errors: formErrors,
        processing: formProcessing,
        reset: () => { setFormData({ name: '', description: '', filesystem_root: '', initial_prompt: '' }); setFormErrors({}); },
    };

    useEffect(() => {
        api_get<{ enabled: boolean }>('/api/settings/trash')
            .then((data) => setTrashEnabled(data.enabled))
            .catch(() => {});
    }, []);

    function handleDeleteProject() {
        if (!deletingProjectId) return;
        api_delete(`/api/projects/${deletingProjectId}`)
            .then(() => {
                setDeletingProjectId(null);
                window.location.reload();
            });
    }

    async function handleSelectDirectory() {
        try {
            const data = await api_post<{ path: string | null }>('/api/select-directory');
            if (data.path) {
                form.setData('filesystem_root', data.path);
            }
        } catch (error) {
            console.error('Failed to select directory:', error);
        }
    }

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setFormProcessing(true);
        setFormErrors({});
        api_post<{ id: string }>('/api/projects', formData)
            .then((project) => {
                setIsCreateDialogOpen(false);
                form.reset();
                navigate(`/projects/${project.id}`);
            })
            .catch((err) => {
                console.error(err);
            })
            .finally(() => setFormProcessing(false));
    }

    return (
        <div className="flex h-screen flex-col">
            <header className="title-bar justify-center">
                <div className="text-black dark:text-white">Trident</div>
            </header>

            <div className="flex h-[calc(100vh-2rem)] w-full overflow-hidden">
                <TooltipProvider>
                    <aside className="flex w-12 flex-col items-center border-r border-neutral-100 bg-white py-2 dark:border-neutral-800 dark:bg-neutral-900">
                        <img
                            src={appIcon}
                            alt="Trident"
                            className="size-8 rounded-lg"
                        />

                        <nav className="mt-4 flex flex-col items-center gap-1">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon-sm">
                                        <FolderIcon className="size-4" />
                                        <span className="sr-only">
                                            Projects
                                        </span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    Projects
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Link to="/settings">
                                        <Button variant="ghost" size="icon-sm">
                                            <Settings2Icon className="size-4" />
                                            <span className="sr-only">
                                                Settings
                                            </span>
                                        </Button>
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    Settings
                                </TooltipContent>
                            </Tooltip>
                        </nav>
                        <div className="mt-auto">
                            <HelpSidebarButton />
                        </div>
                    </aside>
                </TooltipProvider>

                <main className="min-h-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
                    {missingProviders.length > 0 && (
                        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-900/10">
                            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
                            <div className="flex-1">
                                <p className="font-medium text-amber-900 dark:text-amber-200">
                                    {missingProviders.length === 3
                                        ? 'No API keys configured'
                                        : `${missingProviders.join(', ')} API ${missingProviders.length === 1 ? 'key is' : 'keys are'} missing`}
                                </p>
                                <p className="mt-0.5 text-amber-800/80 dark:text-amber-200/70">
                                    <Link to="/settings" className="underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100">
                                        Add API keys in settings
                                    </Link>{' '}
                                    to use these providers.
                                </p>
                            </div>
                        </div>
                    )}
                    <div className="mb-6 flex items-center justify-between">
                        <h1 className="text-lg font-semibold text-neutral-900 dark:text-white">
                            Projects
                        </h1>
                        <Button
                            size="sm"
                            onClick={() => setIsCreateDialogOpen(true)}
                        >
                            <PlusIcon className="size-4" />
                            New Project
                        </Button>
                    </div>

                    {projects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-center">
                            <FolderIcon className="mb-4 size-12 text-neutral-300 dark:text-neutral-600" />
                            <h2 className="text-base font-medium text-neutral-900 dark:text-white">
                                No projects yet
                            </h2>
                            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                                Get started by creating your first project.
                            </p>
                            <Button
                                className="mt-4"
                                onClick={() => setIsCreateDialogOpen(true)}
                            >
                                <PlusIcon className="size-4" />
                                New Project
                            </Button>
                        </div>
                    ) : (
                        <ul
                            role="list"
                            className="grid grid-cols-1 gap-x-6 gap-y-6 lg:grid-cols-3 xl:gap-x-8"
                        >
                            {projects.map((project) => (
                                <li key={project.id} className="relative">
                                    <Link
                                        to={`/projects/${project.id}`}
                                        className="group block h-full rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-300 hover:shadow-sm dark:border-white/10 dark:bg-neutral-900 dark:hover:border-white/20"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <h3 className="truncate text-base font-semibold text-neutral-900 dark:text-white">
                                                {project.name}
                                            </h3>
                                            {/* Spacer to reserve room for the absolutely positioned menu */}
                                            <span aria-hidden="true" className="size-5 shrink-0" />
                                        </div>
                                        <p className="mt-1 line-clamp-2 min-h-10 text-sm text-neutral-500 dark:text-neutral-400">
                                            {project.description || (
                                                <span className="italic text-neutral-400 dark:text-neutral-500">
                                                    No description
                                                </span>
                                            )}
                                        </p>

                                        <div className="mt-6 flex items-end justify-between gap-3">
                                            <div className="flex min-w-0 flex-1 items-center gap-2">
                                                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300">
                                                    <FilesIcon className="size-3.5" aria-hidden="true" />
                                                    <span>{project.document_count}</span>
                                                    <span className="sr-only">documents</span>
                                                </span>
                                                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300">
                                                    <ImagesIcon className="size-3.5" aria-hidden="true" />
                                                    <span>{project.image_count}</span>
                                                    <span className="sr-only">images</span>
                                                </span>
                                                {project.filesystem_root && (
                                                    <span
                                                        className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300"
                                                        title={project.filesystem_root}
                                                    >
                                                        <FolderOpenIcon className="size-3.5 shrink-0" aria-hidden="true" />
                                                        <span className="truncate">
                                                            {project.filesystem_root.split('/').filter(Boolean).pop() ?? project.filesystem_root}
                                                        </span>
                                                        <span className="sr-only">workspace directory</span>
                                                    </span>
                                                )}
                                            </div>

                                            {project.used_providers.length > 0 && (
                                                <div className="flex shrink-0 items-center gap-2">
                                                    {project.used_providers.map((provider) => (
                                                        <ModelSelectorLogo
                                                            key={provider}
                                                            provider={provider}
                                                            className="size-4"
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </Link>

                                    <Menu
                                        as="div"
                                        className="absolute right-3 top-3"
                                    >
                                        <MenuButton
                                            onClick={(e: MouseEvent) => e.stopPropagation()}
                                            className="relative flex size-7 items-center justify-center rounded-md text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white"
                                        >
                                            <span className="sr-only">Open options</span>
                                            <Ellipsis aria-hidden="true" className="size-5" />
                                        </MenuButton>
                                        <MenuItems
                                            transition
                                            className="absolute right-0 z-10 mt-0.5 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg outline-1 outline-neutral-900/5 transition data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in dark:bg-neutral-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10 data-closed:scale-95 data-closed:transform data-closed:opacity-0"
                                        >
                                            <MenuItem>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        api_post<{ id: string }>(`/api/projects/${project.id}/duplicate`)
                                                            .then((newProject) => navigate(`/projects/${newProject.id}`));
                                                    }}
                                                    className="block w-full px-3 py-1 text-left text-sm/6 text-neutral-700 data-focus:bg-neutral-50 data-focus:outline-hidden dark:text-neutral-200 dark:data-focus:bg-white/5"
                                                >
                                                    Duplicate
                                                    <span className="sr-only">, {project.name}</span>
                                                </button>
                                            </MenuItem>
                                            <MenuItem>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDeletingProjectId(project.id);
                                                    }}
                                                    className="block w-full px-3 py-1 text-left text-sm/6 text-red-600 data-focus:bg-neutral-50 data-focus:outline-hidden dark:text-red-400 dark:data-focus:bg-white/5"
                                                >
                                                    Delete
                                                    <span className="sr-only">, {project.name}</span>
                                                </button>
                                            </MenuItem>
                                        </MenuItems>
                                    </Menu>
                                </li>
                            ))}
                        </ul>
                    )}
                </main>
            </div>

            <Dialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Project</DialogTitle>
                        <DialogDescription>
                            Add a new project to get started.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="grid gap-4">
                        <div className="grid gap-2">
                            <label
                                htmlFor="name"
                                className="text-sm font-medium"
                            >
                                Name
                            </label>
                            <Input
                                id="name"
                                value={form.data.name}
                                onChange={(e) =>
                                    form.setData('name', e.target.value)
                                }
                                placeholder="My Project"
                                required
                            />
                            {form.errors.name && (
                                <p className="text-sm text-destructive">
                                    {form.errors.name}
                                </p>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <label
                                htmlFor="description"
                                className="text-sm font-medium"
                            >
                                Description
                            </label>
                            <Textarea
                                id="description"
                                value={form.data.description}
                                onChange={(e) =>
                                    form.setData(
                                        'description',
                                        e.target.value,
                                    )
                                }
                                placeholder="A short description of the project"
                            />
                            {form.errors.description && (
                                <p className="text-sm text-destructive">
                                    {form.errors.description}
                                </p>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">
                                Workspace Directory{' '}
                                <span className="text-neutral-400 font-normal">(optional)</span>
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    value={form.data.filesystem_root}
                                    readOnly
                                    placeholder="No directory selected"
                                    className="flex-1"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={handleSelectDirectory}
                                >
                                    <FolderOpenIcon className="size-4" />
                                </Button>
                            </div>
                            {form.errors.filesystem_root && (
                                <p className="text-sm text-destructive">
                                    {form.errors.filesystem_root}
                                </p>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <label
                                htmlFor="initial_prompt"
                                className="text-sm font-medium"
                            >
                                Initial Prompt{' '}
                                <span className="font-normal text-neutral-400">(optional)</span>
                            </label>
                            <Textarea
                                id="initial_prompt"
                                value={form.data.initial_prompt}
                                onChange={(e) =>
                                    form.setData(
                                        'initial_prompt',
                                        e.target.value,
                                    )
                                }
                                placeholder="Send this message to both chats when the project opens..."
                                rows={3}
                            />
                            {form.errors.initial_prompt && (
                                <p className="text-sm text-destructive">
                                    {form.errors.initial_prompt}
                                </p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsCreateDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={form.processing}
                            >
                                Create
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deletingProjectId !== null} onOpenChange={(open) => {
                if (!open) {
                    setDeletingProjectId(null);
                }
                }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{trashEnabled ? 'Move to Trash?' : 'Delete project?'}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {trashEnabled
                                ? 'This project and all its documents will be moved to the system trash.'
                                : 'This will permanently delete this project and all its documents. This action cannot be undone.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteProject} className="bg-red-600 hover:bg-red-700 text-white">
                            {trashEnabled ? 'Move to Trash' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

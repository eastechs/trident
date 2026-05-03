import { FolderOpenIcon, Settings2Icon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api_patch, api_post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ProjectData } from "@/types/api";

interface FormData {
  name: string;
  description: string;
  filesystem_root: string;
  embeddings_enabled: boolean;
}

interface Props {
  project: ProjectData;
  onUpdated?: (updated: ProjectData) => void;
}

export function ProjectSettingsDialog({ project, onUpdated }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: project.name,
    description: project.description ?? "",
    filesystem_root: project.filesystem_root ?? "",
    embeddings_enabled: project.embeddings_enabled,
  });
  const [processing, setProcessing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setFormData({
      name: project.name,
      description: project.description ?? "",
      filesystem_root: project.filesystem_root ?? "",
      embeddings_enabled: project.embeddings_enabled,
    });
  }, [project]);

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function openDialog() {
    setErrors({});
    setFormData({
      name: project.name,
      description: project.description ?? "",
      filesystem_root: project.filesystem_root ?? "",
      embeddings_enabled: project.embeddings_enabled,
    });
    setIsOpen(true);
  }

  async function handleSelectDirectory() {
    try {
      const result = await api_post<{ path: string | null }>(
        "/api/select-directory",
      );
      if (result.path) {
        setField("filesystem_root", result.path);
      }
    } catch (err) {
      console.error("Failed to select directory:", err);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setProcessing(true);
    setErrors({});
    api_patch<ProjectData>(`/api/projects/${project.id}`, formData)
      .then((updated) => {
        onUpdated?.(updated);
        setIsOpen(false);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => setProcessing(false));
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={openDialog}>
            <Settings2Icon className="size-4" />
            <span className="sr-only">Project Settings</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Project Settings</TooltipContent>
      </Tooltip>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Project Settings</DialogTitle>
            <DialogDescription>
              Update this project's name, description, and workspace directory.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <label htmlFor="update-name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="update-name"
                value={formData.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="My Project"
                required
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>
            <div className="grid gap-2">
              <label
                htmlFor="update-description"
                className="text-sm font-medium"
              >
                Description
              </label>
              <Textarea
                id="update-description"
                value={formData.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="A short description of the project"
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description}</p>
              )}
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">
                Workspace Directory{" "}
                <span className="font-normal text-neutral-400">(optional)</span>
              </label>
              <div className="flex gap-2">
                <Input
                  value={formData.filesystem_root}
                  readOnly
                  placeholder="No directory selected"
                  className="flex-1"
                />
                {formData.filesystem_root && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setField("filesystem_root", "")}
                    title="Clear workspace directory"
                  >
                    <XIcon className="size-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleSelectDirectory}
                >
                  <FolderOpenIcon className="size-4" />
                </Button>
              </div>
              {errors.filesystem_root && (
                <p className="text-sm text-destructive">
                  {errors.filesystem_root}
                </p>
              )}
            </div>
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div className="grid gap-1">
                <label
                  htmlFor="embeddings-toggle"
                  className="text-sm font-medium"
                >
                  Semantic search
                </label>
                <p className="text-xs text-muted-foreground">
                  Embed this project's documents with OpenAI so the agent and
                  the command palette can search them by meaning.
                </p>
              </div>
              <Switch
                id="embeddings-toggle"
                checked={formData.embeddings_enabled}
                onCheckedChange={(checked) =>
                  setField("embeddings_enabled", checked)
                }
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={processing}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

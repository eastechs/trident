import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileTextIcon,
  ImageIcon,
  KeyRoundIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api_post, isApiError } from "@/lib/api";
import type { DocumentData } from "@/types/api";

interface SearchResult {
  id: string;
  name: string;
  directory: string;
  snippet: string;
  score: number;
}

interface ImageSearchResult {
  id: string;
  name: string;
  prompt: string | undefined;
  snippet: string;
  score: number;
}

interface SemanticResults {
  documents: SearchResult[];
  images: ImageSearchResult[];
}

interface Props {
  projectId: string;
  documents: DocumentData[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TriggerProps {
  projectId: string;
  documents: DocumentData[];
}

const NAME_RESULT_CAP = 25;

// Self-contained sidebar trigger: renders the search-icon button, owns the
// palette open state, registers the global Cmd/Ctrl+K shortcut, and mounts
// the palette modal. Drop one into each project-scoped page that has the
// left-rail sidebar (project, docs, gallery). The keydown listener is
// per-instance and unmounts with the component, so only the active route's
// listener is live at a time — no double-firing.
export function ProjectSearchTrigger({ projectId, documents }: TriggerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)}>
            <SearchIcon className="size-4" />
            <span className="sr-only">Search</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Search (⌘K)</TooltipContent>
      </Tooltip>
      <CommandPalette
        projectId={projectId}
        documents={documents}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

// Project-scoped command palette. Type to filter docs by name (instant,
// client-side); press Enter to run a semantic search through the embeddings
// API. Falls back to a configure-key empty state when the API responds 409
// (no OpenAI key) — that's the only place this notice surfaces in the app.
export function CommandPalette({
  projectId,
  documents,
  open,
  onOpenChange,
}: Props) {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [semanticResults, setSemanticResults] = useState<SemanticResults | null>(
    null,
  );
  const [searching, setSearching] = useState(false);
  const [noKey, setNoKey] = useState(false);
  const [searchError, setSearchError] = useState(false);

  // Reset transient state every time the palette opens, so the user
  // never sees stale results from a previous session.
  useEffect(() => {
    if (open) {
      setInput("");
      setSemanticResults(null);
      setSearching(false);
      setNoKey(false);
      setSearchError(false);
    }
  }, [open]);

  // When the user edits the input after a semantic search ran, drop back
  // to name-match mode so they can keep typing without re-pressing Enter.
  useEffect(() => {
    if (semanticResults !== null || noKey || searchError) {
      setSemanticResults(null);
      setNoKey(false);
      setSearchError(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  const nameMatches = useMemo(() => {
    const q = input.trim().toLowerCase();
    const sorted = [...documents].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted.slice(0, NAME_RESULT_CAP);
    return sorted
      .filter((d) => d.name.toLowerCase().includes(q))
      .slice(0, NAME_RESULT_CAP);
  }, [documents, input]);

  const runSemanticSearch = useCallback(async () => {
    const q = input.trim();
    if (!q || searching) return;
    setSearching(true);
    setNoKey(false);
    setSearchError(false);
    try {
      const result = await api_post<SemanticResults>(
        `/api/projects/${projectId}/search`,
        { query: q },
      );
      setSemanticResults(result);
    } catch (err) {
      if (isApiError(err) && err.status === 409) {
        setNoKey(true);
        setSemanticResults({ documents: [], images: [] });
      } else {
        console.error("Semantic search failed:", err);
        setSearchError(true);
        setSemanticResults({ documents: [], images: [] });
      }
    } finally {
      setSearching(false);
    }
  }, [input, projectId, searching]);

  const openDoc = useCallback(
    (docId: string) => {
      onOpenChange(false);
      navigate(`/projects/${projectId}/docs`, {
        state: { focusDocumentId: docId },
      });
    },
    [navigate, onOpenChange, projectId],
  );

  const openImage = useCallback(
    (imageId: string) => {
      onOpenChange(false);
      navigate(`/projects/${projectId}/gallery`, {
        state: { focusImageId: imageId },
      });
    },
    [navigate, onOpenChange, projectId],
  );

  const goToSettings = useCallback(() => {
    onOpenChange(false);
    navigate("/settings");
  }, [navigate, onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search documents..."
          value={input}
          onValueChange={setInput}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              e.preventDefault();
              void runSemanticSearch();
            }
          }}
        />
        <CommandList>
          {noKey ? (
            <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
              <KeyRoundIcon className="size-5 opacity-60" />
              <p className="text-sm font-medium">Configure an OpenAI API key</p>
              <p className="text-xs text-muted-foreground">
                Semantic search needs an OpenAI key for embeddings. Name-only
                search keeps working without one.
              </p>
              <Button onClick={goToSettings} variant="outline" size="sm">
                Open settings
              </Button>
            </div>
          ) : semanticResults !== null ? (
            <>
              {searching ? (
                <CommandGroup heading="Searching by content...">
                  <></>
                </CommandGroup>
              ) : semanticResults.documents.length === 0 &&
                semanticResults.images.length === 0 ? (
                <CommandEmpty>
                  {searchError
                    ? "Search failed. Try again."
                    : "Nothing matched."}
                </CommandEmpty>
              ) : (
                <>
                  {semanticResults.documents.length > 0 && (
                    <CommandGroup heading="Documents">
                      {semanticResults.documents.map((r) => (
                        <CommandItem
                          key={r.id}
                          value={`doc-${r.id}`}
                          onSelect={() => openDoc(r.id)}
                        >
                          <SparklesIcon className="opacity-60" />
                          <div className="flex min-w-0 flex-col gap-0.5 overflow-hidden">
                            <span className="truncate font-medium">{r.name}</span>
                            <span className="line-clamp-2 text-xs font-normal text-muted-foreground">
                              {r.snippet}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  {semanticResults.images.length > 0 && (
                    <CommandGroup heading="Images">
                      {semanticResults.images.map((r) => (
                        <CommandItem
                          key={r.id}
                          value={`image-${r.id}`}
                          onSelect={() => openImage(r.id)}
                        >
                          <ImageIcon className="opacity-60" />
                          <div className="flex min-w-0 flex-col gap-0.5 overflow-hidden">
                            <span className="truncate font-medium">{r.name}</span>
                            {r.snippet && (
                              <span className="line-clamp-2 text-xs font-normal text-muted-foreground">
                                {r.snippet}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </>
              )}
            </>
          ) : (
            <CommandGroup
              heading={input.trim() ? "Documents" : "All documents"}
            >
              {nameMatches.length === 0 ? (
                <CommandEmpty>
                  No name match. Press Enter to search by content.
                </CommandEmpty>
              ) : (
                nameMatches.map((d) => (
                  <CommandItem
                    key={d.id}
                    value={`name-${d.id}-${d.name}`}
                    onSelect={() => openDoc(d.id)}
                  >
                    <FileTextIcon className="opacity-60" />
                    <span className="truncate">{d.name}</span>
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

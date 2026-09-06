import { Link, useSearchParams } from "react-router-dom";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { api_get, api_put, api_delete } from "@/lib/api";
import {
  BellIcon,
  BotIcon,
  CheckIcon,
  FolderIcon,
  KeyRoundIcon,
  Settings2Icon,
  Trash2Icon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppTheme } from "@main/settings";

import { ModelSelectorLogo } from "@/components/ai-elements/model-selector";
import type { EditorHandle } from "@/components/editor";
import { MilkdownEditorWrapper } from "@/components/editor";
import { ProviderConnectionForm } from "@/components/provider-connection-form";
import { UpdateSidebarButton } from "@/components/update-sidebar-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PROVIDER_CATALOG,
  PROVIDER_GROUPS,
  emptyProviderSettings,
  type ProviderId,
  type ProviderSettingsResponse,
} from "@/lib/providers";
import appIcon from "../../images/app-icon.png";

export default function Settings() {
  useDocumentTitle("Settings");
  const [providerSettings, setProviderSettings] = useState(
    emptyProviderSettings,
  );
  const [providerLoading, setProviderLoading] = useState(true);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(
    null,
  );
  const [providerToRemove, setProviderToRemove] = useState<ProviderId | null>(
    null,
  );
  const [removingProvider, setRemovingProvider] = useState(false);
  const [removeProviderError, setRemoveProviderError] = useState<string | null>(
    null,
  );
  const [providerAnnouncement, setProviderAnnouncement] = useState("");
  const [providerSaving, setProviderSaving] = useState(false);
  const [instructionsError, setInstructionsError] = useState<string | null>(
    null,
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [chimeEnabled, setChimeEnabled] = useState(true);
  const [trashEnabled, setTrashEnabled] = useState(true);
  const [theme, setTheme] = useState<AppTheme>();
  const [themeLoading, setThemeLoading] = useState(true);
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeError, setThemeError] = useState<string | null>(null);

  // Side menu state — section is derived from the ?section= query param
  // (e.g. /settings?section=providers from the missing-keys alert) so that
  // navigating to a new section URL updates the visible panel.
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection: "preferences" | "providers" | "agents" =
    (["preferences", "providers", "agents"] as const).find(
      (s) => s === searchParams.get("section"),
    ) ?? "preferences";
  const setActiveSection = useCallback(
    (section: "preferences" | "providers" | "agents") => {
      setSearchParams({ section }, { replace: true });
    },
    [setSearchParams],
  );

  // Agent instructions state
  const [selectedAgent, setSelectedAgent] =
    useState<"collaborator">("collaborator");
  const [agentInstructions, setAgentInstructions] = useState("");
  const [agentIsCustom, setAgentIsCustom] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentSaving, setAgentSaving] = useState(false);
  const [agentSaved, setAgentSaved] = useState(false);
  const [agentDirty, setAgentDirty] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const editorRef = useRef<EditorHandle>(null);
  const lastSavedInstructions = useRef("");

  useEffect(() => {
    let active = true;
    api_get<{ theme: AppTheme }>("/api/settings/theme")
      .then((data) => {
        if (active) setTheme(data.theme);
      })
      .catch(() => {
        if (active)
          setThemeError(
            "Could not load the saved theme. Choose a theme to try again.",
          );
      })
      .finally(() => {
        if (active) setThemeLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleThemeChange = async (value: AppTheme) => {
    setThemeSaving(true);
    setThemeError(null);
    try {
      const data = await api_put<{ theme: AppTheme }>("/api/settings/theme", {
        theme: value,
      });
      setTheme(data.theme);
    } catch {
      setThemeError("Could not save the theme. Please try again.");
    } finally {
      setThemeSaving(false);
    }
  };

  useEffect(() => {
    api_get<{ enabled: boolean }>("/api/settings/notifications")
      .then((data) => setNotificationsEnabled(data.enabled))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api_get<{ enabled: boolean }>("/api/settings/agent-chime")
      .then((data) => setChimeEnabled(data.enabled))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api_get<{ enabled: boolean }>("/api/settings/trash")
      .then((data) => setTrashEnabled(data.enabled))
      .catch(() => {});
  }, []);

  const refreshProviderSettings = useCallback(async () => {
    const data = await api_get<ProviderSettingsResponse>(
      "/api/settings/providers",
    );
    setProviderSettings(data);
    setProviderError(null);
    return data;
  }, []);

  const loadProviderSettings = useCallback(async () => {
    setProviderLoading(true);
    setProviderError(null);
    try {
      await refreshProviderSettings();
    } catch (error) {
      console.error("Failed to load provider settings:", error);
      setProviderError(
        "Provider connections could not be loaded. Please try again.",
      );
    } finally {
      setProviderLoading(false);
    }
  }, [refreshProviderSettings]);

  useEffect(() => {
    void loadProviderSettings();
  }, [loadProviderSettings]);

  const handleProviderSaved = async (provider: ProviderId) => {
    await refreshProviderSettings();
    setProviderAnnouncement(
      `${PROVIDER_CATALOG[provider].label} is configured.`,
    );
    setSelectedProvider(null);
  };

  const handleRemoveProvider = async () => {
    if (!providerToRemove) return;

    const provider = providerToRemove;
    setRemovingProvider(true);
    setRemoveProviderError(null);
    let providerWasRemoved = false;
    try {
      await api_delete(`/api/settings/providers/${provider}`);
      providerWasRemoved = true;
      await refreshProviderSettings();
      setProviderAnnouncement(
        `${PROVIDER_CATALOG[provider].label} was removed.`,
      );
      setProviderToRemove(null);
    } catch (error) {
      console.error(`Failed to remove ${provider} provider:`, error);
      if (providerWasRemoved) {
        setProviderToRemove(null);
        setProviderError(
          `${PROVIDER_CATALOG[provider].label} was removed, but its status could not be refreshed. Reopen Settings to refresh it.`,
        );
      } else {
        setRemoveProviderError(
          `Failed to remove ${PROVIDER_CATALOG[provider].label}. Please try again.`,
        );
      }
    } finally {
      setRemovingProvider(false);
    }
  };

  // Agent instructions handlers
  const fetchAgentInstructions = useCallback((agentKey: string) => {
    setAgentLoading(true);
    setAgentDirty(false);
    setAgentSaved(false);
    api_get<{ instructions: string; isCustom: boolean }>(
      `/api/settings/agent-instructions/${agentKey}`,
    )
      .then((data) => {
        setAgentInstructions(data.instructions);
        setAgentIsCustom(data.isCustom);
        lastSavedInstructions.current = data.instructions;
        setEditorKey((prev) => prev + 1);
      })
      .catch(() => {})
      .finally(() => setAgentLoading(false));
  }, []);

  useEffect(() => {
    fetchAgentInstructions(selectedAgent);
  }, [selectedAgent, fetchAgentInstructions]);

  const handleSaveInstructions = async () => {
    const content = editorRef.current?.getMarkdown() ?? "";
    setAgentSaving(true);
    setAgentSaved(false);
    setInstructionsError(null);

    try {
      await api_put(`/api/settings/agent-instructions/${selectedAgent}`, {
        instructions: content,
      });
      lastSavedInstructions.current = content;
      setAgentIsCustom(true);
      setAgentDirty(false);
      setAgentSaved(true);
      setTimeout(() => setAgentSaved(false), 3000);
    } catch (error) {
      console.error("Failed to save agent instructions:", error);
      setInstructionsError(
        "Failed to save agent instructions. Please try again.",
      );
    } finally {
      setAgentSaving(false);
    }
  };

  const handleResetInstructions = async () => {
    setInstructionsError(null);
    try {
      await api_delete(`/api/settings/agent-instructions/${selectedAgent}`);
      fetchAgentInstructions(selectedAgent);
    } catch (error) {
      console.error("Failed to reset agent instructions:", error);
      setInstructionsError(
        "Failed to reset agent instructions. Please try again.",
      );
    }
  };

  const handleEditorChange = useCallback((markdown: string) => {
    const isDirty = markdown !== lastSavedInstructions.current;
    setAgentDirty((prev) => (prev === isDirty ? prev : isDirty));
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
          <aside className="border-border flex w-12 flex-col items-center border-r bg-white py-2 dark:bg-neutral-950">
            <Link to="/">
              <img src={appIcon} alt="Trident" className="size-8 rounded-lg" />
            </Link>
            <nav className="mt-4 flex flex-col items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link to="/">
                    <Button variant="ghost" size="icon-sm">
                      <FolderIcon className="size-4" />
                      <span className="sr-only">Projects</span>
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Projects</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <Settings2Icon className="size-4" />
                    <span className="sr-only">Settings</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Settings</TooltipContent>
              </Tooltip>
            </nav>
            <div className="mt-auto">
              <UpdateSidebarButton />
            </div>
          </aside>
        </TooltipProvider>

        <div className="flex min-h-0 flex-1">
          {/* Settings side menu */}
          <nav className="border-border flex w-44 shrink-0 flex-col border-r bg-neutral-50 py-4 dark:bg-neutral-950">
            <div className="text-muted-foreground px-4 pb-3 text-[10px] font-medium tracking-wider uppercase">
              Settings
            </div>
            <button
              onClick={() => setActiveSection("preferences")}
              className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                activeSection === "preferences"
                  ? "border-primary text-foreground border-l-2 bg-white font-medium dark:bg-neutral-900"
                  : "text-muted-foreground hover:text-foreground border-l-2 border-transparent"
              }`}
            >
              <BellIcon className="size-4" />
              Preferences
            </button>
            <button
              onClick={() => setActiveSection("providers")}
              className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                activeSection === "providers"
                  ? "border-primary text-foreground border-l-2 bg-white font-medium dark:bg-neutral-900"
                  : "text-muted-foreground hover:text-foreground border-l-2 border-transparent"
              }`}
            >
              <KeyRoundIcon className="size-4" />
              Providers
            </button>
            <button
              onClick={() => setActiveSection("agents")}
              className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                activeSection === "agents"
                  ? "border-primary text-foreground border-l-2 bg-white font-medium dark:bg-neutral-900"
                  : "text-muted-foreground hover:text-foreground border-l-2 border-transparent"
              }`}
            >
              <BotIcon className="size-4" />
              Agents
            </button>
          </nav>

          {/* Content area */}
          <main
            className={`min-h-0 flex-1 p-4 sm:p-6 lg:p-8 ${activeSection === "agents" ? "flex flex-col overflow-hidden" : "overflow-auto"}`}
          >
            {/* Preferences */}
            {activeSection === "preferences" && (
              <div className="space-y-12">
                <div className="border-border grid grid-cols-1 gap-x-8 gap-y-10 border-b pb-12 md:grid-cols-3">
                  <div>
                    <h2 className="text-foreground text-base/7 font-semibold">
                      Appearance
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm/6">
                      Choose how Trident looks.
                    </p>
                  </div>
                  <div className="max-w-2xl md:col-span-2">
                    <label
                      htmlFor="app-theme"
                      className="text-foreground text-sm/6 font-semibold"
                    >
                      Theme
                    </label>
                    <Select
                      value={theme ?? ""}
                      onValueChange={(value) => {
                        void handleThemeChange(value as AppTheme);
                      }}
                      disabled={themeLoading || themeSaving}
                    >
                      <SelectTrigger
                        id="app-theme"
                        className="mt-3 w-48"
                        aria-describedby="app-theme-description"
                      >
                        <SelectValue
                          placeholder={
                            themeLoading ? "Loading..." : "Select theme"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">System</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                      </SelectContent>
                    </Select>
                    <p
                      id="app-theme-description"
                      className="text-muted-foreground mt-2 text-sm/6"
                    >
                      System follows your device’s appearance.
                    </p>
                    {themeError && (
                      <p role="alert" className="text-destructive mt-2 text-sm">
                        {themeError}
                      </p>
                    )}
                  </div>
                </div>
                <div className="border-border grid grid-cols-1 gap-x-8 gap-y-10 border-b pb-12 md:grid-cols-3">
                  <div>
                    <h2 className="text-foreground text-base/7 font-semibold">
                      Notifications
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm/6">
                      Configure how you receive notifications from Trident.
                    </p>
                  </div>

                  <div className="max-w-2xl space-y-10 md:col-span-2">
                    <fieldset>
                      <legend className="text-foreground text-sm/6 font-semibold">
                        Desktop notifications
                      </legend>
                      <div className="mt-6 space-y-6">
                        <div className="flex items-center gap-x-3">
                          <input
                            checked={notificationsEnabled}
                            onChange={() => {
                              setNotificationsEnabled(true);
                              api_put("/api/settings/notifications", {
                                enabled: true,
                              }).catch(() => {});
                            }}
                            id="notify-all"
                            name="notifications"
                            type="radio"
                            className="checked:border-primary checked:bg-primary focus-visible:outline-primary dark:checked:border-primary dark:checked:bg-primary relative size-4 appearance-none rounded-full border border-neutral-300 bg-white before:absolute before:inset-1 before:rounded-full before:bg-white not-checked:before:hidden focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-neutral-600 dark:bg-neutral-900 forced-colors:appearance-auto forced-colors:before:hidden"
                          />
                          <label
                            htmlFor="notify-all"
                            className="text-foreground block text-sm/6 font-medium"
                          >
                            All responses
                          </label>
                        </div>
                        <div className="flex items-center gap-x-3">
                          <input
                            checked={!notificationsEnabled}
                            onChange={() => {
                              setNotificationsEnabled(false);
                              api_put("/api/settings/notifications", {
                                enabled: false,
                              }).catch(() => {});
                            }}
                            id="notify-none"
                            name="notifications"
                            type="radio"
                            className="checked:border-primary checked:bg-primary focus-visible:outline-primary dark:checked:border-primary dark:checked:bg-primary relative size-4 appearance-none rounded-full border border-neutral-300 bg-white before:absolute before:inset-1 before:rounded-full before:bg-white not-checked:before:hidden focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-neutral-600 dark:bg-neutral-900 forced-colors:appearance-auto forced-colors:before:hidden"
                          />
                          <label
                            htmlFor="notify-none"
                            className="text-foreground block text-sm/6 font-medium"
                          >
                            No notifications
                          </label>
                        </div>
                      </div>
                    </fieldset>

                    <fieldset>
                      <legend className="text-foreground text-sm/6 font-semibold">
                        Agent chime
                      </legend>
                      <p className="text-muted-foreground mt-1 text-sm/6">
                        Play a short sound when the agent finishes responding.
                      </p>
                      <div className="mt-6 space-y-6">
                        <div className="flex items-center gap-x-3">
                          <input
                            checked={chimeEnabled}
                            onChange={() => {
                              setChimeEnabled(true);
                              api_put("/api/settings/agent-chime", {
                                enabled: true,
                              }).catch(() => {});
                            }}
                            id="chime-on"
                            name="chime"
                            type="radio"
                            className="checked:border-primary checked:bg-primary focus-visible:outline-primary dark:checked:border-primary dark:checked:bg-primary relative size-4 appearance-none rounded-full border border-neutral-300 bg-white before:absolute before:inset-1 before:rounded-full before:bg-white not-checked:before:hidden focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-neutral-600 dark:bg-neutral-900 forced-colors:appearance-auto forced-colors:before:hidden"
                          />
                          <label
                            htmlFor="chime-on"
                            className="text-foreground block text-sm/6 font-medium"
                          >
                            Play chime
                          </label>
                        </div>
                        <div className="flex items-center gap-x-3">
                          <input
                            checked={!chimeEnabled}
                            onChange={() => {
                              setChimeEnabled(false);
                              api_put("/api/settings/agent-chime", {
                                enabled: false,
                              }).catch(() => {});
                            }}
                            id="chime-off"
                            name="chime"
                            type="radio"
                            className="checked:border-primary checked:bg-primary focus-visible:outline-primary dark:checked:border-primary dark:checked:bg-primary relative size-4 appearance-none rounded-full border border-neutral-300 bg-white before:absolute before:inset-1 before:rounded-full before:bg-white not-checked:before:hidden focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-neutral-600 dark:bg-neutral-900 forced-colors:appearance-auto forced-colors:before:hidden"
                          />
                          <label
                            htmlFor="chime-off"
                            className="text-foreground block text-sm/6 font-medium"
                          >
                            Silent
                          </label>
                        </div>
                      </div>
                    </fieldset>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-x-8 gap-y-10 pb-12 md:grid-cols-3">
                  <div>
                    <h2 className="text-foreground text-base/7 font-semibold">
                      File Deletion
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm/6">
                      Choose whether deleted files are moved to the system trash
                      or permanently removed.
                    </p>
                  </div>

                  <div className="max-w-2xl space-y-10 md:col-span-2">
                    <fieldset>
                      <legend className="text-foreground text-sm/6 font-semibold">
                        When deleting files
                      </legend>
                      <div className="mt-6 space-y-6">
                        <div className="flex items-center gap-x-3">
                          <input
                            checked={trashEnabled}
                            onChange={() => {
                              setTrashEnabled(true);
                              api_put("/api/settings/trash", {
                                enabled: true,
                              }).catch(() => {});
                            }}
                            id="trash-enabled"
                            name="trash"
                            type="radio"
                            className="checked:border-primary checked:bg-primary focus-visible:outline-primary dark:checked:border-primary dark:checked:bg-primary relative size-4 appearance-none rounded-full border border-neutral-300 bg-white before:absolute before:inset-1 before:rounded-full before:bg-white not-checked:before:hidden focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-neutral-600 dark:bg-neutral-900 forced-colors:appearance-auto forced-colors:before:hidden"
                          />
                          <label
                            htmlFor="trash-enabled"
                            className="text-foreground block text-sm/6 font-medium"
                          >
                            Move to Trash
                          </label>
                        </div>
                        <div className="flex items-center gap-x-3">
                          <input
                            checked={!trashEnabled}
                            onChange={() => {
                              setTrashEnabled(false);
                              api_put("/api/settings/trash", {
                                enabled: false,
                              }).catch(() => {});
                            }}
                            id="trash-disabled"
                            name="trash"
                            type="radio"
                            className="checked:border-primary checked:bg-primary focus-visible:outline-primary dark:checked:border-primary dark:checked:bg-primary relative size-4 appearance-none rounded-full border border-neutral-300 bg-white before:absolute before:inset-1 before:rounded-full before:bg-white not-checked:before:hidden focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-neutral-600 dark:bg-neutral-900 forced-colors:appearance-auto forced-colors:before:hidden"
                          />
                          <label
                            htmlFor="trash-disabled"
                            className="text-foreground block text-sm/6 font-medium"
                          >
                            Delete permanently
                          </label>
                        </div>
                      </div>
                    </fieldset>
                  </div>
                </div>
              </div>
            )}

            {/* Providers */}
            {activeSection === "providers" && (
              <div className="space-y-8 pb-12">
                <div className="space-y-6">
                  <div>
                    <h2 className="text-foreground text-base/7 font-semibold">
                      Provider connections
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm/6">
                      Connect direct model APIs or route models through your
                      cloud account. Secrets entered in Trident are encrypted
                      locally.
                    </p>
                  </div>

                  <div className="space-y-6">
                    <p className="sr-only" role="status" aria-live="polite">
                      {providerAnnouncement}
                    </p>

                    {providerError ? (
                      <Alert variant="destructive">
                        <AlertDescription className="flex items-center justify-between gap-3">
                          <span>{providerError}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void loadProviderSettings()}
                          >
                            Retry
                          </Button>
                        </AlertDescription>
                      </Alert>
                    ) : null}

                    {providerLoading ? (
                      <p
                        className="text-muted-foreground py-8 text-sm"
                        role="status"
                      >
                        Loading provider connections...
                      </p>
                    ) : providerError ? null : (
                      PROVIDER_GROUPS.map((group) => (
                        <section
                          key={group.id}
                          className="space-y-3"
                          aria-labelledby={`settings-${group.id}-providers`}
                        >
                          <div>
                            <h3
                              id={`settings-${group.id}-providers`}
                              className="text-foreground text-sm font-semibold"
                            >
                              {group.label}
                            </h3>
                            <p className="text-muted-foreground mt-1 text-xs">
                              {group.description}
                            </p>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            {group.providers.map((provider) => {
                              const definition = PROVIDER_CATALOG[provider];
                              const status =
                                providerSettings.providers[provider];

                              return (
                                <Card
                                  key={provider}
                                  size="sm"
                                  className="gap-3 shadow-none"
                                >
                                  <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-sm">
                                      <ModelSelectorLogo
                                        provider={definition.logo}
                                        className="size-4"
                                        aria-hidden="true"
                                      />
                                      {definition.label}
                                    </CardTitle>
                                    <CardDescription className="text-xs leading-5">
                                      {definition.description}
                                    </CardDescription>
                                    <CardAction>
                                      <span
                                        className={
                                          status.configured
                                            ? "flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                            : "bg-muted text-muted-foreground rounded-full px-2 py-1 text-[10px] font-medium"
                                        }
                                      >
                                        {status.configured ? (
                                          <CheckIcon
                                            className="size-3"
                                            aria-hidden="true"
                                          />
                                        ) : null}
                                        {status.configured
                                          ? "Configured"
                                          : "Not configured"}
                                      </span>
                                    </CardAction>
                                  </CardHeader>
                                  <CardContent className="text-muted-foreground space-y-1 text-xs">
                                    {status.detail ? (
                                      <p>{status.detail}</p>
                                    ) : null}
                                    {status.configured &&
                                    (definition.group === "cloud" ||
                                      status.modelCount > 0) ? (
                                      <p>
                                        {status.modelCount}{" "}
                                        {status.modelCount === 1
                                          ? "model"
                                          : "models"}
                                      </p>
                                    ) : null}
                                  </CardContent>
                                  <CardFooter className="mt-auto gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setProviderAnnouncement("");
                                        setSelectedProvider(provider);
                                      }}
                                    >
                                      {status.configured ? "Edit" : "Configure"}
                                    </Button>
                                    {status.configured ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setRemoveProviderError(null);
                                          setProviderToRemove(provider);
                                        }}
                                      >
                                        <Trash2Icon
                                          className="size-3.5"
                                          aria-hidden="true"
                                        />
                                        Remove
                                      </Button>
                                    ) : null}
                                  </CardFooter>
                                </Card>
                              );
                            })}
                          </div>
                        </section>
                      ))
                    )}
                  </div>
                </div>

                <Dialog
                  open={selectedProvider !== null}
                  onOpenChange={(open) => {
                    if (!open && !providerSaving) setSelectedProvider(null);
                  }}
                >
                  <DialogContent
                    className="flex max-h-[calc(100vh-3rem)] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
                    showCloseButton={!providerSaving}
                    onEscapeKeyDown={(event) => {
                      if (providerSaving) event.preventDefault();
                    }}
                    onInteractOutside={(event) => {
                      if (providerSaving) event.preventDefault();
                    }}
                  >
                    {selectedProvider ? (
                      <>
                        <DialogHeader className="sr-only">
                          <DialogTitle>
                            Configure {PROVIDER_CATALOG[selectedProvider].label}
                          </DialogTitle>
                          <DialogDescription>
                            Test and save this provider connection.
                          </DialogDescription>
                        </DialogHeader>
                        <ProviderConnectionForm
                          key={selectedProvider}
                          provider={selectedProvider}
                          modal
                          configured={
                            providerSettings.providers[selectedProvider]
                              .configured
                          }
                          onSaved={handleProviderSaved}
                          onCancel={() => setSelectedProvider(null)}
                          onSavingChange={setProviderSaving}
                        />
                      </>
                    ) : null}
                  </DialogContent>
                </Dialog>

                <AlertDialog
                  open={providerToRemove !== null}
                  onOpenChange={(open) => {
                    if (!open && !removingProvider) {
                      setProviderToRemove(null);
                      setRemoveProviderError(null);
                    }
                  }}
                >
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove provider?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {providerToRemove
                          ? `${PROVIDER_CATALOG[providerToRemove].label} credentials and model configuration will be removed from Trident.`
                          : "This provider connection will be removed from Trident."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    {removeProviderError ? (
                      <Alert variant="destructive">
                        <AlertDescription>
                          {removeProviderError}
                        </AlertDescription>
                      </Alert>
                    ) : null}
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={removingProvider}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        disabled={removingProvider}
                        onClick={(event) => {
                          event.preventDefault();
                          void handleRemoveProvider();
                        }}
                      >
                        {removingProvider ? "Removing..." : "Remove"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {/* Agents: Agent instructions editor */}
            {activeSection === "agents" && (
              <div className="flex min-h-0 flex-1 flex-col">
                {instructionsError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{instructionsError}</AlertDescription>
                  </Alert>
                )}
                <div className="mb-4 flex items-center justify-between">
                  <select
                    value={selectedAgent}
                    onChange={(e) =>
                      setSelectedAgent(e.target.value as "collaborator")
                    }
                    className="text-foreground focus:border-primary focus:ring-primary appearance-none rounded-md border border-neutral-300 bg-white bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23888%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-size-[16px] bg-position-[right_8px_center] bg-no-repeat py-1.5 pr-8 pl-3 text-sm shadow-sm focus:ring-1 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
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
                      {agentSaving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>

                <div className="border-border min-h-0 flex-1 overflow-y-auto rounded-lg border">
                  {agentLoading ? (
                    <div className="flex h-full items-center justify-center">
                      <p className="text-muted-foreground text-sm">
                        Loading...
                      </p>
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

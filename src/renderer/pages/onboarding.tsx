import { CheckIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useOnboardingComplete } from "@/app";
import { ModelSelectorLogo } from "@/components/ai-elements/model-selector";
import { ProviderConnectionForm } from "@/components/provider-connection-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { api_get } from "@/lib/api";
import {
  PROVIDER_CATALOG,
  PROVIDER_GROUPS,
  emptyProviderSettings,
  type ProviderId,
  type ProviderSettingsResponse,
} from "@/lib/providers";
import appIcon from "../../images/app-icon.png";

export default function Onboarding() {
  useDocumentTitle("Welcome to Trident");
  const navigate = useNavigate();
  const markOnboardingComplete = useOnboardingComplete();
  const [providerSettings, setProviderSettings] = useState(
    emptyProviderSettings,
  );
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(
    null,
  );
  const [showChooser, setShowChooser] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const refreshProviders = useCallback(async () => {
    const data = await api_get<ProviderSettingsResponse>(
      "/api/settings/providers",
    );
    setProviderSettings(data);
    setLoadError(null);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;

    api_get<ProviderSettingsResponse>("/api/settings/providers")
      .then((data) => {
        if (cancelled) return;
        setProviderSettings(data);
        setShowChooser(!data.anyConfigured);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to load provider settings:", error);
        setLoadError(
          "Provider settings could not be loaded. Check that Trident is running and try again.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaved = async (provider: ProviderId) => {
    await refreshProviders();
    setAnnouncement(`${PROVIDER_CATALOG[provider].label} is configured.`);
    setSelectedProvider(null);
    setShowChooser(false);
  };

  const handleRetryLoad = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await refreshProviders();
      setShowChooser(!data.anyConfigured);
    } catch (error) {
      console.error("Failed to load provider settings:", error);
      setLoadError(
        "Provider settings could not be loaded. Check that Trident is running and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (!providerSettings.anyConfigured) return;
    markOnboardingComplete();
    navigate("/");
  };

  const chooseProvider = (provider: ProviderId) => {
    setAnnouncement("");
    setSelectedProvider(provider);
    setShowChooser(false);
  };

  return (
    <>
      <div className="title-bar" />

      <main className="from-background via-background to-primary/5 flex min-h-[calc(100vh-2rem)] justify-center overflow-y-auto bg-gradient-to-b px-6 py-10">
        <div className="w-full max-w-3xl self-start">
          <div className="flex flex-col items-center">
            <img
              src={appIcon}
              alt="Trident"
              className="mb-6 size-20 rounded-lg drop-shadow-lg"
            />

            <h1 className="text-foreground mb-2 text-2xl font-semibold tracking-tight">
              Welcome to Trident
            </h1>
            <p className="text-muted-foreground mb-8 max-w-xl text-center text-sm">
              Connect at least one AI provider. You can add, replace, or remove
              connections later in Settings.
            </p>
          </div>

          <p className="sr-only" role="status" aria-live="polite">
            {announcement}
          </p>

          {loadError ? (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          ) : null}

          {loading ? (
            <p
              className="text-muted-foreground py-12 text-center text-sm"
              role="status"
            >
              Loading provider connections...
            </p>
          ) : loadError ? (
            <div className="flex justify-center py-4">
              <Button variant="outline" onClick={() => void handleRetryLoad()}>
                Retry
              </Button>
            </div>
          ) : selectedProvider ? (
            <div className="bg-card ring-foreground/5 rounded-4xl p-6 shadow-lg ring-1 sm:p-8">
              <ProviderConnectionForm
                key={selectedProvider}
                provider={selectedProvider}
                configured={
                  providerSettings.providers[selectedProvider].configured
                }
                onSaved={handleSaved}
                onCancel={() => {
                  setSelectedProvider(null);
                  setShowChooser(true);
                }}
              />
            </div>
          ) : showChooser || !providerSettings.anyConfigured ? (
            <div className="space-y-8">
              {PROVIDER_GROUPS.map((group) => (
                <section
                  key={group.id}
                  aria-labelledby={`${group.id}-providers`}
                >
                  <div className="mb-3">
                    <h2
                      id={`${group.id}-providers`}
                      className="text-foreground text-sm font-semibold"
                    >
                      {group.label}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {group.description}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {group.providers.map((provider) => {
                      const definition = PROVIDER_CATALOG[provider];
                      const status = providerSettings.providers[provider];

                      return (
                        <button
                          key={provider}
                          type="button"
                          onClick={() => chooseProvider(provider)}
                          className="bg-card hover:bg-accent/50 focus-visible:ring-ring group flex min-h-36 flex-col items-start rounded-3xl p-4 text-left shadow-sm ring-1 ring-black/5 transition-colors outline-none focus-visible:ring-2 dark:ring-white/10"
                        >
                          <div className="mb-4 flex w-full items-center justify-between gap-3">
                            <span className="bg-muted flex size-9 items-center justify-center rounded-xl">
                              <ModelSelectorLogo
                                provider={definition.logo}
                                className="size-5"
                                aria-hidden="true"
                              />
                            </span>
                            {status.configured ? (
                              <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <CheckIcon
                                  className="size-3"
                                  aria-hidden="true"
                                />
                                Configured
                              </span>
                            ) : null}
                          </div>
                          <span className="text-foreground text-sm font-medium">
                            {definition.label}
                          </span>
                          <span className="text-muted-foreground mt-1 text-xs leading-5">
                            {definition.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}

              {providerSettings.anyConfigured ? (
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowChooser(false)}
                  >
                    Back
                  </Button>
                  <Button onClick={handleContinue}>Continue to Trident</Button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="bg-card rounded-4xl p-8 text-center shadow-lg ring-1 ring-black/5 dark:ring-white/10">
              <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <CheckIcon className="size-6" aria-hidden="true" />
              </span>
              <h2 className="text-foreground text-lg font-semibold">
                Provider connected
              </h2>
              <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
                Trident is ready to use. You can connect another provider now or
                continue and start a project.
              </p>
              <div className="mt-6 flex flex-col-reverse justify-center gap-3 sm:flex-row">
                <Button variant="outline" onClick={() => setShowChooser(true)}>
                  Add another provider
                </Button>
                <Button onClick={handleContinue}>Continue to Trident</Button>
              </div>
            </div>
          )}

          <p className="text-muted-foreground/70 mt-6 text-center text-xs">
            Secrets entered in Trident are encrypted and stored locally. Cloud
            profile credentials remain in their standard system locations.
          </p>
        </div>
      </main>
    </>
  );
}

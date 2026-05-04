import { useNavigate } from "react-router-dom";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { api_put, isApiError } from "@/lib/api";
import { useOnboardingComplete } from "@/app";
import { EyeIcon, EyeOffIcon, KeyRoundIcon } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { ModelSelectorLogo } from "@/components/ai-elements/model-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import appIcon from "../../images/app-icon.png";

type FieldErrors = {
  anthropic_key?: string;
  openai_key?: string;
  gemini_key?: string;
};

export default function Onboarding() {
  useDocumentTitle("Welcome to Trident");
  const navigate = useNavigate();
  const markOnboardingComplete = useOnboardingComplete();
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const hasAtLeastOneKey =
    anthropicKey.trim().length > 0 ||
    openaiKey.trim().length > 0 ||
    geminiKey.trim().length > 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!hasAtLeastOneKey) {
      setError("Please enter at least one API key to continue.");

      return;
    }

    setSaving(true);
    setError("");
    setFieldErrors({});

    try {
      await api_put("/api/settings/api-keys", {
        anthropic_key: anthropicKey.trim() || null,
        openai_key: openaiKey.trim() || null,
        gemini_key: geminiKey.trim() || null,
      });
      markOnboardingComplete();
      navigate("/");
    } catch (err) {
      if (isApiError(err) && err.status === 422) {
        const errors =
          (err.response as { errors?: Record<string, string[]> })?.errors ?? {};
        const mapped: FieldErrors = {};
        for (const [field, messages] of Object.entries(errors)) {
          if (
            field === "anthropic_key" ||
            field === "openai_key" ||
            field === "gemini_key"
          ) {
            mapped[field] = Array.isArray(messages)
              ? messages[0]
              : String(messages);
          }
        }
        setFieldErrors(mapped);
        setError("Please fix the errors below and try again.");
      } else {
        setError("Failed to save API keys. Please try again.");
        console.error(err);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="title-bar" />

      <div className="from-background via-background to-primary/5 flex min-h-[calc(100vh-2rem)] items-center justify-center bg-gradient-to-b">
        <div className="w-full max-w-md px-6">
          <div className="flex flex-col items-center">
            <img
              src={appIcon}
              alt="Trident"
              className="mb-6 size-20 rounded-lg drop-shadow-lg"
            />

            <h1 className="text-foreground mb-2 text-2xl font-semibold tracking-tight">
              Welcome to Trident
            </h1>
            <p className="text-muted-foreground mb-8 text-center text-sm">
              Add at least one API key to get started. You can always update
              these later in settings.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-foreground flex items-center gap-2 text-sm font-medium">
                <ModelSelectorLogo provider="anthropic" className="size-4" />
                Anthropic
              </label>
              <div className="relative">
                <KeyRoundIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  type={showAnthropic ? "text" : "password"}
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="pr-9 pl-9"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowAnthropic(!showAnthropic)}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
                  tabIndex={-1}
                >
                  {showAnthropic ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </button>
              </div>
              {fieldErrors.anthropic_key && (
                <p className="text-destructive text-xs">
                  {fieldErrors.anthropic_key}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-foreground flex items-center gap-2 text-sm font-medium">
                <ModelSelectorLogo provider="openai" className="size-4" />
                OpenAI
              </label>
              <div className="relative">
                <KeyRoundIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  type={showOpenai ? "text" : "password"}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  className="pr-9 pl-9"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowOpenai(!showOpenai)}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
                  tabIndex={-1}
                >
                  {showOpenai ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </button>
              </div>
              {fieldErrors.openai_key && (
                <p className="text-destructive text-xs">
                  {fieldErrors.openai_key}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-foreground flex items-center gap-2 text-sm font-medium">
                <ModelSelectorLogo provider="gemini" className="size-4" />
                Gemini
              </label>
              <div className="relative">
                <KeyRoundIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  type={showGemini ? "text" : "password"}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIza..."
                  className="pr-9 pl-9"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowGemini(!showGemini)}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
                  tabIndex={-1}
                >
                  {showGemini ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </button>
              </div>
              {fieldErrors.gemini_key && (
                <p className="text-destructive text-xs">
                  {fieldErrors.gemini_key}
                </p>
              )}
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <Button
              type="submit"
              disabled={!hasAtLeastOneKey || saving}
              className="w-full"
            >
              {saving ? "Saving..." : "Get Started"}
            </Button>
          </form>

          <p className="text-muted-foreground/60 mt-6 text-center text-xs">
            Keys are encrypted and stored locally on your device.
          </p>
        </div>
      </div>
    </>
  );
}

import { EyeIcon, EyeOffIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";

import { ModelSelectorLogo } from "@/components/ai-elements/model-selector";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api_put, isApiError } from "@/lib/api";
import { PROVIDER_CATALOG, type ProviderId } from "@/lib/providers";

type BedrockAuthType = "accessKey" | "profile" | "apiKey";
type VertexAuthType = "apiKey" | "serviceAccount" | "adc";

interface ModelRow {
  key: number;
  id: string;
  baseModelId: string;
}

interface ProviderFormState {
  apiKey: string;
  bedrockAuthType: BedrockAuthType;
  vertexAuthType: VertexAuthType;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  serviceAccountJson: string;
  project: string;
  location: string;
  endpoint: string;
  apiVersion: string;
  models: ModelRow[];
}

type FieldErrors = Record<string, string>;

let nextModelRowKey = 1;

function createModelRow(): ModelRow {
  return { key: nextModelRowKey++, id: "", baseModelId: "" };
}

function initialState(provider: ProviderId): ProviderFormState {
  return {
    apiKey: "",
    bedrockAuthType: "profile",
    vertexAuthType: "adc",
    region: "us-east-1",
    accessKeyId: "",
    secretAccessKey: "",
    sessionToken: "",
    serviceAccountJson: "",
    project: "",
    location: "us-central1",
    endpoint: "",
    apiVersion: "",
    models:
      provider === "bedrock" || provider === "vertex" || provider === "azure"
        ? [createModelRow()]
        : [],
  };
}

// The field a provider's models are reported under, matching the key the
// server returns errors on. Azure calls them deployments; keeping one source
// for the name stops client- and server-side errors landing in two different
// namespaces where only one of them gets displayed or cleared.
function modelCollectionKey(provider: ProviderId): "models" | "deployments" {
  return provider === "azure" ? "deployments" : "models";
}

function isDirectProvider(provider: ProviderId): boolean {
  return (
    provider === "anthropic" || provider === "openai" || provider === "gemini"
  );
}

function validateForm(
  provider: ProviderId,
  values: ProviderFormState,
): FieldErrors {
  const errors: FieldErrors = {};

  if (isDirectProvider(provider) && !values.apiKey.trim()) {
    errors.apiKey = "Enter an API key.";
  }

  if (provider === "bedrock") {
    if (!values.region.trim()) errors.region = "Enter an AWS region.";
    if (values.bedrockAuthType === "accessKey") {
      if (!values.accessKeyId.trim()) {
        errors.accessKeyId = "Enter an access key ID.";
      }
      if (!values.secretAccessKey.trim()) {
        errors.secretAccessKey = "Enter a secret access key.";
      }
    }
    if (values.bedrockAuthType === "apiKey" && !values.apiKey.trim()) {
      errors.apiKey = "Enter a Bedrock API key.";
    }
  }

  if (provider === "vertex") {
    let serviceAccountProjectId = "";
    if (!values.location.trim()) {
      errors.location = "Enter a Google Cloud location.";
    }
    if (values.vertexAuthType === "apiKey" && !values.apiKey.trim()) {
      errors.apiKey = "Enter a Vertex AI API key.";
    }
    if (
      values.vertexAuthType === "serviceAccount" &&
      !values.serviceAccountJson.trim()
    ) {
      errors.serviceAccountJson = "Paste the service account JSON.";
    } else if (
      values.vertexAuthType === "serviceAccount" &&
      values.serviceAccountJson.trim()
    ) {
      try {
        const parsed = JSON.parse(values.serviceAccountJson) as Record<
          string,
          unknown
        >;
        if (typeof parsed.project_id === "string") {
          serviceAccountProjectId = parsed.project_id.trim();
        }
      } catch {
        errors.serviceAccountJson = "Enter valid service account JSON.";
      }
    }
    if (
      values.vertexAuthType !== "apiKey" &&
      !values.project.trim() &&
      !serviceAccountProjectId
    ) {
      errors.project = "Enter a Google Cloud project ID.";
    }
  }

  if (provider === "azure") {
    if (!values.apiKey.trim()) errors.apiKey = "Enter an Azure API key.";
    if (!values.endpoint.trim()) errors.endpoint = "Enter an Azure endpoint.";
  }

  if (provider === "bedrock" || provider === "vertex" || provider === "azure") {
    const collectionKey = modelCollectionKey(provider);
    values.models.forEach((model, index) => {
      if (!model.id.trim()) {
        errors[`${collectionKey}.${index}.id`] =
          provider === "azure"
            ? "Enter a deployment name."
            : "Enter a model ID.";
      }
    });
  }

  return errors;
}

function normalizeModels(models: ModelRow[]) {
  return models.map(({ id, baseModelId }) => ({
    id: id.trim(),
    ...(baseModelId.trim() ? { baseModelId: baseModelId.trim() } : {}),
  }));
}

function requestBody(provider: ProviderId, values: ProviderFormState): unknown {
  if (isDirectProvider(provider)) {
    return { apiKey: values.apiKey.trim() };
  }

  if (provider === "bedrock") {
    return {
      authType: values.bedrockAuthType,
      region: values.region.trim(),
      ...(values.bedrockAuthType === "accessKey"
        ? {
            accessKeyId: values.accessKeyId.trim(),
            secretAccessKey: values.secretAccessKey.trim(),
            ...(values.sessionToken.trim()
              ? { sessionToken: values.sessionToken.trim() }
              : {}),
          }
        : {}),
      ...(values.bedrockAuthType === "apiKey"
        ? { apiKey: values.apiKey.trim() }
        : {}),
      models: normalizeModels(values.models),
    };
  }

  if (provider === "vertex") {
    return {
      authType: values.vertexAuthType,
      ...(values.vertexAuthType === "apiKey"
        ? { apiKey: values.apiKey.trim() }
        : {}),
      ...(values.vertexAuthType === "serviceAccount"
        ? { serviceAccountJson: values.serviceAccountJson.trim() }
        : {}),
      ...(values.vertexAuthType !== "apiKey" && values.project.trim()
        ? { project: values.project.trim() }
        : {}),
      location: values.location.trim(),
      models: normalizeModels(values.models),
    };
  }

  return {
    apiKey: values.apiKey.trim(),
    endpoint: values.endpoint.trim(),
    ...(values.apiVersion.trim()
      ? { apiVersion: values.apiVersion.trim() }
      : {}),
    deployments: normalizeModels(values.models),
  };
}

function responseErrors(error: unknown): {
  message: string;
  fields: FieldErrors;
} {
  if (!isApiError(error)) {
    return {
      message:
        "Could not save this provider. Check your connection and try again.",
      fields: {},
    };
  }

  const response =
    typeof error.response === "object" && error.response !== null
      ? (error.response as {
          error?: string;
          message?: string;
          errors?: Record<string, string[] | string>;
        })
      : null;
  const fields = Object.fromEntries(
    Object.entries(response?.errors ?? {}).map(([field, messages]) => [
      field,
      Array.isArray(messages) ? messages[0] : messages,
    ]),
  );
  const firstFieldMessage = Object.values(fields).find(Boolean);

  return {
    message:
      response?.error ??
      response?.message ??
      firstFieldMessage ??
      "The provider connection could not be saved. Check its settings and try again.",
    fields,
  };
}

interface FieldShellProps {
  id: string;
  label: string;
  error?: string;
  help?: string;
  children: ReactNode;
}

function FieldShell({ id, label, error, help, children }: FieldShellProps) {
  return (
    <div className="space-y-3">
      <label htmlFor={id} className="text-foreground text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-destructive text-xs">
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="text-muted-foreground text-xs">
          {help}
        </p>
      ) : null}
    </div>
  );
}

interface SecretFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  help?: string;
  placeholder?: string;
  autoComplete?: string;
}

function SecretField({
  id,
  label,
  value,
  onChange,
  error,
  help,
  placeholder,
  autoComplete = "new-password",
}: SecretFieldProps) {
  const [visible, setVisible] = useState(false);
  const descriptionId = error ? `${id}-error` : help ? `${id}-help` : undefined;

  return (
    <FieldShell id={id} label={label} error={error} help={help}>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="pr-10"
          autoComplete={autoComplete}
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={descriptionId}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md outline-none focus-visible:ring-2"
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
        >
          {visible ? (
            <EyeOffIcon className="size-4" aria-hidden="true" />
          ) : (
            <EyeIcon className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </FieldShell>
  );
}

interface ModelRowsProps {
  idPrefix: string;
  provider: ProviderId;
  rows: ModelRow[];
  errors: FieldErrors;
  onChange: (rows: ModelRow[]) => void;
}

function ModelRows({
  idPrefix,
  provider,
  rows,
  errors,
  onChange,
}: ModelRowsProps) {
  const isAzure = provider === "azure";
  const collectionKey = modelCollectionKey(provider);
  const collectionError = errors[collectionKey];
  const collectionErrorId = `${idPrefix}-${collectionKey}-error`;

  const updateRow = (
    index: number,
    field: "id" | "baseModelId",
    value: string,
  ) => {
    onChange(
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    );
  };

  return (
    <fieldset
      className={`space-y-3 rounded-2xl border p-4 ${collectionError ? "border-destructive" : "border-border"}`}
      aria-invalid={collectionError ? true : undefined}
      aria-describedby={collectionError ? collectionErrorId : undefined}
      tabIndex={collectionError ? -1 : undefined}
    >
      <legend className="text-foreground px-1 text-sm font-medium">
        {isAzure ? "Model deployments" : "Models"}
      </legend>
      <p className="text-muted-foreground text-xs">
        {isAzure
          ? "Add each Azure deployment name you want available in Trident."
          : "Add each provider model ID you want available in Trident."}
      </p>
      {collectionError ? (
        <p id={collectionErrorId} className="text-destructive text-xs">
          {collectionError}
        </p>
      ) : null}
      {rows.map((row, index) => {
        const modelId = `${idPrefix}-model-${row.key}`;
        const baseModelId = `${modelId}-base`;
        const modelError = errors[`${collectionKey}.${index}.id`];
        const baseModelError = errors[`${collectionKey}.${index}.baseModelId`];

        return (
          <div
            key={row.key}
            className="bg-muted/30 border-border space-y-3 rounded-xl border p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-foreground text-xs font-medium">
                {isAzure ? "Deployment" : "Model"} {index + 1}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChange(rows.filter((item) => item.key !== row.key))
                }
                disabled={rows.length === 1}
                aria-label={`Remove ${isAzure ? "deployment" : "model"} ${index + 1}`}
              >
                <Trash2Icon className="size-3.5" aria-hidden="true" />
                Remove
              </Button>
            </div>
            <FieldShell
              id={modelId}
              label={isAzure ? "Deployment name" : "Model ID"}
              error={modelError}
            >
              <Input
                id={modelId}
                value={row.id}
                onChange={(event) => updateRow(index, "id", event.target.value)}
                placeholder={
                  isAzure ? "my-gpt-deployment" : "Provider model ID"
                }
                spellCheck={false}
                aria-invalid={modelError ? true : undefined}
                aria-describedby={modelError ? `${modelId}-error` : undefined}
              />
            </FieldShell>
            <FieldShell
              id={baseModelId}
              label="Base model ID (optional)"
              error={baseModelError}
              help="Used to identify capabilities and pricing when the provider ID is an alias."
            >
              <Input
                id={baseModelId}
                value={row.baseModelId}
                onChange={(event) =>
                  updateRow(index, "baseModelId", event.target.value)
                }
                placeholder="gpt-5 or claude-sonnet-4-6"
                spellCheck={false}
                aria-invalid={baseModelError ? true : undefined}
                aria-describedby={
                  baseModelError
                    ? `${baseModelId}-error`
                    : `${baseModelId}-help`
                }
              />
            </FieldShell>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...rows, createModelRow()])}
      >
        <PlusIcon className="size-4" aria-hidden="true" />
        Add {isAzure ? "deployment" : "model"}
      </Button>
    </fieldset>
  );
}

export interface ProviderConnectionFormProps {
  provider: ProviderId;
  configured?: boolean;
  modal?: boolean;
  onSaved: (provider: ProviderId) => void | Promise<void>;
  onCancel?: () => void;
  onSavingChange?: (saving: boolean) => void;
}

export function ProviderConnectionForm({
  provider,
  configured = false,
  modal = false,
  onSaved,
  onCancel,
  onSavingChange,
}: ProviderConnectionFormProps) {
  const definition = PROVIDER_CATALOG[provider];
  const generatedId = useId().replaceAll(":", "");
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState(() => initialState(provider));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValues(initialState(provider));
    setErrors({});
    setFormError(null);
  }, [provider]);

  const updateField = <Field extends keyof ProviderFormState>(
    field: Field,
    value: ProviderFormState[Field],
  ) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFormError(null);
    setErrors((current) => {
      const clearsModelErrors = field === "models";
      const next = { ...current };
      delete next[field];
      if (field === "bedrockAuthType") {
        delete next.authType;
        delete next.accessKeyId;
        delete next.secretAccessKey;
        delete next.sessionToken;
        delete next.apiKey;
      }
      if (field === "vertexAuthType") {
        delete next.authType;
        delete next.apiKey;
        delete next.project;
        delete next.serviceAccountJson;
      }
      if (field === "serviceAccountJson") delete next.project;
      if (clearsModelErrors) {
        // Azure reports this collection as "deployments" while the form field
        // is "models", so clear the collection-level key by its reported name
        // as well as every per-row key beneath it.
        const collectionKey = modelCollectionKey(provider);
        delete next[collectionKey];
        for (const key of Object.keys(next)) {
          if (key.startsWith(`${collectionKey}.`)) delete next[key];
        }
      }
      return next;
    });
  };

  const focusFirstError = () => {
    requestAnimationFrame(() => {
      formRef.current
        ?.querySelector<HTMLElement>("[aria-invalid='true']")
        ?.focus();
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateForm(provider, values);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setFormError("Review the highlighted fields and try again.");
      focusFirstError();
      return;
    }

    setSaving(true);
    onSavingChange?.(true);
    setErrors({});
    setFormError(null);
    let providerWasSaved = false;

    try {
      await api_put(
        `/api/settings/providers/${provider}`,
        requestBody(provider, values),
      );
      providerWasSaved = true;
      await onSaved(provider);
    } catch (error) {
      console.error(`Failed to save ${provider} provider:`, error);
      if (providerWasSaved) {
        setFormError(
          `${definition.label} was saved, but its status could not be refreshed. Close this form and try again.`,
        );
      } else {
        const parsed = responseErrors(error);
        setErrors(parsed.fields);
        setFormError(parsed.message);
        focusFirstError();
      }
    } finally {
      setSaving(false);
      onSavingChange?.(false);
    }
  };

  const apiKeyId = `${generatedId}-api-key`;
  const regionId = `${generatedId}-region`;
  const accessKeyId = `${generatedId}-access-key-id`;
  const secretAccessKeyId = `${generatedId}-secret-access-key`;
  const sessionTokenId = `${generatedId}-session-token`;
  const serviceAccountId = `${generatedId}-service-account`;
  const projectId = `${generatedId}-project`;
  const locationId = `${generatedId}-location`;
  const endpointId = `${generatedId}-endpoint`;
  const apiVersionId = `${generatedId}-api-version`;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className={modal ? "flex min-h-0 flex-1 flex-col" : "space-y-5"}
      aria-busy={saving}
      noValidate
    >
      <div
        className={
          modal
            ? "border-border flex shrink-0 items-start gap-3 border-b px-6 py-5 pr-16"
            : "flex items-start gap-3"
        }
      >
        <ModelSelectorLogo
          provider={definition.logo}
          className="mt-0.5 size-6"
          aria-hidden="true"
        />
        <div>
          <h2 className="text-foreground text-base font-semibold">
            {configured ? `Reconfigure ${definition.label}` : definition.label}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {definition.description}
          </p>
          {configured ? (
            <p className="text-muted-foreground mt-1 text-xs">
              Saving replaces the existing connection. Re-enter all required
              credentials and settings.
            </p>
          ) : null}
        </div>
      </div>

      <div
        className={
          modal
            ? "min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5"
            : "space-y-5"
        }
      >
        {formError ? (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        {isDirectProvider(provider) ? (
          <SecretField
            id={apiKeyId}
            label={`${definition.label} API key`}
            value={values.apiKey}
            onChange={(value) => updateField("apiKey", value)}
            error={errors.apiKey}
            placeholder={
              provider === "anthropic"
                ? "sk-ant-..."
                : provider === "gemini"
                  ? "AIza..."
                  : "sk-..."
            }
          />
        ) : null}

        {provider === "bedrock" ? (
          <>
            <FieldShell
              id={`${generatedId}-bedrock-auth`}
              label="Authentication"
              error={errors.authType}
              help="Use the default AWS credential chain, long-lived access keys, or a Bedrock API key."
            >
              <Select
                value={values.bedrockAuthType}
                onValueChange={(value) =>
                  updateField("bedrockAuthType", value as BedrockAuthType)
                }
              >
                <SelectTrigger
                  id={`${generatedId}-bedrock-auth`}
                  className="w-full"
                  aria-invalid={errors.authType ? true : undefined}
                  aria-describedby={
                    errors.authType
                      ? `${generatedId}-bedrock-auth-error`
                      : `${generatedId}-bedrock-auth-help`
                  }
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="profile">Default AWS profile</SelectItem>
                  <SelectItem value="accessKey">Access keys</SelectItem>
                  <SelectItem value="apiKey">Bedrock API key</SelectItem>
                </SelectContent>
              </Select>
            </FieldShell>
            <FieldShell id={regionId} label="AWS region" error={errors.region}>
              <Input
                id={regionId}
                value={values.region}
                onChange={(event) => updateField("region", event.target.value)}
                placeholder="us-east-1"
                spellCheck={false}
                aria-invalid={errors.region ? true : undefined}
                aria-describedby={
                  errors.region ? `${regionId}-error` : undefined
                }
              />
            </FieldShell>
            {values.bedrockAuthType === "accessKey" ? (
              <>
                <SecretField
                  id={accessKeyId}
                  label="AWS access key ID"
                  value={values.accessKeyId}
                  onChange={(value) => updateField("accessKeyId", value)}
                  error={errors.accessKeyId}
                  autoComplete="off"
                />
                <SecretField
                  id={secretAccessKeyId}
                  label="AWS secret access key"
                  value={values.secretAccessKey}
                  onChange={(value) => updateField("secretAccessKey", value)}
                  error={errors.secretAccessKey}
                />
                <SecretField
                  id={sessionTokenId}
                  label="AWS session token (optional)"
                  value={values.sessionToken}
                  onChange={(value) => updateField("sessionToken", value)}
                  error={errors.sessionToken}
                />
              </>
            ) : null}
            {values.bedrockAuthType === "apiKey" ? (
              <SecretField
                id={apiKeyId}
                label="Bedrock API key"
                value={values.apiKey}
                onChange={(value) => updateField("apiKey", value)}
                error={errors.apiKey}
              />
            ) : null}
            {values.bedrockAuthType === "profile" ? (
              <p className="bg-muted/40 text-muted-foreground rounded-xl p-3 text-xs">
                Trident will use credentials already available through the
                default AWS credential chain on this Mac.
              </p>
            ) : null}
            <ModelRows
              idPrefix={generatedId}
              provider={provider}
              rows={values.models}
              errors={errors}
              onChange={(models) => updateField("models", models)}
            />
          </>
        ) : null}

        {provider === "vertex" ? (
          <>
            <FieldShell
              id={`${generatedId}-vertex-auth`}
              label="Authentication"
              error={errors.authType}
              help="Use Application Default Credentials, a service account, or Vertex AI Express mode."
            >
              <Select
                value={values.vertexAuthType}
                onValueChange={(value) =>
                  updateField("vertexAuthType", value as VertexAuthType)
                }
              >
                <SelectTrigger
                  id={`${generatedId}-vertex-auth`}
                  className="w-full"
                  aria-invalid={errors.authType ? true : undefined}
                  aria-describedby={
                    errors.authType
                      ? `${generatedId}-vertex-auth-error`
                      : `${generatedId}-vertex-auth-help`
                  }
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adc">
                    Application Default Credentials
                  </SelectItem>
                  <SelectItem value="serviceAccount">
                    Service account JSON
                  </SelectItem>
                  <SelectItem value="apiKey">Vertex AI API key</SelectItem>
                </SelectContent>
              </Select>
            </FieldShell>
            {values.vertexAuthType === "apiKey" ? (
              <SecretField
                id={apiKeyId}
                label="Vertex AI API key"
                value={values.apiKey}
                onChange={(value) => updateField("apiKey", value)}
                error={errors.apiKey}
              />
            ) : null}
            {values.vertexAuthType === "serviceAccount" ? (
              <FieldShell
                id={serviceAccountId}
                label="Service account JSON"
                error={errors.serviceAccountJson}
                help="The private key is encrypted before it is stored locally."
              >
                <Textarea
                  id={serviceAccountId}
                  value={values.serviceAccountJson}
                  onChange={(event) =>
                    updateField("serviceAccountJson", event.target.value)
                  }
                  className="min-h-32 font-mono text-xs"
                  placeholder='{"type":"service_account", ...}'
                  spellCheck={false}
                  aria-invalid={errors.serviceAccountJson ? true : undefined}
                  aria-describedby={
                    errors.serviceAccountJson
                      ? `${serviceAccountId}-error`
                      : `${serviceAccountId}-help`
                  }
                />
              </FieldShell>
            ) : null}
            {values.vertexAuthType === "adc" ? (
              <p className="bg-muted/40 text-muted-foreground rounded-xl p-3 text-xs">
                Trident will use Application Default Credentials already
                available on this Mac.
              </p>
            ) : null}
            {values.vertexAuthType !== "apiKey" ? (
              <FieldShell
                id={projectId}
                label={`Google Cloud project ID${values.vertexAuthType === "serviceAccount" ? " (optional when included in JSON)" : ""}`}
                error={errors.project}
                help={
                  values.vertexAuthType === "serviceAccount"
                    ? "Leave blank only when the service account JSON includes project_id."
                    : "Required for Vertex AI routing."
                }
              >
                <Input
                  id={projectId}
                  value={values.project}
                  onChange={(event) =>
                    updateField("project", event.target.value)
                  }
                  placeholder="my-cloud-project"
                  spellCheck={false}
                  aria-invalid={errors.project ? true : undefined}
                  aria-describedby={
                    errors.project ? `${projectId}-error` : `${projectId}-help`
                  }
                />
              </FieldShell>
            ) : null}
            <FieldShell
              id={locationId}
              label="Google Cloud location"
              error={errors.location}
            >
              <Input
                id={locationId}
                value={values.location}
                onChange={(event) =>
                  updateField("location", event.target.value)
                }
                placeholder="us-central1"
                spellCheck={false}
                aria-invalid={errors.location ? true : undefined}
                aria-describedby={
                  errors.location ? `${locationId}-error` : undefined
                }
              />
            </FieldShell>
            <ModelRows
              idPrefix={generatedId}
              provider={provider}
              rows={values.models}
              errors={errors}
              onChange={(models) => updateField("models", models)}
            />
          </>
        ) : null}

        {provider === "azure" ? (
          <>
            <SecretField
              id={apiKeyId}
              label="Azure API key"
              value={values.apiKey}
              onChange={(value) => updateField("apiKey", value)}
              error={errors.apiKey}
            />
            <FieldShell
              id={endpointId}
              label="Azure OpenAI endpoint"
              error={errors.endpoint}
              help="Use the endpoint shown for your Azure OpenAI resource."
            >
              <Input
                id={endpointId}
                type="url"
                value={values.endpoint}
                onChange={(event) =>
                  updateField("endpoint", event.target.value)
                }
                placeholder="https://my-resource.openai.azure.com"
                spellCheck={false}
                aria-invalid={errors.endpoint ? true : undefined}
                aria-describedby={
                  errors.endpoint ? `${endpointId}-error` : `${endpointId}-help`
                }
              />
            </FieldShell>
            <FieldShell
              id={apiVersionId}
              label="API version (optional)"
              error={errors.apiVersion}
              help="Leave blank to use Trident’s default Azure API version."
            >
              <Input
                id={apiVersionId}
                value={values.apiVersion}
                onChange={(event) =>
                  updateField("apiVersion", event.target.value)
                }
                placeholder="v1"
                spellCheck={false}
                aria-invalid={errors.apiVersion ? true : undefined}
                aria-describedby={
                  errors.apiVersion
                    ? `${apiVersionId}-error`
                    : `${apiVersionId}-help`
                }
              />
            </FieldShell>
            <ModelRows
              idPrefix={generatedId}
              provider={provider}
              rows={values.models}
              errors={errors}
              onChange={(models) => updateField("models", models)}
            />
          </>
        ) : null}
      </div>

      <div
        className={
          modal
            ? "border-border flex shrink-0 flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end"
            : "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
        }
      >
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={saving}>
          {saving
            ? "Testing connection..."
            : configured
              ? "Test and save changes"
              : "Test and save"}
        </Button>
      </div>
    </form>
  );
}

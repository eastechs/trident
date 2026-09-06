import { Router } from "express";
import { nativeTheme } from "electron";
import {
  deleteGatewayProviderConfig,
  getSetting,
  setSetting,
  setApiKey,
  deleteApiKey,
  getProviderStatusResponse,
  isApiKeyEncryptionAvailable,
  setGatewayProviderConfig,
} from "../settings.js";
import {
  isDirectProviderId,
  isGatewayProviderId,
  isProviderId,
  type GatewayProviderConfig,
} from "../ai/provider-config.js";
import {
  parseGatewayProviderPayload,
  validateDirectProviderConnection,
  validateGatewayProviderConnection,
} from "../ai/provider-validation.js";

const router = Router();

// ─── Theme ─────────────────────────────────────────────────

router.get("/theme", (_req, res) => {
  res.json({ theme: getSetting("theme") });
});

router.put("/theme", (req, res) => {
  const theme: unknown = req.body?.theme;
  if (theme !== "system" && theme !== "light" && theme !== "dark") {
    res
      .status(422)
      .json({ errors: { theme: ["Choose System, Light, or Dark."] } });
    return;
  }
  setSetting("theme", theme);
  // Electron updates prefers-color-scheme and native chrome in every window.
  nativeTheme.themeSource = theme;
  res.json({ theme });
});

// ─── Autosave ──────────────────────────────────────────────

router.get("/autosave", (_req, res) => {
  res.json({ enabled: getSetting("autosave") });
});

router.put("/autosave", (req, res) => {
  setSetting("autosave", !!req.body.enabled);
  res.json({ enabled: getSetting("autosave") });
});

// ─── Notifications ─────────────────────────────────────────

router.get("/notifications", (_req, res) => {
  res.json({ enabled: getSetting("notifications") });
});

router.put("/notifications", (req, res) => {
  setSetting("notifications", !!req.body.enabled);
  res.json({ enabled: getSetting("notifications") });
});

// ─── Agent chime ───────────────────────────────────────────

router.get("/agent-chime", (_req, res) => {
  res.json({ enabled: getSetting("agentChime") });
});

router.put("/agent-chime", (req, res) => {
  setSetting("agentChime", !!req.body.enabled);
  res.json({ enabled: getSetting("agentChime") });
});

// ─── Trash ─────────────────────────────────────────────────

router.get("/trash", (_req, res) => {
  res.json({ enabled: getSetting("useTrash") });
});

router.put("/trash", (req, res) => {
  setSetting("useTrash", !!req.body.enabled);
  res.json({ enabled: getSetting("useTrash") });
});

// ─── Project tour ──────────────────────────────────────────

router.put("/project-tour", (_req, res) => {
  setSetting("projectTourCompleted", true);
  res.json({ success: true });
});

// ─── Providers ─────────────────────────────────────────────

router.get("/providers", (_req, res) => {
  // This intentionally returns status and nonsecret detail only. Credential
  // material never leaves the main process after it is stored.
  res.json(getProviderStatusResponse());
});

function gatewayConfigHasSecrets(config: GatewayProviderConfig): boolean {
  if (config.provider === "bedrock") return config.authType !== "profile";
  if (config.provider === "vertex") return config.authType !== "adc";
  return true;
}

router.put("/providers/:provider", async (req, res) => {
  const provider = req.params.provider;
  if (!isProviderId(provider)) {
    res.status(404).json({ error: "Unknown provider." });
    return;
  }

  const { invalidateModelCache } = await import("../ai/model-registry.js");

  if (isDirectProviderId(provider)) {
    const apiKey =
      typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";
    if (!apiKey) {
      res.status(422).json({ errors: { apiKey: ["API key is required."] } });
      return;
    }
    if (!isApiKeyEncryptionAvailable()) {
      res.status(422).json({
        errors: {
          apiKey: [
            "Cannot securely store this API key because the OS keychain is unavailable.",
          ],
        },
      });
      return;
    }

    const errors = await validateDirectProviderConnection(provider, apiKey);
    if (Object.keys(errors).length > 0) {
      res.status(422).json({ errors });
      return;
    }

    setApiKey(provider, apiKey);
    invalidateModelCache(provider);
    setSetting("onboardingCompleted", true);
    res.json(getProviderStatusResponse());
    return;
  }

  const parsed = parseGatewayProviderPayload(provider, req.body);
  if (!parsed.config || Object.keys(parsed.errors).length > 0) {
    res.status(422).json({ errors: parsed.errors });
    return;
  }
  if (
    gatewayConfigHasSecrets(parsed.config) &&
    !isApiKeyEncryptionAvailable()
  ) {
    res.status(422).json({
      errors: {
        authType: [
          "Cannot securely store these credentials because the OS keychain is unavailable.",
        ],
      },
    });
    return;
  }

  const errors = await validateGatewayProviderConnection(parsed.config);
  if (Object.keys(errors).length > 0) {
    res.status(422).json({ errors });
    return;
  }

  // This is the only write in the gateway PUT path. Parsing and connection
  // validation above cannot partially replace an existing connection.
  setGatewayProviderConfig(parsed.config);
  invalidateModelCache(provider);
  setSetting("onboardingCompleted", true);
  res.json(getProviderStatusResponse());
});

router.delete("/providers/:provider", async (req, res) => {
  const provider = req.params.provider;
  if (!isProviderId(provider)) {
    res.status(404).json({ error: "Unknown provider." });
    return;
  }

  const { invalidateModelCache } = await import("../ai/model-registry.js");
  if (isDirectProviderId(provider)) {
    deleteApiKey(provider);
  } else if (isGatewayProviderId(provider)) {
    deleteGatewayProviderConfig(provider);
  }
  invalidateModelCache(provider);
  res.json(getProviderStatusResponse());
});

// ─── Models ────────────────────────────────────────────────

router.get("/models", async (_req, res) => {
  const { fetchAvailableModels } = await import("../ai/model-registry.js");
  const { lookupPricing } = await import("../ai/pricing.js");
  const models = await fetchAvailableModels();
  // Attach normalized pricing + context-window data per model. Renderer
  // consumes pricing in the cost widget; falls back to undefined for any
  // model the LiteLLM snapshot doesn't recognize.
  const enriched = models.map((m) => ({
    ...m,
    pricing: lookupPricing(m.id),
  }));
  res.json(enriched);
});

// ─── Agent instructions ────────────────────────────────────

import fs from "fs";
import os from "os";
import path from "path";
import { VALID_AGENT_KEYS, loadInstructions } from "../ai/instructions.js";

const INSTRUCTIONS_DIR = path.join(os.homedir(), "Trident", "Instructions");

function getInstructionsPath(agent: string): string {
  return path.join(INSTRUCTIONS_DIR, `${agent}.md`);
}

router.get("/agent-instructions/:agent", (req, res) => {
  if (!VALID_AGENT_KEYS.has(req.params.agent)) {
    res.status(422).json({ errors: { agent_key: ["Invalid agent key."] } });
    return;
  }
  const filePath = getInstructionsPath(req.params.agent);
  const isCustom = fs.existsSync(filePath);
  res.json({
    instructions: loadInstructions(req.params.agent),
    isCustom,
  });
});

router.put("/agent-instructions/:agent", (req, res) => {
  if (!VALID_AGENT_KEYS.has(req.params.agent)) {
    res.status(422).json({ errors: { agent_key: ["Invalid agent key."] } });
    return;
  }
  const { instructions } = req.body as { instructions?: string };
  if (!instructions || typeof instructions !== "string") {
    res
      .status(422)
      .json({ errors: { instructions: ["Instructions are required."] } });
    return;
  }
  const filePath = getInstructionsPath(req.params.agent);
  fs.mkdirSync(INSTRUCTIONS_DIR, { recursive: true });
  fs.writeFileSync(filePath, instructions, "utf-8");
  res.json({ success: true });
});

router.delete("/agent-instructions/:agent", (req, res) => {
  if (!VALID_AGENT_KEYS.has(req.params.agent)) {
    res.status(422).json({ errors: { agent_key: ["Invalid agent key."] } });
    return;
  }
  const filePath = getInstructionsPath(req.params.agent);
  try {
    fs.unlinkSync(filePath);
  } catch {
    // File didn't exist
  }
  res.json({ success: true });
});

export default router;

import { Router } from 'express';
import {
  getSetting,
  setSetting,
  getApiKey,
  setApiKey,
  deleteApiKey,
  getConfiguredProviders,
  getAllModelEfforts,
  setModelEffort,
  resetModelEffort,
  type EffortLevel,
} from '../settings.js';

const VALID_EFFORTS: readonly EffortLevel[] = ['low', 'medium', 'high', 'max'] as const;

const router = Router();

// ─── Autosave ──────────────────────────────────────────────

router.get('/autosave', (_req, res) => {
  res.json({ enabled: getSetting('autosave') });
});

router.put('/autosave', (req, res) => {
  setSetting('autosave', !!req.body.enabled);
  res.json({ enabled: getSetting('autosave') });
});

// ─── Notifications ─────────────────────────────────────────

router.get('/notifications', (_req, res) => {
  res.json({ enabled: getSetting('notifications') });
});

router.put('/notifications', (req, res) => {
  setSetting('notifications', !!req.body.enabled);
  res.json({ enabled: getSetting('notifications') });
});

// ─── Agent chime ───────────────────────────────────────────

router.get('/agent-chime', (_req, res) => {
  res.json({ enabled: getSetting('agentChime') });
});

router.put('/agent-chime', (req, res) => {
  setSetting('agentChime', !!req.body.enabled);
  res.json({ enabled: getSetting('agentChime') });
});

// ─── Trash ─────────────────────────────────────────────────

router.get('/trash', (_req, res) => {
  res.json({ enabled: getSetting('useTrash') });
});

router.put('/trash', (req, res) => {
  setSetting('useTrash', !!req.body.enabled);
  res.json({ enabled: getSetting('useTrash') });
});

// ─── Project tour ──────────────────────────────────────────

router.put('/project-tour', (_req, res) => {
  setSetting('projectTourCompleted', true);
  res.json({ success: true });
});

// ─── API keys ──────────────────────────────────────────────

router.get('/api-keys', (_req, res) => {
  res.json(getConfiguredProviders());
});

router.put('/api-keys', async (req, res) => {
  const { validateApiKey } = await import('../ai/validate-key.js');
  const { invalidateModelCache } = await import('../ai/model-registry.js');
  const { anthropic_key, openai_key, gemini_key } = req.body;

  const keys: Record<'anthropic' | 'openai' | 'gemini', string> = {} as Record<'anthropic' | 'openai' | 'gemini', string>;
  const anthropic = (anthropic_key ?? '').trim();
  const openai = (openai_key ?? '').trim();
  const gemini = (gemini_key ?? '').trim();
  if (anthropic) keys.anthropic = anthropic;
  if (openai) keys.openai = openai;
  if (gemini) keys.gemini = gemini;

  if (Object.keys(keys).length === 0) {
    res.status(422).json({
      errors: { anthropic_key: ['At least one API key is required.'] },
    });
    return;
  }

  const saved: Array<'anthropic' | 'openai' | 'gemini'> = [];
  const invalid: Array<'anthropic' | 'openai' | 'gemini'> = [];
  const errors: Record<string, string[]> = {};

  for (const [provider, key] of Object.entries(keys) as Array<['anthropic' | 'openai' | 'gemini', string]>) {
    if (await validateApiKey(provider, key)) {
      setApiKey(provider, key);
      invalidateModelCache(provider);
      saved.push(provider);
    } else {
      invalid.push(provider);
      errors[`${provider}_key`] = [`The ${provider} API key is invalid. Please check the key and try again.`];
    }
  }

  if (saved.length === 0) {
    res.status(422).json({ errors });
    return;
  }

  setSetting('onboardingCompleted', true);

  res.json({ success: true, saved, invalid });
});

router.delete('/api-keys', async (req, res) => {
  const { invalidateModelCache } = await import('../ai/model-registry.js');
  const { provider } = req.body as { provider: 'anthropic' | 'openai' | 'gemini' };
  if (!provider) {
    res.status(422).json({ error: 'Provider is required' });
    return;
  }
  deleteApiKey(provider);
  invalidateModelCache(provider);
  res.json(getConfiguredProviders());
});

// ─── Models ────────────────────────────────────────────────

router.get('/models', async (_req, res) => {
  const { fetchAvailableModels } = await import('../ai/model-registry.js');
  res.json(await fetchAvailableModels());
});

// ─── Per-model reasoning effort ────────────────────────────

router.get('/model-effort', (_req, res) => {
  res.json(getAllModelEfforts());
});

router.put('/model-effort', (req, res) => {
  const { modelId, level } = req.body as { modelId?: string; level?: string };
  if (!modelId || typeof modelId !== 'string') {
    res.status(422).json({ error: 'modelId is required' });
    return;
  }
  if (!level || !VALID_EFFORTS.includes(level as EffortLevel)) {
    res.status(422).json({ error: `level must be one of: ${VALID_EFFORTS.join(', ')}` });
    return;
  }
  setModelEffort(modelId, level as EffortLevel);
  res.json({ success: true });
});

router.delete('/model-effort/:modelId', (req, res) => {
  resetModelEffort(req.params.modelId);
  res.json({ success: true });
});

// ─── Agent instructions ────────────────────────────────────

import fs from 'fs';
import os from 'os';
import path from 'path';

const INSTRUCTIONS_DIR = path.join(os.homedir(), 'Trident', 'Instructions');

function getInstructionsPath(agent: string): string {
  return path.join(INSTRUCTIONS_DIR, `${agent}.md`);
}

router.get('/agent-instructions/:agent', async (req, res) => {
  const { loadInstructions } = await import('../ai/instructions.js');
  const filePath = getInstructionsPath(req.params.agent);
  const isCustom = fs.existsSync(filePath);
  res.json({
    instructions: loadInstructions(req.params.agent),
    isCustom,
  });
});

const VALID_AGENT_KEYS = new Set(['collaborator']);

router.put('/agent-instructions/:agent', (req, res) => {
  if (!VALID_AGENT_KEYS.has(req.params.agent)) {
    res.status(422).json({ errors: { agent_key: ['Invalid agent key.'] } });
    return;
  }
  const { instructions } = req.body as { instructions?: string };
  if (!instructions || typeof instructions !== 'string') {
    res.status(422).json({ errors: { instructions: ['Instructions are required.'] } });
    return;
  }
  const filePath = getInstructionsPath(req.params.agent);
  fs.mkdirSync(INSTRUCTIONS_DIR, { recursive: true });
  fs.writeFileSync(filePath, instructions, 'utf-8');
  res.json({ success: true });
});

router.delete('/agent-instructions/:agent', (req, res) => {
  if (!VALID_AGENT_KEYS.has(req.params.agent)) {
    res.status(422).json({ errors: { agent_key: ['Invalid agent key.'] } });
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

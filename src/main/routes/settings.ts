import { Router } from 'express';
import {
  getSetting,
  setSetting,
  getApiKey,
  setApiKey,
  deleteApiKey,
  getConfiguredProviders,
} from '../settings.js';

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

router.delete('/api-keys', (req, res) => {
  const { provider } = req.body as { provider: 'anthropic' | 'openai' | 'gemini' };
  if (!provider) {
    res.status(422).json({ error: 'Provider is required' });
    return;
  }
  deleteApiKey(provider);
  res.json(getConfiguredProviders());
});

// ─── Agent instructions ────────────────────────────────────

import fs from 'fs';
import os from 'os';
import path from 'path';

const INSTRUCTIONS_DIR = path.join(os.homedir(), 'Trident', 'Instructions');

function getInstructionsPath(agent: string): string {
  return path.join(INSTRUCTIONS_DIR, `${agent}.md`);
}

router.get('/agent-instructions/:agent', (req, res) => {
  const filePath = getInstructionsPath(req.params.agent);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ instructions: content });
  } catch {
    res.json({ instructions: null });
  }
});

router.put('/agent-instructions/:agent', (req, res) => {
  const filePath = getInstructionsPath(req.params.agent);
  const { instructions } = req.body as { instructions: string };
  fs.mkdirSync(INSTRUCTIONS_DIR, { recursive: true });
  fs.writeFileSync(filePath, instructions, 'utf-8');
  res.json({ success: true });
});

router.delete('/agent-instructions/:agent', (req, res) => {
  const filePath = getInstructionsPath(req.params.agent);
  try {
    fs.unlinkSync(filePath);
  } catch {
    // File didn't exist
  }
  res.json({ success: true });
});

export default router;

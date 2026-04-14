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

router.put('/api-keys', (req, res) => {
  // Support both single-key format { provider, key } and bulk format { anthropic_key, openai_key, gemini_key }
  const { provider, key, anthropic_key, openai_key, gemini_key } = req.body;

  if (provider && key) {
    // Single-key format (from settings page)
    setApiKey(provider, key);
  } else {
    // Bulk format (from onboarding page)
    if (anthropic_key) setApiKey('anthropic', anthropic_key);
    if (openai_key) setApiKey('openai', openai_key);
    if (gemini_key) setApiKey('gemini', gemini_key);
  }

  res.json(getConfiguredProviders());
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

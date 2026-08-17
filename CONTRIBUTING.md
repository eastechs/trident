# Contributing to Trident

Thanks for your interest. Trident is maintained by one person, so a little
coordination up front saves everyone time.

## Before you build something

For bug fixes, typo corrections, and small self-contained improvements, just
open a pull request.

For anything larger — a new feature, a new AI provider, a refactor that touches
several modules — **please open an issue first** so we can agree on the approach.
It is genuinely disappointing to turn down good work that went in a direction
the project wasn't taking, and that is avoidable with one conversation.

## Development setup

```bash
npm install
npm run dev
```

That runs Vite (renderer), tsup (main process), and Electron together with hot
reload. You need Node 22+ and, for provider work, an API key for whichever
provider you're touching.

Before opening a pull request:

```bash
npm run lint:check && npm run format:check && npm run types:check && npm run test:provider-contracts
```

CI runs exactly these, so a clean local run means a green PR.

## How the code is laid out

| Path | What lives there |
| --- | --- |
| `src/main/` | Electron main process: Express server, database, AI providers, agent tools |
| `src/main/routes/` | HTTP handlers, all project-scoped and auth-guarded |
| `src/main/ai/` | Provider resolution, model registry, pricing, embeddings, tools |
| `src/renderer/` | React app — pages, components, hooks |
| `src/renderer/components/ui/` | shadcn/ui primitives (see [CREDITS.md](CREDITS.md)) |

A few conventions worth absorbing before writing code: everything is
project-scoped, secrets never leave the main process, and filesystem paths from
users or models go through the boundary helpers in `src/main/safe-paths.ts`.
Match the style of the code around you — the repo is consistent, and consistency
is worth more than any individual preference.

### Working in `src/main/ai/`

The provider layer has a few rules that are not obvious from reading one file:

- A cloud model is persisted as an opaque reference
  (`trident-<provider>-<base64url>`) carrying the provider-facing model ID plus
  an optional base model ID. Identity is the **model ID alone** — the base model
  ID is a capability hint that can be edited without orphaning conversations.
- `provider-config.ts` is deliberately free of Electron and Node-only imports so
  the routing, capability, and validation rules it owns stay unit-testable.
  `provider-contracts.test.ts` covers it; keep it that way.
- Capability decisions (reasoning, image input, prompt caching) follow the
  **model family**, not the connection — Claude reached through Vertex behaves
  like Claude, not like "a Vertex model".
- Reads that only need model IDs or connection status must not decrypt
  credentials. Use the plain-config accessors in `settings.ts` rather than
  `getGatewayProviderConfig`.

## Contributor License Agreement

Trident is released under the AGPL-3.0 and is also offered under a commercial
license to organizations that cannot use AGPL software. To keep both of those
true, contributors sign a [Contributor License Agreement](CLA.md) before their
first pull request is merged. A bot handles this — you'll get a comment with a
link on your first PR.

**What it means:** you keep the copyright to your work. You grant Eastechs, LLC
the right to distribute it under other license terms, including commercial ones.
In exchange, Eastechs commits that every accepted contribution stays published
under the AGPL in this repository, permanently — the open version never loses
anything you give it.

**Obvious fixes are exempt.** Typos, whitespace, comment corrections, and other
changes with no creative content — roughly under ten lines — don't need a
signature.

This is the standard arrangement for dual-licensed projects, and it's a real
trade: you're granting something in order for the project to be able to fund
itself. If you'd rather not, that's completely reasonable — open an issue
describing the fix instead, and it can be implemented independently.

## Security issues

Please don't open a public issue. See [SECURITY.md](SECURITY.md) for private
reporting.

## Branding

The code is AGPL; the Trident name and icon are not. If you distribute a
modified build, give it your own name — see [TRADEMARK.md](TRADEMARK.md).

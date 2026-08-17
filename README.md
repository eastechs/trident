# Trident

Multi-Model AI Collaborative Workspace — an Electron desktop app (Electron 35, React 19,
Vite, Express, PGLite).

## Development

```bash
npm install
npm run dev        # vite + tsup (main) + electron, with hot reload
```

Other scripts:

| Script                                    | Purpose                                                  |
| ----------------------------------------- | -------------------------------------------------------- |
| `npm run build`                           | Build main (tsup) + renderer (vite) into `dist/`         |
| `npm run dist:mac`                        | Build, then package a macOS dmg/zip via electron-builder |
| `npm run lint:check` / `npm run lint`     | ESLint (check / autofix)                                 |
| `npm run format:check` / `npm run format` | Prettier (check / write)                                 |
| `npm run types:check`                     | `tsc --noEmit`                                           |
| `npm run test:provider-contracts`         | Model reference, capability, and pricing contracts       |
| `npm run test:image-providers`            | Image generation request contracts                       |
| `npm run release`                         | Cut a release (see below)                                |

## AI providers

Trident chats through two kinds of connection, both configured in **Settings → Providers**:

- **Direct APIs** — Anthropic, OpenAI, and Google Gemini, each with a provider API key.
- **Cloud platforms** — Amazon Bedrock, Google Vertex AI, and Azure OpenAI, using the models
  and deployments already available in an organization's own account.

Credentials are encrypted with the OS keychain (`safeStorage`) and never leave the machine;
non-secret details like regions, endpoints, and model IDs are stored as plain settings.

A few implementation notes for anyone working in `src/main/ai/`:

- A cloud model is persisted as an opaque reference (`trident-<provider>-<base64url>`) carrying
  the provider-facing model ID plus an optional base model ID. Identity is the **model ID alone** —
  the base model ID is a capability hint that can be edited without orphaning conversations.
- `provider-config.ts` is deliberately free of Electron and Node-only imports so the routing,
  capability, and validation rules it owns stay unit-testable; `provider-contracts.test.ts` covers it.
- Capability decisions (reasoning, image input, prompt caching) follow the **model family**, not
  the connection — Claude reached through Vertex behaves like Claude, not like "a Vertex model".
- Reads that only need model IDs or connection status must not decrypt credentials; use the
  plain-config accessors in `settings.ts` rather than `getGatewayProviderConfig`.

## Releases & auto-update

The packaged app self-updates via [`electron-updater`](https://www.electron.build/auto-update).
On launch (and every 4 hours) it checks GitHub Releases, downloads a newer version in the
background, and surfaces an **Install available** indicator (download icon + red dot) in the main
left sidebar — clicking it installs the update and restarts.

> **First auto-update-capable build is 0.2.0.** The currently-shipped 0.1.0 predates the updater and
> cannot update itself, so 0.2.0 must be installed **manually, once** on each machine. From 0.2.0
> onward, every newer _published_ release is delivered automatically.

### Why a separate releases repo

The source repo (`eastechs/trident`) is **private**, and an installed app can't anonymously read a
private repo's release assets. So release artifacts are published to a separate **public** repo,
**`eastechs/trident-releases`**, configured as the `github` publish provider in
`electron-builder.yml`. Source stays private; only the built installers are public. No credential is
shipped inside the app — clients read updates anonymously.

> Scope: auto-update currently targets **macOS arm64** only (matching the signed dmg/zip we build).

### One-time setup

- The public repo `eastechs/trident-releases` must exist (created during initial setup).
- macOS signing + notarization must be configured (see env vars below). macOS will not auto-update
  an unsigned/un-notarized app.

### Cutting a release

Requires these environment variables:

| Var                                                        | Purpose                                                        |
| ---------------------------------------------------------- | -------------------------------------------------------------- |
| `GH_TOKEN`                                                 | Uploads the GitHub release. `export GH_TOKEN=$(gh auth token)` |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | Notarization                                                   |

Then, from a clean `main`:

```bash
npm version <patch|minor|major>   # bumps version, commits, tags
npm run release                   # build → notarize → upload DRAFT → push tag
```

`npm run release` builds, notarizes, and uploads the dmg, zip, `latest-mac.yml`, and blockmap to a
**draft** GitHub Release in `eastechs/trident-releases`, then pushes the version tag to the source
repo.

**Drafts are invisible to the updater.** To go live, open the draft at
<https://github.com/eastechs/trident-releases/releases>, review it, and click **Publish release**.
Installed apps pick it up on their next check.

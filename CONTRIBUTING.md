# Contributing to Trident

External code contributions are currently closed, but we plan to welcome them
in the near future. Bug reports and feature requests are welcome.

Pull requests are disabled while Eastechs prepares the contribution process.
Please use GitHub Issues for bug reports and feature requests, and Discussions
for questions. Describe the problem or desired behavior rather than submitting
patches through issues or email; external patches are not being accepted yet.

You can still build and modify your own copy under the AGPL. Contribution terms
and instructions will be published before external code contributions open.

## Development setup

```bash
npm ci
npm run dev
```

That runs Vite (renderer), tsup (main process), and Electron together with hot
reload. You need Node 24+ and, for provider work, an API key for whichever
provider you're touching.

To validate a local build:

```bash
npm run lint:check
npm run format:check
npm run types:check
npm run test:provider-contracts
npm run test:image-providers
npm run test:desktop-contracts
npm run build
```

CI installs the lockfile with `npm ci` and runs these checks on pushes to `main`.

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

## Security issues

Please don't open a public issue. See [SECURITY.md](SECURITY.md) for private
reporting.

## Branding

The code is AGPL; the Trident name and icon are not. If you distribute a
modified build, give it your own name — see [TRADEMARK.md](TRADEMARK.md).

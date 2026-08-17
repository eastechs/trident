# Security policy

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through either channel:

- [GitHub private vulnerability reporting](https://github.com/eastechs/trident/security/advisories/new)
  — preferred, keeps the discussion attached to the repository
- Email <security@eastechs.com>

Useful things to include: what an attacker can do, the steps to reproduce it,
the Trident version, and your macOS version. A proof of concept helps but is not
required — a clear description of the flaw is enough to start.

## What to expect

| | |
| --- | --- |
| Acknowledgement | Within 7 days |
| Assessment and plan | Within 14 days |
| Fix released | As soon as practical; coordinated disclosure within 90 days |

Trident is maintained by one person, so these are honest targets rather than a
contractual SLA. If a report goes unacknowledged past 7 days, please follow up —
it was missed, not ignored.

Credit is given in the release notes unless you prefer otherwise.

## Supported versions

Only the **latest release** is supported. The app auto-updates on launch and
every four hours, so keeping current requires no action for most users.

## Scope

Trident is a local-first desktop application. It runs an HTTP server bound to
`127.0.0.1` for its own renderer, guarded by a per-launch shared secret, and
stores API keys encrypted through the operating system keychain.

Especially relevant:

- Escaping the project directory boundary through document, image, or agent
  tool paths
- Reaching the local API without the per-launch secret, or from another
  process or origin on the machine
- Recovering stored provider credentials from disk
- Code execution via untrusted document, image, or model-generated content

Out of scope: vulnerabilities in the AI providers themselves, and anything that
requires an attacker to already have your unlocked user account.

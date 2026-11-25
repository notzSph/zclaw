---
summary: "Private JayZoo operator documentation."
read_when:
  - Orienting yourself inside the private JayZoo fork
title: "JayZoo"
---

# JayZoo Docs

JayZoo is a private, machine-specific operator stack for zSph. It is derived
from OpenClaw, but this repository is not a public OpenClaw distribution,
community project, support target, or generic installer.

These docs exist for one environment:

- source checkout at `/opt/jayzoo/source`
- runtime data under `/opt/jayzoo-data`
- container source mount at `/work/jayzoo`
- gateway defaults bound to loopback unless explicitly changed

If a page still describes upstream OpenClaw behavior, treat it as reference
material only. JayZoo-specific runtime choices, private host layout, lack of
GitHub automation, and local secrets policy override upstream public-project
guidance.

## Working Rules

- Do not commit runtime state, secrets, `.env` files, `.agents/`, or
  `jayzoo-data` material.
- Do not add upstream release, publishing, issue-management, or CI automation
  unless it is deliberately reviewed for this private fork.
- Do not publish support, security, Discord, or community-maintenance promises
  from this repository.
- Preserve upstream OpenClaw attribution and license notices where upstream
  material remains.

## Useful Local Checks

```bash
pnpm install
pnpm audit --prod
git diff --check
```

For the authoritative project posture, read the repository root `README.md`,
`SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, and `LICENSE`.

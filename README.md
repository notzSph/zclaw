# zClaw

![Version](https://img.shields.io/badge/version-3.0.0-blue)
![Build](https://img.shields.io/badge/Build-passing-brightgreen)
![Language](https://img.shields.io/badge/Language-TypeScript-cyan)
![PR](https://img.shields.io/badge/PRs-Welcome-green)
![License: MIT](https://img.shields.io/badge/License-MIT-lightgrey)

zClaw is a self-hosted AI assistant and automation stack built on OpenClaw. It combines a customized gateway and agent runtime with Docker deployment configuration and optional companion services for retrieval and tool integrations.

This repository contains an independent OpenClaw fork and its deployment configuration. It is intended to run on infrastructure you control and to be configured for your environment. It is not an official OpenClaw release.

## Scope

zClaw provides:

- a gateway for connecting supported chat channels, model providers, and agent tools
- a configurable agent runtime for working with local projects and data
- Docker Compose configuration for running the gateway and optional companion services
- integration points for memory, retrieval, and external tools

The project is under active development. Configuration and behavior may differ from upstream OpenClaw, and compatibility with upstream documentation is not guaranteed.

## Runtime layout

Copy `infra/secret/.env.example` to `infra/secret/.env`, then set `AGENT_ROOT` to the host directory containing the deployment. `infra/secret/.env` is a local Compose input and is ignored by Git. Keep real credentials in `$AGENT_ROOT/data/secrets`, outside the source checkout. A typical `AGENT_ROOT` is `/opt/zclaw`.

Set `PROJECTS_ROOT` to the host directory containing project checkouts. Compose mounts it at `/work/projects`; for example, `$PROJECTS_ROOT/my-project` is available in the container at `/work/projects/my-project`. This mount includes child directories and is read-write.

Expected host layout beneath `$AGENT_ROOT`:

```text
data/                    # private config, secrets, workspace, and state
data/secrets/runtime.env # required runtime secrets
zclaw/                   # source checkout
zruntime/                # optional custom runtime and MCP services
zrag/                    # optional retrieval service
zjev/                    # optional RLCD service
```

Expected Docker posture:

- image defaults to `zclaw:local`
- gateway ports bind to `127.0.0.1` by default
- gateway bind defaults to `loopback`
- real secrets live outside the repository, under `$AGENT_ROOT/data/secrets`
- `infra/secret/.env` is local only and ignored

## Development

Install dependencies and build the source:

```bash
pnpm install
pnpm build
pnpm audit --prod
```

To prepare a Docker deployment, copy `infra/secret/.env.example` to `infra/secret/.env`, set `AGENT_ROOT`, and run:

```bash
./scripts/docker/setup.sh
```

The CLI binary and some internal package names retain OpenClaw compatibility names while the fork is being migrated. This avoids breaking workspace resolution during the transition.

## Security

zClaw is designed for a trusted single-operator environment. It is not a multi-tenant security boundary.

- Keep gateway access loopback-only unless it is deliberately exposed.
- Keep `$AGENT_ROOT/data` out of Git.
- Keep `$AGENT_ROOT/data/secrets/runtime.env` out of build artifacts.
- Do not mount the Docker socket unless the deployment requires it.
- Run `pnpm audit --prod` and a secret scan before publishing changes.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License and attribution

zClaw is licensed under the MIT License. It is derived from OpenClaw and includes upstream copyright notices. See [LICENSE](LICENSE) for the license terms and notices.

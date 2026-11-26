# ClawDock <!-- omit in toc -->

Stop typing `docker-compose` commands. Just type `clawdock-start`.

Inspired by Simon Willison's [Running OpenClaw in Docker](https://til.simonwillison.net/llms/openclaw-docker).

- [Quickstart](#quickstart)
- [Available Commands](#available-commands)
  - [Basic Operations](#basic-operations)
  - [Container Access](#container-access)
  - [Web UI \& Devices](#web-ui--devices)
  - [Setup \& Configuration](#setup--configuration)
  - [Maintenance](#maintenance)
  - [Utilities](#utilities)
- [Configuration \& Secrets](#configuration--secrets)
  - [Docker Files](#docker-files)
  - [Config Files](#config-files)
  - [Initial Setup](#initial-setup)
  - [How It Works in Docker](#how-it-works-in-docker)
  - [Env Precedence](#env-precedence)
- [Common Workflows](#common-workflows)
  - [Check Status and Logs](#check-status-and-logs)
  - [Set Up WhatsApp Bot](#set-up-whatsapp-bot)
  - [Troubleshooting Device Pairing](#troubleshooting-device-pairing)
  - [Fix Token Mismatch Issues](#fix-token-mismatch-issues)
  - [Permission Denied](#permission-denied)
- [Requirements](#requirements)
- [Development](#development)

## Quickstart

**Install:**

```bash
mkdir -p ~/.clawdock && curl -sL https://raw.githubusercontent.com/openclaw/openclaw/main/scripts/clawdock/clawdock-helpers.sh -o ~/.clawdock/clawdock-helpers.sh
```

```bash
echo 'source ~/.clawdock/clawdock-helpers.sh' >> ~/.zshrc && source ~/.zshrc
```

Canonical docs page: https://docs.openclaw.ai/install/clawdock

If you previously installed ClawDock from `scripts/shell-helpers/clawdock-helpers.sh`, rerun the install command above. The old raw GitHub path has been removed.

**See what you get:**

```bash
clawdock-help
```

On first command, ClawDock auto-detects your OpenClaw directory:

- Checks common paths (`~/openclaw`, `~/workspace/openclaw`, etc.)
- If found, asks you to confirm
- Saves to `~/.clawdock/config`

**First time setup:**

```bash
clawdock-start
```

```bash
clawdock-fix-token
```

```bash
clawdock-dashboard
```

If you see "pairing required":

```bash
clawdock-devices
```

And approve the request for the specific device:

```bash
clawdock-approve <request-id>
```

## Available Commands

### Basic Operations

| Command            | Description                     |
| ------------------ | ------------------------------- |
| `clawdock-start`   | Start the gateway               |
| `clawdock-stop`    | Stop the gateway                |
| `clawdock-restart` | Restart the gateway             |
| `clawdock-status`  | Check container status          |
| `clawdock-logs`    | View live logs (follows output) |

### Container Access

| Command                   | Description                                    |
| ------------------------- | ---------------------------------------------- |
| `clawdock-shell`          | Interactive shell inside the gateway container |
| `clawdock-cli <command>`  | Run OpenClaw CLI commands                      |
| `clawdock-exec <command>` | Execute arbitrary commands in the container    |

### Web UI & Devices

| Command                 | Description                                |
| ----------------------- | ------------------------------------------ |
| `clawdock-dashboard`    | Open web UI in browser with authentication |
| `clawdock-devices`      | List device pairing requests               |
| `clawdock-approve <id>` | Approve a device pairing request           |

### Setup & Configuration

| Command              | Description                                       |
| -------------------- | ------------------------------------------------- |
| `clawdock-fix-token` | Configure gateway authentication token (run once) |

### Maintenance

| Command            | Description                                           |
| ------------------ | ----------------------------------------------------- |
| `clawdock-update`  | Pull latest, rebuild image, and restart (one command) |
| `clawdock-rebuild` | Rebuild the Docker image only                         |
| `clawdock-clean`   | Remove all containers and volumes (destructive!)      |

### Utilities

| Command                | Description                               |
| ---------------------- | ----------------------------------------- |
| `clawdock-health`      | Run gateway health check                  |
| `clawdock-token`       | Display the gateway authentication token  |
| `clawdock-cd`          | Jump to the OpenClaw project directory    |
| `clawdock-config`      | Open the OpenClaw config directory        |
| `clawdock-show-config` | Print config files with redacted values   |
| `clawdock-workspace`   | Open the workspace directory              |
| `clawdock-help`        | Show all available commands with examples |

## Configuration & Secrets

The Docker setup uses three config files on the host. The container never stores secrets — everything is bind-mounted from local files.

### Docker Files

| File                                    | Purpose                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------- |
| `infra/docker/Dockerfile`               | Builds the `openclaw:local` image (Node 22, pnpm, non-root `node` user)    |
| `infra/docker/compose.yml`       | Defines `openclaw-gateway` and `openclaw-cli` services, bind-mounts, ports |
| `scripts/docker/setup.sh`               | First-time setup, builds image and initializes `infra/secret/.env`         |
| `infra/secret/.env.example`             | Template for `infra/secret/.env` with all supported vars and docs          |
| `infra/docker/docker-compose.extra.yml` | Optional overrides — auto-loaded by ClawDock helpers if present            |

### Config Files

| File                  | Purpose                                          | Examples                                                    |
| --------------------- | ------------------------------------------------ | ----------------------------------------------------------- |
| `infra/secret/.env`   | **Docker infra** — image, ports, gateway token   | `ZCLAW_GATEWAY_TOKEN`, `ZCLAW_IMAGE`, `ZCLAW_GATEWAY_PORT`  |
| `~/.zclaw/.env`       | **Secrets** — API keys and bot tokens            | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN` |
| `~/.zclaw/zclaw.json` | **Behavior config** — models, channels, policies | Model selection, WhatsApp allowlists, agent settings        |

**Do NOT** put API keys or bot tokens in `zclaw.json`. Use `~/.zclaw/.env` for all secrets.

### Initial Setup

`./scripts/docker/setup.sh` handles first-time Docker configuration:

- Builds the `openclaw:local` image from `infra/docker/Dockerfile`
- Initializes `infra/secret/.env` with a generated gateway token
- Sets up `~/.zclaw` directories if they don't exist

```bash
./scripts/docker/setup.sh
```

After setup, add your API keys:

```bash
vim ~/.zclaw/.env
```

See `infra/secret/.env.example` for all supported keys.

The `infra/docker/Dockerfile` supports two optional build args:

- `ZCLAW_DOCKER_APT_PACKAGES` — extra apt packages to install (e.g. `ffmpeg`)
- `OPENCLAW_INSTALL_BROWSER=1` — pre-install Chromium for browser automation (adds ~300MB, but skips the 60-90s Playwright install on each container start)

### How It Works in Docker

`infra/docker/compose.yml` bind-mounts both config and workspace from the host:

```yaml
volumes:
  - ${ZCLAW_CONFIG_DIR}:/home/node/.zclaw
  - ${ZCLAW_WORKSPACE_DIR}:/home/node/.zclaw/workspace
```

This means:

- `~/.zclaw/.env` is available inside the container at `/home/node/.zclaw/.env` — OpenClaw loads it automatically as the global env fallback
- `~/.zclaw/zclaw.json` is available at `/home/node/.zclaw/zclaw.json` — the gateway watches it and hot-reloads most changes
- Downloadable plugin packages and install records live under the mounted OpenClaw home
- No need to add API keys to `infra/docker/compose.yml` or configure anything inside the container
- Keys survive `clawdock-update`, `clawdock-rebuild`, and `clawdock-clean` because they live on the host

The project `.env` feeds Docker Compose directly (gateway token, image name, ports). The `~/.zclaw/.env` feeds the OpenClaw process inside the container.

### Example `~/.zclaw/.env`

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
TELEGRAM_BOT_TOKEN=123456:ABCDEF...
```

### Example `infra/secret/.env`

```bash
ZCLAW_CONFIG_DIR=/Users/you/.zclaw
ZCLAW_WORKSPACE_DIR=/Users/you/.zclaw/workspace
ZCLAW_GATEWAY_PORT=18789
ZCLAW_BRIDGE_PORT=18790
ZCLAW_GATEWAY_BIND=lan
ZCLAW_GATEWAY_TOKEN=<generated-by-docker-setup>
ZCLAW_IMAGE=openclaw:local
```

### Env Precedence

OpenClaw loads env vars in this order (highest wins, never overrides existing):

1. **Process environment** — `infra/docker/compose.yml` `environment:` block (gateway token, session keys)
2. **`.env` in CWD** — `infra/secret/.env` (Docker infra vars)
3. **`~/.zclaw/.env`** — global secrets (API keys, bot tokens)
4. **`zclaw.json` `env` block** — inline vars, applied only if still missing
5. **Shell env import** — optional login-shell scrape (`OPENCLAW_LOAD_SHELL_ENV=1`)

## Common Workflows

### Update OpenClaw

> **Important:** `openclaw update` does not work inside Docker.
> The container runs as a non-root user with a source-built image, so `npm i -g` fails with EACCES.
> Use `clawdock-update` instead — it pulls, rebuilds, and restarts from the host.

```bash
clawdock-update
```

This runs `git pull` → `sudo docker compose build` → `sudo docker compose down/up` in one step.

If you only want to rebuild without pulling:

```bash
clawdock-rebuild && clawdock-stop && clawdock-start
```

### Check Status and Logs

**Restart the gateway:**

```bash
clawdock-restart
```

**Check container status:**

```bash
clawdock-status
```

**View live logs:**

```bash
clawdock-logs
```

### Set Up WhatsApp Bot

**Shell into the container:**

```bash
clawdock-shell
```

**Inside the container, login to WhatsApp:**

```bash
openclaw channels login --channel whatsapp --verbose
```

Scan the QR code with WhatsApp on your phone.

**Verify connection:**

```bash
openclaw status
```

### Troubleshooting Device Pairing

**Check for pending pairing requests:**

```bash
clawdock-devices
```

**Copy the Request ID from the "Pending" table, then approve:**

```bash
clawdock-approve <request-id>
```

Then refresh your browser.

### Fix Token Mismatch Issues

If you see "gateway token mismatch" errors:

```bash
clawdock-fix-token
```

This will:

1. Read the token from your `.env` file
2. Configure it in the OpenClaw config
3. Restart the gateway
4. Verify the configuration

### Permission Denied

**Ensure Docker is running and you have permission:**

```bash
sudo docker ps
```

## Requirements

- Docker and Docker Compose installed
- Bash or Zsh shell
- OpenClaw project (run `scripts/docker/setup.sh`)

## Development

**Test with fresh config (mimics first-time install):**

```bash
unset CLAWDOCK_DIR && rm -f ~/.clawdock/config && source scripts/clawdock/clawdock-helpers.sh
```

Then run any command to trigger auto-detect:

```bash
clawdock-start
```

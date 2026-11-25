# zClaw Vision

zClaw is a self-hosted assistant for turning conversations into useful work across a person's tools, projects, and devices.

It combines a configurable agent runtime with chat channels, model providers, browser and system tools, and optional services for memory and retrieval. The gateway and its data remain under the operator's control, while integrations can be enabled as needed.

## What we optimize for

- **Useful work:** agents should help complete real tasks, not just produce plausible text.
- **Operator control:** make permissions, network exposure, model choice, and data locations understandable and configurable.
- **Private-by-default operation:** keep runtime state and credentials in operator-managed data directories, outside the source tree.
- **Composable capability:** use plugins and companion services for optional integrations instead of making every installation carry every feature.
- **Reliable self-hosting:** make setup, upgrades, recovery, and day-to-day operation predictable on infrastructure the operator controls.

## Product direction

We will prioritize secure defaults, first-run reliability, stable channel and provider integrations, and clear operational diagnostics. We will improve the agent's ability to use approved tools and work with local projects while keeping the operator in charge of access.

The project should remain practical to run and maintain. New features should fit existing plugin, provider, channel, or tool boundaries where possible. Changes to core behavior should include focused tests and documentation for the operator-facing contract.

## Data and source

The repository contains software and deployment templates. Runtime configuration, credentials, conversations, and other operator data belong in the configured data directory and must not be committed. See [SECURITY.md](SECURITY.md) for reporting and handling security issues.

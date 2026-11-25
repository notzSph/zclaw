# Security Policy

zClaw is an open-source, self-hosted project. Deployments are operator-managed and are not a multi-tenant security boundary.

## Supported Scope

Security reports should identify the affected zClaw version or commit, deployment method, and steps to reproduce. Do not include real credentials, personal data, or private infrastructure details.

## Trust Model

zClaw assumes:

- one trusted operator
- one trusted machine boundary
- local secrets stored outside the source repository
- no hostile multi-user tenancy on the same gateway

Do not expose the gateway beyond loopback unless there is a deliberate network/security reason.

## Reporting

Report suspected vulnerabilities through GitHub's private vulnerability reporting for this repository. If private reporting is unavailable, contact the maintainers privately. Do not post exploitable details in a public issue.

For upstream OpenClaw vulnerabilities, report to the upstream OpenClaw project through its own security process.

For ordinary bugs and hardening proposals without sensitive exploit details, open a public issue or pull request.

## Hard Rules

- Do not commit `.env`.
- Do not commit `$AGENT_ROOT/data`.
- Do not commit `runtime.env`.
- Do not commit credentials, runtime state, or private operator data.
- Keep upstream MIT attribution in redistributed copies of OpenClaw code.

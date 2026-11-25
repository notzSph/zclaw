# Contributing

Contributions to zClaw are welcome. Before starting substantial work, open an issue or discussion to agree on the problem and the proposed approach.

## Before opening a pull request

- Keep each pull request focused on one problem or related change.
- Include tests for behavior changes and update operator documentation when contracts or setup steps change.
- Run the relevant checks for the files you changed. Include the commands and results in the pull request.
- Keep generated files in sync with their source generators when applicable.
- Do not include credentials, personal data, runtime state, private logs, or machine-specific configuration. Keep these in the configured data directory, outside Git.
- Do not include unrelated upstream changes in a zClaw pull request.

## Security issues

Do not report exploitable vulnerabilities in a public issue. Follow the private reporting instructions in [SECURITY.md](SECURITY.md).

## Upstream changes

zClaw is based on OpenClaw and maintains its own operator-focused changes. If a change is useful to both projects, consider proposing it upstream separately, following the contribution process in the OpenClaw repository.

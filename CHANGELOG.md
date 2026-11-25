# Changelog

Notable user-facing changes to zClaw are recorded here. Entries describe this repository's releases and do not imply compatibility with every upstream OpenClaw release.

## 3.0.0 - 2026-11-25

### Changed

- Updated project documentation and separated environment templates from runtime data.
- Removed unused Fly.io and Render deployment templates; Docker Compose remains the supported deployment path for this repository.

## 2.0.0 - 2026-07-18

### Added

- Added GPT-5.6 Sol, Terra, and Luna catalog, OAuth compatibility, reasoning policy, Codex 0.144.4 harness support, and Docker live-validation coverage while preserving GPT-5.5 compatibility and Gemini fallback behavior.

## 1.0.0 - 2026-05-18

### Added

- Added zClaw Docker and runtime defaults for the intended host layout.

### Security

- Set Docker gateway defaults to loopback-only.
- Updated vulnerable dependency overrides for `hono` and `protobufjs`.
- Kept runtime credentials and operator data outside the source tree.

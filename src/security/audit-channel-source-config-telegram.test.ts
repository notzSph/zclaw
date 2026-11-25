import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { stubAuditChannelPlugin } from "./audit-channel-test-helpers.js";
import { collectChannelSecurityFindings } from "./audit-channel.js";

function stubTelegramPlugin(params: {
  resolveAccount: (cfg: OpenClawConfig, accountId: string | null | undefined) => unknown;
  inspectAccount?: (cfg: OpenClawConfig, accountId: string | null | undefined) => unknown;
  isConfigured?: (account: unknown, cfg: OpenClawConfig) => boolean;
}) {
  return stubAuditChannelPlugin({
    id: "telegram",
    label: "Telegram",
    commands: {
      nativeCommandsAutoEnabled: false,
      nativeSkillsAutoEnabled: false,
    },
    collectAuditFindings: async ({ account }) => {
      const config =
        (account as { config?: { slashCommand?: { enabled?: boolean }; allowFrom?: unknown } })
          .config ?? {};
      const slashCommandEnabled = config.slashCommand?.enabled === true;
      const allowFrom =
        Array.isArray(config.allowFrom) && config.allowFrom.length > 0 ? config.allowFrom : [];
      if (!slashCommandEnabled || allowFrom.length > 0) {
        return [];
      }
      return [
        {
          checkId: "channels.telegram.commands.slash.no_allowlists",
          severity: "warn" as const,
          title: "Telegram slash commands have no allowlists",
          detail: "test stub",
        },
      ];
    },
    ...params,
  });
}

function makeTelegramHttpConfig(): OpenClawConfig {
  return {
    channels: {
      telegram: {
        enabled: true,
        mode: "http",
        groupPolicy: "open",
        slashCommand: { enabled: true },
      },
    },
  } as OpenClawConfig;
}

function makeTelegramInspection(
  channel: unknown,
  overrides: {
    enabled?: boolean;
    configured?: boolean;
    botTokenStatus?: string;
    signingSecretStatus?: string;
  },
) {
  return {
    accountId: "default",
    enabled: overrides.enabled ?? true,
    configured: overrides.configured ?? true,
    mode: "http",
    botTokenSource: "config",
    botTokenStatus: overrides.botTokenStatus ?? "configured_unavailable",
    signingSecretSource: "config",
    signingSecretStatus: overrides.signingSecretStatus ?? "configured_unavailable",
    config: channel,
  };
}

describe("security audit channel source-config fallback telegram", () => {
  it("keeps source-configured channel security findings when resolved inspection is incomplete", async () => {
    const cases = [
      {
        name: "telegram resolved inspection only exposes signingSecret status",
        sourceConfig: makeTelegramHttpConfig(),
        resolvedConfig: makeTelegramHttpConfig(),
        plugin: (sourceConfig: OpenClawConfig) =>
          stubTelegramPlugin({
            inspectAccount: (cfg) => {
              const channel = cfg.channels?.telegram ?? {};
              if (cfg === sourceConfig) {
                return makeTelegramInspection(channel, {
                  enabled: false,
                });
              }
              return makeTelegramInspection(channel, {
                botTokenStatus: "available",
                signingSecretStatus: "available",
              });
            },
            resolveAccount: (cfg) => ({ config: cfg.channels?.telegram ?? {} }),
            isConfigured: (account) => Boolean((account as { configured?: boolean }).configured),
          }),
      },
      {
        name: "telegram source config still wins when resolved inspection is unconfigured",
        sourceConfig: makeTelegramHttpConfig(),
        resolvedConfig: makeTelegramHttpConfig(),
        plugin: (sourceConfig: OpenClawConfig) =>
          stubTelegramPlugin({
            inspectAccount: (cfg) => {
              const channel = cfg.channels?.telegram ?? {};
              if (cfg === sourceConfig) {
                return makeTelegramInspection(channel, {});
              }
              return makeTelegramInspection(channel, {
                configured: false,
                botTokenStatus: "available",
                signingSecretStatus: "missing",
              });
            },
            resolveAccount: (cfg) => ({ config: cfg.channels?.telegram ?? {} }),
            isConfigured: (account) => Boolean((account as { configured?: boolean }).configured),
          }),
      },
    ] as const;

    for (const testCase of cases) {
      const findings = await collectChannelSecurityFindings({
        cfg: testCase.resolvedConfig,
        sourceConfig: testCase.sourceConfig,
        plugins: [testCase.plugin(testCase.sourceConfig)],
      });

      expect(findings, testCase.name).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            checkId: "channels.telegram.commands.slash.no_allowlists",
            severity: "warn",
          }),
        ]),
      );
    }
  });
});

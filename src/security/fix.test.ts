import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ChannelPlugin } from "../channels/plugins/types.js";
import type { OpenClawConfig } from "../config/config.js";
import {
  applySecurityFixConfigMutations,
  collectSecurityPermissionTargets,
  fixSecurityFootguns,
} from "./fix.js";

const isWindows = process.platform === "win32";

const expectPerms = (actual: number, expected: number) => {
  if (isWindows) {
    expect([expected, 0o666, 0o777]).toContain(actual);
    return;
  }
  expect(actual).toBe(expected);
};

describe("security fix", () => {
  let fixtureRoot = "";
  let fixtureCount = 0;

  const createStateDir = async (prefix: string) => {
    const dir = path.join(fixtureRoot, `${prefix}-${fixtureCount++}`);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  };

  const createFixEnv = (stateDir: string, configPath: string) => ({
    ...process.env,
    OPENCLAW_STATE_DIR: stateDir,
    OPENCLAW_CONFIG_PATH: configPath,
  });

  const createTelegramConfigFixTestPlugin = (storeAllowFrom: string[]): ChannelPlugin => ({
    id: "telegram",
    meta: {
      id: "telegram",
      label: "Telegram",
      selectionLabel: "Telegram",
      docsPath: "/docs/testing",
      blurb: "test stub",
    },
    capabilities: {
      chatTypes: ["direct", "group"],
    },
    config: {
      listAccountIds: () => ["default"],
      inspectAccount: () => ({ accountId: "default", enabled: true, configured: true, config: {} }),
      resolveAccount: () => ({ accountId: "default", enabled: true, config: {} }),
      isEnabled: () => true,
      isConfigured: () => true,
    },
    security: {
      applyConfigFixes: async ({ cfg }) => {
        if (storeAllowFrom.length === 0) {
          return { config: cfg, changes: [] };
        }
        const next = structuredClone(cfg ?? {});
        const telegram = next.channels?.telegram as Record<string, unknown> | undefined;
        if (!telegram || typeof telegram !== "object") {
          return { config: cfg, changes: [] };
        }
        const changes: string[] = [];
        let changed = false;
        const maybeApply = (prefix: string, holder: Record<string, unknown>) => {
          if (holder.groupPolicy !== "allowlist") {
            return;
          }
          const allowFrom = Array.isArray(holder.allowFrom) ? holder.allowFrom : [];
          const groupAllowFrom = Array.isArray(holder.groupAllowFrom) ? holder.groupAllowFrom : [];
          if (allowFrom.length > 0 || groupAllowFrom.length > 0) {
            return;
          }
          holder.groupAllowFrom = [...storeAllowFrom];
          changes.push(`${prefix}groupAllowFrom=pairing-store`);
          changed = true;
        };

        maybeApply("channels.telegram.", telegram);
        const accounts = telegram.accounts;
        if (accounts && typeof accounts === "object") {
          for (const [accountId, value] of Object.entries(accounts)) {
            if (!value || typeof value !== "object") {
              continue;
            }
            maybeApply(
              `channels.telegram.accounts.${accountId}.`,
              value as Record<string, unknown>,
            );
          }
        }

        return { config: changed ? next : cfg, changes };
      },
    },
  });

  const expectTightenedStateAndConfigPerms = async (stateDir: string, configPath: string) => {
    const stateMode = (await fs.stat(stateDir)).mode & 0o777;
    expectPerms(stateMode, 0o700);

    const configMode = (await fs.stat(configPath)).mode & 0o777;
    expectPerms(configMode, 0o600);
  };

  const expectTelegramGroupPolicy = (
    channels: Record<string, Record<string, unknown>>,
    expectedPolicy = "allowlist",
  ) => {
    expect(channels.telegram.groupPolicy).toBe(expectedPolicy);
  };

  const expectTelegramAccountGroupPolicy = (
    channels: Record<string, Record<string, unknown>>,
    accountId: string,
    expectedPolicy = "allowlist",
  ) => {
    const telegram = channels.telegram;
    const accounts = telegram.accounts as Record<string, Record<string, unknown>>;
    const account = accounts[accountId];
    if (!account) {
      throw new Error(`Expected Telegram account ${accountId}`);
    }
    expect(account.groupPolicy).toBe(expectedPolicy);
    return accounts;
  };

  const fixTelegramConfigScenario = async (params: {
    telegram: Record<string, unknown>;
    allowFromStore: string[];
  }) => {
    const fixed = await applySecurityFixConfigMutations({
      cfg: {
        channels: {
          telegram: params.telegram,
        },
      } satisfies OpenClawConfig,
      env: process.env,
      channelPlugins: [createTelegramConfigFixTestPlugin(params.allowFromStore)],
    });
    return {
      res: { ok: true, changes: fixed.changes },
      channels: fixed.cfg.channels as Record<string, Record<string, unknown>>,
    };
  };

  beforeAll(async () => {
    fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-security-fix-suite-"));
  });

  afterAll(async () => {
    if (fixtureRoot) {
      await fs.rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("tightens groupPolicy + filesystem perms", async () => {
    const cfg = {
      channels: {
        telegram: { groupPolicy: "open" },
        discord: { groupPolicy: "open" },
        imessage: { groupPolicy: "open" },
      },
      logging: { redactSensitive: "off" },
    } satisfies OpenClawConfig;
    const fixed = await applySecurityFixConfigMutations({
      cfg,
      env: process.env,
      channelPlugins: [createTelegramConfigFixTestPlugin(["+15551234567"])],
    });
    expect(fixed.changes).toEqual(
      expect.arrayContaining([
        "channels.telegram.groupPolicy=open -> allowlist",
        "channels.discord.groupPolicy=open -> allowlist",
        "channels.imessage.groupPolicy=open -> allowlist",
        'logging.redactSensitive=off -> "tools"',
      ]),
    );

    const channels = fixed.cfg.channels as Record<string, Record<string, unknown>>;
    expect(channels.telegram.groupPolicy).toBe("allowlist");
    expect(channels.discord.groupPolicy).toBe("allowlist");
    expect(channels.imessage.groupPolicy).toBe("allowlist");

    expect(channels.telegram.groupAllowFrom).toEqual(["+15551234567"]);
  });

  it("applies allowlist per-account and seeds Telegram groupAllowFrom from store", async () => {
    const { res, channels } = await fixTelegramConfigScenario({
      telegram: {
        accounts: {
          a1: { groupPolicy: "open" },
        },
      },
      allowFromStore: ["+15550001111"],
    });
    expect(res.ok).toBe(true);
    const accounts = expectTelegramAccountGroupPolicy(channels, "a1");
    expect(accounts.a1.groupAllowFrom).toEqual(["+15550001111"]);
  });

  it("does not seed Telegram groupAllowFrom if allowFrom is set", async () => {
    const { res, channels } = await fixTelegramConfigScenario({
      telegram: {
        groupPolicy: "open",
        allowFrom: ["+15552223333"],
      },
      allowFromStore: ["+15550001111"],
    });
    expect(res.ok).toBe(true);
    expectTelegramGroupPolicy(channels);
    expect(channels.telegram.groupAllowFrom).toBeUndefined();
  });

  it("returns ok=false for invalid config but still tightens perms", async () => {
    const stateDir = await createStateDir("invalid-config");
    await fs.chmod(stateDir, 0o755);

    const configPath = path.join(stateDir, "jayzoo.json");
    await fs.writeFile(configPath, "{ this is not json }\n", "utf-8");
    await fs.chmod(configPath, 0o644);

    const env = createFixEnv(stateDir, configPath);

    const res = await fixSecurityFootguns({ env, stateDir, configPath });
    expect(res.ok).toBe(false);

    await expectTightenedStateAndConfigPerms(stateDir, configPath);
  });

  it("collects permission targets for credentials + agent auth/sessions + include files", async () => {
    const stateDir = await createStateDir("includes");

    const includesDir = path.join(stateDir, "includes");
    await fs.mkdir(includesDir, { recursive: true });
    const includePath = path.join(includesDir, "extra.json5");
    await fs.writeFile(includePath, "{ logging: { redactSensitive: 'off' } }\n", "utf-8");
    await fs.chmod(includePath, 0o644);

    const configPath = path.join(stateDir, "jayzoo.json");
    await fs.writeFile(
      configPath,
      `{ "$include": "./includes/extra.json5", channels: { telegram: { groupPolicy: "open" } } }\n`,
      "utf-8",
    );
    await fs.chmod(configPath, 0o644);

    const credsDir = path.join(stateDir, "credentials");
    await fs.mkdir(credsDir, { recursive: true });
    const allowFromPath = path.join(credsDir, "telegram-allowFrom.json");
    await fs.writeFile(
      allowFromPath,
      `${JSON.stringify({ version: 1, allowFrom: ["+15550002222"] }, null, 2)}\n`,
      "utf-8",
    );
    await fs.chmod(allowFromPath, 0o644);

    const agentDir = path.join(stateDir, "agents", "main", "agent");
    await fs.mkdir(agentDir, { recursive: true });
    const authProfilesPath = path.join(agentDir, "auth-profiles.json");
    await fs.writeFile(authProfilesPath, "{}\n", "utf-8");
    await fs.chmod(authProfilesPath, 0o644);

    const sessionsDir = path.join(stateDir, "agents", "main", "sessions");
    await fs.mkdir(sessionsDir, { recursive: true });
    const sessionsStorePath = path.join(sessionsDir, "sessions.json");
    await fs.writeFile(sessionsStorePath, "{}\n", "utf-8");
    await fs.chmod(sessionsStorePath, 0o644);
    const transcriptPath = path.join(sessionsDir, "sess-main.jsonl");
    await fs.writeFile(transcriptPath, '{"type":"session"}\n', "utf-8");
    await fs.chmod(transcriptPath, 0o644);

    const targets = await collectSecurityPermissionTargets({
      env: createFixEnv(stateDir, configPath),
      stateDir,
      configPath,
      cfg: {
        channels: { telegram: { groupPolicy: "open" } },
      } as OpenClawConfig,
      includePaths: [includePath],
    });

    expect(targets).toEqual(
      expect.arrayContaining([
        { path: stateDir, mode: 0o700, require: "dir" },
        { path: configPath, mode: 0o600, require: "file" },
        { path: credsDir, mode: 0o700, require: "dir" },
        { path: allowFromPath, mode: 0o600, require: "file" },
        { path: authProfilesPath, mode: 0o600, require: "file" },
        { path: sessionsStorePath, mode: 0o600, require: "file" },
        { path: transcriptPath, mode: 0o600, require: "file" },
        { path: includePath, mode: 0o600, require: "file" },
      ]),
    );
  });
});

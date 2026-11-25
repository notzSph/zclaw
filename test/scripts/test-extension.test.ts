import { execFileSync } from "node:child_process";
import path from "node:path";
import { bundledPluginFile, bundledPluginRoot } from "openclaw/plugin-sdk/test-fixtures";
import { describe, expect, it, vi } from "vitest";
import {
  detectChangedExtensionIds,
  listAvailableExtensionIds,
  listChangedExtensionIds,
} from "../../scripts/lib/changed-extensions.mjs";
import {
  DEFAULT_EXTENSION_TEST_SHARD_COUNT,
  createExtensionTestShards,
  resolveExtensionBatchPlan,
  resolveExtensionTestPlan,
} from "../../scripts/lib/extension-test-plan.mjs";
import {
  resolveExtensionBatchParallelism,
  runExtensionBatchPlan,
} from "../../scripts/test-extension-batch.mjs";

const scriptPath = path.join(process.cwd(), "scripts", "test-extension.mjs");

type RunGroupParams = {
  args: string[];
  config: string;
  env: Record<string, string | undefined>;
  targets: string[];
};

function runScript(args: string[], cwd = process.cwd()) {
  return execFileSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: "utf8",
  });
}

function requireFirstMockArg<T>(mock: { mock: { calls: Array<[T, ...unknown[]]> } }): T {
  const [arg] = mock.mock.calls[0] ?? [];
  if (arg === undefined) {
    throw new Error("expected first mock call argument");
  }
  return arg;
}

function findExtensionWithoutTests() {
  const extensionId = listAvailableExtensionIds().find(
    (candidate) => !resolveExtensionTestPlan({ targetArg: candidate, cwd: process.cwd() }).hasTests,
  );

  if (!extensionId) {
    throw new Error("Expected at least one extension without tests");
  }
  return extensionId;
}

function expectPositiveIntegerMetric(value: number) {
  expect(Number.isInteger(value)).toBe(true);
  expect(value).toBeGreaterThan(0);
}

describe("scripts/test-extension.mjs", () => {
  it("resolves split channel extensions onto their own vitest configs", () => {
    const plan = resolveExtensionTestPlan({ targetArg: "imessage", cwd: process.cwd() });

    expect(plan.extensionId).toBe("imessage");
    expect(plan.extensionDir).toBe(bundledPluginRoot("imessage"));
    expect(plan.config).toBe("test/vitest/vitest.extension-imessage.config.ts");
    expect(plan.roots).toContain(bundledPluginRoot("imessage"));
    expect(plan.hasTests).toBe(true);
  });

  it("resolves diffs onto the diffs vitest config", () => {
    const plan = resolveExtensionTestPlan({ targetArg: "diffs", cwd: process.cwd() });

    expect(plan.extensionId).toBe("diffs");
    expect(plan.config).toBe("test/vitest/vitest.extension-diffs.config.ts");
    expect(plan.roots).toContain(bundledPluginRoot("diffs"));
    expect(plan.hasTests).toBe(true);
  });

  it("resolves OpenAI onto its own provider vitest config", () => {
    const plan = resolveExtensionTestPlan({ targetArg: "openai", cwd: process.cwd() });

    expect(plan.extensionId).toBe("openai");
    expect(plan.config).toBe("test/vitest/vitest.extension-provider-openai.config.ts");
    expect(plan.roots).toContain(bundledPluginRoot("openai"));
    expect(plan.hasTests).toBe(true);
  });

  it("resolves telegram onto the telegram vitest config", () => {
    const plan = resolveExtensionTestPlan({ targetArg: "telegram", cwd: process.cwd() });

    expect(plan.extensionId).toBe("telegram");
    expect(plan.config).toBe("test/vitest/vitest.extension-telegram.config.ts");
    expect(plan.roots).toContain(bundledPluginRoot("telegram"));
    expect(plan.hasTests).toBe(true);
  });

  it("resolves memory extensions onto the memory vitest config", () => {
    const plan = resolveExtensionTestPlan({ targetArg: "memory-core", cwd: process.cwd() });

    expect(plan.extensionId).toBe("memory-core");
    expect(plan.config).toBe("test/vitest/vitest.extension-memory.config.ts");
    expect(plan.roots).toContain(bundledPluginRoot("memory-core"));
    expect(plan.hasTests).toBe(true);
  });

  it("resolves broad dedicated extension groups onto their narrow vitest configs", () => {
    expect(resolveExtensionTestPlan({ targetArg: "browser", cwd: process.cwd() }).config).toBe(
      "test/vitest/vitest.extension-browser.config.ts",
    );
    expect(
      resolveExtensionTestPlan({ targetArg: "image-generation-core", cwd: process.cwd() }).config,
    ).toBe(
      "test/vitest/vitest.extension-media.config.ts",
    );
    expect(resolveExtensionTestPlan({ targetArg: "firecrawl", cwd: process.cwd() }).config).toBe(
      "test/vitest/vitest.extension-misc.config.ts",
    );
  });

  it("keeps unmatched non-provider extensions on the shared extensions vitest config", () => {
    const plan = resolveExtensionTestPlan({ targetArg: "codex", cwd: process.cwd() });

    expect(plan.extensionId).toBe("codex");
    expect(plan.config).toBe("test/vitest/vitest.extensions.config.ts");
    expect(plan.roots).toContain(bundledPluginRoot("codex"));
    expect(plan.hasTests).toBe(true);
  });

  it("maps changed paths back to extension ids", () => {
    const extensionIds = detectChangedExtensionIds([
      bundledPluginFile("telegram", "src/channel.ts"),
      bundledPluginFile("firecrawl", "package.json"),
      "src/not-a-plugin/file.ts",
    ]);

    expect(extensionIds).toEqual(["firecrawl", "telegram"]);
  });

  it("lists available extension ids", () => {
    const extensionIds = listAvailableExtensionIds();

    expect(extensionIds).toContain("telegram");
    expect(extensionIds).toContain("firecrawl");
    expect(extensionIds).toEqual(
      [...extensionIds].toSorted((left, right) => left.localeCompare(right)),
    );
  });

  it("can fail safe to all extensions when the base revision is unavailable", () => {
    const extensionIds = listChangedExtensionIds({
      base: "refs/heads/openclaw-test-missing-base",
      unavailableBaseBehavior: "all",
    });

    expect(extensionIds).toEqual(listAvailableExtensionIds());
  });

  it("resolves a plan for extensions without tests", () => {
    const extensionId = findExtensionWithoutTests();
    const plan = resolveExtensionTestPlan({ cwd: process.cwd(), targetArg: extensionId });

    expect(plan.extensionId).toBe(extensionId);
    expect(plan.hasTests).toBe(false);
    expect(plan.testFileCount).toBe(0);
  });

  it("batches extensions into config-specific vitest invocations", () => {
    const batch = resolveExtensionBatchPlan({
      cwd: process.cwd(),
      extensionIds: [
        "firecrawl",
        "openai",
        "telegram",
        "memory-core",
        "diffs",
        "browser",
        "image-generation-core",
        "imessage",
        "deepseek",
      ],
    });

    expect(batch.extensionIds).toEqual([
      "browser",
      "deepseek",
      "diffs",
      "firecrawl",
      "image-generation-core",
      "imessage",
      "memory-core",
      "openai",
      "telegram",
    ]);
    const stablePlanGroups = batch.planGroups.map(({ estimatedCost, testFileCount, ...group }) => {
      expectPositiveIntegerMetric(estimatedCost);
      expectPositiveIntegerMetric(testFileCount);
      return group;
    });

    expect(stablePlanGroups).toEqual([
      {
        config: "test/vitest/vitest.extension-browser.config.ts",
        extensionIds: ["browser"],
        roots: [bundledPluginRoot("browser")],
      },
      {
        config: "test/vitest/vitest.extension-diffs.config.ts",
        extensionIds: ["diffs"],
        roots: [bundledPluginRoot("diffs")],
      },
      {
        config: "test/vitest/vitest.extension-imessage.config.ts",
        extensionIds: ["imessage"],
        roots: [bundledPluginRoot("imessage")],
      },
      {
        config: "test/vitest/vitest.extension-media.config.ts",
        extensionIds: ["image-generation-core"],
        roots: [bundledPluginRoot("image-generation-core")],
      },
      {
        config: "test/vitest/vitest.extension-memory.config.ts",
        extensionIds: ["memory-core"],
        roots: [bundledPluginRoot("memory-core")],
      },
      {
        config: "test/vitest/vitest.extension-misc.config.ts",
        extensionIds: ["firecrawl"],
        roots: [bundledPluginRoot("firecrawl")],
      },
      {
        config: "test/vitest/vitest.extension-provider-openai.config.ts",
        extensionIds: ["openai"],
        roots: [bundledPluginRoot("openai")],
      },
      {
        config: "test/vitest/vitest.extension-providers.config.ts",
        extensionIds: ["deepseek"],
        roots: [bundledPluginRoot("deepseek")],
      },
      {
        config: "test/vitest/vitest.extension-telegram.config.ts",
        extensionIds: ["telegram"],
        roots: [bundledPluginRoot("telegram")],
      },
    ]);
  });

  it("balances extension test shards by estimated CI cost", () => {
    const shards = createExtensionTestShards({
      cwd: process.cwd(),
      shardCount: DEFAULT_EXTENSION_TEST_SHARD_COUNT,
    });

    expect(shards).toHaveLength(DEFAULT_EXTENSION_TEST_SHARD_COUNT);
    expect(shards.map((shard) => shard.checkName)).toEqual(
      shards.map((shard, index) => `checks-node-extensions-shard-${index + 1}`),
    );

    const assigned = shards.flatMap((shard) => shard.extensionIds);
    const uniqueAssigned = [...new Set(assigned)];
    const expected = listAvailableExtensionIds().filter(
      (extensionId) =>
        resolveExtensionTestPlan({ cwd: process.cwd(), targetArg: extensionId }).hasTests,
    );

    expect(uniqueAssigned.toSorted((left, right) => left.localeCompare(right))).toEqual(
      expected.toSorted((left, right) => left.localeCompare(right)),
    );
    expect(assigned).toHaveLength(expected.length);

    const totals = shards.map((shard) => shard.estimatedCost);
    expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(1);

    for (const shard of shards) {
      expect(shard.extensionIds.length).toBeGreaterThan(0);
    }
  });

  it("runs extension batch config groups concurrently when requested", async () => {
    const started: string[] = [];
    const resolvers: Array<() => void> = [];
    const runGroup = vi.fn((params: RunGroupParams) => {
      started.push(params.config);
      return new Promise<number>((resolve) => {
        resolvers.push(() => resolve(0));
      });
    });
    const runPromise = runExtensionBatchPlan(
      {
        extensionCount: 3,
        extensionIds: ["one", "two", "three"],
        estimatedCost: 60,
        hasTests: true,
        planGroups: [
          {
            config: "light",
            estimatedCost: 10,
            extensionIds: ["one"],
            roots: ["extensions/one"],
            testFileCount: 1,
          },
          {
            config: "heavy",
            estimatedCost: 30,
            extensionIds: ["two"],
            roots: ["extensions/two"],
            testFileCount: 3,
          },
          {
            config: "middle",
            estimatedCost: 20,
            extensionIds: ["three"],
            roots: ["extensions/three"],
            testFileCount: 2,
          },
        ],
        testFileCount: 6,
      },
      {
        env: { OPENCLAW_EXTENSION_BATCH_PARALLEL: "2" },
        runGroup,
        vitestArgs: ["--reporter=dot"],
      },
    );

    await Promise.resolve();
    expect(started).toEqual(["heavy", "middle"]);
    resolvers.shift()?.();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(started).toEqual(["heavy", "middle", "light"]);
    while (resolvers.length > 0) {
      resolvers.shift()?.();
    }
    await expect(runPromise).resolves.toBe(0);
    expect(runGroup).toHaveBeenCalledTimes(3);
    const firstRunGroupParams = requireFirstMockArg<RunGroupParams>(runGroup);
    expect(firstRunGroupParams).toEqual({
      args: ["--reporter=dot"],
      config: "heavy",
      env: {
        OPENCLAW_EXTENSION_BATCH_PARALLEL: "2",
        OPENCLAW_VITEST_FS_MODULE_CACHE_PATH: path.join(
          process.cwd(),
          "node_modules",
          ".experimental-vitest-cache",
          "extension-batch",
          "0-heavy",
        ),
      },
      targets: ["extensions/two"],
    });
  });

  it("keeps extension batch parallelism bounded by group count", () => {
    expect(resolveExtensionBatchParallelism(3, { OPENCLAW_EXTENSION_BATCH_PARALLEL: "2" })).toBe(2);
    expect(resolveExtensionBatchParallelism(1, { OPENCLAW_EXTENSION_BATCH_PARALLEL: "4" })).toBe(1);
    expect(resolveExtensionBatchParallelism(3, { OPENCLAW_EXTENSION_BATCH_PARALLEL: "nope" })).toBe(
      1,
    );
  });

  it("treats extensions without tests as a no-op by default", () => {
    const extensionId = findExtensionWithoutTests();
    const stdout = runScript([extensionId]);

    expect(stdout).toContain(`No tests found for ${bundledPluginRoot(extensionId)}.`);
    expect(stdout).toContain("Skipping.");
  });
});

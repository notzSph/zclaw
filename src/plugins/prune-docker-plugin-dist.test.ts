import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  parseDockerPluginKeepList,
  pruneDockerPluginDist,
} from "../../scripts/prune-docker-plugin-dist.mjs";
import { cleanupTempDirs, makeTempRepoRoot, writeJsonFile } from "../../test/helpers/temp-repo.js";

const tempDirs: string[] = [];

function makeRepoRoot(prefix: string): string {
  return makeTempRepoRoot(tempDirs, prefix);
}

function writeDistPluginFile(repoRoot: string, root: "dist" | "dist-runtime", pluginId: string) {
  const pluginDir = path.join(repoRoot, root, "extensions", pluginId);
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(path.join(pluginDir, "openclaw.plugin.json"), "{}\n", "utf8");
}

afterEach(() => {
  cleanupTempDirs(tempDirs);
});

describe("pruneDockerPluginDist", () => {
  it("parses space and comma separated Docker plugin keep lists", () => {
    expect([...parseDockerPluginKeepList("browser webhooks,discord")]).toEqual([
      "browser",
      "webhooks",
      "discord",
    ]);
  });

  it("removes package-excluded plugin dist unless Docker explicitly opts it in", () => {
    const repoRoot = makeRepoRoot("openclaw-docker-plugin-dist-");
    writeJsonFile(path.join(repoRoot, "package.json"), {
      files: ["dist/**", "!dist/extensions/browser/**", "!dist/extensions/webhooks/**"],
    });
    writeDistPluginFile(repoRoot, "dist", "browser");
    writeDistPluginFile(repoRoot, "dist", "webhooks");
    writeDistPluginFile(repoRoot, "dist-runtime", "webhooks");
    writeDistPluginFile(repoRoot, "dist", "telegram");

    const removed = pruneDockerPluginDist({
      repoRoot,
      env: { JAYZOO_EXTENSIONS: "browser" } as NodeJS.ProcessEnv,
    });

    expect(removed).toEqual(["dist/extensions/webhooks", "dist-runtime/extensions/webhooks"]);
    expect(fs.existsSync(path.join(repoRoot, "dist", "extensions", "browser"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "dist", "extensions", "webhooks"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, "dist-runtime", "extensions", "webhooks"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, "dist", "extensions", "telegram"))).toBe(true);
  });
});

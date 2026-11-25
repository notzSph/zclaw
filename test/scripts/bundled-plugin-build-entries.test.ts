import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectRootPackageExcludedExtensionDirs,
  listBundledPluginBuildEntries,
  listBundledPluginPackArtifacts,
} from "../../scripts/lib/bundled-plugin-build-entries.mjs";

function expectNoPrefixMatches(values: string[], prefix: string) {
  expect(values.some((value) => value.startsWith(prefix))).toBe(false);
}

function expectSomePrefixMatch(values: string[], prefix: string) {
  expect(values.some((value) => value.startsWith(prefix))).toBe(true);
}

function pickEntries(entries: Record<string, string>, keys: readonly string[]) {
  return Object.fromEntries(keys.map((key) => [key, entries[key]]));
}

describe("bundled plugin build entries", () => {
  const bundledChannelEntrySources = ["index.ts", "channel-entry.ts", "setup-entry.ts"];
  const forEachBundledChannelEntry = (
    visit: (params: { entryPath: string; entry: string; pluginId: string }) => void,
  ) => {
    for (const dirent of fs.readdirSync("extensions", { withFileTypes: true })) {
      if (!dirent.isDirectory()) {
        continue;
      }

      for (const sourceEntry of bundledChannelEntrySources) {
        const entryPath = path.join("extensions", dirent.name, sourceEntry);
        if (!fs.existsSync(entryPath)) {
          continue;
        }
        visit({
          entryPath,
          entry: fs.readFileSync(entryPath, "utf8"),
          pluginId: dirent.name,
        });
      }
    }
  };

  it("includes manifest-less runtime core support packages in dist build entries", () => {
    const entries = listBundledPluginBuildEntries();
    const expectedEntries = {
      "extensions/image-generation-core/api": "extensions/image-generation-core/api.ts",
      "extensions/image-generation-core/runtime-api":
        "extensions/image-generation-core/runtime-api.ts",
      "extensions/media-understanding-core/runtime-api":
        "extensions/media-understanding-core/runtime-api.ts",
    };

    expect(pickEntries(entries, Object.keys(expectedEntries))).toStrictEqual(expectedEntries);
  });

  it("packs runtime core support packages without requiring plugin manifests", () => {
    const artifacts = listBundledPluginPackArtifacts();

    expect(artifacts).toContain("dist/extensions/image-generation-core/package.json");
    expect(artifacts).toContain("dist/extensions/image-generation-core/runtime-api.js");
    expect(artifacts).not.toContain("dist/extensions/image-generation-core/openclaw.plugin.json");
    expect(artifacts).toContain("dist/extensions/media-understanding-core/runtime-api.js");
    expect(artifacts).not.toContain(
      "dist/extensions/media-understanding-core/openclaw.plugin.json",
    );
  });

  it("keeps bundled channel secret contracts on packed top-level sidecars", () => {
    const artifacts = listBundledPluginPackArtifacts();
    const excludedPackageDirs = collectRootPackageExcludedExtensionDirs();
    const offenders: string[] = [];
    const secretBackedPluginIds = new Set<string>();

    forEachBundledChannelEntry(({ entryPath, entry, pluginId }) => {
      if (!entry.includes('exportName: "channelSecrets"')) {
        return;
      }
      secretBackedPluginIds.add(pluginId);
      if (entry.includes("./src/secret-contract.js")) {
        offenders.push(entryPath);
      }
      expect(entry).toContain('specifier: "./secret-contract-api.js"');
    });

    expect(offenders).toStrictEqual([]);

    for (const pluginId of [...secretBackedPluginIds].toSorted()) {
      if (excludedPackageDirs.has(pluginId)) {
        continue;
      }
      const secretApiPath = path.join("extensions", pluginId, "secret-contract-api.ts");
      expect(fs.readFileSync(secretApiPath, "utf8")).toContain("channelSecrets");
      expect(artifacts).toContain(`dist/extensions/${pluginId}/secret-contract-api.js`);
    }
  });

  it("keeps bundled channel entry metadata on packed top-level sidecars", () => {
    const offenders: string[] = [];

    forEachBundledChannelEntry(({ entryPath, entry }) => {
      if (
        !entry.includes("defineBundledChannelEntry") &&
        !entry.includes("defineBundledChannelSetupEntry")
      ) {
        return;
      }
      if (/specifier:\s*["']\.\/src\//u.test(entry)) {
        offenders.push(entryPath);
      }
    });

    expect(offenders).toStrictEqual([]);
  });
});

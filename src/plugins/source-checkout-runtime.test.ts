import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setBundledPluginsDirOverrideForTest } from "./bundled-dir.js";
import { loadOpenClawPlugins } from "./loader.js";

describe("source checkout bundled plugin runtime", () => {
  beforeEach(() => {
    setBundledPluginsDirOverrideForTest(path.join(process.cwd(), "extensions"));
  });

  afterEach(() => {
    setBundledPluginsDirOverrideForTest(undefined);
  });

  it("loads enabled bundled plugins from source checkout", () => {
    const registry = loadOpenClawPlugins({
      cache: false,
      onlyPluginIds: ["webhooks"],
      config: {
        plugins: {
          entries: {
            webhooks: { enabled: true },
          },
        },
      },
    });

    const webhooks = registry.plugins.find((plugin) => plugin.id === "webhooks");
    expect(webhooks).toMatchObject({
      status: "loaded",
      origin: "bundled",
    });

    const expectedRuntime = `${path.sep}extensions${path.sep}webhooks${path.sep}index.ts`;
    const expectedRoot = `${path.sep}extensions${path.sep}webhooks`;

    expect(webhooks?.source).toContain(expectedRuntime);
    expect(webhooks?.rootDir).toContain(expectedRoot);
  });
});

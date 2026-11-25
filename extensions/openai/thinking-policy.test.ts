import { describe, expect, it } from "vitest";
import {
  resolveOpenAICodexThinkingProfile,
  resolveOpenAIThinkingProfile,
} from "./thinking-policy.js";

describe("OpenAI GPT-5.6 thinking policy", () => {
  it.each([
    ["gpt-5.6-sol", "low"],
    ["gpt-5.6-terra", "medium"],
    ["gpt-5.6-luna", "medium"],
  ] as const)("exposes max and the upstream default for %s", (modelId, defaultLevel) => {
    for (const resolve of [resolveOpenAIThinkingProfile, resolveOpenAICodexThinkingProfile]) {
      const profile = resolve(modelId);
      expect(profile.defaultLevel).toBe(defaultLevel);
      expect(profile.levels.map((level) => level.id)).toContain("max");
    }
  });

  it("keeps GPT-5.5 behavior unchanged", () => {
    const profile = resolveOpenAICodexThinkingProfile("gpt-5.5");
    expect(profile.defaultLevel).toBeUndefined();
    expect(profile.levels.map((level) => level.id)).not.toContain("max");
  });

  it("supports GPT-6.1 with max reasoning and no-reasoning mode", () => {
    for (const resolve of [resolveOpenAIThinkingProfile, resolveOpenAICodexThinkingProfile]) {
      const profile = resolve("gpt-6.1-sol");
      expect(profile.levels.map((level) => level.id)).toEqual([
        "low",
        "medium",
        "high",
        "xhigh",
        "max",
      ]);
      expect(profile.defaultLevel).toBe("medium");
    }
  });
});

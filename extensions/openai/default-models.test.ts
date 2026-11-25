import type { OpenClawConfig } from "openclaw/plugin-sdk/provider-onboard";
import { describe, expect, it } from "vitest";
import { applyOpenAIConfig, applyOpenAIProviderConfig, OPENAI_DEFAULT_MODEL } from "./api.js";

describe("openai default models", () => {
  it("adds allowlist entry for the default model", () => {
    const next = applyOpenAIProviderConfig({});
    expect(Object.keys(next.agents?.defaults?.models ?? {})).toContain(OPENAI_DEFAULT_MODEL);
  });

  it("preserves existing alias for the default model", () => {
    const next = applyOpenAIProviderConfig({
      agents: {
        defaults: {
          models: {
            [OPENAI_DEFAULT_MODEL]: { alias: "My GPT" },
          },
        },
      },
    });
    expect(next.agents?.defaults?.models?.[OPENAI_DEFAULT_MODEL]?.alias).toBe("My GPT");
  });

  it("sets the default model when it is unset", () => {
    const next = applyOpenAIConfig({});
    expect(next.agents?.defaults?.model).toEqual({ primary: OPENAI_DEFAULT_MODEL });
  });

  it("overrides model.primary while preserving fallbacks", () => {
    const next = applyOpenAIConfig({
      agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6", fallbacks: [] } } },
    } as OpenClawConfig);
    expect(next.agents?.defaults?.model).toEqual({ primary: OPENAI_DEFAULT_MODEL, fallbacks: [] });
  });

  it("preserves the proven GPT-5.5 primary and separate Gemini fallback during provider refresh", () => {
    const next = applyOpenAIProviderConfig({
      agents: {
        defaults: {
          model: {
            primary: "openai/gpt-5.5",
            fallbacks: ["google/gemini-3-flash-preview"],
          },
          models: {
            "openai/gpt-5.5": { alias: "Codex 5.5" },
            "openai/gpt-5.6-terra": { alias: "Codex 5.6 Terra" },
            "google/gemini-3-flash-preview": { alias: "Gemini" },
          },
        },
      },
    });

    expect(next.agents?.defaults?.model).toEqual({
      primary: "openai/gpt-5.5",
      fallbacks: ["google/gemini-3-flash-preview"],
    });
    expect(next.agents?.defaults?.models?.["openai/gpt-5.6-terra"]?.alias).toBe(
      "Codex 5.6 Terra",
    );
    expect(next.agents?.defaults?.models?.["google/gemini-3-flash-preview"]?.alias).toBe("Gemini");
  });
});

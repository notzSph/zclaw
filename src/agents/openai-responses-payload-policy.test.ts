import type { Model } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import {
  applyOpenAIResponsesPayloadPolicy,
  resolveOpenAIResponsesPayloadPolicy,
} from "./openai-responses-payload-policy.js";

describe("openai responses payload policy", () => {
  it("strips temperature for GPT-5.6 variants", () => {
    for (const id of ["gpt-5.6", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]) {
      const payload = { temperature: 0.2 };
      applyOpenAIResponsesPayloadPolicy(
        payload,
        resolveOpenAIResponsesPayloadPolicy({
          provider: "openai",
          api: "openai-responses",
          baseUrl: "https://api.openai.com/v1",
          id,
        }),
      );
      expect(payload).not.toHaveProperty("temperature");
    }
  });

  it("keeps temperature for GPT-5.5", () => {
    const payload = { temperature: 0.2 };
    applyOpenAIResponsesPayloadPolicy(
      payload,
      resolveOpenAIResponsesPayloadPolicy({
        provider: "openai",
        api: "openai-responses",
        baseUrl: "https://api.openai.com/v1",
        id: "gpt-5.5",
      }),
    );
    expect(payload.temperature).toBe(0.2);
  });

  it("honors explicit temperature compatibility overrides", () => {
    const gpt56Payload = { temperature: 0.2 };
    applyOpenAIResponsesPayloadPolicy(
      gpt56Payload,
      resolveOpenAIResponsesPayloadPolicy({
        api: "openai-responses",
        id: "gpt-5.6-luna",
        compat: { supportsTemperature: true },
      }),
    );
    expect(gpt56Payload.temperature).toBe(0.2);

    const gpt55Payload = { temperature: 0.2 };
    applyOpenAIResponsesPayloadPolicy(
      gpt55Payload,
      resolveOpenAIResponsesPayloadPolicy({
        api: "openai-responses",
        id: "gpt-5.5",
        compat: { supportsTemperature: false },
      }),
    );
    expect(gpt55Payload).not.toHaveProperty("temperature");
  });

  it("forces store for native OpenAI responses payloads but keeps disable mode for transport defaults", () => {
    const model = {
      id: "gpt-5.4",
      name: "GPT-5.4",
      api: "openai-responses",
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      reasoning: true,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 200000,
      maxTokens: 8192,
    } satisfies Model<"openai-responses">;

    const providerPolicy = resolveOpenAIResponsesPayloadPolicy(model, {
      storeMode: "provider-policy",
    });
    expect(providerPolicy.explicitStore).toBe(true);
    expect(providerPolicy.allowsServiceTier).toBe(true);

    const disablePolicy = resolveOpenAIResponsesPayloadPolicy(model, { storeMode: "disable" });
    expect(disablePolicy.explicitStore).toBe(false);
    expect(disablePolicy.allowsServiceTier).toBe(true);
  });

  it("couples native Responses server compaction to provider-managed store", () => {
    const model = {
      id: "gpt-5.4",
      api: "openai-responses",
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      contextWindow: 200_000,
    } satisfies Pick<
      Model<"openai-responses">,
      "api" | "baseUrl" | "contextWindow" | "id" | "provider"
    >;
    const payload = {} satisfies Record<string, unknown>;

    applyOpenAIResponsesPayloadPolicy(
      payload,
      resolveOpenAIResponsesPayloadPolicy(model, {
        enableServerCompaction: true,
        storeMode: "provider-policy",
      }),
    );

    expect(payload).toEqual({
      store: true,
      context_management: [{ type: "compaction", compact_threshold: 140_000 }],
    });
  });

  it("strips store and prompt cache for proxy-like responses routes when requested", () => {
    const policy = resolveOpenAIResponsesPayloadPolicy(
      {
        api: "openai-responses",
        provider: "openai",
        baseUrl: "https://proxy.example.com/v1",
        compat: { supportsStore: false },
      },
      {
        enablePromptCacheStripping: true,
        storeMode: "provider-policy",
      },
    );
    const payload = {
      store: false,
      prompt_cache_key: "session-123",
      prompt_cache_retention: "24h",
    } satisfies Record<string, unknown>;

    applyOpenAIResponsesPayloadPolicy(payload, policy);

    expect(payload).not.toHaveProperty("store");
    expect(payload).not.toHaveProperty("prompt_cache_key");
    expect(payload).not.toHaveProperty("prompt_cache_retention");
  });

  it("keeps disabled reasoning payloads on native OpenAI responses models that support none", () => {
    const payload = {
      reasoning: {
        effort: "none",
      },
    } satisfies Record<string, unknown>;

    applyOpenAIResponsesPayloadPolicy(
      payload,
      resolveOpenAIResponsesPayloadPolicy(
        {
          api: "openai-responses",
          provider: "openai",
          id: "gpt-5.4",
          baseUrl: "https://api.openai.com/v1",
        },
        { storeMode: "disable" },
      ),
    );

    expect(payload).toEqual({
      reasoning: {
        effort: "none",
      },
      store: false,
    });
  });

  it("strips disabled reasoning payloads on native OpenAI responses models that do not support none", () => {
    const payload = {
      reasoning: {
        effort: "none",
      },
    } satisfies Record<string, unknown>;

    applyOpenAIResponsesPayloadPolicy(
      payload,
      resolveOpenAIResponsesPayloadPolicy(
        {
          api: "openai-responses",
          provider: "openai",
          id: "gpt-5",
          baseUrl: "https://api.openai.com/v1",
        },
        { storeMode: "disable" },
      ),
    );

    expect(payload).toEqual({
      store: false,
    });
  });

  it("strips disabled reasoning payloads for proxy-like OpenAI responses routes", () => {
    const payload = {
      reasoning: {
        effort: "none",
      },
    } satisfies Record<string, unknown>;

    applyOpenAIResponsesPayloadPolicy(
      payload,
      resolveOpenAIResponsesPayloadPolicy(
        {
          api: "openai-responses",
          provider: "openai",
          baseUrl: "https://proxy.example.com/v1",
        },
        { storeMode: "disable" },
      ),
    );

    expect(payload).not.toHaveProperty("reasoning");
  });

  it("emits store false for native OpenAI Codex responses disable mode", () => {
    const policy = resolveOpenAIResponsesPayloadPolicy(
      {
        api: "openai-codex-responses",
        provider: "openai-codex",
        baseUrl: "https://chatgpt.com/backend-api/codex",
      },
      { storeMode: "disable" },
    );

    expect(policy.explicitStore).toBe(false);
    expect(policy.allowsServiceTier).toBe(true);
    expect(policy.shouldStripStore).toBe(false);
  });
});

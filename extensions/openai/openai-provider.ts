import {
  type ProviderResolveDynamicModelContext,
  type ProviderRuntimeModel,
} from "openclaw/plugin-sdk/plugin-entry";
import { createProviderApiKeyAuthMethod } from "openclaw/plugin-sdk/provider-auth-api-key";
import {
  DEFAULT_CONTEXT_TOKENS,
  normalizeModelCompat,
  normalizeProviderId,
  type ProviderPlugin,
} from "openclaw/plugin-sdk/provider-model-shared";
import { normalizeLowercaseStringOrEmpty } from "openclaw/plugin-sdk/text-runtime";
import { OPENAI_API_KEY_LABEL, OPENAI_API_KEY_WIZARD_GROUP } from "./auth-choice-copy.js";
import { isOpenAIApiBaseUrl, OPENAI_CODEX_RESPONSES_BASE_URL } from "./base-url.js";
import { applyOpenAIConfig, OPENAI_DEFAULT_MODEL } from "./default-models.js";
import {
  isOpenAIGpt56VariantModelId,
  OPENAI_GPT_61_SOL_MODEL_ID,
  OPENAI_GPT_56_MODEL_ID,
  OPENAI_GPT_56_VARIANT_MODEL_IDS,
} from "./model-route-contract.js";
import {
  buildOpenAIResponsesProviderHooks,
  buildOpenAISyntheticCatalogEntry,
  cloneFirstTemplateModel,
  findCatalogTemplate,
  matchesExactOrPrefix,
} from "./shared.js";
import { resolveOpenAIThinkingProfile } from "./thinking-policy.js";

const PROVIDER_ID = "openai";
const OPENAI_CHAT_LATEST_MODEL_ID = "chat-latest";
const OPENAI_GPT_55_MODEL_ID = "gpt-5.5";
const OPENAI_GPT_55_PRO_MODEL_ID = "gpt-5.5-pro";
const OPENAI_GPT_54_MODEL_ID = "gpt-5.4";
const OPENAI_GPT_54_PRO_MODEL_ID = "gpt-5.4-pro";
const OPENAI_GPT_54_MINI_MODEL_ID = "gpt-5.4-mini";
const OPENAI_GPT_54_NANO_MODEL_ID = "gpt-5.4-nano";
const OPENAI_GPT_56_CONTEXT_TOKENS = 1_050_000;
const OPENAI_GPT_56_MAX_TOKENS = 128_000;
const OPENAI_GPT_56_THINKING_LEVEL_MAP = { off: "none", xhigh: "xhigh", max: "max" } as const;
const OPENAI_GPT_61_CONTEXT_TOKENS = 1_050_000;
const OPENAI_GPT_61_MAX_TOKENS = 128_000;
const OPENAI_GPT_61_SOL_COST = {
  input: 2,
  output: 10,
  cacheRead: 0.1,
  cacheWrite: 2.5,
} as const;
const OPENAI_CODEX_PROVIDER_ID = "openai-codex";
const OPENAI_GPT_55_PRO_CONTEXT_TOKENS = 1_000_000;
const OPENAI_GPT_54_CONTEXT_TOKENS = 1_050_000;
const OPENAI_GPT_54_PRO_CONTEXT_TOKENS = 1_050_000;
const OPENAI_GPT_54_MINI_CONTEXT_TOKENS = 400_000;
const OPENAI_GPT_54_NANO_CONTEXT_TOKENS = 400_000;
const OPENAI_GPT_54_MAX_TOKENS = 128_000;
const OPENAI_CHAT_LATEST_COST = { input: 5, output: 30, cacheRead: 0.5, cacheWrite: 0 } as const;
const OPENAI_GPT_55_PRO_COST = { input: 30, output: 180, cacheRead: 0, cacheWrite: 0 } as const;
const OPENAI_GPT_54_COST = { input: 2.5, output: 15, cacheRead: 0.25, cacheWrite: 0 } as const;
const OPENAI_GPT_54_PRO_COST = { input: 30, output: 180, cacheRead: 0, cacheWrite: 0 } as const;
const OPENAI_GPT_54_MINI_COST = {
  input: 0.75,
  output: 4.5,
  cacheRead: 0.075,
  cacheWrite: 0,
} as const;
const OPENAI_GPT_54_NANO_COST = {
  input: 0.2,
  output: 1.25,
  cacheRead: 0.02,
  cacheWrite: 0,
} as const;
const OPENAI_GPT_55_PRO_TEMPLATE_MODEL_IDS = [
  OPENAI_GPT_54_PRO_MODEL_ID,
  OPENAI_GPT_54_MODEL_ID,
  "gpt-5.2-pro",
  "gpt-5.2",
] as const;
const OPENAI_GPT_54_TEMPLATE_MODEL_IDS = ["gpt-5.2"] as const;
const OPENAI_GPT_54_PRO_TEMPLATE_MODEL_IDS = ["gpt-5.2-pro", "gpt-5.2"] as const;
const OPENAI_GPT_54_MINI_TEMPLATE_MODEL_IDS = ["gpt-5-mini"] as const;
const OPENAI_GPT_54_NANO_TEMPLATE_MODEL_IDS = ["gpt-5-nano", "gpt-5-mini"] as const;
const OPENAI_CHAT_LATEST_TEMPLATE_MODEL_IDS = [
  OPENAI_GPT_55_MODEL_ID,
  OPENAI_GPT_54_MODEL_ID,
  "gpt-5.2",
] as const;
const OPENAI_MODERN_MODEL_IDS = [
  OPENAI_GPT_61_SOL_MODEL_ID,
  OPENAI_GPT_56_MODEL_ID,
  ...OPENAI_GPT_56_VARIANT_MODEL_IDS,
  OPENAI_CHAT_LATEST_MODEL_ID,
  OPENAI_GPT_55_MODEL_ID,
  OPENAI_GPT_55_PRO_MODEL_ID,
  OPENAI_GPT_54_MODEL_ID,
  OPENAI_GPT_54_PRO_MODEL_ID,
  OPENAI_GPT_54_MINI_MODEL_ID,
  OPENAI_GPT_54_NANO_MODEL_ID,
  "gpt-5.2",
] as const;

function hasConfiguredOpenAICodexOAuth(cfg: ProviderResolveDynamicModelContext["config"]): boolean {
  const profiles = cfg?.auth?.profiles ?? {};
  const order = cfg?.auth?.order?.openai ?? cfg?.auth?.order?.[OPENAI_CODEX_PROVIDER_ID];
  if (Array.isArray(order) && order.length > 0) {
    const first = profiles[order[0] ?? ""];
    return first?.mode === "oauth";
  }
  const matching = Object.values(profiles).filter(
    (profile) => profile.provider === PROVIDER_ID || profile.provider === OPENAI_CODEX_PROVIDER_ID,
  );
  return (
    matching.some((profile) => profile.mode === "oauth") &&
    !matching.some((profile) => profile.mode === "api_key")
  );
}

function shouldUseConfiguredCodexOAuthRoute(params: {
  cfg: ProviderResolveDynamicModelContext["config"];
  modelId: string;
}): boolean {
  const modelId = normalizeLowercaseStringOrEmpty(params.modelId);
  return (
    hasConfiguredOpenAICodexOAuth(params.cfg) &&
    (modelId === "gpt-6-astra" ||
      modelId === "gpt-6-sol" ||
      modelId === "gpt-6-luna" ||
      modelId === OPENAI_GPT_61_SOL_MODEL_ID ||
      isOpenAIGpt56VariantModelId(modelId) ||
      modelId === OPENAI_GPT_55_MODEL_ID ||
      modelId === OPENAI_GPT_55_PRO_MODEL_ID ||
      modelId === OPENAI_GPT_54_MODEL_ID ||
      modelId === OPENAI_GPT_54_PRO_MODEL_ID ||
      modelId === OPENAI_GPT_54_MINI_MODEL_ID)
  );
}

function withConfiguredOpenAICodexOAuthRoute(
  model: ProviderRuntimeModel,
  cfg: ProviderResolveDynamicModelContext["config"],
): ProviderRuntimeModel {
  if (!shouldUseConfiguredCodexOAuthRoute({ cfg, modelId: model.id })) {
    return model;
  }
  return {
    ...model,
    provider: OPENAI_CODEX_PROVIDER_ID,
    api: "openai-codex-responses",
    baseUrl: OPENAI_CODEX_RESPONSES_BASE_URL,
  };
}

function shouldUseOpenAIResponsesTransport(params: {
  provider: string;
  api?: string | null;
  baseUrl?: string;
}): boolean {
  if (params.api !== "openai-completions") {
    return false;
  }
  const isOwnerProvider = normalizeProviderId(params.provider) === PROVIDER_ID;
  if (isOwnerProvider) {
    return !params.baseUrl || isOpenAIApiBaseUrl(params.baseUrl);
  }
  return typeof params.baseUrl === "string" && isOpenAIApiBaseUrl(params.baseUrl);
}

function normalizeOpenAITransport(model: ProviderRuntimeModel): ProviderRuntimeModel {
  const useResponsesTransport = shouldUseOpenAIResponsesTransport({
    provider: model.provider,
    api: model.api,
    baseUrl: model.baseUrl,
  });

  if (!useResponsesTransport) {
    return model;
  }

  return {
    ...model,
    api: "openai-responses",
  };
}

function resolveOpenAIGptForwardCompatModel(ctx: ProviderResolveDynamicModelContext) {
  const trimmedModelId = ctx.modelId.trim();
  const lower = normalizeLowercaseStringOrEmpty(trimmedModelId);

  if (
    (lower === "gpt-6-astra" ||
      lower === "gpt-6-sol" ||
      lower === "gpt-6-luna" ||
      lower === OPENAI_GPT_61_SOL_MODEL_ID) &&
    hasConfiguredOpenAICodexOAuth(ctx.config)
  ) {
    const name =
      lower === "gpt-6-sol"
        ? "GPT-6 Sol"
        : lower === "gpt-6-luna"
          ? "GPT-6 Luna"
          : lower === OPENAI_GPT_61_SOL_MODEL_ID
            ? "GPT-6.1 Sol"
            : "GPT-6 Astra";
    const supportsNone = lower !== "gpt-6-astra" && lower !== OPENAI_GPT_61_SOL_MODEL_ID;
    return normalizeModelCompat({
      id: trimmedModelId,
      name,
      provider: "openai-codex",
      api: "openai-codex-responses",
      baseUrl: OPENAI_CODEX_RESPONSES_BASE_URL,
      reasoning: true,
      input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: OPENAI_GPT_61_CONTEXT_TOKENS,
      contextTokens: 272_000,
      maxTokens: OPENAI_GPT_61_MAX_TOKENS,
      thinkingLevelMap:
        lower === OPENAI_GPT_61_SOL_MODEL_ID
          ? { low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" }
          : {
              off: supportsNone ? "none" : "low",
              minimal: "low",
              xhigh: "xhigh",
              max: "max",
            },
      compat: {
        supportsReasoningEffort: true,
        supportedReasoningEfforts: supportsNone
          ? ["none", "low", "medium", "high", "xhigh", "max"]
          : ["low", "medium", "high", "xhigh", "max"],
        supportsTemperature: false,
      },
    } as ProviderRuntimeModel);
  }
  if (lower === OPENAI_GPT_61_SOL_MODEL_ID) {
    return normalizeModelCompat({
      id: trimmedModelId,
      name: "GPT-6.1 Sol",
      provider: PROVIDER_ID,
      api: "openai-responses",
      baseUrl: "https://api.openai.com/v1",
      reasoning: true,
      input: ["text", "image"],
      cost: OPENAI_GPT_61_SOL_COST,
      contextWindow: OPENAI_GPT_61_CONTEXT_TOKENS,
      maxTokens: OPENAI_GPT_61_MAX_TOKENS,
      compat: {
        supportsReasoningEffort: true,
        supportedReasoningEfforts: ["low", "medium", "high", "xhigh", "max"],
        supportsTemperature: false,
      },
    } as ProviderRuntimeModel);
  }
  let templateIds: readonly string[];
  let patch: Partial<ProviderRuntimeModel>;
  if (lower === OPENAI_GPT_56_MODEL_ID || isOpenAIGpt56VariantModelId(lower)) {
    templateIds = [OPENAI_GPT_55_MODEL_ID, OPENAI_GPT_54_MODEL_ID];
    patch = {
      api: "openai-responses",
      provider: PROVIDER_ID,
      baseUrl: "https://api.openai.com/v1",
      reasoning: true,
      input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: OPENAI_GPT_56_CONTEXT_TOKENS,
      maxTokens: OPENAI_GPT_56_MAX_TOKENS,
      thinkingLevelMap: OPENAI_GPT_56_THINKING_LEVEL_MAP,
      compat: {
        supportsReasoningEffort: true,
        supportedReasoningEfforts: ["none", "low", "medium", "high", "xhigh", "max"],
        supportsTemperature: false,
      },
    };
  } else if (lower === OPENAI_CHAT_LATEST_MODEL_ID) {
    templateIds = OPENAI_CHAT_LATEST_TEMPLATE_MODEL_IDS;
    patch = {
      api: "openai-responses",
      provider: PROVIDER_ID,
      baseUrl: "https://api.openai.com/v1",
      reasoning: false,
      input: ["text", "image"],
      cost: OPENAI_CHAT_LATEST_COST,
      contextWindow: 400_000,
      maxTokens: OPENAI_GPT_54_MAX_TOKENS,
    };
  } else if (lower === OPENAI_GPT_55_PRO_MODEL_ID) {
    templateIds = OPENAI_GPT_55_PRO_TEMPLATE_MODEL_IDS;
    patch = {
      api: "openai-responses",
      provider: PROVIDER_ID,
      baseUrl: "https://api.openai.com/v1",
      reasoning: true,
      input: ["text", "image"],
      cost: OPENAI_GPT_55_PRO_COST,
      contextWindow: OPENAI_GPT_55_PRO_CONTEXT_TOKENS,
      maxTokens: OPENAI_GPT_54_MAX_TOKENS,
    };
  } else if (lower === OPENAI_GPT_54_MODEL_ID) {
    templateIds = OPENAI_GPT_54_TEMPLATE_MODEL_IDS;
    patch = {
      api: "openai-responses",
      provider: PROVIDER_ID,
      baseUrl: "https://api.openai.com/v1",
      reasoning: true,
      input: ["text", "image"],
      cost: OPENAI_GPT_54_COST,
      contextWindow: OPENAI_GPT_54_CONTEXT_TOKENS,
      maxTokens: OPENAI_GPT_54_MAX_TOKENS,
    };
  } else if (lower === OPENAI_GPT_54_PRO_MODEL_ID) {
    templateIds = OPENAI_GPT_54_PRO_TEMPLATE_MODEL_IDS;
    patch = {
      api: "openai-responses",
      provider: PROVIDER_ID,
      baseUrl: "https://api.openai.com/v1",
      reasoning: true,
      input: ["text", "image"],
      cost: OPENAI_GPT_54_PRO_COST,
      contextWindow: OPENAI_GPT_54_PRO_CONTEXT_TOKENS,
      maxTokens: OPENAI_GPT_54_MAX_TOKENS,
    };
  } else if (lower === OPENAI_GPT_54_MINI_MODEL_ID) {
    templateIds = OPENAI_GPT_54_MINI_TEMPLATE_MODEL_IDS;
    patch = {
      api: "openai-responses",
      provider: PROVIDER_ID,
      baseUrl: "https://api.openai.com/v1",
      reasoning: true,
      input: ["text", "image"],
      cost: OPENAI_GPT_54_MINI_COST,
      contextWindow: OPENAI_GPT_54_MINI_CONTEXT_TOKENS,
      maxTokens: OPENAI_GPT_54_MAX_TOKENS,
    };
  } else if (lower === OPENAI_GPT_54_NANO_MODEL_ID) {
    templateIds = OPENAI_GPT_54_NANO_TEMPLATE_MODEL_IDS;
    patch = {
      api: "openai-responses",
      provider: PROVIDER_ID,
      baseUrl: "https://api.openai.com/v1",
      reasoning: true,
      input: ["text", "image"],
      cost: OPENAI_GPT_54_NANO_COST,
      contextWindow: OPENAI_GPT_54_NANO_CONTEXT_TOKENS,
      maxTokens: OPENAI_GPT_54_MAX_TOKENS,
    };
  } else {
    return undefined;
  }

  const resolved =
    cloneFirstTemplateModel({
      providerId: PROVIDER_ID,
      modelId: trimmedModelId,
      templateIds,
      ctx,
      patch,
    }) ??
    normalizeModelCompat({
      id: trimmedModelId,
      name: trimmedModelId,
      ...patch,
      cost: patch.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: patch.contextWindow ?? DEFAULT_CONTEXT_TOKENS,
      maxTokens: patch.maxTokens ?? DEFAULT_CONTEXT_TOKENS,
    } as ProviderRuntimeModel);
  return resolved ? withConfiguredOpenAICodexOAuthRoute(resolved, ctx.config) : undefined;
}

export function buildOpenAIProvider(): ProviderPlugin {
  return {
    id: PROVIDER_ID,
    label: "OpenAI",
    hookAliases: ["azure-openai", "azure-openai-responses"],
    docsPath: "/providers/models",
    envVars: ["OPENAI_API_KEY"],
    auth: [
      createProviderApiKeyAuthMethod({
        providerId: PROVIDER_ID,
        methodId: "api-key",
        label: OPENAI_API_KEY_LABEL,
        hint: "Use your OpenAI API key directly",
        optionKey: "openaiApiKey",
        flagName: "--openai-api-key",
        envVar: "OPENAI_API_KEY",
        promptMessage: "Enter OpenAI API key",
        defaultModel: OPENAI_DEFAULT_MODEL,
        expectedProviders: ["openai"],
        applyConfig: (cfg) => applyOpenAIConfig(cfg),
        wizard: {
          choiceId: "openai-api-key",
          choiceLabel: OPENAI_API_KEY_LABEL,
          ...OPENAI_API_KEY_WIZARD_GROUP,
        },
      }),
    ],
    resolveDynamicModel: (ctx) => resolveOpenAIGptForwardCompatModel(ctx),
    normalizeResolvedModel: (ctx) => {
      if (normalizeProviderId(ctx.provider) !== PROVIDER_ID) {
        return undefined;
      }
      return withConfiguredOpenAICodexOAuthRoute(normalizeOpenAITransport(ctx.model), ctx.config);
    },
    normalizeTransport: ({ provider, api, baseUrl }) =>
      shouldUseOpenAIResponsesTransport({ provider, api, baseUrl })
        ? { api: "openai-responses", baseUrl }
        : undefined,
    ...buildOpenAIResponsesProviderHooks({ transport: "sse" }),
    matchesContextOverflowError: ({ errorMessage }) =>
      /content_filter.*(?:prompt|input).*(?:too long|exceed)/i.test(errorMessage),
    resolveReasoningOutputMode: () => "native",
    resolveThinkingProfile: ({ modelId }) => resolveOpenAIThinkingProfile(modelId),
    isModernModelRef: ({ modelId }) => matchesExactOrPrefix(modelId, OPENAI_MODERN_MODEL_IDS),
    buildMissingAuthMessage: (ctx) => {
      if (ctx.provider !== PROVIDER_ID || ctx.listProfileIds("openai-codex").length === 0) {
        return undefined;
      }
      return 'No API key found for provider "openai". You are authenticated with OpenAI Codex OAuth; OpenAI agent model runs use openai/gpt-* through the Codex runtime. Set OPENAI_API_KEY only for direct OpenAI API-key surfaces.';
    },
    augmentModelCatalog: (ctx) => {
      const openAiGpt55ProTemplate = findCatalogTemplate({
        entries: ctx.entries,
        providerId: PROVIDER_ID,
        templateIds: OPENAI_GPT_55_PRO_TEMPLATE_MODEL_IDS,
      });
      const openAiGpt54Template = findCatalogTemplate({
        entries: ctx.entries,
        providerId: PROVIDER_ID,
        templateIds: OPENAI_GPT_54_TEMPLATE_MODEL_IDS,
      });
      const openAiGpt54ProTemplate = findCatalogTemplate({
        entries: ctx.entries,
        providerId: PROVIDER_ID,
        templateIds: OPENAI_GPT_54_PRO_TEMPLATE_MODEL_IDS,
      });
      const openAiGpt54MiniTemplate = findCatalogTemplate({
        entries: ctx.entries,
        providerId: PROVIDER_ID,
        templateIds: OPENAI_GPT_54_MINI_TEMPLATE_MODEL_IDS,
      });
      const openAiGpt54NanoTemplate = findCatalogTemplate({
        entries: ctx.entries,
        providerId: PROVIDER_ID,
        templateIds: OPENAI_GPT_54_NANO_TEMPLATE_MODEL_IDS,
      });
      return [
        ...[OPENAI_GPT_56_MODEL_ID, ...OPENAI_GPT_56_VARIANT_MODEL_IDS].map((id) =>
          buildOpenAISyntheticCatalogEntry(openAiGpt54Template, {
            id,
            reasoning: true,
            input: ["text", "image"],
            contextWindow: OPENAI_GPT_56_CONTEXT_TOKENS,
          }),
        ),
        buildOpenAISyntheticCatalogEntry(openAiGpt55ProTemplate, {
          id: OPENAI_GPT_55_PRO_MODEL_ID,
          reasoning: true,
          input: ["text", "image"],
          contextWindow: OPENAI_GPT_55_PRO_CONTEXT_TOKENS,
        }),
        buildOpenAISyntheticCatalogEntry(openAiGpt54Template, {
          id: OPENAI_GPT_54_MODEL_ID,
          reasoning: true,
          input: ["text", "image"],
          contextWindow: OPENAI_GPT_54_CONTEXT_TOKENS,
        }),
        buildOpenAISyntheticCatalogEntry(openAiGpt54ProTemplate, {
          id: OPENAI_GPT_54_PRO_MODEL_ID,
          reasoning: true,
          input: ["text", "image"],
          contextWindow: OPENAI_GPT_54_PRO_CONTEXT_TOKENS,
        }),
        buildOpenAISyntheticCatalogEntry(openAiGpt54MiniTemplate, {
          id: OPENAI_GPT_54_MINI_MODEL_ID,
          reasoning: true,
          input: ["text", "image"],
          contextWindow: OPENAI_GPT_54_MINI_CONTEXT_TOKENS,
        }),
        buildOpenAISyntheticCatalogEntry(openAiGpt54NanoTemplate, {
          id: OPENAI_GPT_54_NANO_MODEL_ID,
          reasoning: true,
          input: ["text", "image"],
          contextWindow: OPENAI_GPT_54_NANO_CONTEXT_TOKENS,
        }),
      ].filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);
    },
  };
}

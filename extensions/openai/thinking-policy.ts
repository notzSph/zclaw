import type { ProviderThinkingProfile } from "openclaw/plugin-sdk/plugin-entry";
import { OPENAI_GPT_61_SOL_MODEL_ID } from "./model-route-contract.js";

const OPENAI_THINKING_BASE_LEVELS = [
  { id: "off" },
  { id: "minimal" },
  { id: "low" },
  { id: "medium" },
  { id: "high" },
] as const satisfies ProviderThinkingProfile["levels"];

const OPENAI_XHIGH_MODEL_IDS = [
  "gpt-5.6",
  "gpt-5.5",
  "gpt-5.5-pro",
  "gpt-5.4",
  "gpt-5.4-pro",
  "gpt-5.4-mini",
  "gpt-5.4-nano",
  "gpt-5.2",
] as const;

const OPENAI_CODEX_XHIGH_MODEL_IDS = [
  "gpt-5.6",
  "gpt-5.5",
  "gpt-5.5-pro",
  "gpt-5.4",
  "gpt-5.4-pro",
] as const;

function normalizeModelId(value: string): string {
  return value.trim().toLowerCase();
}

function matchesExactOrPrefix(id: string, values: readonly string[]): boolean {
  const normalizedId = normalizeModelId(id);
  return values.some((value) => {
    const normalizedValue = normalizeModelId(value);
    return normalizedId === normalizedValue || normalizedId.startsWith(normalizedValue);
  });
}

function buildOpenAIThinkingProfile(params: {
  modelId: string;
  xhighModelIds: readonly string[];
}): ProviderThinkingProfile {
  const modelId = normalizeModelId(params.modelId);
  if (
    modelId === "gpt-6-astra" ||
    modelId === "gpt-6-sol" ||
    modelId === "gpt-6-luna" ||
    modelId === OPENAI_GPT_61_SOL_MODEL_ID
  ) {
    if (modelId === OPENAI_GPT_61_SOL_MODEL_ID) {
      return {
        levels: [{ id: "low" }, { id: "medium" }, { id: "high" }, { id: "xhigh" }, { id: "max" }],
        defaultLevel: "medium",
      };
    }
    return {
      levels: [
        ...(modelId === "gpt-6-astra" ? [] : [{ id: "off" as const }]),
        { id: "low" },
        { id: "medium" },
        { id: "high" },
        { id: "xhigh" },
        { id: "max" },
      ],
      defaultLevel: "medium",
    };
  }
  const isSol = modelId === "gpt-5.6-sol";
  const isTerra = modelId === "gpt-5.6-terra";
  const isLuna = modelId === "gpt-5.6-luna";
  const isGpt56 = modelId === "gpt-5.6" || isSol || isTerra || isLuna;
  return {
    levels: [
      ...OPENAI_THINKING_BASE_LEVELS,
      ...(matchesExactOrPrefix(params.modelId, params.xhighModelIds)
        ? [{ id: "xhigh" as const }]
        : []),
      ...(isGpt56 ? [{ id: "max" as const }] : []),
    ],
    ...(isSol ? { defaultLevel: "low" as const } : {}),
    ...(isTerra || isLuna ? { defaultLevel: "medium" as const } : {}),
  };
}

export function resolveOpenAIThinkingProfile(modelId: string): ProviderThinkingProfile {
  return buildOpenAIThinkingProfile({ modelId, xhighModelIds: OPENAI_XHIGH_MODEL_IDS });
}

export function resolveOpenAICodexThinkingProfile(modelId: string): ProviderThinkingProfile {
  return buildOpenAIThinkingProfile({ modelId, xhighModelIds: OPENAI_CODEX_XHIGH_MODEL_IDS });
}

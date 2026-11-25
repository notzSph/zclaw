export const OPENAI_GPT_56_MODEL_ID = "gpt-5.6";
export const OPENAI_GPT_61_SOL_MODEL_ID = "gpt-6.1-sol";
export const OPENAI_GPT_56_SOL_MODEL_ID = "gpt-5.6-sol";
export const OPENAI_GPT_56_TERRA_MODEL_ID = "gpt-5.6-terra";
export const OPENAI_GPT_56_LUNA_MODEL_ID = "gpt-5.6-luna";

export const OPENAI_GPT_56_VARIANT_MODEL_IDS = [
  OPENAI_GPT_56_SOL_MODEL_ID,
  OPENAI_GPT_56_TERRA_MODEL_ID,
  OPENAI_GPT_56_LUNA_MODEL_ID,
] as const;

const openAIGpt56VariantModelIds = new Set<string>(OPENAI_GPT_56_VARIANT_MODEL_IDS);

export function isOpenAIGpt56VariantModelId(value: string | undefined): boolean {
  return openAIGpt56VariantModelIds.has(value?.trim().toLowerCase() ?? "");
}

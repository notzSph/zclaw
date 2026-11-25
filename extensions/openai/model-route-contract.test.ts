import { describe, expect, it } from "vitest";
import {
  isOpenAIGpt56VariantModelId,
  OPENAI_GPT_61_SOL_MODEL_ID,
  OPENAI_GPT_56_VARIANT_MODEL_IDS,
} from "./model-route-contract.js";

describe("OpenAI GPT-5.6 model routes", () => {
  it("defines the subscription-capable GPT-5.6 variants", () => {
    expect(OPENAI_GPT_56_VARIANT_MODEL_IDS).toEqual([
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
    ]);
  });

  it("matches variants without treating the bare platform model as a variant", () => {
    expect(isOpenAIGpt56VariantModelId(" GPT-5.6-TERRA ")).toBe(true);
    expect(isOpenAIGpt56VariantModelId("gpt-5.6")).toBe(false);
    expect(isOpenAIGpt56VariantModelId("gpt-5.6-terra-preview")).toBe(false);
  });

  it("defines GPT-6.1 Sol as a canonical model id", () => {
    expect(OPENAI_GPT_61_SOL_MODEL_ID).toBe("gpt-6.1-sol");
  });
});

import { describe, expect, it } from "vitest";
import { formatShadowObservation, inspectOutboundText } from "./shadow.js";

describe("watermark-remover shadow mode", () => {
  it("reports suspicious text without a mutation path", () => {
    const report = inspectOutboundText({ content: "a\u200bb", channelId: "discord" });
    expect(report?.suspiciousCount).toBe(1);
    expect(formatShadowObservation(report!)).toContain("count=1");
  });

  it("limits inspection to configured channels", () => {
    expect(inspectOutboundText({ content: "a\u200bb", channelId: "slack" })).toBeUndefined();
  });
});

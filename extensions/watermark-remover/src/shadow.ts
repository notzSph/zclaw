import { inspectText, type InspectionResult } from "@zclaw/watermark-remover";

export function inspectOutboundText(params: {
  content: string;
  channelId: string;
  enabled?: boolean;
  channels?: string[];
}): InspectionResult | undefined {
  if (params.enabled === false || !(params.channels ?? ["discord"]).includes(params.channelId)) {
    return undefined;
  }
  return inspectText(params.content);
}

export function formatShadowObservation(report: InspectionResult): string | undefined {
  if (report.suspiciousCount === 0) {
    return undefined;
  }
  const categories = [...new Set(report.findings.map((finding) => finding.kind))].sort();
  return `watermark-remover: shadow finding count=${report.suspiciousCount} categories=${categories.join(",")}`;
}

export type InspectionFinding = {
  index: number;
  codePoint: string;
  kind: string;
};

export type InspectionResult = {
  inputLength: number;
  suspiciousCount: number;
  findings: InspectionFinding[];
};

export type SanitizationResult = {
  text: string;
  changed: boolean;
  removedCount: number;
  normalizedCount: number;
  findings: string[];
};

export function inspectText(text: string): InspectionResult;
export function sanitizeText(
  text: string,
  options?: { mode?: "safe" | "strict" },
): SanitizationResult;

export const miscExtensionTestRoots = [
  "extensions/active-memory",
  "extensions/bonjour",
  "extensions/brave",
  "extensions/canvas",
  "extensions/codex",
  "extensions/device-pair",
  "extensions/document-extract",
  "extensions/duckduckgo",
  "extensions/exa",
  "extensions/file-transfer",
  "extensions/firecrawl",
  "extensions/google-meet",
  "extensions/llm-task",
  "extensions/openshell",
  "extensions/perplexity",
  "extensions/phone-control",
  "extensions/searxng",
  "extensions/skill-workshop",
  "extensions/tavily",
  "extensions/web-readability",
  "extensions/webhooks",
];

export function isMiscExtensionRoot(root) {
  return miscExtensionTestRoots.includes(root);
}

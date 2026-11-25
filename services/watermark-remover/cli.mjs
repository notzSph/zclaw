#!/usr/bin/env node
import { inspectText, sanitizeText } from "./sanitize.mjs";

const [command = "inspect", mode = "safe"] = process.argv.slice(2);
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const text = Buffer.concat(chunks).toString("utf8");
if (command === "inspect") {
  process.stdout.write(`${JSON.stringify(inspectText(text), null, 2)}\n`);
} else if (command === "sanitize") {
  const result = sanitizeText(text, { mode });
  process.stdout.write(result.text);
  process.stderr.write(`${JSON.stringify({ changed: result.changed, removedCount: result.removedCount, normalizedCount: result.normalizedCount, findings: result.findings })}\n`);
} else {
  process.stderr.write("Usage: cli.mjs <inspect|sanitize> [safe|strict] < input.txt\n");
  process.exitCode = 2;
}

import assert from "node:assert/strict";
import test from "node:test";
import { inspectText, sanitizeText } from "./sanitize.mjs";

test("safe mode removes invisible controls", () => assert.equal(sanitizeText("Hello\u200bWorld\u00ad!").text, "HelloWorld!"));
test("safe mode preserves emoji and Arabic directionality", () => {
  const input = "👨‍👩‍👧 السعر \u2066123 USD\u2069\u200f";
  assert.equal(sanitizeText(input).text, input);
});
test("safe mode removes bidi overrides", () => assert.equal(sanitizeText("abc\u202edef\u202c").text, "abcdef"));
test("strict mode normalizes unusual spaces and strips private-use characters", () => {
  const result = sanitizeText("a\u2003b\ue000", { mode: "strict" });
  assert.equal(result.text, "a b");
  assert.equal(result.normalizedCount, 1);
});
test("inspection reports a codepoint without changing input", () => {
  const report = inspectText("x\u200by");
  assert.equal(report.suspiciousCount, 1);
  assert.equal(report.findings[0].codePoint, "U+200B");
});

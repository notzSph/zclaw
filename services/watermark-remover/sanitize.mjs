const SAFE_REMOVE = new Set([0x00ad, 0x034f, 0x180e, 0x200b, 0x2060]);
const BIDI_OVERRIDES = new Set([0x202a, 0x202b, 0x202c, 0x202d, 0x202e]);
const STRICT_REMOVE = new Set([0x200c, 0x200d, 0x200e, 0x200f, 0x2061, 0x2062, 0x2063, 0x2064, 0x2066, 0x2067, 0x2068, 0x2069]);
const SPACE_REPLACEMENTS = new Set([0x00a0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x202f, 0x205f, 0x3000]);

function category(codePoint) {
  if (codePoint === 0x00ad) return "soft_hyphen";
  if (codePoint === 0x200b || codePoint === 0x2060 || codePoint === 0xfeff) return "zero_width";
  if (BIDI_OVERRIDES.has(codePoint)) return "bidi_override";
  if (codePoint >= 0xe0001 && codePoint <= 0xe007f) return "tag_character";
  if (codePoint >= 0xe000 && codePoint <= 0xf8ff) return "private_use";
  if (SPACE_REPLACEMENTS.has(codePoint)) return "unusual_space";
  if (STRICT_REMOVE.has(codePoint)) return "format_control";
  return null;
}

function flagTagIndices(chars) {
  const protectedIndices = new Set();
  for (let start = 0; start < chars.length; start += 1) {
    if (chars[start] !== "🏴") continue;
    let cursor = start + 1;
    while (cursor < chars.length && chars[cursor].codePointAt(0) >= 0xe0020 && chars[cursor].codePointAt(0) <= 0xe007e) cursor += 1;
    if (cursor > start + 1 && chars[cursor]?.codePointAt(0) === 0xe007f) {
      for (let index = start; index <= cursor; index += 1) protectedIndices.add(index);
    }
  }
  return protectedIndices;
}

/** Inspect suspicious or potentially disruptive Unicode without mutating text. */
export function inspectText(text) {
  const chars = Array.from(text);
  const protectedIndices = flagTagIndices(chars);
  const findings = [];
  for (let index = 0; index < chars.length; index += 1) {
    if (protectedIndices.has(index)) continue;
    const codePoint = chars[index].codePointAt(0);
    const kind = category(codePoint);
    if (kind) findings.push({ index, codePoint: `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`, kind });
  }
  return { inputLength: chars.length, suspiciousCount: findings.length, findings };
}

/** Clean text-only input; safe mode preserves emoji and language-directionality. */
export function sanitizeText(text, { mode = "safe" } = {}) {
  if (mode !== "safe" && mode !== "strict") throw new Error(`Unsupported mode: ${mode}`);
  const chars = Array.from(text);
  const protectedIndices = flagTagIndices(chars);
  const output = [];
  const removed = [];
  let normalizedCount = 0;

  for (let index = 0; index < chars.length; index += 1) {
    const codePoint = chars[index].codePointAt(0);
    const remove = SAFE_REMOVE.has(codePoint)
      || BIDI_OVERRIDES.has(codePoint)
      || (codePoint === 0xfeff && index > 0)
      || ((codePoint >= 0xe0001 && codePoint <= 0xe007f) && !protectedIndices.has(index))
      || (mode === "strict" && (STRICT_REMOVE.has(codePoint) || (codePoint >= 0xe000 && codePoint <= 0xf8ff)));
    if (remove) {
      removed.push(category(codePoint) ?? "format_control");
      continue;
    }
    if (mode === "strict" && SPACE_REPLACEMENTS.has(codePoint)) {
      output.push(" ");
      normalizedCount += 1;
      continue;
    }
    output.push(chars[index]);
  }

  const cleaned = output.join("");
  return { text: cleaned, changed: cleaned !== text, removedCount: removed.length, normalizedCount, findings: [...new Set(removed)] };
}

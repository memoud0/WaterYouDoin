/**
 * Normalize user prompt text so that:
 * - heuristics are consistent (case/spacing/punctuation)
 * - duplicate hashing is stable
 * - features behave predictably
 */
export function normalize(raw: string): string {
  if (!raw) return "";

  // Unicode normalize helps unify visually-similar characters
  let s = raw.normalize("NFKC");

  // Lowercase + trim
  s = s.toLowerCase().trim();

  // Remove apostrophes to normalize contractions (what's -> whats)
  s = s.replace(/['’]+/g, "");

  // Collapse whitespace
  s = s.replace(/\s+/g, " ");

  // Strip leading/trailing “noise” punctuation, but keep internal punctuation
  s = s.replace(/^[\s"'`“”‘’.,!?():;\[\]{}]+/, "");
  s = s.replace(/[\s"'`“”‘’.,!?():;\[\]{}]+$/, "");

  return s;
}

/** Lightweight tokenization: enough for length-based heuristics/features. */
export function tokenize(normalized: string): string[] {
  if (!normalized) return [];
  return normalized.split(/\s+/).filter(Boolean);
}

/** True if string contains no alphanumerics (emoji/punct-only). */
export function isMostlyEmojiOrPunct(normalized: string): boolean {
  if (!normalized) return false;
  const hasAlphaNum = /[a-z0-9]/i.test(normalized);
  const hasNonSpace = /\S/.test(normalized);
  return hasNonSpace && !hasAlphaNum;
}

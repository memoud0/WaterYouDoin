import { Features } from "./features";
import { clamp01 } from "./thresholds";

// LOW-VALUE patterns: keep these strict to avoid false blocks.
const LOW_VALUE_EXACT = new Set([
  "hi", "hello", "hey", "yo",
  "thanks", "thank you", "thx",
  "ok", "okay", "k", "cool", "nice",
  "lol", "lmao",
  "got it", "makes sense", "awesome",
]);

const RE_ONLY_PUNCT_OR_EMOJI = /^[^a-z0-9]+$/i;

// FACTUAL starters (expanded)
const RE_FACT_START =
  /^(what is|what does|what are|who is|when did|when was|where is|define|definition of|meaning of|capital of|population of|timezone of|how many|how much)\b/i;

// Strong lookup "noun-of" patterns (these were the missing cases)
const RE_STRONG_LOOKUP_OF =
  /^(timezone of|population of|capital of|definition of|meaning of|syntax for|release date of)\b/i;

// More factual lookup phrases
const RE_LOOKUP_PHRASE =
  /\b(meaning|definition|timezone|capital|population|height|age|birthday|release date|syntax|version|ports?)\b/i;

// Strong reasoning verbs
const RE_REASONING_STRONG =
  /\b(implement|design|debug|fix|optimize|refactor|tradeoffs?|architecture|approach|strategy)\b/i;

export type ScoreResult = {
  score: number;      // 0..1
  signals: string[];
};

export function lowValueScore(normalized: string, f: Features): ScoreResult {
  const signals: string[] = [];
  let score = 0;

  if (!normalized) {
    return { score: 1, signals: ["empty_prompt"] };
  }

  if (LOW_VALUE_EXACT.has(normalized)) {
    return { score: 0.99, signals: ["low_value_exact"] };
  }

  if (f.lenTokens <= 2) {
    score += 0.45;
    signals.push("very_short");
  } else if (f.lenTokens <= 4) {
    score += 0.2;
    signals.push("short");
  }

  if (RE_ONLY_PUNCT_OR_EMOJI.test(normalized)) {
    score += 0.65;
    signals.push("punct_or_emoji_only");
  }

  // Existing "question-like" penalty
  if (f.startsWithWh || /\?$/.test(normalized)) {
    score -= 0.25;
    signals.push("looks_like_question");
  }

  // If it has factual/lookup cues, it should NOT be treated as low-value just for being short.
  if (f.hasDefine || f.hasDatePattern) {
    score -= 0.35;
    signals.push("factual_like_penalty");
  }

  if (f.hasCodeTokens || f.hasErrorWords || f.hasBuildVerbs) {
    score -= 0.6;
    signals.push("has_substance");
  }

  return { score: clamp01(score), signals };
}


export function factualScore(normalized: string, f: Features): ScoreResult {
  const signals: string[] = [];
  let score = 0;

  // Very strong lookup forms even without WH-words
  if (RE_STRONG_LOOKUP_OF.test(normalized)) {
    score += 0.85;
    signals.push("strong_lookup_of");
  }

  if (RE_FACT_START.test(normalized)) {
    score += 0.72;
    signals.push("factual_starter");
  }

  if (f.startsWithWh) {
    score += 0.22;
    signals.push("starts_with_wh");
  }
  if (f.hasDefine) {
    score += 0.28;
    signals.push("has_define");
  }
  if (f.hasDatePattern) {
    score += 0.16;
    signals.push("has_date_pattern");
  }
  if (RE_LOOKUP_PHRASE.test(normalized)) {
    score += 0.22;
    signals.push("lookup_phrase");
  }

  // Boost short lookup-ish prompts like "timezone of montreal"
  if (RE_LOOKUP_PHRASE.test(normalized) && f.lenTokens <= 6 && !f.hasBuildVerbs && !f.hasCodeTokens) {
    score += 0.25;
    signals.push("short_lookup_boost");
  }

  // Penalize deep-work signals
  if (f.hasCodeTokens) {
    score -= 0.5;
    signals.push("code_tokens_penalty");
  }
  if (f.hasErrorWords) {
    score -= 0.4;
    signals.push("error_words_penalty");
  }
  if (f.hasBuildVerbs || f.hasCompareWords || RE_REASONING_STRONG.test(normalized)) {
    score -= 0.35;
    signals.push("reasoning_words_penalty");
  }

  if (f.lenTokens >= 40) {
    score -= 0.2;
    signals.push("very_long_penalty");
  }

  return { score: clamp01(score), signals };
}

export function reasoningScore(normalized: string, f: Features): ScoreResult {
  const signals: string[] = [];
  let score = 0;

  if (f.hasCodeTokens) {
    score += 0.45;
    signals.push("has_code_tokens");
  }
  if (f.hasErrorWords) {
    score += 0.35;
    signals.push("has_error_words");
  }
  if (f.hasBuildVerbs) {
    score += 0.3;
    signals.push("has_build_verbs");
  }
  if (f.hasCompareWords) {
    score += 0.25;
    signals.push("has_compare_words");
  }
  if (RE_REASONING_STRONG.test(normalized)) {
    score += 0.25;
    signals.push("reasoning_strong_words");
  }

  if (f.lenTokens >= 18) {
    score += 0.15;
    signals.push("long_prompt");
  }

  if (RE_FACT_START.test(normalized) || f.hasDefine || RE_STRONG_LOOKUP_OF.test(normalized)) {
    score -= 0.25;
    signals.push("factual_hint_penalty");
  }

  return { score: clamp01(score), signals };
}

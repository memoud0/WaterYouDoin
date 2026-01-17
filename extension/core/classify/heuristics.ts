// extension/core/classify/heuristics.ts

import { Features } from "./features";
import { clamp01 } from "./thesholds";

// LOW-VALUE patterns: keep these strict to avoid false blocks.
const LOW_VALUE_EXACT = new Set([
  "hi", "hello", "hey", "yo",
  "thanks", "thank you", "thx",
  "ok", "okay", "k", "cool", "nice",
  "lol", "lmao",
  "got it", "makes sense", "awesome",
]);

const RE_ONLY_PUNCT_OR_EMOJI = /^[^a-z0-9]+$/i;

// FACTUAL starters
const RE_FACT_START = /^(what is|who is|when did|when was|where is|define|definition of|meaning of|capital of|population of)\b/i;

// Helpful “factual-like” patterns
const RE_LOOKUP_PHRASE = /\b(meaning|definition|timezone|capital|population|height|age|birthday|release date|syntax)\b/i;

// If the prompt contains strong reasoning verbs, that’s a pull toward REASONING
const RE_REASONING_STRONG = /\b(implement|design|debug|fix|optimize|refactor|tradeoffs?|architecture|approach|strategy)\b/i;

export type ScoreResult = {
  score: number;      // 0..1
  signals: string[];
};

/**
 * Low-value: greetings/acks/empty/no-content.
 * Be conservative (high precision).
 */
export function lowValueScore(normalized: string, f: Features): ScoreResult {
  const signals: string[] = [];
  let score = 0;

  if (!normalized) {
    return { score: 1, signals: ["empty_prompt"] };
  }

  if (LOW_VALUE_EXACT.has(normalized)) {
    return { score: 0.99, signals: ["low_value_exact"] };
  }

  // Very short + no “question-ness”
  if (f.lenTokens <= 2) {
    score += 0.45;
    signals.push("very_short");
  } else if (f.lenTokens <= 4) {
    score += 0.2;
    signals.push("short");
  }

  // Emoji/punct-only (or almost)
  if (RE_ONLY_PUNCT_OR_EMOJI.test(normalized)) {
    score += 0.65;
    signals.push("punct_or_emoji_only");
  }

  // If it looks like a real question or has substantive tokens, push score down.
  if (f.startsWithWh || /\?$/.test(normalized)) {
    score -= 0.25;
    signals.push("looks_like_question");
  }
  if (f.hasCodeTokens || f.hasErrorWords || f.hasBuildVerbs) {
    score -= 0.6;
    signals.push("has_substance");
  }

  return { score: clamp01(score), signals };
}

/**
 * Factual: likely a quick lookup / definition / single-answer query.
 */
export function factualScore(normalized: string, f: Features): ScoreResult {
  const signals: string[] = [];
  let score = 0;

  if (RE_FACT_START.test(normalized)) {
    score += 0.6;
    signals.push("factual_starter");
  }
  if (f.startsWithWh) {
    score += 0.18;
    signals.push("starts_with_wh");
  }
  if (f.hasDefine) {
    score += 0.2;
    signals.push("has_define");
  }
  if (f.hasDatePattern) {
    score += 0.12;
    signals.push("has_date_pattern");
  }
  if (RE_LOOKUP_PHRASE.test(normalized)) {
    score += 0.18;
    signals.push("lookup_phrase");
  }

  // Penalize if it looks like deep work
  if (f.hasCodeTokens) {
    score -= 0.45;
    signals.push("code_tokens_penalty");
  }
  if (f.hasErrorWords) {
    score -= 0.35;
    signals.push("error_words_penalty");
  }
  if (f.hasBuildVerbs || f.hasCompareWords || RE_REASONING_STRONG.test(normalized)) {
    score -= 0.35;
    signals.push("reasoning_words_penalty");
  }

  // “Too long” tends to be reasoning-heavy
  if (f.lenTokens >= 40) {
    score -= 0.2;
    signals.push("very_long_penalty");
  }

  return { score: clamp01(score), signals };
}

/**
 * Reasoning: problem-solving, debugging, design, comparisons.
 * You’ll usually end up here when factual/low-value are below thresholds.
 */
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

  // Length boosts reasoning a bit
  if (f.lenTokens >= 18) {
    score += 0.15;
    signals.push("long_prompt");
  }

  // If it’s clearly a lookup, reduce reasoning a bit.
  if (RE_FACT_START.test(normalized) || f.hasDefine) {
    score -= 0.2;
    signals.push("factual_hint_penalty");
  }

  return { score: clamp01(score), signals };
}

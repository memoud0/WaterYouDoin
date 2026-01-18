import { Features } from "./features";
import { clamp01 } from "./thresholds";

const LOW_VALUE_EXACT = new Set([
  "hi", "hello", "hey", "yo",
  "thanks", "thank you", "thx",
  "ok", "okay", "k", "cool", "nice",
  "lol", "lmao",
  "got it", "makes sense", "awesome",
]);

const RE_ONLY_PUNCT_OR_EMOJI = /^[^a-z0-9]+$/i;

const RE_FACT_START =
  /^(what is|what does|what are|who is|when did|when was|where is|define|definition of|meaning of|capital of|population of|timezone of|how many|how much)\b/i;

// include "syntax for" here too
const RE_STRONG_LOOKUP_OF =
  /^(timezone of|population of|capital of|definition of|meaning of|syntax for|release date of)\b/i;

const RE_LOOKUP_PHRASE =
  /\b(meaning|definition|timezone|capital|population|height|age|birthday|release date|syntax|version|ports?)\b/i;

const RE_REASONING_STRONG =
  /\b(implement|design|debug|fix|optimize|reduce|refactor|tradeoffs?|architecture|approach|strategy)\b/i;

// Short but meaningful lookups/acronyms that should not be treated as low-value
const RE_SHORT_MEANINGFUL =
  /^(jwt( exp| iat| aud| iss)?|cors|grpc|etag|protobuf|gzip|base64|sha[- ]?256|utf[- ]?8|sql join|ts generics|regex lookbehind|tcp handshake|dns ttl|http 418|ssh keys?|docker compose|k8s ingress|sqlite pragma|git rebase|npm audit|python venv|react memo|oauth flow)$/i;

export type ScoreResult = { score: number; signals: string[] };

export function lowValueScore(normalized: string, f: Features): ScoreResult {
  const signals: string[] = [];
  let score = 0;

  if (!normalized) return { score: 1, signals: ["empty_prompt"] };
  if (RE_SHORT_MEANINGFUL.test(normalized)) return { score: 0, signals: ["short_meaningful_whitelist"] };
  if (LOW_VALUE_EXACT.has(normalized)) return { score: 0.99, signals: ["low_value_exact"] };

  if (f.lenTokens <= 2) { score += 0.45; signals.push("very_short"); }
  else if (f.lenTokens <= 4) { score += 0.2; signals.push("short"); }

  if (RE_ONLY_PUNCT_OR_EMOJI.test(normalized)) { score += 0.65; signals.push("punct_or_emoji_only"); }

  if (f.startsWithWh || /\?$/.test(normalized)) { score -= 0.25; signals.push("looks_like_question"); }

  if (f.hasDefine || f.hasDatePattern) { score -= 0.35; signals.push("factual_like_penalty"); }

  if (f.hasCodeTokens || f.hasErrorWords || f.hasBuildVerbs) { score -= 0.6; signals.push("has_substance"); }

  return { score: clamp01(score), signals };
}

export function factualScore(normalized: string, f: Features): ScoreResult {
  const signals: string[] = [];
  let score = 0;

  const startsStrongLookup = RE_STRONG_LOOKUP_OF.test(normalized);

  const hasOtherReasoningCues =
    f.hasErrorWords || f.hasBuildVerbs || f.hasCompareWords || RE_REASONING_STRONG.test(normalized);

  const isLookupPhraseOnly = f.hasLookupPhrase && !hasOtherReasoningCues;

  const isLookupish = startsStrongLookup || isLookupPhraseOnly;

  if (startsStrongLookup) {
    score += 0.85;
    signals.push("strong_lookup_of");
  }
  if (isLookupPhraseOnly) {
    score += 0.55;
    signals.push("lookup_phrase_only");
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
  if (f.hasLookupPhrase) {
    score += 0.22;
    signals.push("lookup_phrase");
  }

  // ✅ key rule: don’t punish code tokens if the whole prompt is a lookup
  if (f.hasCodeTokens && !(isLookupish && !hasOtherReasoningCues)) {
    score -= 0.5;
    signals.push("code_tokens_penalty");
  } else if (f.hasCodeTokens && isLookupish && !hasOtherReasoningCues) {
    signals.push("code_tokens_in_lookup_ok");
  }

  if (f.hasErrorWords) {
    score -= 0.4;
    signals.push("error_words_penalty");
  }
  if (hasOtherReasoningCues) {
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

  const startsStrongLookup = RE_STRONG_LOOKUP_OF.test(normalized);

  const hasOtherReasoningCues =
    f.hasErrorWords || f.hasBuildVerbs || f.hasCompareWords || RE_REASONING_STRONG.test(normalized);

  const isLookupPhraseOnly = f.hasLookupPhrase && !hasOtherReasoningCues;
  const isLookupish = startsStrongLookup || isLookupPhraseOnly;

  if (f.hasCodeTokens && !(isLookupish && !hasOtherReasoningCues)) {
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

  if (RE_FACT_START.test(normalized) || f.hasDefine || startsStrongLookup || isLookupPhraseOnly) {
    score -= 0.25;
    signals.push("factual_hint_penalty");
  }

  return { score: clamp01(score), signals };
}

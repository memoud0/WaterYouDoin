import { extractFeatures } from "./features";
import { factualScore, lowValueScore, reasoningScore } from "./heuristics";
import { DEFAULT_THRESHOLDS, applyStrictness, Classification, clamp01 } from "./thresholds";
import { mlPredictProbs, ModelWeights } from "./model";
import { normalize } from "../utils/text";
import { fnv1a32 } from "../utils/hash";

export type ClassifyContext = {
  lastHash?: string;
  lastTimestamp?: number;
  nowTimestamp?: number;
  duplicateWindowMs?: number;
  strictness?: number;
  modelWeights?: ModelWeights;
};

export type ClassificationResult = {
  classification: Classification;
  confidence: number;
  signals: string[];
  probs?: Record<Classification, number>;
};

export function factualOrNot(promptRaw: string, ctx: ClassifyContext = {}): ClassificationResult {
  const signals: string[] = [];

  const now = ctx.nowTimestamp ?? Date.now();
  const duplicateWindowMs = ctx.duplicateWindowMs ?? 8000;

  const normalized = normalize(promptRaw);
  const f = extractFeatures(normalized);

  // 1) Duplicate check FIRST
  const hash = fnv1a32(normalized);
  if (ctx.lastHash && ctx.lastTimestamp && ctx.lastHash === hash && now - ctx.lastTimestamp <= duplicateWindowMs) {
    return {
      classification: "LOW_VALUE",
      confidence: 0.95,
      signals: ["duplicate_prompt"],
    };
  }

  // 2) Low-value early exit
  const low = lowValueScore(normalized, f);
  signals.push(...low.signals);

  const thresholds = applyStrictness(DEFAULT_THRESHOLDS, ctx.strictness);

  if (low.score >= thresholds.lowValue) {
    return {
      classification: "LOW_VALUE",
      confidence: clamp01(low.score),
      signals,
    };
  }

  // 3) Heuristic scores
  const fact = factualScore(normalized, f);
  const reas = reasoningScore(normalized, f);
  signals.push(...fact.signals, ...reas.signals);

  // Normalize heuristic “strength scores” into probabilities
  const heurProbs = normalizeScores3({
    FACTUAL: fact.score,
    LOW_VALUE: low.score,
    REASONING: reas.score,
  });

  // 4) Optional ML fallback when heuristics are unsure
  let finalProbs = { ...heurProbs };
  const heurMax = Math.max(finalProbs.FACTUAL, finalProbs.LOW_VALUE, finalProbs.REASONING);

  if (heurMax < 0.75) {
    const x = featureVector(f);
    const ml = mlPredictProbs(x, ctx.modelWeights);
    if (ml) {
      signals.push(...ml.signals);
      const mlNorm = normalize3(ml.probs);

      // Blend (heuristics still primary)
      finalProbs = {
        FACTUAL: 0.75 * heurProbs.FACTUAL + 0.25 * mlNorm.FACTUAL,
        LOW_VALUE: 0.75 * heurProbs.LOW_VALUE + 0.25 * mlNorm.LOW_VALUE,
        REASONING: 0.75 * heurProbs.REASONING + 0.25 * mlNorm.REASONING,
      };
      finalProbs = normalize3(finalProbs);
    }
  }

  const best = argmax3(finalProbs);
  const confidence = clamp01(finalProbs[best]);

  if (finalProbs.LOW_VALUE >= thresholds.lowValue) {
    return { classification: "LOW_VALUE", confidence: finalProbs.LOW_VALUE, signals, probs: finalProbs };
  }
  if (finalProbs.FACTUAL >= thresholds.factual) {
    return { classification: "FACTUAL", confidence: finalProbs.FACTUAL, signals, probs: finalProbs };
  }

  // Force long prompts into reasoning if not clearly factual/low-value
  if (f.lenTokens >= 80) {
    return { classification: "REASONING", confidence: Math.max(confidence, 0.8), signals: [...signals, "forced_long_reasoning"], probs: finalProbs };
  }

  return { classification: "REASONING", confidence, signals, probs: finalProbs };
}

function featureVector(f: ReturnType<typeof extractFeatures>): number[] {
  return [
    f.lenTokens,
    f.startsWithWh ? 1 : 0,
    f.hasDefine ? 1 : 0,
    f.hasDatePattern ? 1 : 0,
    f.hasCodeTokens ? 1 : 0,
    f.hasErrorWords ? 1 : 0,
    f.hasCompareWords ? 1 : 0,
    f.hasBuildVerbs ? 1 : 0,
    f.hasLookupPhrase ? 1 : 0,
    f.isStrongLookupStart ? 1 : 0,
  ];
}

function normalizeScores3(scores: Record<Classification, number>): Record<Classification, number> {
  const PRIOR_FACTUAL = 0.05;
  const PRIOR_REASONING = 0.10;
  const PRIOR_LOW_VALUE = 0.00;

  const f = Math.max(0, scores.FACTUAL) + PRIOR_FACTUAL;
  const l = Math.max(0, scores.LOW_VALUE) + PRIOR_LOW_VALUE;
  const r = Math.max(0, scores.REASONING) + PRIOR_REASONING;

  const sum = f + l + r || 1;

  return {
    FACTUAL: f / sum,
    LOW_VALUE: l / sum,
    REASONING: r / sum,
  };
}

function normalize3(p: Record<Classification, number>): Record<Classification, number> {
  const sum = p.FACTUAL + p.LOW_VALUE + p.REASONING || 1;
  return { FACTUAL: p.FACTUAL / sum, LOW_VALUE: p.LOW_VALUE / sum, REASONING: p.REASONING / sum };
}

function argmax3(p: Record<Classification, number>): Classification {
  if (p.FACTUAL >= p.LOW_VALUE && p.FACTUAL >= p.REASONING) return "FACTUAL";
  if (p.LOW_VALUE >= p.FACTUAL && p.LOW_VALUE >= p.REASONING) return "LOW_VALUE";
  return "REASONING";
}

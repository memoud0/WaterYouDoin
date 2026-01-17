import { extractFeatures } from "./features";
import { factualScore, lowValueScore, reasoningScore } from "./heuristics";
import { DEFAULT_THRESHOLDS, applyStrictness, Classification, clamp01 } from "./thresholds";
import { mlPredictProbs, ModelWeights } from "./model";
import { normalize } from "../utils/text";
import { fnv1a32 } from "../utils/hash";

/**
 * Context gives you optional duplicate detection + threshold tuning.
 * In the blueprint, duplicate info often lives in storage; background can pass it in.
 */
export type ClassifyContext = {
  // duplicate detection
  lastHash?: string;
  lastTimestamp?: number;
  nowTimestamp?: number;
  duplicateWindowMs?: number;

  // threshold tuning (e.g., from settings)
  strictness?: number;

  // optional ML weights
  modelWeights?: ModelWeights;
};

export type ClassificationResult = {
  classification: Classification;
  confidence: number; // 0..1
  signals: string[];
  probs?: Record<Classification, number>;
};

/**
 * MAIN: classify prompt into FACTUAL / LOW_VALUE / REASONING.
 */
export function factualOrNot(promptRaw: string, ctx: ClassifyContext = {}): ClassificationResult {
  const signals: string[] = [];

  const now = ctx.nowTimestamp ?? Date.now();
  const duplicateWindowMs = ctx.duplicateWindowMs ?? 8000;

  const normalized = normalize(promptRaw);
  const f = extractFeatures(normalized);

  // ---- 1) Low-value early exit (fast & strict)
  const low = lowValueScore(normalized, f);
  signals.push(...low.signals);

  // ---- 2) Duplicate check (optional but strong)
  const hash = fnv1a32(normalized);
  if (ctx.lastHash && ctx.lastTimestamp && ctx.lastHash === hash && now - ctx.lastTimestamp <= duplicateWindowMs) {
    return {
      classification: "LOW_VALUE",
      confidence: 0.95,
      signals: [...signals, "duplicate_prompt"],
    };
  }

  const thresholds = applyStrictness(DEFAULT_THRESHOLDS, ctx.strictness);

  if (low.score >= thresholds.lowValue) {
    return {
      classification: "LOW_VALUE",
      confidence: clamp01(low.score),
      signals,
    };
  }

  // ---- 3) Heuristic scores
  const fact = factualScore(normalized, f);
  const reas = reasoningScore(normalized, f);
  signals.push(...fact.signals, ...reas.signals);

  // Convert heuristic scores into probabilities via softmax (simple + stable)
  const heurProbs = softmax3({
    FACTUAL: fact.score,
    LOW_VALUE: low.score,
    REASONING: reas.score,
  });

  // ---- 4) Optional ML fallback when heuristics are unsure
  let finalProbs = { ...heurProbs };
  const heurMax = Math.max(finalProbs.FACTUAL, finalProbs.LOW_VALUE, finalProbs.REASONING);

  if (heurMax < 0.75) {
    // Build a tiny feature vector for ML (numbers only)
    const x = featureVector(f);

    const ml = mlPredictProbs(x, ctx.modelWeights);
    if (ml) {
      signals.push(...ml.signals);

      // One-vs-rest probs -> normalize to sum to 1 (for combining)
      const mlNorm = normalize3(ml.probs);

      // Blend (heuristics are primary; ML just nudges)
      finalProbs = {
        FACTUAL: 0.75 * heurProbs.FACTUAL + 0.25 * mlNorm.FACTUAL,
        LOW_VALUE: 0.75 * heurProbs.LOW_VALUE + 0.25 * mlNorm.LOW_VALUE,
        REASONING: 0.75 * heurProbs.REASONING + 0.25 * mlNorm.REASONING,
      };

      // Normalize after blending
      finalProbs = normalize3(finalProbs);
    }
  }

  // ---- 5) Apply thresholds → final class
  const best = argmax3(finalProbs);
  const confidence = clamp01(finalProbs[best]);

  // Blueprint rule: if low-value >= threshold => LOW_VALUE, else if factual >= threshold => FACTUAL, else REASONING.
  // Also: bias toward REASONING when unsure (safer UX than redirect/block).
  if (finalProbs.LOW_VALUE >= thresholds.lowValue) {
    return { classification: "LOW_VALUE", confidence: finalProbs.LOW_VALUE, signals, probs: finalProbs };
  }
  if (finalProbs.FACTUAL >= thresholds.factual) {
    return { classification: "FACTUAL", confidence: finalProbs.FACTUAL, signals, probs: finalProbs };
  }
  return { classification: "REASONING", confidence, signals, probs: finalProbs };
}

function featureVector(f: ReturnType<typeof extractFeatures>): number[] {
  // Keep ordering stable if you ever train weights!
  return [
    f.lenTokens,
    f.startsWithWh ? 1 : 0,
    f.hasDefine ? 1 : 0,
    f.hasDatePattern ? 1 : 0,
    f.hasCodeTokens ? 1 : 0,
    f.hasErrorWords ? 1 : 0,
    f.hasCompareWords ? 1 : 0,
    f.hasBuildVerbs ? 1 : 0,
  ];
}

function softmax3(scores: Record<Classification, number>): Record<Classification, number> {
  const m = Math.max(scores.FACTUAL, scores.LOW_VALUE, scores.REASONING);
  const eF = Math.exp(scores.FACTUAL - m);
  const eL = Math.exp(scores.LOW_VALUE - m);
  const eR = Math.exp(scores.REASONING - m);
  const sum = eF + eL + eR || 1;
  return {
    FACTUAL: eF / sum,
    LOW_VALUE: eL / sum,
    REASONING: eR / sum,
  };
}

function normalize3(p: Record<Classification, number>): Record<Classification, number> {
  const sum = p.FACTUAL + p.LOW_VALUE + p.REASONING || 1;
  return {
    FACTUAL: p.FACTUAL / sum,
    LOW_VALUE: p.LOW_VALUE / sum,
    REASONING: p.REASONING / sum,
  };
}

function argmax3(p: Record<Classification, number>): Classification {
  if (p.FACTUAL >= p.LOW_VALUE && p.FACTUAL >= p.REASONING) return "FACTUAL";
  if (p.LOW_VALUE >= p.FACTUAL && p.LOW_VALUE >= p.REASONING) return "LOW_VALUE";
  return "REASONING";
}

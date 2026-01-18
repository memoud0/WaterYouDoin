import { clamp01 } from  "./thresholds"

export type ModelClass = "FACTUAL" | "LOW_VALUE" | "REASONING";

export interface ModelWeights {
  version: number;
  classes: ("FACTUAL" | "LOW_VALUE" | "REASONING")[];
  featureOrder: string[];
  weights: Record<"FACTUAL" | "LOW_VALUE" | "REASONING", ClassWeights>;
}

export interface ClassWeights {
  w: number[];
  b: number;
}

export type ModelResult = {
  probs: Record<ModelClass, number>; // softmax-normalized 0..1
  signals: string[];
};

/**
 * Optional: pass weights in from an import (JSON) or from build pipeline.
 * Keep synchronous; do NOT fetch network.
 */
export function mlPredictProbs(x: number[], weights?: ModelWeights): ModelResult | null {
  if (!weights) return null;

  const signals: string[] = ["ml_used_softmax"];
  const logits: Record<ModelClass, number> = {
    FACTUAL: 0,
    LOW_VALUE: 0,
    REASONING: 0,
  };

  for (const c of weights.classes) {
    const { b, w } = weights.weights[c];
    logits[c] = dot(w, x) + b;
  }

  const probs = softmax(logits);
  return { probs, signals };
}

function dot(w: number[], x: number[]): number {
  const n = Math.min(w.length, x.length);
  let s = 0;
  for (let i = 0; i < n; i++) s += w[i] * x[i];
  return s;
}

function softmax(p: Record<ModelClass, number>): Record<ModelClass, number> {
  // numerically stable softmax for 3 classes
  const vals = [p.FACTUAL, p.LOW_VALUE, p.REASONING];
  const m = Math.max(...vals);
  const exps = vals.map((v) => Math.exp(v - m));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return {
    FACTUAL: exps[0] / sum,
    LOW_VALUE: exps[1] / sum,
    REASONING: exps[2] / sum,
  };
}

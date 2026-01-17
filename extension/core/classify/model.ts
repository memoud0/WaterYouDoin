// extension/core/classify/model.ts

import { clamp01 } from  "./thesholds"

export type ModelClass = "FACTUAL" | "LOW_VALUE" | "REASONING";

export type ModelWeights = {
  version: number;
  classes: ModelClass[];
  // For one-vs-rest logistic regression:
  // score_c = sigmoid(b_c + w_c · x)
  weights: Record<ModelClass, { b: number; w: number[] }>;
};

export type ModelResult = {
  probs: Record<ModelClass, number>; // 0..1 (not necessarily summing to 1 if one-vs-rest)
  signals: string[];
};

/**
 * Optional: pass weights in from an import (JSON) or from build pipeline.
 * Keep synchronous; do NOT fetch network.
 */
export function mlPredictProbs(x: number[], weights?: ModelWeights): ModelResult | null {
  if (!weights) return null;

  const signals: string[] = ["ml_used"];
  const probs: Record<ModelClass, number> = {
    FACTUAL: 0,
    LOW_VALUE: 0,
    REASONING: 0,
  };

  for (const c of weights.classes) {
    const { b, w } = weights.weights[c];
    probs[c] = clamp01(sigmoid(dot(w, x) + b));
  }

  return { probs, signals };
}

function dot(w: number[], x: number[]): number {
  const n = Math.min(w.length, x.length);
  let s = 0;
  for (let i = 0; i < n; i++) s += w[i] * x[i];
  return s;
}

function sigmoid(z: number): number {
  // numerically stable enough for small models
  return 1 / (1 + Math.exp(-z));
}

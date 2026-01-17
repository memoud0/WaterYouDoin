import type { ModelWeights } from "./model";

/**
 * Shipped tiny offline weights (no backend, no training required for MVP).
 * Feature order must match featureVector() in factualOrNot.ts:
 * [
 *   lenTokens,
 *   startsWithWh,
 *   hasDefine,
 *   hasDatePattern,
 *   hasCodeTokens,
 *   hasErrorWords,
 *   hasCompareWords,
 *   hasBuildVerbs,
 *   hasLookupPhrase,
 *   isStrongLookupStart
 * ]
 */
export const MODEL_WEIGHTS: ModelWeights = {
  version: 1,
  classes: ["FACTUAL", "LOW_VALUE", "REASONING"],
  weights: {
    FACTUAL: {
      b: -0.3,
      w: [-0.05, 1.25, 1.15, 0.65, -0.35, -0.9, -0.7, -0.7, 1.25, 1.35],
    },
    LOW_VALUE: {
      b: 0.9,
      w: [-0.22, -0.8, -1.0, -0.7, -1.0, -1.0, -0.9, -1.0, -0.9, -1.0],
    },
    REASONING: {
      b: -0.2,
      w: [0.08, -0.45, -0.75, -0.35, 1.15, 1.1, 1.05, 1.05, -0.85, -1.1],
    },
  },
};

export default MODEL_WEIGHTS;

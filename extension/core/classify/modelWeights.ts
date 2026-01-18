import type { ModelWeights } from "./model.ts";
import raw from "../../data/model_weights.json";

export const MODEL_WEIGHTS: ModelWeights = {
  version: 2,
  classes: raw.labels as ("FACTUAL" | "LOW_VALUE" | "REASONING")[],
  featureOrder: raw.feature_order,

  // Convert matrix form into class-indexed form
  weights: {
    FACTUAL: {
      b: raw.bias[0],
      w: raw.weights[0],
    },
    LOW_VALUE: {
      b: raw.bias[1],
      w: raw.weights[1],
    },
    REASONING: {
      b: raw.bias[2],
      w: raw.weights[2],
    },
  },
};

export default MODEL_WEIGHTS;

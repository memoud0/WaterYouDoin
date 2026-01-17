export type Classification = "FACTUAL" | "LOW_VALUE" | "REASONING";

export type Thresholds = {
  factual: number;   // e.g. 0.75
  lowValue: number;  // e.g. 0.85
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  factual: 0.75,
  lowValue: 0.85,
};

// Optional: strictness slider mapping (-1..+1).
// +1 => stricter (harder to classify as factual/low-value)
// -1 => looser
export function applyStrictness(base: Thresholds, strictness?: number): Thresholds {
  const s = typeof strictness === "number" ? clamp(strictness, -1, 1) : 0;
  const bump = s * 0.08; // 8% range is plenty for MVP

  return {
    factual: clamp01(base.factual + bump),
    lowValue: clamp01(base.lowValue + bump),
  };
}

export function clamp01(x: number): number {
  return clamp(x, 0, 1);
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

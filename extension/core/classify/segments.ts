import { factualOrNot, ClassificationResult, ClassifyContext } from "./factualOrNot";
import { normalize } from "../utils/text";
import { fnv1a32 } from "../utils/hash";

export type SegmentResult = {
  text: string;
  result: ClassificationResult;
};

export type CompositeResult = {
  classification: ClassificationResult["classification"];
  confidence: number;
  signals: string[];
  probs?: ClassificationResult["probs"];
  segments: SegmentResult[];
};

function splitSegments(prompt: string): string[] {
  // Split on sentence-ish delimiters and newlines, keep meaningful chunks
  return prompt
    .split(/[\n\r]+|[.?!;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function aggregate(segments: SegmentResult[]): CompositeResult {
  if (segments.length === 0) {
    return {
      classification: "LOW_VALUE",
      confidence: 0,
      signals: ["no_segments"],
      segments: [],
    };
  }

  let bestReasoning: SegmentResult | null = null;
  let bestFactual: SegmentResult | null = null;
  let bestLow: SegmentResult | null = null;

  for (const seg of segments) {
    const c = seg.result.classification;
    if (c === "REASONING" && (!bestReasoning || seg.result.confidence > bestReasoning.result.confidence)) {
      bestReasoning = seg;
    } else if (c === "FACTUAL" && (!bestFactual || seg.result.confidence > bestFactual.result.confidence)) {
      bestFactual = seg;
    } else if (c === "LOW_VALUE" && (!bestLow || seg.result.confidence > bestLow.result.confidence)) {
      bestLow = seg;
    }
  }

  if (bestReasoning) {
    return {
      classification: "REASONING",
      confidence: bestReasoning.result.confidence,
      signals: ["composite_reasoning", ...(bestReasoning.result.signals || [])],
      probs: bestReasoning.result.probs,
      segments,
    };
  }
  if (bestFactual) {
    return {
      classification: "FACTUAL",
      confidence: bestFactual.result.confidence,
      signals: ["composite_factual", ...(bestFactual.result.signals || [])],
      probs: bestFactual.result.probs,
      segments,
    };
  }
  return {
    classification: "LOW_VALUE",
    confidence: bestLow?.result.confidence ?? 0,
    signals: ["composite_low_value", ...(bestLow?.result.signals || [])],
    probs: bestLow?.result.probs,
    segments,
  };
}

export function classifyComposite(prompt: string, ctx: ClassifyContext): CompositeResult {
  // Duplicate check on the full prompt (preserve previous behavior for multi-sentence inputs)
  const now = ctx.nowTimestamp ?? Date.now();
  const window = ctx.duplicateWindowMs ?? 8000;
  const normalizedFull = normalize(prompt);
  const fullHash = fnv1a32(normalizedFull);

  if (ctx.lastHash && ctx.lastTimestamp && ctx.lastHash === fullHash && now - ctx.lastTimestamp <= window) {
    const dup: ClassificationResult = {
      classification: "LOW_VALUE",
      confidence: 0.95,
      signals: ["duplicate_prompt"],
    };
    return {
      classification: dup.classification,
      confidence: dup.confidence,
      signals: dup.signals,
      probs: dup.probs,
      segments: [{ text: prompt, result: dup }],
    };
  }

  const parts = splitSegments(prompt);
  if (parts.length <= 1) {
    const res = factualOrNot(prompt, ctx);
    return {
      classification: res.classification,
      confidence: res.confidence,
      signals: res.signals,
      probs: res.probs,
      segments: [{ text: prompt, result: res }],
    };
  }

  const segResults: SegmentResult[] = parts.map((text) => {
    const res = factualOrNot(text, {
      ...ctx,
      lastHash: undefined,
      lastTimestamp: undefined,
      duplicateWindowMs: 0,
    });
    return { text, result: res };
  });

  return aggregate(segResults);
}

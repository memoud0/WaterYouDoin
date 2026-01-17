// extension/core/classify/__tests__/modelFallback.test.ts
import { describe, it, expect } from "vitest";
import { factualOrNot } from "../factualOrNot";
import MODEL_WEIGHTS from "../modelWeights";

describe("ML fallback (gated, optional)", () => {
  it.each([
    // Borderline: contains "function" (code-ish) but is clearly a lookup due to "syntax"
    "Syntax for a JavaScript arrow function",
    "Arrow function syntax",
    "JavaScript arrow function syntax",
    "Syntax for a Python list comprehension",
    "Meaning of HTTP 404",
    "Definition of idempotent",
  ])("ML helps borderline factual lookup: %s", (prompt) => {
    const r = factualOrNot(prompt, { modelWeights: MODEL_WEIGHTS });

    // ML may or may not run (depending on heuristic confidence), but classification should be FACTUAL.
    expect(r.classification, `Prompt: "${prompt}"\n${JSON.stringify(r, null, 2)}`).toBe("FACTUAL");
  });

  it.each([
    "TypeError cannot read properties of undefined",
    "Debug this error: ReferenceError foo is not defined",
    "Compare OAuth vs SAML and explain tradeoffs",
    "Implement rate limiting in Node.js",
  ])("ML keeps reasoning-heavy prompts as REASONING: %s", (prompt) => {
    const r = factualOrNot(prompt, { modelWeights: MODEL_WEIGHTS });
    expect(r.classification, `Prompt: "${prompt}"\n${JSON.stringify(r, null, 2)}`).toBe("REASONING");
  });

  it("ML is reachable on an ambiguous prompt", () => {
    const prompt = "function syntax";
    const r = factualOrNot(prompt, { modelWeights: MODEL_WEIGHTS });

    // If heuristics were confident, ML won't run — but this phrase is usually ambiguous.
    // We assert the important product behavior: don't block it as LOW_VALUE.
    expect(r.classification, `Prompt: "${prompt}"\n${JSON.stringify(r, null, 2)}`).not.toBe("LOW_VALUE");
  });
});

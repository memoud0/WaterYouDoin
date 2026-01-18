import { describe, it, expect } from "vitest";
import { normalize } from "../../utils/text";
import { extractFeatures } from "../features";
import { spawnSync } from "node:child_process";

const PROMPTS = [
  "What's the capital of Japan?",
  "whats the capital of japan??",
  "Syntax for a JavaScript arrow function",
  "debug why my react rerenders infinitely",
  "okkk",
  "Compare http 1.1 vs http 2 and explain differences",
];

function runPython(prompts: string[]) {
  const res = spawnSync("python3", ["ml/feature_parity_check.py"], {
    input: JSON.stringify(prompts),
    encoding: "utf-8",
    cwd: process.cwd(),
  });

  if (res.error) {
    throw res.error;
  }
  if (res.status !== 0) {
    throw new Error(`python parity script failed: ${res.stderr || res.stdout}`);
  }

  try {
    return JSON.parse(res.stdout);
  } catch (e) {
    throw new Error(`failed to parse python output: ${e}\nstdout=${res.stdout}`);
  }
}

describe("Feature parity: TS vs Python", () => {
  it("matches normalized text and feature vectors for sample prompts", () => {
    const py = runPython(PROMPTS);

    for (const entry of py) {
      const prompt = entry.prompt as string;
      const pyNorm = entry.normalized as string;
      const pyVec = entry.vector as number[];

      const tsNorm = normalize(prompt);
      const tsVec = extractFeatures(tsNorm);
      const tsArray = [
        tsVec.lenTokens,
        tsVec.startsWithWh ? 1 : 0,
        tsVec.hasDefine ? 1 : 0,
        tsVec.hasDatePattern ? 1 : 0,
        tsVec.hasCodeTokens ? 1 : 0,
        tsVec.hasErrorWords ? 1 : 0,
        tsVec.hasCompareWords ? 1 : 0,
        tsVec.hasBuildVerbs ? 1 : 0,
        tsVec.hasLookupPhrase ? 1 : 0,
        tsVec.isStrongLookupStart ? 1 : 0,
      ];

      expect(tsNorm, `normalized mismatch for prompt: ${prompt}`).toBe(pyNorm);
      expect(tsArray, `feature vector mismatch for prompt: ${prompt}`).toEqual(pyVec);
    }
  });
});

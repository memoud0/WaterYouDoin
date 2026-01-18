import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { factualOrNot } from "../core/classify/factualOrNot";
import MODEL_WEIGHTS from "../core/classify/modelWeights";

type Row = { prompt: string; label: "FACTUAL" | "LOW_VALUE" | "REASONING" };
type Counts = Record<"FACTUAL" | "LOW_VALUE" | "REASONING", number>;

function loadCsv(p: string): Row[] {
  const abs = path.resolve(p);
  const data = fs.readFileSync(abs, "utf-8");
  const rows = parse(data, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  return rows
    .map((r) => ({ prompt: String(r.prompt || "").trim(), label: String(r.label || "").trim().toUpperCase() }))
    .filter((r): r is Row => !!r.prompt && (r.label === "FACTUAL" || r.label === "LOW_VALUE" || r.label === "REASONING"));
}

function confusion(): Record<"FACTUAL" | "LOW_VALUE" | "REASONING", Counts> {
  return {
    FACTUAL: { FACTUAL: 0, LOW_VALUE: 0, REASONING: 0 },
    LOW_VALUE: { FACTUAL: 0, LOW_VALUE: 0, REASONING: 0 },
    REASONING: { FACTUAL: 0, LOW_VALUE: 0, REASONING: 0 },
  };
}

function precisionRecall(cm: Record<"FACTUAL" | "LOW_VALUE" | "REASONING", Counts>) {
  const classes: Array<"FACTUAL" | "LOW_VALUE" | "REASONING"> = ["FACTUAL", "LOW_VALUE", "REASONING"];
  const metrics = classes.map((c) => {
    const tp = cm[c][c];
    const fp = classes.reduce((s, k) => (k === c ? s : s + cm[k][c]), 0);
    const fn = classes.reduce((s, k) => (k === c ? s : s + cm[c][k]), 0);
    const prec = tp + fp === 0 ? 0 : tp / (tp + fp);
    const rec = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = prec + rec === 0 ? 0 : (2 * prec * rec) / (prec + rec);
    return { cls: c, precision: prec, recall: rec, f1, support: tp + fn };
  });
  return metrics;
}

function runEval(csvPath: string) {
  const rows = loadCsv(csvPath);
  const cm = confusion();
  const signalsCount: Record<string, number> = {};
  let mlUsed = 0;

  for (const { prompt, label } of rows) {
    const r = factualOrNot(prompt, { modelWeights: MODEL_WEIGHTS });
    cm[label][r.classification] += 1;
    if (r.signals?.includes("ml_used_softmax") || r.signals?.includes("ml_used")) mlUsed += 1;
    for (const s of r.signals || []) signalsCount[s] = (signalsCount[s] || 0) + 1;
  }

  const metrics = precisionRecall(cm);
  const total = rows.length;
  const acc =
    (cm.FACTUAL.FACTUAL + cm.LOW_VALUE.LOW_VALUE + cm.REASONING.REASONING) / (total || 1);

  console.log(`=== Eval on ${csvPath} (${rows.length} rows) ===`);
  console.table(metrics.map((m) => ({ Class: m.cls, Precision: m.precision.toFixed(3), Recall: m.recall.toFixed(3), F1: m.f1.toFixed(3), Support: m.support })));
  console.log(`Accuracy: ${acc.toFixed(3)}`);
  console.log(`ML used: ${mlUsed} (${((mlUsed / (total || 1)) * 100).toFixed(1)}%)`);
  console.log("Confusion matrix (rows=true, cols=pred):");
  console.table(cm);

  const topSignals = Object.entries(signalsCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  console.log("Top signals:", topSignals);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: tsx extension/scripts/evalPipeline.ts <csv> [<csv>...]");
    process.exit(1);
  }
  for (const p of args) {
    runEval(p);
  }
}

main();

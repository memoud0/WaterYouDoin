import readline from "node:readline";
import { factualOrNot } from "../core/classify/factualOrNot";
import MODEL_WEIGHTS from "../core/classify/modelWeights";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

console.log("WaterYouDoin classifier CLI");
console.log("Type a prompt and press enter. Type ':q' to quit.\n");

rl.prompt();

rl.on("line", (line) => {
  const prompt = line.trim();
  if (!prompt) return rl.prompt();
  if (prompt === ":q" || prompt === ":quit" || prompt === "exit") {
    rl.close();
    return;
  }

  const res = factualOrNot(prompt, {
    modelWeights: MODEL_WEIGHTS,
    // optional: simulate duplicate window by keeping state in this CLI later
  });

  console.log(JSON.stringify(res, null, 2));
  console.log("");
  rl.prompt();
});

rl.on("close", () => process.exit(0));

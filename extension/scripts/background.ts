import { factualOrNot, ClassifyContext } from "../core/classify/factualOrNot";
import MODEL_WEIGHTS from "../core/classify/modelWeights";
import { buildSearchUrl } from "../core/redirect/search";

import {
  recordFactualRedirect,
  recordLowValueBlock,
  recordReasoningNudge,
} from "../core/metrics/counters";

type BackgroundMsg =
  | { type: "GET_STATS" }
  | { type: "PROMPT_SUBMIT"; prompt: string; timestamp: number }
  | {
      type: "NUDGE_RESULT";
      choice: "TRY_MYSELF" | "ASK_AI_ANYWAY";
      waitedMs?: number;
    };

chrome.runtime.onMessage.addListener(
  async (msg: BackgroundMsg, sender, sendResponse) => {
    if (msg.type !== "PROMPT_SUBMIT") return;

    const { prompt, timestamp } = msg;

    console.log("[WaterYouDoin] Background received prompt:", prompt);

    /* -----------------------------
       Build classifier context
    ------------------------------ */
    const ctx: ClassifyContext = {
      modelWeights: MODEL_WEIGHTS,
      strictness: 1.0,
      nowTimestamp: timestamp,
    };

    /* -----------------------------
       Classify
    ------------------------------ */
    const result = factualOrNot(prompt, ctx);

    console.log(
      "[WaterYouDoin] Classification:",
      result.classification,
      "confidence:",
      result.confidence
    );

    /* -----------------------------
       Decide action
    ------------------------------ */
    switch (result.classification) {
      case "LOW_VALUE":
        recordLowValueBlock();
        sendResponse({ action: "BLOCK_LOW_VALUE" });
        return true;

      case "FACTUAL":
        recordFactualRedirect();
        sendResponse({
          action: "REDIRECT_FACT",
          redirectUrl: buildSearchUrl(prompt),
        });
        return true;

      case "REASONING":
        recordReasoningNudge();
        sendResponse({
          action: "NUDGE_REASONING",
          waitMs: 10_000,
        });
        return true;

      default:
        sendResponse({ action: "ALLOW" });
        return true;
    }
  }
);

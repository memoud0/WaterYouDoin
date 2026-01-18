import { factualOrNot } from "../core/classify/factualOrNot";
import MODEL_WEIGHTS from "../core/classify/modelWeights";
import { buildSearchUrl } from "../core/redirect/search";

import { getStats, updateStats } from "../core/storage/storage";

import {
  recordFactualRedirect,
  recordLowValueBlock,
  recordReasoningNudge,
  recordTryMyself,
  recordAskAIAnyway,
  recordDuplicateBlocked,
} from "../core/metrics/counters";

import { normalize } from "../core/utils/text";
import { fnv1a32 } from "../core/utils/hash";

function makeNudgeId(): string {
  return `nudge_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

type BackgroundMsg =
  | { type: "GET_STATS" }
  | { type: "PROMPT_SUBMIT"; prompt: string; timestamp: number }
  | { type: "NUDGE_RESULT"; choice: "TRY_MYSELF" | "ASK_AI_ANYWAY"; waitedMs?: number };

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== "PROMPT_SUBMIT") return;

  const { prompt } = msg;

  console.log("[WaterYouDoin] Background received prompt:", prompt);

  // TEMP: always allow
  sendResponse({ action: "ALLOW" });

  // Required for async safety in MV3
  return true;
});


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

chrome.runtime.onMessage.addListener(
  (msg: BackgroundMsg, sender, sendResponse) => {
    (async () => {
      try {
        if (msg?.type === "GET_STATS") {
          const s = await getStats();
          sendResponse({ type: "STATS", data: s });
          return;
        }

        if (msg?.type === "NUDGE_RESULT") {
          const { choice, waitedMs } = msg;

          if (choice === "TRY_MYSELF") {
            await recordTryMyself(waitedMs ?? 0);
          } else {
            await recordAskAIAnyway();
          }

          sendResponse({ ok: true });
          return;
        }

        if (msg?.type !== "PROMPT_SUBMIT") {
          sendResponse({ ok: false });
          return;
        }

        const stats = await getStats();
        if (!stats.settings.enabled) {
          sendResponse({ type: "DECISION", action: "ALLOW" });
          return;
        }

        const prompt = String(msg.prompt ?? "");
        const timestamp = Number(msg.timestamp ?? Date.now());

        // ----- Duplicate memory -----
        const norm = normalize(prompt);
        const hash = fnv1a32(norm);

        const lastHash = stats.lastPrompts.lastHash;
        const lastTimestamp = stats.lastPrompts.lastTimestamp;

        const r = factualOrNot(prompt, {
          lastHash,
          lastTimestamp,
          nowTimestamp: timestamp,
          duplicateWindowMs: 8000,
          modelWeights: MODEL_WEIGHTS,
        });

        // update duplicate memory immediately
        await updateStats((prev) => {
          prev.lastPrompts.lastHash = hash;
          prev.lastPrompts.lastTimestamp = timestamp;
          return prev;
        });

        if (stats.settings.debugLogs) {
          console.log("[WaterYouDoin] classify:", { prompt, result: r });
        }

        // ----- Decisions + counters -----

        if (r.classification === "LOW_VALUE" && r.signals?.includes("duplicate_prompt")) {
          await recordDuplicateBlocked();
          sendResponse({ type: "DECISION", action: "BLOCK_LOW_VALUE", reason: "duplicate" });
          return;
        }

        if (r.classification === "LOW_VALUE") {
          await recordLowValueBlock();
          sendResponse({ type: "DECISION", action: "BLOCK_LOW_VALUE", reason: "low_value" });
          return;
        }

        if (r.classification === "FACTUAL") {
          await recordFactualRedirect();
          const url = buildSearchUrl("DOGPILE", prompt);

          if (sender?.tab?.id != null) {
            chrome.tabs.update(sender.tab.id, { url });
          }

          sendResponse({ type: "DECISION", action: "REDIRECT", url });
          return;
        }

        if (stats.settings.enableNudge) {
          await recordReasoningNudge();
          sendResponse({
            type: "DECISION",
            action: "SHOW_NUDGE",
            nudgeId: makeNudgeId(),
            suggestedWaitMs: stats.settings.nudgeWaitMs,
          });
          return;
        }

        sendResponse({ type: "DECISION", action: "ALLOW" });
      } catch (err) {
        console.error("[WaterYouDoin] background error:", err);
        sendResponse({ type: "DECISION", action: "ALLOW" });
      }
    })();

    return true; // required for async sendResponse (MV3)
  }
);

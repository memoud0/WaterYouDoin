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

chrome.runtime.onMessage.addListener((msg: any, sender, sendResponse) => {
  (async () => {
    if (msg?.type === "GET_STATS") {
      const s = await getStats();
      sendResponse({ type: "STATS", data: s });
      return;
    }

    if (msg?.type === "NUDGE_RESULT") {
      const { choice, waitedMs } = msg as { choice: "TRY_MYSELF" | "ASK_AI_ANYWAY"; waitedMs?: number };

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

    // ✅ update lastHash + lastTimestamp immediately so duplicate logic works
    // (your counters currently set lastTimestamp = Date.now(), but not lastHash)
    await updateStats((prev) => {
      prev.lastPrompts.lastHash = hash;
      prev.lastPrompts.lastTimestamp = timestamp;
      return prev;
    });

    if (stats.settings.debugLogs) {
      console.log("[WaterYouDoin] classify:", { prompt, result: r });
    }

    // ----- Decisions + counters -----

    // Duplicate (special-cased)
    if (r.classification === "LOW_VALUE" && r.signals?.includes("duplicate_prompt")) {
      await recordDuplicateBlocked();
      sendResponse({ type: "DECISION", action: "BLOCK_LOW_VALUE", reason: "duplicate" });
      return;
    }

    // Low-value
    if (r.classification === "LOW_VALUE") {
      await recordLowValueBlock();
      sendResponse({ type: "DECISION", action: "BLOCK_LOW_VALUE", reason: "low_value" });
      return;
    }

    // Factual → redirect
    if (r.classification === "FACTUAL") {
      await recordFactualRedirect();

      const url = buildSearchUrl("DOGPILE", prompt);

      if (sender?.tab?.id != null) {
        chrome.tabs.update(sender.tab.id, { url });
      }

      sendResponse({ type: "DECISION", action: "REDIRECT", url });
      return;
    }

    // Reasoning → nudge
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

    // Nudges disabled
    sendResponse({ type: "DECISION", action: "ALLOW" });
  })();

  return true;
});

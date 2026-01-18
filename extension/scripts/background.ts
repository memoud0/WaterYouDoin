import { factualOrNot } from "../core/classify/factualOrNot";
import MODEL_WEIGHTS from "../core/classify/modelWeights";
import { buildSearchUrl } from "../core/redirect/search";

import { getStats, StoredStats } from "../core/storage/schema";

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
import { classifyComposite } from "../core/classify/segments";

function makeNudgeId(): string {
  return `nudge_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

type DecisionPayload = {
  type: "DECISION";
  action: "ALLOW" | "BLOCK_LOW_VALUE" | "SHOW_NUDGE" | "REDIRECT";
  classification: "FACTUAL" | "LOW_VALUE" | "REASONING";
  confidence: number;
  signals: string[];
  probs?: Record<"FACTUAL" | "LOW_VALUE" | "REASONING", number>;
  reason?: string;
  url?: string;
  nudgeId?: string;
  suggestedWaitMs?: number;
  metricsSnapshot?: StoredStats;
};

function broadcastMetrics(stats?: StoredStats) {
  if (!stats) return;
  chrome.runtime.sendMessage({ type: "METRICS_UPDATE", data: stats });
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

      let stats: StoredStats | undefined;
      if (choice === "TRY_MYSELF") {
        stats = await recordTryMyself(waitedMs ?? 0);
      } else {
        stats = await recordAskAIAnyway();
      }

      broadcastMetrics(stats);
      sendResponse({ ok: true, metricsSnapshot: stats });
      return;
    }

    if (msg?.type !== "PROMPT_SUBMIT") {
      sendResponse({ ok: false });
      return;
    }

    const stats = await getStats();
    if (!stats.settings.enabled) {
      const payload: DecisionPayload = {
        type: "DECISION",
        action: "ALLOW",
        classification: "REASONING",
        confidence: 0,
        signals: ["disabled"],
        metricsSnapshot: stats,
      };
      sendResponse(payload);
      return;
    }

    const prompt = String(msg.prompt ?? "");
    const timestamp = Number(msg.timestamp ?? Date.now());

    // ----- Duplicate memory -----
    const norm = normalize(prompt);
    const hash = fnv1a32(norm);

    const lastHash = stats.lastPrompts.lastHash;
    const lastTimestamp = stats.lastPrompts.lastTimestamp;

    const composite = classifyComposite(prompt, {
      lastHash,
      lastTimestamp,
      nowTimestamp: timestamp,
      duplicateWindowMs: 8000,
      modelWeights: MODEL_WEIGHTS,
    });
    const r = composite;

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
      const statsAfter = await recordDuplicateBlocked();
      broadcastMetrics(statsAfter);
      const payload: DecisionPayload = {
        type: "DECISION",
        action: "BLOCK_LOW_VALUE",
        classification: r.classification,
        confidence: r.confidence,
        signals: r.signals,
        probs: r.probs,
        reason: "duplicate",
        segments: r.segments,
        metricsSnapshot: statsAfter,
      };
      sendResponse(payload);
      return;
    }

    // Low-value
    if (r.classification === "LOW_VALUE") {
      const statsAfter = await recordLowValueBlock();
      broadcastMetrics(statsAfter);
      const payload: DecisionPayload = {
        type: "DECISION",
        action: "BLOCK_LOW_VALUE",
        classification: r.classification,
        confidence: r.confidence,
        signals: r.signals,
        probs: r.probs,
        reason: "low_value",
        segments: r.segments,
        metricsSnapshot: statsAfter,
      };
      sendResponse(payload);
      return;
    }

    // Factual → redirect
    if (r.classification === "FACTUAL") {
      const statsAfter = await recordFactualRedirect();
      const provider = stats.settings.searchProvider || "DOGPILE";
      const url = buildSearchUrl(provider, prompt);

      if (sender?.tab?.id != null) {
        chrome.tabs.update(sender.tab.id, { url });
      }

      broadcastMetrics(statsAfter);
      const payload: DecisionPayload = {
        type: "DECISION",
        action: "REDIRECT",
        classification: r.classification,
        confidence: r.confidence,
        signals: r.signals,
        probs: r.probs,
        url,
        segments: r.segments,
        metricsSnapshot: statsAfter,
      };
      sendResponse(payload);
      return;
    }

    // Reasoning → nudge
    if (stats.settings.enableNudge) {
      const statsAfter = await recordReasoningNudge();
      broadcastMetrics(statsAfter);
      const payload: DecisionPayload = {
        type: "DECISION",
        action: "SHOW_NUDGE",
        classification: r.classification,
        confidence: r.confidence,
        signals: r.signals,
        probs: r.probs,
        nudgeId: makeNudgeId(),
        suggestedWaitMs: stats.settings.nudgeWaitMs,
        segments: r.segments,
        metricsSnapshot: statsAfter,
      };
      sendResponse(payload);
      return;
    }

    // Nudges disabled
    const payload: DecisionPayload = {
      type: "DECISION",
      action: "ALLOW",
      classification: r.classification,
      confidence: r.confidence,
      signals: r.signals,
      probs: r.probs,
      segments: r.segments,
    };
    sendResponse(payload);
  })();

  return true;
});

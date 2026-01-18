import { classifyComposite } from "../core/classify/segments";
import MODEL_WEIGHTS from "../core/classify/modelWeights";
import { buildSearchUrl, fetchTopSearchResults, SearchProvider, SearchResult } from "../core/redirect/search";
import { getStats, updateStats, StoredStats } from "../core/storage/schema";
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

type BackgroundMsg =
  | { type: "GET_STATS" }
  | { type: "PROMPT_SUBMIT"; prompt: string; timestamp?: number }
  | { type: "NUDGE_RESULT"; choice: "TRY_MYSELF" | "ASK_AI_ANYWAY"; waitedMs?: number }
  | { type: "FACTUAL_RESULT_CLICK"; prompt?: string };

type DecisionPayload = {
  type: "DECISION";
  action: "ALLOW" | "BLOCK_LOW_VALUE" | "SHOW_NUDGE" | "REDIRECT";
  classification: "FACTUAL" | "LOW_VALUE" | "REASONING";
  confidence: number;
  signals: string[];
  probs?: Record<"FACTUAL" | "LOW_VALUE" | "REASONING", number>;
  reason?: string;
  url?: string;
  searchProvider?: SearchProvider;
  searchResults?: SearchResult[];
  nudgeId?: string;
  segments?: unknown;
  metricsSnapshot?: StoredStats;
};

function makeNudgeId(): string {
  return `nudge_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function broadcastMetrics(stats?: StoredStats) {
  if (!stats) return;
  chrome.runtime.sendMessage({ type: "METRICS_UPDATE", data: stats });
}

chrome.runtime.onMessage.addListener((msg: BackgroundMsg, sender, sendResponse) => {
  (async () => {
    // 1. GET STATS
    if (msg.type === "GET_STATS") {
      const s = await getStats();
      sendResponse({ type: "STATS", data: s });
      return;
    }

    // 2. HANDLE UI FEEDBACK
    if (msg.type === "NUDGE_RESULT") {
      const { choice, waitedMs } = msg;
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

    if (msg.type === "FACTUAL_RESULT_CLICK") {
      // FIX: Added 'const' here to declare a local variable
      const stats = await recordFactualRedirect(msg.prompt);
      broadcastMetrics(stats);
      sendResponse({ ok: true, metricsSnapshot: stats });
      return;
    }

    // 3. HANDLE PROMPT SUBMISSION
    if (msg.type !== "PROMPT_SUBMIT") {
      sendResponse({ ok: false });
      return;
    }

    // Only declared here, which caused the Temporal Dead Zone error before
    const stats = await getStats();
    
    if (!stats.settings.enabled) {
      sendResponse({
        type: "DECISION",
        action: "ALLOW",
        classification: "REASONING",
        confidence: 0,
        signals: ["disabled"],
        metricsSnapshot: stats,
      });
      return;
    }

    const prompt = String(msg.prompt ?? "");
    const timestamp = Number(msg.timestamp ?? Date.now());

    const norm = normalize(prompt);
    const hash = fnv1a32(norm);
    await updateStats((prev) => {
      prev.lastPrompts.lastHash = hash;
      prev.lastPrompts.lastTimestamp = timestamp;
      return prev;
    });

    const lastHash = stats.lastPrompts.lastHash;
    const lastTimestamp = stats.lastPrompts.lastTimestamp;

    const r = classifyComposite(prompt, {
      lastHash,
      lastTimestamp,
      nowTimestamp: timestamp,
      duplicateWindowMs: 8000,
      modelWeights: MODEL_WEIGHTS,
    });

    // A. DUPLICATE or LOW VALUE
    if (r.classification === "LOW_VALUE") {
       sendResponse({
        type: "DECISION",
        action: "BLOCK_LOW_VALUE",
        classification: r.classification,
        confidence: r.confidence,
        signals: r.signals,
        probs: r.probs,
        reason: r.signals?.includes("duplicate_prompt") ? "duplicate" : "low_value",
        segments: r.segments,
        metricsSnapshot: stats, 
      });
      return;
    }

    // B. FACTUAL
    if (r.classification === "FACTUAL") {
      const provider = stats.settings.searchProvider || "DOGPILE";
      const url = buildSearchUrl(provider, prompt);
      const searchResults = await fetchTopSearchResults(provider, prompt, 5);

      sendResponse({
        type: "DECISION",
        action: "SHOW_NUDGE",
        classification: r.classification,
        confidence: r.confidence,
        signals: r.signals,
        probs: r.probs,
        url,
        searchProvider: provider,
        searchResults,
        segments: r.segments,
        metricsSnapshot: stats,
      });
      return;
    }

    // C. REASONING
    if (stats.settings.enableNudge) {
      sendResponse({
        type: "DECISION",
        action: "SHOW_NUDGE",
        classification: r.classification,
        confidence: r.confidence,
        signals: r.signals,
        probs: r.probs,
        nudgeId: makeNudgeId(),
        segments: r.segments,
        metricsSnapshot: stats,
      });
      return;
    }

    // D. ALLOW
    sendResponse({
      type: "DECISION",
      action: "ALLOW",
      classification: r.classification,
      confidence: r.confidence,
      signals: r.signals,
      probs: r.probs,
      segments: r.segments,
    });
  })();

  return true;
});
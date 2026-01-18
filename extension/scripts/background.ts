import { classifyComposite } from "../core/classify/segments";
import MODEL_WEIGHTS from "../core/classify/modelWeights";
import { buildSearchUrl, fetchSearchHtml, SearchProvider, SearchResult } from "../core/redirect/search";
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
  | { type: "FACTUAL_RESULT_CLICK"; prompt?: string }
  | { type: "PARSE_SEARCH_RESULTS"; html: string; limit?: number };

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

async function ensureOffscreenDocument(): Promise<void> {
  if (!chrome.offscreen?.hasDocument) return;
  const exists = await chrome.offscreen.hasDocument();
  if (exists) return;
  await chrome.offscreen.createDocument({
    url: "extension/pages/offscreen/offscreen.html",
    reasons: ["DOM_PARSER"],
    justification: "Parse Dogpile search HTML in a DOM context.",
  });
}

async function parseSearchResultsOffscreen(html: string, limit: number): Promise<SearchResult[]> {
  if (!html) return [];
  if (!chrome.offscreen?.createDocument) return [];
  await ensureOffscreenDocument();

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "PARSE_SEARCH_RESULTS", html, limit },
      (response: { ok?: boolean; results?: SearchResult[] } | undefined) => {
        if (response?.ok && Array.isArray(response.results)) {
          resolve(response.results);
          return;
        }
        resolve([]);
      }
    );
  });
}

chrome.runtime.onMessage.addListener((msg: BackgroundMsg, sender, sendResponse) => {
  if (msg.type === "PARSE_SEARCH_RESULTS") {
    return false;
  }

  (async () => {
    if (msg.type === "GET_STATS") {
      const s = await getStats();
      sendResponse({ type: "STATS", data: s });
      return;
    }

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
      const stats = await recordFactualRedirect(msg.prompt);
      broadcastMetrics(stats);
      sendResponse({ ok: true, metricsSnapshot: stats });
      return;
    }

    if (msg.type !== "PROMPT_SUBMIT") {
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

    // Duplicate memory bookkeeping (store hash/timestamp)
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

    // Duplicate (special-cased)
    if (r.classification === "LOW_VALUE" && r.signals?.includes("duplicate_prompt")) {
      const statsAfter = await recordDuplicateBlocked(prompt);
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
      const statsAfter = await recordLowValueBlock(prompt);
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

    // Factual → fetch alternatives and show nudge (no stats increment until user decides)
    if (r.classification === "FACTUAL") {
      const provider: SearchProvider = "DOGPILE";
      const url = buildSearchUrl(provider, prompt);
      const html = await fetchSearchHtml(provider, prompt);
      const searchResults = html ? await parseSearchResultsOffscreen(html, 5) : [];

      const payload: DecisionPayload = {
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

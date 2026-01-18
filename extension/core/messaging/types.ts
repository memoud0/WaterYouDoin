import type { PromptType, StoredStats } from "../storage/schema";

export type PromptContext = {
  siteId?: string;
  inputId?: string;
  selection?: string;
  modelHint?: string;
};

export type PromptSubmitMsg = {
  type: "PROMPT_SUBMIT";
  prompt: string;
  pageUrl: string;
  timestamp: number;
  context?: PromptContext;
};

export type SegmentDecision = {
  text: string;
  classification: PromptType;
  confidence: number;
  signals?: string[];
};

export type DecisionBase = {
  type: "DECISION";
  classification: PromptType;
  confidence: number;
  signals: string[];
  probs?: Record<PromptType, number>;
  segments?: SegmentDecision[];
  metricsSnapshot?: StoredStats;
};

export type DecisionMsg =
  | (DecisionBase & { action: "ALLOW" })
  | (DecisionBase & { action: "BLOCK_LOW_VALUE"; reason: string })
  | (DecisionBase & { action: "SHOW_NUDGE"; nudgeId: string })
  | (DecisionBase & { action: "REDIRECT"; url: string });

export type NudgeResultMsg = {
  type: "NUDGE_RESULT";
  nudgeId: string;
  choice: "TRY_MYSELF" | "ASK_AI_ANYWAY";
  waitedMs?: number;
};

export type GetStatsMsg = { type: "GET_STATS" };
export type GetStatsRes = { type: "STATS"; data: StoredStats };

export type MetricsUpdateMsg = {
  type: "METRICS_UPDATE";
  data: StoredStats;
};

export type ClassifyOnlyMsg = {
  type: "CLASSIFY_ONLY";
  prompt: string;
  context?: PromptContext;
};

export type AnyMsg =
  | PromptSubmitMsg
  | DecisionMsg
  | NudgeResultMsg
  | GetStatsMsg
  | GetStatsRes
  | MetricsUpdateMsg
  | ClassifyOnlyMsg;

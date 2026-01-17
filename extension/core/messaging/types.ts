export type PromptSubmitMsg = {
  type: "PROMPT_SUBMIT";
  prompt: string;
  pageUrl: string;
  timestamp: number;
};

export type DecisionMsg =
  | { type: "DECISION"; action: "ALLOW" }
  | { type: "DECISION"; action: "BLOCK_LOW_VALUE"; reason: string }
  | { type: "DECISION"; action: "SHOW_NUDGE"; nudgeId: string; suggestedWaitMs: number }
  | { type: "DECISION"; action: "REDIRECT"; url: string };

export type NudgeResultMsg = {
  type: "NUDGE_RESULT";
  nudgeId: string;
  choice: "TRY_MYSELF" | "ASK_AI_ANYWAY";
  waitedMs?: number;
};

export type GetStatsMsg = { type: "GET_STATS" };
export type GetStatsRes = { type: "STATS"; data: unknown };

export type AnyMsg = PromptSubmitMsg | DecisionMsg | NudgeResultMsg | GetStatsMsg | GetStatsRes;

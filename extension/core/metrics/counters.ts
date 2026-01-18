import { updateStats, getStats, StoredStats } from "../storage/schema";
import { encode } from "gpt-tokenizer";
import { recalculteSeverity } from "./severity";
import { recalculateWater } from "./water";

const estimateTokens = (prompt?: string): number => {
  if (!prompt) return 300; // rough average if prompt missing
  try {
    const tokens = encode(prompt);
    if (Array.isArray(tokens) && tokens.length > 0) {
      return tokens.length;
    }
  } catch {
    // fallback
  }
  const approxTokens = Math.ceil(prompt.trim().length / 4);
  return Math.max(10, approxTokens);
};

// --- HELPERS ---

const addAvoidedTokens = (stats: StoredStats, tokens: number) => {
  stats.water.tokensAvoidedDaily += tokens;
  stats.water.tokensAvoidedLifetime += tokens;
};

const addWastedTokens = (stats: StoredStats, tokens: number) => {
  stats.water.tokensWastedDaily = (stats.water.tokensWastedDaily || 0) + tokens;
  stats.water.tokensWastedLifetime = (stats.water.tokensWastedLifetime || 0) + tokens;
};

const processUpdate = (stats: StoredStats, updater: (s: StoredStats) => void): StoredStats => {
  updater(stats);
  let next = recalculateWater(stats);
  next = recalculteSeverity(next); // This will now use the Net Water
  next.lastPrompts.lastTimestamp = Date.now();
  return next;
};

// --- SAVING ACTIONS (Good) ---

export const recordFactualRedirect = async (prompt?: string): Promise<StoredStats> => {
  const tokens = estimateTokens(prompt);
  return updateStats((prev) =>
    processUpdate(prev, (s) => {
      s.today.factualRedirects++;
      s.lifetime.factualRedirects++;
      s.today.avoidedAiCalls++; // Stat tracking
      s.lifetime.avoidedAiCalls++;
      addAvoidedTokens(s, tokens); // SAVED
    })
  );
};

export const recordTryMyself = async (waitMs: number): Promise<StoredStats> => {
  const tokens = estimateTokens(); // We don't have prompt here easily, assume avg
  return updateStats((prev) =>
    processUpdate(prev, (s) => {
      s.today.tryMyselfClicks++;
      s.lifetime.tryMyselfClicks++;
      s.today.totalThinkTimeMs += waitMs;
      s.lifetime.totalThinkTimeMs += waitMs;
      s.today.avoidedAiCalls++;
      s.lifetime.avoidedAiCalls++;
      addAvoidedTokens(s, tokens); // SAVED
    })
  );
};

// --- WASTING ACTIONS (Bad) ---

export const recordLowValueBlock = async (prompt?: string): Promise<StoredStats> => {
  // User intended to send junk. We block it, but we penalize the "attempt".
  const tokens = estimateTokens(prompt);
  return updateStats((prev) =>
    processUpdate(prev, (s) => {
      s.today.lowValueBlocks++;
      s.lifetime.lowValueBlocks++;
      addWastedTokens(s, tokens); // WASTED (User request)
    })
  );
};

export const recordDuplicateBlocked = async (prompt?: string): Promise<StoredStats> => {
  const tokens = estimateTokens(prompt);
  return updateStats((prev) =>
    processUpdate(prev, (s) => {
      s.today.duplicateBlocked++;
      s.lifetime.duplicateBlocked++;
      addWastedTokens(s, tokens); // WASTED (Spamming)
    })
  );
};

export const recordAskAIAnyway = async (): Promise<StoredStats> => {
  // We don't have the prompt string in this message payload easily, 
  // so we use default avg tokens (300).
  const tokens = estimateTokens(); 
  return updateStats((prev) =>
    processUpdate(prev, (s) => {
      s.today.askAIAnywayClicks++;
      s.lifetime.askAIAnywayClicks++;
      addWastedTokens(s, tokens); // WASTED
    })
  );
};

export const recordReasoningNudge = async (): Promise<StoredStats> => {
  // Just showing the nudge doesn't save or waste yet.
  return updateStats((prev) =>
    processUpdate(prev, (s) => {
      s.today.reasoningNudges++;
      s.lifetime.reasoningNudges++;
    })
  );
};
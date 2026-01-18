import { updateStats, getStats, StoredStats } from "../storage/schema";
import { recalculteSeverity } from "./severity";
import { recalculateWater } from "./water";

const processUpdate = (stats: StoredStats, updater: (s: StoredStats) => void): StoredStats => {
  updater(stats);

  let next = recalculateWater(stats);
  next = recalculteSeverity(next);

  next.lastPrompts.lastTimestamp = Date.now();
  return next;
};

export const recordFactualRedirect = async (): Promise<StoredStats> => {
  return updateStats((prev) =>
    processUpdate(prev, (s) => {
      s.today.factualRedirects++;
      s.lifetime.factualRedirects++;
      s.today.avoidedAiCalls++;
      s.lifetime.avoidedAiCalls++;
    })
  );
};

export const recordLowValueBlock = async (): Promise<StoredStats> => {
  return updateStats((prev) =>
    processUpdate(prev, (s) => {
      s.today.lowValueBlocks++;
      s.lifetime.lowValueBlocks++;
      s.today.avoidedAiCalls++;
      s.lifetime.avoidedAiCalls++;
    })
  );
};

export const recordReasoningNudge = async (): Promise<StoredStats> => {
  return updateStats((prev) =>
    processUpdate(prev, (s) => {
      s.today.reasoningNudges++;
      s.lifetime.reasoningNudges++;
    })
  );
};

export const recordTryMyself = async (waitMs: number): Promise<StoredStats> => {
  return updateStats((prev) =>
    processUpdate(prev, (s) => {
      s.today.tryMyselfClicks++;
      s.lifetime.tryMyselfClicks++;
      s.today.totalThinkTimeMs += waitMs;
      s.lifetime.totalThinkTimeMs += waitMs;
      s.today.avoidedAiCalls++;
      s.lifetime.avoidedAiCalls++;
    })
  );
};

export const recordAskAIAnyway = async (): Promise<StoredStats> => {
  return updateStats((prev) =>
    processUpdate(prev, (s) => {
      s.today.askAIAnywayClicks++;
      s.lifetime.askAIAnywayClicks++;
    })
  );
};

export const recordDuplicateBlocked = async (): Promise<StoredStats> => {
  return updateStats((prev) =>
    processUpdate(prev, (s) => {
      s.today.duplicateBlocked++;
      s.lifetime.duplicateBlocked++;
      s.today.avoidedAiCalls++;
      s.lifetime.avoidedAiCalls++;
    })
  );
};

import { StoredStats, MascotState } from "../storage/schema";

const THRESHOLDS = {
  SOLID: 0,
  MELTING: 50,
  DROPLET: 75,
};

export const recalculteSeverity = (stats: StoredStats): StoredStats => {
  let score = 0;

  // Negative actions
  score += stats.today.askAIAnywayClicks * 18;
  score += stats.today.lowValueBlocks * 3;
  score += stats.today.duplicateBlocked * 2;

  // Positive actions
  score -= stats.today.tryMyselfClicks * 12;
  score -= stats.today.factualRedirects * 6;

  // Clamp
  score = Math.max(0, Math.min(100, score));

  let newState: MascotState = "SOLID";

  const lastAction = stats.lastPrompts.lastTimestamp || 0;
  const isRecent = Date.now() - lastAction < 5 * 60 * 1000;

  if (isRecent && stats.today.tryMyselfClicks > 0 && score < THRESHOLDS.MELTING) {
    newState = "THINKING";
  } else if (score >= THRESHOLDS.DROPLET) {
    newState = "DROPLET";
  } else if (score >= THRESHOLDS.MELTING) {
    newState = "MELTING";
  }

  return {
    ...stats,
    severity: {
      score,
      mascotState: newState,
    },
  };
};

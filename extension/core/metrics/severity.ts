import { StoredStats, MascotState } from "../storage/schema";

const THRESHOLDS = {
  SOLID: 0,
  MELTING: 60,
  DROPLET: 85,
};

const DECAY_PER_HOUR = 12; // score points reduced per hour of inactivity

export const recalculteSeverity = (stats: StoredStats): StoredStats => {
  const now = Date.now();
  const lastUpdated = stats.severity.lastUpdated ?? now;
  const hoursElapsed = Math.max(0, (now - lastUpdated) / (1000 * 60 * 60));

  let score = 0;

  // Negative actions
  score += stats.today.askAIAnywayClicks * 18;
  score += stats.today.lowValueBlocks * 3;
  score += stats.today.duplicateBlocked * 2;

  // Positive actions
  score -= stats.today.tryMyselfClicks * 12;
  score -= stats.today.factualRedirects * 6;

  // Decay over time
  if (hoursElapsed > 0) {
    score = Math.max(0, score - DECAY_PER_HOUR * hoursElapsed);
  }

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
      lastUpdated: now,
    },
  };
};

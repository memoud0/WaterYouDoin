import { StoredStats, MascotState } from "../storage/schema";

const THRESHOLDS = {
    SOLID: 0, 
    MELTING: 50,
    DROPLET: 75,
}

export const recalculteSeverity = (stats: StoredStats): StoredStats => {
    let score = 0;
    score += (stats.today.askAIAnywayClicks*15);
    score += (stats.today.lowValueBlocks*2);
    score -= (stats.today.tryMyselfClicks*10);
    score += (stats.today.factualRedirects*5);
    score = Math.max(0, Math.min(100, score));

    let newState: MascotState = "SOLID";

    const lastAction = stats.lastPrompts.lastTimestamp || 0;
    const isRecent = Date.now() - lastAction < (5*60*1000);

    if (isRecent && stats.today.tryMyselfClicks > 0 && score < THRESHOLDS.MELTING) {
        newState = "THINKING";
    }

    else if (score >= THRESHOLDS.DROPLET) {
        newState = "DROPLET";
    }

    else if (score >= THRESHOLDS.MELTING) {
        newState = "MELTING";
    }

    return {
        ...stats,
        severity: {
            score: score,
            mascotState: newState,
        }
    }
};
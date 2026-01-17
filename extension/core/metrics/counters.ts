import { updateStats } from "../storage/storage";
import { StoredStats} from "../storage/schema";
import { recalculteSeverity } from "./severity";
import { recalculateWater } from "./water";

const processUpdate = (
    stats: StoredStats,
    updater: (s: StoredStats) => void): 
    
    StoredStats => {
        updater(stats);

        let next = recalculateWater(stats);
        next = recalculteSeverity(next);

        next.lastPrompts.lastTimestamp = Date.now();
        return next;
    };

export const recordFactualRedirect = async () => {
    await updateStats((prev) => {
        return processUpdate(prev, (s) => {
            s.today.factualRedirects++;
            s.lifetime.factualRedirects++;

            s.today.avoidedAiCalls++;
            s.lifetime.avoidedAiCalls++;
        });
    })
}

export const recordLowValueBlock = async () => {
    await updateStats((prev) => {
        return processUpdate(prev, (s) => {
            s.today.lowValueBlocks++;
            s.lifetime.lowValueBlocks++;

            s.today.avoidedAiCalls++;
            s.lifetime.avoidedAiCalls++;
        });
    });
};

export const recordReasoningNudge = async () => {
    await updateStats((prev) => {
        return processUpdate(prev, (s) => {
            s.today.reasoningNudges++;
            s.lifetime.reasoningNudges++;
        });
    });
};

export const recordTryMyself = async (waitMs: number) => {
    await updateStats((prev) => {
        return processUpdate(prev, (s) => {
            s.today.tryMyselfClicks++;
            s.lifetime.tryMyselfClicks++;

            s.today.totalThinkTimeMs += waitMs;
            s.lifetime.totalThinkTimeMs += waitMs;

            s.today.avoidedAiCalls++;
            s.lifetime.avoidedAiCalls++;
        });
    });
};

export const recordAskAIAnyway = async () => {
    await updateStats((prev) => {
        return processUpdate(prev, (s) => {
            s.today.askAIAnywayClicks++;
            s.lifetime.askAIAnywayClicks++;
        });
    });
};

export const recordDuplicateBlocked = async () => {
    await updateStats((prev) => {
        return processUpdate(prev, (s) => {
            s.today.duplicateBlocked++;
            s.lifetime.duplicateBlocked++;

            s.today.avoidedAiCalls++;
            s.lifetime.avoidedAiCalls++;
        });
    });
};


import { StoredStats } from "../storage/schema";

export const recalculateWater = (stats: StoredStats): StoredStats => {
    const litersPerThousandTokens = stats.water.litersPerThousandTokens || stats.water.litersPerAvoidedCall || 0.5;
    const tokensLifetime = stats.water.tokensAvoidedLifetime ?? stats.lifetime.avoidedAiCalls * 300;
    const tokensDaily = stats.water.tokensAvoidedDaily ?? stats.today.avoidedAiCalls * 300;

    const newLiftimeWater = (tokensLifetime / 1000) * litersPerThousandTokens;

    const newDailyWater = (tokensDaily / 1000) * litersPerThousandTokens;

    return {
        ...stats,
        water: {
            ...stats.water,
            tokensAvoidedLifetime: tokensLifetime,
            tokensAvoidedDaily: tokensDaily,
            litersSavedLifetime: newLiftimeWater,
            litersSavedDaily: newDailyWater,
        }
    };
};

export const formatWaterVolume = (liters: number): string => {
    if (liters < 1) {
        return `${(liters * 1000).toFixed(0)} mL`;
    } else {
        return `${liters.toFixed(1)} L`;
    }
};

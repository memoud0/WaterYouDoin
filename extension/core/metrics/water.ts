import { StoredStats } from "../storage/schema";

export const recalculateWater = (stats: StoredStats): StoredStats => {
    const litersPerCall = stats.water.litersPerAvoidedCall;

    const newLiftimeWater = stats.lifetime.avoidedAiCalls * litersPerCall;

    const newDailyWater = stats.today.avoidedAiCalls * litersPerCall;

    return {
        ...stats,
        water: {
            ...stats.water,
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
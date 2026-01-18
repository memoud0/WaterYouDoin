import { StoredStats } from "../storage/schema";

export const recalculateWater = (stats: StoredStats): StoredStats => {
    const litersPerThousandTokens = stats.water.litersPerThousandTokens || 0.5;
    
    // SAVED
    const tokensSavedLife = stats.water.tokensAvoidedLifetime;
    const tokensSavedDay = stats.water.tokensAvoidedDaily;
    const litersSavedLife = (tokensSavedLife / 1000) * litersPerThousandTokens;
    const litersSavedDay = (tokensSavedDay / 1000) * litersPerThousandTokens;

    // WASTED
    const tokensWastedLife = stats.water.tokensWastedLifetime || 0;
    const tokensWastedDay = stats.water.tokensWastedDaily || 0;
    const litersWastedLife = (tokensWastedLife / 1000) * litersPerThousandTokens;
    const litersWastedDay = (tokensWastedDay / 1000) * litersPerThousandTokens;

    return {
        ...stats,
        water: {
            ...stats.water,
            // Update Saved
            litersSavedLifetime: litersSavedLife,
            litersSavedDaily: litersSavedDay,
            
            // Update Wasted
            tokensWastedLifetime: tokensWastedLife,
            tokensWastedDaily: tokensWastedDay,
            litersWastedLifetime: litersWastedLife,
            litersWastedDaily: litersWastedDay,
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
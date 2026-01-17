export type MascotState = "SOLID" | "THINKING" | "MELTING" | "DROPLET";

export type PromptType = "FACTUAL" | "LOW_VALUE" | "REASONING";

export interface LifetimeStats {
    avoidedAiCalls: number;
    factualRedirects: number;
    lowValueBlocks: number;
    reasoningNudges: number;
    tryMyselfClicks: number;
    askAIAnywayClicks: number;
    totalThinkTimeMs: number;
    duplicateBlocked: number;
}

export interface DailyStats extends LifetimeStats {
    dataKey: string;
}

export interface WaterStats {
    litersPerAvoidedCall: number;
    litersSavedLifetime: number;
    litersSavedDaily: number;
}

export interface SeverityStats {
    score: number;
    mascotState: MascotState;
}

export interface AppSettings {
    enabled: boolean;
    enableNudge: boolean;
    nudgeWaitMs: number;
    searchProvider: "DOGPILE" | "GOOGLE";
    debugLogs: boolean;
}

export interface PromptHistory {
    lastHash?: string;
    lastTimestamp?: number;
}

export interface StoredStats {
    version: number;
    lifetime: LifetimeStats;
    today: DailyStats;
    water: WaterStats;
    severity: SeverityStats;
    settings: AppSettings;
    lastPrompts: PromptHistory;
}

export const DEFAULT_STATS: StoredStats = {
    version: 1,
    lifetime: {
        avoidedAiCalls: 0,
        factualRedirects: 0,
        lowValueBlocks: 0,
        reasoningNudges: 0,
        tryMyselfClicks: 0,
        askAIAnywayClicks: 0,
        totalThinkTimeMs: 0,
        duplicateBlocked: 0,
    },
    today: {
        dataKey: new Date().toISOString().split("T")[0],
        avoidedAiCalls: 0,
        factualRedirects: 0,
        lowValueBlocks: 0,
        reasoningNudges: 0,
        tryMyselfClicks: 0,
        askAIAnywayClicks: 0,
        totalThinkTimeMs: 0,
        duplicateBlocked: 0,
    },
    water: {
        litersPerAvoidedCall: 0.5,
        litersSavedLifetime: 0,
        litersSavedDaily: 0,
    },
    severity: {
        score: 0,
        mascotState: "SOLID",
    },
    settings: {
        enabled: true,
        enableNudge: true,
        nudgeWaitMs: 90000,
        searchProvider: "DOGPILE",
        debugLogs: true,
    },
    lastPrompts: {},
};
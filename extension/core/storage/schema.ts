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

const STORAGE_KEY = "waterYouDoinStats";

export function todayKey(): string {
  return new Date().toISOString().split("T")[0];
}

export function resetTodayIfNeeded(s: StoredStats): StoredStats {
  const key = todayKey();
  if (s.today?.dataKey === key) return s;

  return {
    ...s,
    today: {
      dataKey: key,
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
      ...s.water,
      litersSavedDaily: 0,
    },
  };
}

export async function getStats(): Promise<StoredStats> {
  const res = await chrome.storage.local.get(STORAGE_KEY);
  const s = (res?.[STORAGE_KEY] as StoredStats) ?? DEFAULT_STATS;
  const fixed = resetTodayIfNeeded(s);
  if (fixed !== s) await chrome.storage.local.set({ [STORAGE_KEY]: fixed });
  return fixed;
}

export async function setStats(next: StoredStats): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
}

export async function updateStats(updater: (prev: StoredStats) => StoredStats): Promise<StoredStats> {
  const prev = await getStats();
  const next = resetTodayIfNeeded(updater(prev));
  await setStats(next);
  return next;
}

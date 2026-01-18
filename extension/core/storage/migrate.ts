import { StoredStats } from "./schema";

/**
 * Simple migration to add new water/severity fields and prune obsolete ones.
 * Call this on load before using stats.
 */
export function migrateStats(raw: Partial<StoredStats> | undefined): StoredStats {
  const stats = raw as StoredStats;
  if (!stats) return stats as StoredStats;

  // Water defaults
  stats.water = stats.water || ({} as any);
  stats.water.litersPerThousandTokens = stats.water.litersPerThousandTokens ?? stats.water.litersPerAvoidedCall ?? 0.5;
  
  stats.water.tokensAvoidedLifetime = stats.water.tokensAvoidedLifetime ?? 0;
  stats.water.tokensAvoidedDaily = stats.water.tokensAvoidedDaily ?? 0;
  stats.water.litersSavedLifetime = stats.water.litersSavedLifetime ?? 0;
  stats.water.litersSavedDaily = stats.water.litersSavedDaily ?? 0;

  // NEW: Wasted Defaults
  stats.water.tokensWastedLifetime = stats.water.tokensWastedLifetime ?? 0;
  stats.water.tokensWastedDaily = stats.water.tokensWastedDaily ?? 0;
  stats.water.litersWastedLifetime = stats.water.litersWastedLifetime ?? 0;
  stats.water.litersWastedDaily = stats.water.litersWastedDaily ?? 0;

  // Severity defaults
  stats.severity = stats.severity || ({} as any);
  stats.severity.lastUpdated = stats.severity.lastUpdated ?? Date.now();

  return stats as StoredStats;
}
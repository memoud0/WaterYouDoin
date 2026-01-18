import { StoredStats } from "./schema";

/**
 * Simple migration to add new water/severity fields and prune obsolete ones.
 * Call this on load before using stats.
 */
export function migrateStats(raw: Partial<StoredStats> | undefined): StoredStats {
  // Fallback to DEFAULT_STATS handled by getStats; this just patches shape.
  const stats = raw as StoredStats;
  if (!stats) return stats as StoredStats;

  // Water defaults
  stats.water = stats.water || ({} as any);
  stats.water.litersPerThousandTokens = stats.water.litersPerThousandTokens ?? stats.water.litersPerAvoidedCall ?? 0.5;
  stats.water.tokensAvoidedLifetime = stats.water.tokensAvoidedLifetime ?? (stats.lifetime?.avoidedAiCalls ?? 0) * 300;
  stats.water.tokensAvoidedDaily = stats.water.tokensAvoidedDaily ?? (stats.today?.avoidedAiCalls ?? 0) * 300;
  stats.water.litersSavedLifetime = stats.water.litersSavedLifetime ?? 0;
  stats.water.litersSavedDaily = stats.water.litersSavedDaily ?? 0;

  // Severity defaults
  stats.severity = stats.severity || ({} as any);
  stats.severity.lastUpdated = stats.severity.lastUpdated ?? Date.now();

  // Remove deprecated fields if present (noop in plain object)
  if (stats.settings && (stats.settings as any).nudgeWaitMs) {
    delete (stats.settings as any).nudgeWaitMs;
  }

  return stats as StoredStats;
}

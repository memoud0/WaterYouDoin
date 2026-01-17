import { StoredStats, DEFAULT_STATS} from "./schema";

const STORAGE_KEY = "waterYouDoinStats";

//Reads the current state from Chrome local storage.
export const getStats = async (): Promise<StoredStats> => {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      if (!result[STORAGE_KEY]) {
        chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_STATS }, () => {
          resolve(DEFAULT_STATS);
        });
      } else {
        const stats = result[STORAGE_KEY] as StoredStats;
        const todayKey = new Date().toISOString().split('T')[0];
        if (stats.today.dataKey !== todayKey) {
          const resetStats = resetDailyStats(stats, todayKey);
          setStats(resetStats).then(() => resolve(resetStats));
        } else {
          resolve(stats);
        }
      }
    });
  });
};

// Saves the provided stats to Chrome local storage.
export const setStats = async (stats: StoredStats): Promise<void> => {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: stats }, () => {
      resolve();
    });
  });
};

// Updates the stats using the provided updater function.
export const updateStats = async (
  updater: (prev: StoredStats) => StoredStats
): Promise<StoredStats> => {
  const current = await getStats();
  const next = updater(current);
  await setStats(next);
  return next;
};

// Resets the daily stats while preserving lifetime stats.
function resetDailyStats(current: StoredStats, newDateKey: string): StoredStats {
  return {
    ...current,
    today: {
      ...DEFAULT_STATS.today, 
      dataKey: newDateKey,
    },
    water: {
      ...current.water,
      litersSavedDaily: 0,
    }
  };
}
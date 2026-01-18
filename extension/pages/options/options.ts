import { getStats, updateStats } from "../../core/storage/storage";
import { AppSettings } from "../../core/storage/schema";
import { settings } from "node:cluster";

const getEl = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLSelectElement;

async function restoreOptions() {
  const stats = await getStats();
  const settings = stats.settings;

  (getEl("enabled") as HTMLInputElement).checked = settings.enabled;
  (getEl("enableNudge") as HTMLInputElement).checked = settings.enableNudge;
  (getEl("nudgeWaitMs") as HTMLSelectElement).value = String(settings.nudgeWaitMs);
  (getEl("searchProvider") as HTMLSelectElement).value = settings.searchProvider;
  (getEl("debugLogs") as HTMLInputElement).checked = settings.debugLogs;
}

async function saveOptions() {
  const status = document.getElementById("status");
  
  await updateStats((prev) => {
    const newSettings: AppSettings = {
      enabled: (getEl("enabled") as HTMLInputElement).checked,
      enableNudge: (getEl("enableNudge") as HTMLInputElement).checked,
      nudgeWaitMs: Number((getEl("nudgeWaitMs") as HTMLSelectElement).value),
      searchProvider: (getEl("searchProvider") as HTMLSelectElement).value as "DOGPILE" | "GOOGLE",
      debugLogs: (getEl("debugLogs") as HTMLInputElement).checked,
    };

    return {
      ...prev,
      settings: newSettings
    };
  });

  if (status) {
    status.textContent = "Options saved.";
    setTimeout(() => {
      status.textContent = "";
    }, 2000);

}
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.getElementById("save-btn")?.addEventListener("click", saveOptions);
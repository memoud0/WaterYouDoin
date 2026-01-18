import { getStats, updateStats } from "../../core/storage/schema";
import { AppSettings } from "../../core/storage/schema";

const getEl = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLSelectElement;

async function restoreOptions() {
  const stats = await getStats();
  const settings = stats.settings;

  (getEl("enabled") as HTMLInputElement).checked = settings.enabled;
  (getEl("searchProvider") as HTMLSelectElement).value = settings.searchProvider;
  (getEl("debugLogs") as HTMLInputElement).checked = settings.debugLogs;
}

async function saveOptions() {
  const status = document.getElementById("status");
  
  await updateStats((prev) => {
    const newSettings: AppSettings = {
      enabled: (getEl("enabled") as HTMLInputElement).checked,
      enableNudge: true,
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

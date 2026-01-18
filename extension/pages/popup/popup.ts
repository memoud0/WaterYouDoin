import { getStats } from "../../core/storage/storage";
import { formatWaterVolume } from "../../core/metrics/water";
import { MascotState } from "../../core/storage/schema";

const MASCOT_IMAGES: Record<MascotState, string> = {
  SOLID: "/extension/assets/mascot/cube-smiling.png",
  THINKING: "/extension/assets/mascot/cube-thinking.png",
  MELTING: "/extension/assets/mascot/cube-melting.png",
  DROPLET: "/extension/assets/mascot/cube-puddle.png",
};

const MASCOT_MESSAGES: Record<MascotState, string> = {
  SOLID: "Great job!",
  THINKING: "Thinking...",
  MELTING: "High usage!",
  DROPLET: "Meltdown!",
};

document.addEventListener("DOMContentLoaded", async () => {
  const stats = await getStats();

  const waterEl = document.getElementById("water-count");
  if (waterEl) {
    waterEl.textContent = formatWaterVolume(stats.water.litersSavedLifetime);
  }

  const imgEl = document.getElementById("mascot-image") as HTMLImageElement;
  const statusEl = document.getElementById("mascot-status");
  
  if (imgEl && statusEl) {
    const state = stats.severity.mascotState;
    imgEl.src = MASCOT_IMAGES[state] || MASCOT_IMAGES["SOLID"];
    statusEl.textContent = MASCOT_MESSAGES[state];
    
    if (state === "MELTING" || state === "DROPLET") {
      statusEl.style.color = "#d9534f";
    }
  }

  const redirectEl = document.getElementById("stat-redirects");
  const allowedEl = document.getElementById("stat-allowed");
  const totalEl = document.getElementById("stat-total");

  if (redirectEl) redirectEl.textContent = stats.today.factualRedirects.toString();
  if (allowedEl) allowedEl.textContent = (stats.today.askAIAnywayClicks + stats.today.reasoningNudges).toString(); // Approx "allowed"
  if (totalEl) totalEl.textContent = (stats.today.avoidedAiCalls + stats.today.askAIAnywayClicks).toString();

  const sliderEl = document.getElementById("severity-slider");
  if (sliderEl) {
    const score = stats.severity.score || 0;
    const position = 10 + (score * 0.8);
    sliderEl.style.left = `${position}%`;
  }

  const settingsBtn = document.getElementById("settings-btn");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL('extension/pages/options/options.html'));
      }
    });
  }
});
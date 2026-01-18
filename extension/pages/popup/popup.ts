import { getStats } from "../../core/storage/schema";
import { formatWaterVolume } from "../../core/metrics/water";
import { MascotState } from "../../core/storage/schema";

const MASCOT_IMAGES: Record<MascotState, string> = {
  SOLID: chrome.runtime.getURL("extension/assets/mascot/cube-smiling.png"),
  THINKING: chrome.runtime.getURL("extension/assets/mascot/cube-thinking.png"),
  MELTING: chrome.runtime.getURL("extension/assets/mascot/cube-melting.png"),
  DROPLET: chrome.runtime.getURL("extension/assets/mascot/cube-puddle.png"),
};

const MASCOT_MESSAGES: Record<MascotState, string> = {
  SOLID: "Great job!",
  THINKING: "Thinking...",
  MELTING: "High usage!",
  DROPLET: "Meltdown!",
};

function computeTodayTotals(stats: Awaited<ReturnType<typeof getStats>>) {
  const allowed = stats.today.askAIAnywayClicks + stats.today.reasoningNudges;
  const total =
    stats.today.factualRedirects +
    stats.today.lowValueBlocks +
    stats.today.reasoningNudges +
    stats.today.askAIAnywayClicks +
    stats.today.tryMyselfClicks +
    stats.today.duplicateBlocked;
  return { allowed, total };
}

function renderStats(stats: Awaited<ReturnType<typeof getStats>>) {
  const waterEl = document.getElementById("water-count");
  const waterTodayEl = document.getElementById("water-today");
  if (waterEl) {
    waterEl.textContent = formatWaterVolume(stats.water.litersSavedLifetime);
  }
  if (waterTodayEl) {
    waterTodayEl.textContent = formatWaterVolume(stats.water.litersSavedDaily);
  }

  const imgEl = document.getElementById("mascot-image") as HTMLImageElement;
  const statusEl = document.getElementById("mascot-status");

  if (imgEl && statusEl) {
    const rawState = stats.severity.mascotState;
    const state: MascotState = rawState === "THINKING" ? "SOLID" : rawState;
    const nextSrc = MASCOT_IMAGES[state] || MASCOT_IMAGES["SOLID"];
    if (imgEl.src !== nextSrc) {
      imgEl.style.opacity = "0";
      imgEl.style.transform = "scale(0.97)";
      requestAnimationFrame(() => {
        imgEl.src = nextSrc;
        imgEl.onload = () => {
          imgEl.style.opacity = "1";
          imgEl.style.transform = "scale(1)";
        };
      });
    }
    statusEl.textContent = MASCOT_MESSAGES[state];

    if (state === "MELTING" || state === "DROPLET") {
      statusEl.style.color = "#d9534f";
    } else {
      statusEl.style.color = "#005dad";
    }
  }

  const redirectEl = document.getElementById("stat-redirects");
  const allowedEl = document.getElementById("stat-allowed");
  const totalEl = document.getElementById("stat-total");

  const { allowed, total } = computeTodayTotals(stats);
  if (redirectEl) redirectEl.textContent = stats.today.factualRedirects.toString();
  if (allowedEl) allowedEl.textContent = allowed.toString();
  if (totalEl) totalEl.textContent = total.toString();

  const sliderEl = document.getElementById("severity-slider");
  if (sliderEl) {
    const score = stats.severity.score || 0;
    const position = 10 + score * 0.8;
    sliderEl.style.left = `${position}%`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const stats = await getStats();
  renderStats(stats);

  const settingsBtn = document.getElementById("settings-btn");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL("extension/pages/options/options.html"));
      }
    });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "METRICS_UPDATE" && msg.data) {
      renderStats(msg.data);
    }
  });
});

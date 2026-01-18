type NudgeType = "FACTUAL" | "LOW_VALUE" | "REASONING";

const popup = document.getElementById("popup") as HTMLDivElement;
const closeBtn = document.getElementById(
  "popup-close-button"
) as HTMLImageElement;

const cubeImg = document.getElementById("popup-cube") as HTMLImageElement;
const titleEl = document.getElementById("popup-title") as HTMLDivElement;
const textEl = document.getElementById("popup-text") as HTMLDivElement;
const linkEl = document.getElementById("popup-link") as HTMLAnchorElement;

if (!popup || !closeBtn) {
  throw new Error("Nudge DOM not mounted");
}

closeBtn.addEventListener("click", () => {
  popup.classList.remove("opened");
  popup.classList.add("closed");
});

export function showNudge(
  type: NudgeType,
  payload?: { url?: string }
) {
  popup.classList.remove("closed");
  popup.classList.add("opened");

  linkEl.style.display = "none";

  switch (type) {
    case "FACTUAL":
      cubeImg.src = "../../assets/mascot/cube-neutral.png";
      titleEl.textContent = "This looks factual";
      textEl.textContent =
        "You don’t need AI for this. A simple search will do the job instantly.";

      if (payload?.url) {
        linkEl.href = payload.url;
        linkEl.textContent = "Open result";
        linkEl.style.display = "inline-block";
      }
      break;

    case "LOW_VALUE":
      cubeImg.src = "../../assets/mascot/cube-sad.png";
      titleEl.textContent = "Let’s pause for a second";
      textEl.textContent =
        "This prompt doesn’t really need computing power. Tiny choices add up — let’s save some water 💧.";
      break;

    case "REASONING":
      cubeImg.src = "../../assets/mascot/cube-thinking.png";
      titleEl.textContent = "This looks reasoning-heavy";
      textEl.textContent =
        "Before asking AI, try breaking the problem into steps or rewording it more clearly. You might solve it yourself — and if not, AI is still here.";
      break;
  }
}

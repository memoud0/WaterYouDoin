console.log("[WaterYouDoin] content script loaded");

// Find ChatGPT's ProseMirror textbox
function findTextbox(): HTMLElement | null {
  return document.querySelector("#prompt-textarea");
}

// Core interception logic (THE ONE WE AGREED ON)
function intercept(textbox: HTMLElement) {
  console.log("[WaterYouDoin] intercept ready");

  document.addEventListener(
    "keydown",
    (e) => {
      // Only intercept REAL user Enter presses
      if (
        e.key !== "Enter" ||
        e.shiftKey ||
        e.isComposing ||
        !e.isTrusted
      ) {
        return;
      }

      // Snapshot BEFORE React mutates the DOM
      const snapshot = textbox.innerText;
      const prompt = snapshot.trim();

      console.log("[WaterYouDoin] prompt captured:", prompt);

      if (!prompt) return;

      // Pause ChatGPT submission
      e.preventDefault();
      e.stopPropagation();

      // Hand off to background for decision
      chrome.runtime.sendMessage(
        {
          type: "PROMPT_SUBMIT",
          prompt,
          pageUrl: location.href,
          timestamp: Date.now(),
        },
        (res) => {
          if (!res) return;

          // --- CASE: ALLOW ---
          if (res.action === "ALLOW") {
            textbox.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: "Enter",
                code: "Enter",
                bubbles: true,
              })
            );
          }

          // --- CASE: BLOCK / NUDGE / REDIRECT ---
          // (Handled elsewhere — modal, redirect, etc.)
        }
      );
    },
    true // CAPTURE PHASE (critical)
  );
}

// SPA-safe observer: ChatGPT recreates the editor often
const observer = new MutationObserver(() => {
  const textbox = findTextbox();

  if (textbox && !(textbox as any).__wyIntercepted) {
    (textbox as any).__wyIntercepted = true;
    intercept(textbox);
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

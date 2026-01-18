console.log("[WaterYouDoin] content script loaded");

function findTextbox(): HTMLElement | null {
  return document.querySelector('#prompt-textarea');
}

function intercept(textbox: HTMLElement) {
  console.log("[WaterYouDoin] intercept ready");

  document.addEventListener(
    "keydown",
    (e) => {
      if (
        e.key !== "Enter" ||
        e.shiftKey ||
        e.isComposing ||
        !e.isTrusted
        ) {
        return;
        }


      // Snapshot BEFORE anything else
      const snapshot = textbox.innerText;
      const prompt = snapshot.trim();

      console.log("[WaterYouDoin] prompt captured:", prompt);

      if (!prompt) return;

      e.preventDefault();
      e.stopPropagation();

      chrome.runtime.sendMessage(
        {
          type: "PROMPT_SUBMIT",
          prompt,
          pageUrl: location.href,
          timestamp: Date.now()
        },
        (res) => {
          if (res?.action === "ALLOW") {
            textbox.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: "Enter",
                code: "Enter",
                bubbles: true
              })
            );
          }
        }
      );
    },
    true // capture phase
  );
}

// SPA-safe observer (do NOT disconnect forever)
const observer = new MutationObserver(() => {
  const textbox = findTextbox();
  if (textbox && !(textbox as any).__wyIntercepted) {
    (textbox as any).__wyIntercepted = true;
    intercept(textbox);
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

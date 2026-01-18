function findTextarea(): HTMLTextAreaElement | null {
  return document.querySelector("textarea");
}

function intercept() {
  const textarea = findTextarea();
  if (!textarea) return;

  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();

      const prompt = textarea.value;
      if (!prompt.trim()) return;

      chrome.runtime.sendMessage(
        {
          type: "PROMPT_SUBMIT",
          prompt,
          pageUrl: location.href,
          timestamp: Date.now()
        },
        (res) => {
          if (!res) return;

          if (res.action === "ALLOW") {
            textarea.form?.dispatchEvent(
              new Event("submit", { bubbles: true })
            );
          }

          if (res.action === "BLOCK_LOW_VALUE") {
            console.log("Blocked low-value prompt");
          }
        }
      );
    }
  });
}

// ChatGPT is an SPA → wait until textarea exists
const observer = new MutationObserver(() => {
  if (findTextarea()) {
    intercept();
    observer.disconnect();
  }
});

observer.observe(document.body, { childList: true, subtree: true });

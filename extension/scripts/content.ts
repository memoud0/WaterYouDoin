import { buildDogpileUrl } from "../core/redirect/dogpile";
import { showNudgeModal } from "../pages/nudge/nudge";
import { updateStats } from "../core/storage/storage";

// Helper: Finds the chat box
function findTextarea(): HTMLTextAreaElement | null {
  return document.querySelector("textarea") || document.querySelector('div[contenteditable="true"]');
}

// Helper: Actually submits the prompt to ChatGPT
function submitPrompt(textarea: HTMLElement) {
  // 1. Mark as bypassed so we don't intercept it again
  textarea.dataset.iceguardBypass = "true";

  // 2. Dispatch Enter key
  const event = new KeyboardEvent("keydown", {
    key: "Enter",
    bubbles: true,
    cancelable: true,
    shiftKey: false
  });
  textarea.dispatchEvent(event);
}

function intercept() {
  const textarea = findTextarea();
  if (!textarea) return;

  // Listen for Enter key
  textarea.addEventListener("keydown", async (e) => {
    // If it's just Enter (no Shift) AND we haven't bypassed it yet
    if (e.key === "Enter" && !e.shiftKey && textarea.dataset.iceguardBypass !== "true") {
      
      const promptText = (textarea as HTMLTextAreaElement).value || textarea.innerText;
      if (!promptText.trim()) return;

      // 🛑 STOP propagation immediately to block the request
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      console.log("🧊 IceGuard: Intercepting prompt...", promptText.slice(0, 50));

      // 1. Ask Background: "What is this?"
      chrome.runtime.sendMessage(
        {
          type: "PROMPT_SUBMIT",
          prompt: promptText,
          pageUrl: location.href,
          timestamp: Date.now()
        },
        async (res) => {
          if (!res) return;

          // --- CASE A: ALLOW (Creative/Complex) ---
          if (res.action === "ALLOW") {
            submitPrompt(textarea);
          }

          // --- CASE B: FACT (Redirect) ---
          else if (res.action === "REDIRECT_FACT") {
            console.log("🚫 Blocking simple fact query. Redirecting...");
            
            // 1. Get settings & Track the "Save"
            await updateStats((prev) => ({
              ...prev,
              today: {
                ...prev.today,
                factualRedirects: prev.today.factualRedirects + 1,
                avoidedAiCalls: prev.today.avoidedAiCalls + 1,
              },
              water: {
                ...prev.water,
                litersSavedLifetime: prev.water.litersSavedLifetime + 0.5, // ~500ml saved
              }
            }));

            // 2. Build URL based on user preference (Google/Dogpile)
            // (You might need to fetch stats again or pass provider in 'res')
            // For now, we default to Dogpile or fetch locally if needed. 
            // Better: Pass provider in the response from background.
            const targetUrl = buildDogpileUrl(promptText);

            // 3. Redirect
            window.location.href = targetUrl;
          }

          // --- CASE C: REASONING (Nudge) ---
          else if (res.action === "NUDGE_REASONING") {
             console.log("🧠 Triggering reasoning nudge...");
             
             // Show the Modal
             showNudgeModal("nudge-" + Date.now(), res.waitMs || 10000, async (choice) => {
                
                if (choice === "TRY_MYSELF") {
                  // User decided to think!
                  await updateStats((prev) => ({
                    ...prev,
                    today: {
                      ...prev.today,
                      reasoningNudges: prev.today.reasoningNudges + 1,
                      avoidedAiCalls: prev.today.avoidedAiCalls + 1,
                    },
                    water: {
                      ...prev.water,
                      litersSavedLifetime: prev.water.litersSavedLifetime + 2.0, // Big save!
                    }
                  }));
                  // Clear the box (optional, helps them focus)
                  // (textarea as HTMLTextAreaElement).value = ""; 
                } 
                
                else if (choice === "ASK_AI_ANYWAY") {
                  // User gave up, let it through
                  await updateStats((prev) => ({
                    ...prev,
                    today: { ...prev.today, askAIAnywayClicks: prev.today.askAIAnywayClicks + 1 }
                  }));
                  
                  submitPrompt(textarea);
                }
             });
          }
        }
      );
    }
  }, true); // Use capture phase to ensure we catch it first
}

// Observer to handle ChatGPT's dynamic loading
const observer = new MutationObserver(() => {
  if (findTextarea()) {
    intercept();
    observer.disconnect(); // Attach once
  }
});

observer.observe(document.body, { childList: true, subtree: true });

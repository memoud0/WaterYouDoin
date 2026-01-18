console.log("[WaterYouDoin] content script loaded");

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

type DecisionResponse = {
  action?: "ALLOW" | "BLOCK_LOW_VALUE" | "SHOW_NUDGE" | "REDIRECT";
  classification?: "FACTUAL" | "LOW_VALUE" | "REASONING";
  url?: string;
  searchProvider?: "DOGPILE" | "GOOGLE";
  searchResults?: SearchResult[];
  signals?: string[];
};

function findTextbox(): HTMLElement | null {
  return document.querySelector("#prompt-textarea");
}

function findSendButton(textbox: HTMLElement): HTMLElement | null {
  const container = textbox.closest("form") ?? textbox.parentElement ?? document.body;
  return (
    (container.querySelector('button[type="submit"]') as HTMLElement | null) ||
    (container.querySelector('button[aria-label*="Send"]') as HTMLElement | null) ||
    (container.querySelector('button[data-testid*="send"]') as HTMLElement | null)
  );
}

function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function createNudgeUI() {
  const host = document.createElement("div");
  host.id = "wy-nudge-root";
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    *, *::before, *::after { box-sizing: border-box; }
    @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600;700&display=swap');

    @keyframes wy-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

    .wrapper {
      position: fixed;
      z-index: 999999;
      max-width: 440px;
      width: min(440px, calc(100vw - 24px));
      font-family: "Quicksand", system-ui, -apple-system, sans-serif;
      transition: opacity 160ms ease, transform 160ms ease, visibility 160ms ease;
      opacity: 0;
      visibility: hidden;
      transform: translateY(8px);
      animation: wy-fade-in 180ms ease;
    }
    .wrapper.open {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }
    .card {
      background: linear-gradient(135deg, #74bdf9, #d4ecff);
      border-radius: 18px;
      box-shadow: 0 10px 28px rgba(0,0,0,0.18);
      padding: 12px;
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 10px;
      align-items: center;
      color: #0d2b4d;
    }
    .mascot {
      width: 68px;
      height: 68px;
      object-fit: contain;
      flex-shrink: 0;
    }
    .body {
      flex: 1;
      min-width: 0;
    }
    .title {
      font-weight: 700;
      font-size: 16px;
      color: #0d2b4d;
      margin: 0 0 4px 0;
      line-height: 1.3;
    }
    .subtitle {
      font-size: 13px;
      color: #163a62;
      margin: 0;
      line-height: 1.35;
    }
    .close {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      line-height: 1;
      color: #0d2b4d;
      font-size: 18px;
      transition: transform 120ms ease, color 120ms ease;
    }
    .close:hover { transform: scale(1.05); color: #002b59; }
    .results {
      margin-top: 10px;
      background: #fff;
      border-radius: 12px;
      padding: 10px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.6);
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 48vh;
      overflow-y: auto;
    }
    .result {
      display: block;
      text-decoration: none;
      background: #f7fbff;
      border: 1px solid #d2ecff;
      border-radius: 10px;
      padding: 10px 12px;
      color: #0d2b4d;
      transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease, background 120ms ease;
    }
    .result:hover {
      border-color: #61aef3;
      box-shadow: 0 6px 18px rgba(0,0,0,0.08);
      transform: translateY(-1px);
      background: #eef7ff;
    }
    .result-title {
      font-weight: 700;
      font-size: 14px;
      color: #005dad;
      margin-bottom: 4px;
      line-height: 1.3;
    }
    .result-url {
      font-size: 12px;
      color: #3172c4;
      margin-bottom: 4px;
      word-break: break-all;
    }
    .result-snippet {
      font-size: 12.5px;
      color: #214065;
      line-height: 1.4;
    }
    .empty {
      font-size: 13px;
      color: #214065;
      background: #f6fbff;
      border: 1px dashed #d2ecff;
      border-radius: 10px;
      padding: 10px 12px;
    }
    .actions {
      display: flex;
      gap: 8px;
      margin-top: 10px;
      flex-wrap: wrap;
    }
    .button {
      border: none;
      border-radius: 10px;
      padding: 10px 12px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
      font-size: 13px;
    }
    .button.primary {
      background: #61aef3;
      color: white;
      box-shadow: 0 8px 18px rgba(22,123,210,0.25);
    }
    .button.secondary {
      background: #ffffff;
      color: #005dad;
      border: 1px solid #61aef3;
    }
    .button:hover { transform: translateY(-1px); }
  `;

  const wrapper = document.createElement("div");
  wrapper.className = "wrapper";

  const card = document.createElement("div");
  card.className = "card";

  const mascot = document.createElement("img");
  mascot.className = "mascot";
  mascot.src = chrome.runtime.getURL("extension/assets/mascot/ICECUBE.PNG");

  const body = document.createElement("div");
  body.className = "body";

  const title = document.createElement("div");
  title.className = "title";
  title.textContent = "Quick factual results";

  const subtitle = document.createElement("div");
  subtitle.className = "subtitle";
  subtitle.textContent = "You don’t need AI for this. Pick a result or continue anyway.";

  const resultsList = document.createElement("div");
  resultsList.className = "results";

  const actions = document.createElement("div");
  actions.className = "actions";

  const openSearchBtn = document.createElement("button");
  openSearchBtn.className = "button secondary";
  openSearchBtn.textContent = "Open full search";

  const tryMyselfBtn = document.createElement("button");
  tryMyselfBtn.className = "button secondary";
  tryMyselfBtn.textContent = "I'll try myself";

  const askAiBtn = document.createElement("button");
  askAiBtn.className = "button primary";
  askAiBtn.textContent = "Ask ChatGPT anyway";

  actions.append(openSearchBtn, tryMyselfBtn, askAiBtn);

  const closeBtn = document.createElement("button");
  closeBtn.className = "close";
  closeBtn.textContent = "×";
  closeBtn.title = "Close";

  body.append(title, subtitle, resultsList, actions);
  card.append(mascot, body, closeBtn);
  wrapper.append(card);
  shadow.append(style, wrapper);
  document.body.appendChild(host);

  let searchUrl: string | undefined;
  let onAskAi: (() => void) | undefined;
  let anchor: HTMLElement | null = null;
  let nudgeStart = 0;

  const sendAskAnyway = () => {
    chrome.runtime.sendMessage({ type: "NUDGE_RESULT", choice: "ASK_AI_ANYWAY" });
    hide();
    onAskAi?.();
  };

  const sendTryMyself = () => {
    const waitedMs = Date.now() - nudgeStart;
    chrome.runtime.sendMessage({ type: "NUDGE_RESULT", choice: "TRY_MYSELF", waitedMs });
    hide();
  };

  closeBtn.addEventListener("click", () => hide());
  askAiBtn.addEventListener("click", sendAskAnyway);
  tryMyselfBtn.addEventListener("click", sendTryMyself);

  openSearchBtn.addEventListener("click", () => {
    if (searchUrl) {
      chrome.runtime.sendMessage({ type: "FACTUAL_RESULT_CLICK", prompt: lastPromptForMetrics });
      window.open(searchUrl, "_blank", "noopener");
    }
  });

  function renderResults(results: SearchResult[], promptForMetrics?: string) {
    resultsList.innerHTML = "";
    if (!results.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "Couldn’t fetch quick results right now. You can still open the search results or ask ChatGPT.";
      resultsList.appendChild(empty);
      return;
    }

    for (const r of results) {
      const item = document.createElement("a");
      item.className = "result";
      item.href = r.url;
      item.target = "_blank";
      item.rel = "noopener noreferrer";
      item.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "FACTUAL_RESULT_CLICK", prompt: promptForMetrics ?? lastPromptForMetrics });
      });

      const titleEl = document.createElement("div");
      titleEl.className = "result-title";
      titleEl.textContent = r.title;

      const urlEl = document.createElement("div");
      urlEl.className = "result-url";
      urlEl.textContent = displayHost(r.url);

      const snippetEl = document.createElement("div");
      snippetEl.className = "result-snippet";
      snippetEl.textContent = r.snippet || "Visit to learn more.";

      item.append(titleEl, urlEl, snippetEl);
      resultsList.appendChild(item);
    }
  }

  function positionNearAnchor() {
    const target = anchor ?? document.body;
    const rect = target.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const width = wrapper.offsetWidth || hostRect.width || 0;
    const height = wrapper.offsetHeight || hostRect.height || 0;

    let left = rect.right - width + 8;
    if (left < 12) left = 12;
    if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12;

    let top = rect.top - height - 10;
    if (top < 12) {
      top = rect.bottom + 10;
    }

    wrapper.style.left = `${left}px`;
    wrapper.style.top = `${top}px`;
  }

  function showFactual(results: SearchResult[], url?: string, onAsk?: () => void, anchorEl?: HTMLElement, promptForMetrics?: string) {
    searchUrl = url;
    onAskAi = onAsk;
    anchor = anchorEl ?? anchor;
    nudgeStart = Date.now();

    mascot.src = chrome.runtime.getURL("extension/assets/mascot/ICECUBE.PNG");
    title.textContent = "This looks factual";
    subtitle.textContent = "Stay on ChatGPT. Here are quick non-AI results you can open in a new tab.";
    renderResults(results, promptForMetrics);
    
    resultsList.style.display = "block";
    openSearchBtn.style.display = url ? "inline-block" : "none";
    tryMyselfBtn.style.display = "none";
    askAiBtn.style.display = "inline-block";

    wrapper.classList.add("open");
    requestAnimationFrame(() => positionNearAnchor());
  }

  function showMessage(
    titleText: string,
    subtitleText: string,
    onAsk?: () => void,
    anchorEl?: HTMLElement,
    showTryButton = false // NEW PARAMETER
  ) {
    searchUrl = undefined;
    onAskAi = onAsk;
    anchor = anchorEl ?? anchor;
    nudgeStart = Date.now();

    mascot.src = chrome.runtime.getURL("extension/assets/mascot/ICECUBE.PNG");
    title.textContent = titleText;
    subtitle.textContent = subtitleText;
    
    resultsList.innerHTML = "";
    resultsList.style.display = "none";
    
    openSearchBtn.style.display = "none";
    
    // CONTROL THE BUTTON VISIBILITY
    tryMyselfBtn.style.display = showTryButton ? "inline-block" : "none";
    
    askAiBtn.style.display = "inline-block";

    wrapper.classList.add("open");
    requestAnimationFrame(() => positionNearAnchor());
  }

  function hide() {
    wrapper.classList.remove("open");
  }

  window.addEventListener("resize", positionNearAnchor);
  document.addEventListener("scroll", positionNearAnchor, true);

  return { showFactual, showMessage, hide, setAnchor: (el: HTMLElement | null) => (anchor = el) };
}

const nudge = createNudgeUI();
let allowPassthrough = false;
let latestPrompt = "";
let lastPromptForMetrics = "";

function pickNudgeCopy(
  classification: "LOW_VALUE" | "REASONING",
  signals: string[] = []
): { title: string; subtitle: string } {
  const has = (s: string) => signals.includes(s);

  if (classification === "LOW_VALUE") {
    if (has("duplicate_prompt")) {
      return {
        title: "Looks like a duplicate",
        subtitle: "You just asked this. Skip the repeat or tweak it slightly before sending.",
      };
    }
    return {
      title: "Maybe skip this prompt",
      subtitle: "Doesn’t seem worth AI cycles. If you still need it, tighten the ask first.",
    };
  }

  // REASONING
  if (has("has_code_tokens") || has("has_error_words") || has("has_build_verbs")) {
    return {
      title: "Heavy lifting ahead",
      subtitle: "Break it into steps or isolate the failing part, then send. You’ll get a better answer.",
    };
  }
  return {
    title: "Take a beat before asking AI",
    subtitle: "Refine the question or outline your steps. Then send if you still need help.",
  };
}

function intercept(textbox: HTMLElement) {
  console.log("[WaterYouDoin] intercept ready");

  const updateLatest = () => {
    latestPrompt = (textbox.textContent ?? "").trim();
  };
  textbox.addEventListener("input", updateLatest, { passive: true });
  nudge.setAnchor(findSendButton(textbox) ?? textbox);

  document.addEventListener(
    "keydown",
    (e) => {
      if (allowPassthrough) return;

      if (
        e.key !== "Enter" ||
        e.shiftKey ||
        e.isComposing ||
        !e.isTrusted ||
        !textbox.contains(e.target as Node | null)
      ) {
        return;
      }

      const prompt = (textbox.textContent ?? "").trim() || latestPrompt;
      if (!prompt) return;
      lastPromptForMetrics = prompt;

      e.preventDefault();
      e.stopPropagation();

      chrome.runtime.sendMessage(
        {
          type: "PROMPT_SUBMIT",
          prompt,
          pageUrl: location.href,
          timestamp: Date.now(),
        },
        (res: DecisionResponse) => {
          if (!res) return;

          const sendToChatGPT = () => {
            allowPassthrough = true;
            textbox.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: "Enter",
                code: "Enter",
                bubbles: true,
              })
            );
            setTimeout(() => {
              allowPassthrough = false;
            }, 50);
          };

          if (res.action === "ALLOW") {
            sendToChatGPT();
            return;
          }

          if (res.action === "SHOW_NUDGE") {
            const anchor = findSendButton(textbox) ?? textbox;
            if (res.classification === "FACTUAL") {
              nudge.showFactual(res.searchResults ?? [], res.url, sendToChatGPT, anchor, lastPromptForMetrics);
              return;
            }
            const copy = pickNudgeCopy(res.classification ?? "REASONING", res.signals);
            // REASONING = SHOW TRY BUTTON
            nudge.showMessage(copy.title, copy.subtitle, sendToChatGPT, anchor, true);
            return;
          }

          if (res.action === "BLOCK_LOW_VALUE") {
            const anchor = findSendButton(textbox) ?? textbox;
            const copy = pickNudgeCopy("LOW_VALUE", res.signals);
            // LOW VALUE = HIDE TRY BUTTON
            nudge.showMessage(copy.title, copy.subtitle, sendToChatGPT, anchor, false);
            return;
          }
        }
      );
    },
    true
  );
}

const observer = new MutationObserver(() => {
  const textbox = findTextbox();
  if (textbox && !(textbox as any).__wyIntercepted) {
    (textbox as any).__wyIntercepted = true;
    intercept(textbox);
    observer.disconnect();
    setTimeout(() => observer.observe(document.body, { childList: true, subtree: true }), 1500);
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
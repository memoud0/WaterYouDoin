// 1. MUST HAVE 'export' HERE
export function showNudgeModal(nudgeId: string, waitMs: number, onComplete: (choice: "TRY_MYSELF" | "ASK_AI_ANYWAY") => void) {
  
  // 1. Inject Styles
  if (!document.getElementById("ig-nudge-styles")) {
    const style = document.createElement("style");
    style.id = "ig-nudge-styles";
    style.textContent = `
      #ig-overlay { position: fixed; top: 20px; right: 20px; width: 320px; background: white; z-index: 2147483647; padding: 20px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); border: 2px solid #005DAD; font-family: sans-serif; animation: slideIn 0.3s ease-out; }
      @keyframes slideIn { from { transform: translateX(120%); } to { transform: translateX(0); } }
      .ig-btn { display: block; width: 100%; padding: 12px; margin-top: 10px; cursor: pointer; border-radius: 8px; border: none; font-weight: bold; font-size: 14px; }
      .ig-primary { background: #005DAD; color: white; }
      .ig-secondary { background: transparent; color: #666; border: 1px solid #ddd; }
    `;
    document.head.appendChild(style);
  }

  // 2. Create Modal
  const div = document.createElement("div");
  div.id = "ig-overlay";
  div.innerHTML = `
    <h3 style="margin:0 0 10px; color:#005DAD; font-size: 18px;">🧊 Freeze!</h3>
    <p style="margin:0 0 15px; font-size:14px; color:#444; line-height: 1.4;">
      This looks like a complex problem. <br>Do you have a hypothesis yet?
    </p>
    <div id="ig-controls">
      <button id="ig-try" class="ig-btn ig-primary">I'll Try Myself (${waitMs / 1000}s)</button>
      <button id="ig-ask" class="ig-btn ig-secondary">Ask AI Anyway</button>
    </div>
  `;
  document.body.appendChild(div);

  // 3. Handle Clicks
  document.getElementById("ig-ask")?.addEventListener("click", () => {
    div.remove();
    onComplete("ASK_AI_ANYWAY");
  });

  document.getElementById("ig-try")?.addEventListener("click", () => {
    const controls = document.getElementById("ig-controls");
    let remaining = waitMs / 1000;
    
    // Timer UI
    if(controls) controls.innerHTML = `<div style="font-size:32px; text-align:center; color:#005DAD; margin: 20px 0;">${remaining}</div>`;
    
    const interval = setInterval(() => {
      remaining--;
      if(controls) controls.innerHTML = `<div style="font-size:32px; text-align:center; color:#005DAD; margin: 20px 0;">${remaining}</div>`;
      
      if (remaining <= 0) {
        clearInterval(interval);
        div.remove();
        onComplete("TRY_MYSELF");
      }
    }, 1000);
  });
}
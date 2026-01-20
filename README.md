# WaterYouDoin

🏆 **McHacks 2026 - 2nd Place Winner**

WaterYouDoin is a Chrome extension that nudges you away from low‑value AI prompts, redirects quick factual lookups to search, and encourages intentional problem‑solving for reasoning‑heavy requests. It tracks avoided tokens and estimates water saved locally.

Devpost: https://devpost.com/software/wateryourdoin

<p align="center">
  <img width="750" alt="pop-up-view" src="https://github.com/user-attachments/assets/b9eccefe-98cb-4e1b-b9fd-c6387bfc7b74" />
</p>

## What it does
- Classifies prompts into **Factual**, **Low‑Value**, or **Reasoning‑Heavy**.
- Shows a contextual nudge with a mascot and a suggested next step.
- Tracks daily and lifetime stats, including estimated water saved.
- Keeps all classification and counting local (no network calls for token estimates).

## Screenshots

<table align="center">
  <tr>
    <td><img src="https://github.com/user-attachments/assets/d4c717be-4d85-407c-bdb8-d7b8664371e0" width="300" /></td>
    <td><img src="https://github.com/user-attachments/assets/d446c642-72ec-41cf-90d2-275eb5d160a6" width="300" /></td>
  </tr>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/61a6680e-31c9-423a-896a-60266580764f" width="300" /></td>
    <td><img src="https://github.com/user-attachments/assets/a3b45d49-3fbf-4cf3-816f-b32722c659ac" width="300" /></td>
  </tr>
</table>

## Tech highlights
- Heuristic classifier with ML fallback for ambiguous prompts.
- Local token estimation using `gpt-tokenizer`.
- MV3 extension with background, content script, popup, and options UI.
- Vite build pipeline with static asset copy.

## Tech Stack:
### Core
- **TypeScript**
- **Node.js**
- **Chrome Extensions (Manifest V3)**

### Frontend & Build
- **Vite** — fast build pipeline
- **HTML / CSS** — popup, nudges, options UI

### NLP & Evaluation
- **Custom heuristic classifier**
- **Local ML fallback**
- **gpt-tokenizer** — local token estimation
- **Python (scikit-learn, numpy, pandas, joblib libraries)** — evaluation & dataset tooling

## Install
1. Install dependencies:
   ```bash
   npm install
   ```
2. Build the extension:
   ```bash
   npm run build
   ```
3. Load it in Chrome:
   - Open `chrome://extensions`
   - Enable **Developer mode**
   - Click **Load unpacked**
   - Select the `dist` folder

## Scripts
- `npm run dev` — Vite dev server (UI dev)
- `npm run build` — Build extension to `dist`
- `npm test` — Run tests (Vitest)
- `npm run classify` — Run the classify script
- `npm run eval` — Run pipeline evaluation on the CSV dataset

## Project structure
- `extension/` — Chrome extension source
  - `scripts/` — background/content logic
  - `pages/` — popup/options/offscreen/nudge UI
  - `core/` — classification + metrics + storage
- `ml/` — feature parity + evaluation utilities
- `dist/` — build output (created by Vite)

## Privacy
All classification and token estimation run locally. The extension does not send your prompts to any server for analysis.

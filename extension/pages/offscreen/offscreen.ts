import { parseSearchResultsFromHtml } from "../../core/redirect/parser";

type ParseResultsMessage = {
  type: "PARSE_SEARCH_RESULTS";
  html: string;
  limit?: number;
};

chrome.runtime.onMessage.addListener((msg: ParseResultsMessage, sender, sendResponse) => {
  if (msg.type !== "PARSE_SEARCH_RESULTS") return;

  const html = String(msg.html ?? "");
  const limit = Math.max(1, Math.min(5, Number(msg.limit ?? 5)));
  const results = parseSearchResultsFromHtml(html, limit);
  sendResponse({ ok: true, results });
});

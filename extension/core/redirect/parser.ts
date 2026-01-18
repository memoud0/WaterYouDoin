import type { SearchResult } from "./search";

function extractSnippet(anchor: Element): string {
  const snippetNode =
    anchor.closest(".result, .web-bing__result, article")?.querySelector("p") ??
    anchor.parentElement?.querySelector("p") ??
    anchor.parentElement;

  const snippet = snippetNode?.textContent?.trim() ?? "";
  return snippet.replace(/\s+/g, " ").slice(0, 220);
}

export function parseSearchResultsFromHtml(html: string, limit: number): SearchResult[] {
  if (!html) return [];

  if (typeof DOMParser === "undefined") return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const selectors = [
    "a.resultTitle",
    ".web-bing__result a",
    "a[data-evt='title']",
    "a[href^='http']",
  ];

  const anchors = Array.from(doc.querySelectorAll<HTMLAnchorElement>(selectors.join(",")));
  const seen = new Set<string>();
  const results: SearchResult[] = [];

  for (const a of anchors) {
    const href = a.getAttribute("href") ?? "";
    if (!href.startsWith("http")) continue;

    let normalizedUrl: string;
    try {
      const parsed = new URL(href);
      if (parsed.hostname.includes("dogpile.com")) continue;
      normalizedUrl = parsed.toString();
    } catch {
      continue;
    }

    if (seen.has(normalizedUrl)) continue;

    const title = a.textContent?.trim();
    if (!title) continue;

    const snippet = extractSnippet(a);
    results.push({
      title,
      url: normalizedUrl,
      snippet,
    });

    seen.add(normalizedUrl);
    if (results.length >= limit) break;
  }

  return results;
}

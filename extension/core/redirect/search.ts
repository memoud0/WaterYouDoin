export type SearchProvider = "DOGPILE" | "GOOGLE";

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

const SEARCH_BASE_URLS: Record<SearchProvider, string> = {
  DOGPILE: "https://www.dogpile.com/serp?q=",
  GOOGLE: "https://www.google.com/search?q=",
};

export function buildSearchUrl(provider: SearchProvider, query: string): string {
  const q = encodeURIComponent(query.trim());
  const baseUrl = SEARCH_BASE_URLS[provider] ?? SEARCH_BASE_URLS.DOGPILE;
  return `${baseUrl}${q}`;
}

function extractSnippet(anchor: Element): string {
  const snippetNode =
    anchor.closest(".result, .web-bing__result, article")?.querySelector("p") ??
    anchor.parentElement?.querySelector("p") ??
    anchor.parentElement;

  const snippet = snippetNode?.textContent?.trim() ?? "";
  return snippet.replace(/\s+/g, " ").slice(0, 220);
}

function parseSearchResults(doc: Document, limit: number): SearchResult[] {
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

export async function fetchTopSearchResults(
  provider: SearchProvider,
  query: string,
  limit = 5
): Promise<SearchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const searchUrl = buildSearchUrl(provider, cleanQuery);
  try {
    const res = await fetch(searchUrl, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!res.ok) return [];
    const html = await res.text();
    if (typeof DOMParser === "undefined") return [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const parsed = parseSearchResults(doc, limit);
    return parsed;
  } catch {
    return [];
  }
}

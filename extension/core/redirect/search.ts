import { parseSearchResultsFromHtml } from "./parser";

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

export async function fetchSearchHtml(
  provider: SearchProvider,
  query: string
): Promise<string | null> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return null;

  const searchUrl = buildSearchUrl(provider, cleanQuery);
  try {
    const res = await fetch(searchUrl, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function fetchTopSearchResults(
  provider: SearchProvider,
  query: string,
  limit = 5
): Promise<SearchResult[]> {
  const clampedLimit = Math.max(1, Math.min(5, limit));
  const html = await fetchSearchHtml(provider, query);
  if (!html) return [];
  return parseSearchResultsFromHtml(html, clampedLimit);
}

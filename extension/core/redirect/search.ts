export function buildSearchUrl(provider: "DOGPILE" | "GOOGLE", query: string): string {
  const q = encodeURIComponent(query.trim());

  if (provider === "GOOGLE") {
    return `https://www.google.com/search?q=${q}`;
  }
  return `https://www.dogpile.com/serp?q=${q}`;
}

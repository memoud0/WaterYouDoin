export function buildDogpileUrl(query: string): string {
  const q = encodeURIComponent(query.trim());
  return `https://www.dogpile.com/serp?q=${q}`;
}
import { asArray, asNumber, asRecord, asString } from "@/lib/market-data/http";

export type Headline = {
  id: string;
  title: string;
  source: string | null;
  publishedAt: string | null;
  url: string | null;
  symbols: string[];
};

export function parseHeadlines(payload: unknown, symbol?: string) {
  const seen = new Set<string>();
  const headlines: Headline[] = [];

  for (const item of asArray(asRecord(payload)?.news)) {
    const row = asRecord(item);
    const title = asString(row?.title);
    if (!row || !title) continue;
    const url = asString(row.link);
    const id = asString(row.uuid) ?? url ?? title;
    if (seen.has(id)) continue;
    const symbols = asArray(row.relatedTickers)
      .map((ticker) => asString(ticker))
      .filter((ticker): ticker is string => Boolean(ticker))
      .sort((left, right) => {
        if (!symbol) return 0;
        const match = (ticker: string) => ticker.toUpperCase() === symbol.toUpperCase();
        return Number(match(right)) - Number(match(left));
      });
    if (symbol && symbols.length > 0 && !symbols.some((ticker) => ticker.toUpperCase() === symbol.toUpperCase())) continue;
    seen.add(id);
    const seconds = asNumber(row.providerPublishTime);
    headlines.push({
      id,
      title,
      source: asString(row.publisher),
      publishedAt: seconds == null ? null : new Date(seconds * 1000).toISOString(),
      url,
      symbols,
    });
  }

  return headlines;
}

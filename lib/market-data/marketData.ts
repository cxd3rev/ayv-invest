import { displayTicker, rankSearchResults } from "@/lib/market-data/identity";
import type { MarketDataProvider } from "@/lib/market-data/providers/provider";
import { fetchYahooSearch, yahooProvider } from "@/lib/market-data/providers/yahoo";
import { parseHeadlines } from "@/lib/market-data/headlines";
import { MarketDataError, type AssetSearchResult } from "@/lib/market-data/types";

const CRYPTO_TICKERS = new Set(["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "AVAX", "DOT", "LINK"]);
const TYPO_HINTS: Record<string, string> = {
  nvida: "NVDA",
  bitc: "BTC-USD",
  bitco: "BTC-USD",
  ethe: "ETH-USD",
  sola: "SOL-USD",
  solan: "SOL-USD",
};

const searchCache = new Map<string, { at: number; results: AssetSearchResult[] }>();

function remember(query: string, results: AssetSearchResult[]) {
  searchCache.set(query, { at: Date.now(), results });
  if (searchCache.size > 40) {
    const oldest = searchCache.keys().next().value;
    if (oldest) searchCache.delete(oldest);
  }
}

export function getMarketDataProvider(): MarketDataProvider {
  const provider = process.env.MARKET_DATA_PROVIDER?.trim() || "yahoo";
  if (provider !== "yahoo") {
    throw new MarketDataError("The configured market-data provider is not available.");
  }

  return yahooProvider;
}

export async function searchAssets(query: string) {
  const trimmed = query.trim();
  const key = `v3:${trimmed.toLowerCase()}`;
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.at < 60_000) return cached.results;

  const provider = getMarketDataProvider();
  const upper = trimmed.toUpperCase();
  const [primary, cryptoAlias] = await Promise.all([
    provider.searchAssets(trimmed),
    CRYPTO_TICKERS.has(upper) ? provider.searchAssets(`${upper}-USD`).catch(() => []) : Promise.resolve([]),
  ]);

  const merged = [...primary, ...cryptoAlias];
  const hint = TYPO_HINTS[trimmed.toLowerCase()];
  if (hint && !merged.some((result) => result.symbol.toUpperCase() === hint || displayTicker(result.symbol, result.assetType) === hint)) {
    try {
      const quote = await provider.getAssetQuote(hint);
      if (quote) {
        merged.push({
          symbol: quote.symbol,
          name: quote.name,
          assetType: quote.assetType,
          exchange: quote.exchange,
          currency: quote.currency,
        });
      }
    } catch {
      // A typo hint is only shown when the provider confirms the listing.
    }
  }

  const ranked = rankSearchResults(trimmed, merged);
  remember(key, ranked);
  return ranked;
}

export async function getAssetQuote(symbol: string) {
  return getMarketDataProvider().getAssetQuote(symbol);
}

export async function getAssetQuotes(symbols: string[]) {
  return getMarketDataProvider().getAssetQuotes(symbols);
}

export async function getHistoricalPrices(
  symbol: string,
  options: { interval: "1d" | "15m"; from: string; to: string },
) {
  return getMarketDataProvider().getHistoricalPrices(symbol, options);
}

export async function getExchangeRateSeries(fromCurrency: string, start: string, end: string) {
  return getMarketDataProvider().getExchangeRateSeries(fromCurrency, start, end);
}

export async function getHeadlines(query: string, symbol?: string) {
  const payload = await fetchYahooSearch(query, 8);
  const headlines = parseHeadlines(payload);
  if (!symbol) return { headlines, relatedOnly: false };
  const matched = parseHeadlines(payload, symbol);
  if (matched.length > 0) return { headlines: matched, relatedOnly: true };
  return { headlines, relatedOnly: false };
}

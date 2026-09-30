import type { MarketDataProvider } from "@/lib/market-data/providers/provider";
import { yahooProvider } from "@/lib/market-data/providers/yahoo";
import { MarketDataError } from "@/lib/market-data/types";

export function getMarketDataProvider(): MarketDataProvider {
  const provider = process.env.MARKET_DATA_PROVIDER?.trim() || "yahoo";
  if (provider !== "yahoo") {
    throw new MarketDataError("The configured market-data provider is not available.");
  }

  return yahooProvider;
}

export async function searchAssets(query: string) {
  return getMarketDataProvider().searchAssets(query);
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

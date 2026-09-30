import type { AssetQuote, AssetSearchResult, HistoryInterval, PriceBar } from "@/lib/market-data/types";

export interface MarketDataProvider {
  searchAssets(query: string): Promise<AssetSearchResult[]>;
  getAssetQuote(symbol: string): Promise<AssetQuote | null>;
  getAssetQuotes(symbols: string[]): Promise<Map<string, AssetQuote>>;
  getHistoricalPrices(
    symbol: string,
    options: { interval: HistoryInterval; from: string; to: string },
  ): Promise<PriceBar[]>;
  getExchangeRateSeries(fromCurrency: string, start: string, end: string): Promise<Map<string, number>>;
}

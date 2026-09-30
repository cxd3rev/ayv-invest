export type AssetType = "stock" | "etf" | "crypto";
export type SearchAssetType = AssetType | "index" | "commodity";

export type AssetSearchResult = {
  symbol: string;
  name: string;
  assetType: SearchAssetType;
  exchange: string | null;
  currency: string | null;
};

export type AssetQuote = {
  symbol: string;
  name: string;
  assetType: SearchAssetType;
  exchange: string | null;
  currency: string;
  price: number;
  previousClose: number | null;
  asOf: string | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  marketCap: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
};

export type PriceBar = {
  time: string;
  close: number;
  volume?: number;
};

export type HistoryInterval = "1d" | "15m";

export class MarketDataError extends Error {
  constructor(message = "Unable to load market data.") {
    super(message);
    this.name = "MarketDataError";
  }
}

export function normalizeQuotedMoney(currency: string, amount: number) {
  if (currency === "GBp" || currency === "GBX") {
    return { currency: "GBP", amount: amount / 100 };
  }

  return { currency: currency.toUpperCase(), amount };
}

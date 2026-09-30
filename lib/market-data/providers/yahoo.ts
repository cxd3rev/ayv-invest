import { getExchangeRateSeries } from "@/lib/market-data/fx";
import { yahooUrl } from "@/lib/market-data/hosts";
import { asArray, asNumber, asRecord, asString, fetchJson, mapPool } from "@/lib/market-data/http";
import type { MarketDataProvider } from "@/lib/market-data/providers/provider";
import {
  type AssetQuote,
  type AssetSearchResult,
  type SearchAssetType,
  type PriceBar,
  normalizeQuotedMoney,
} from "@/lib/market-data/types";

function mapAssetType(value: string | null): SearchAssetType | null {
  switch (value) {
    case "EQUITY":
      return "stock";
    case "ETF":
      return "etf";
    case "CRYPTOCURRENCY":
      return "crypto";
    case "INDEX":
      return "index";
    case "FUTURE":
    case "COMMODITY":
      return "commodity";
    default:
      return null;
  }
}

function chartUrl(symbol: string, params: string) {
  return yahooUrl(`/v8/finance/chart/${encodeURIComponent(symbol)}?${params}`);
}

function readQuote(symbol: string, payload: unknown): AssetQuote | null {
  const result = asRecord(asArray(asRecord(asRecord(payload)?.chart)?.result)[0]);
  const meta = asRecord(result?.meta);
  if (!meta) return null;

  const assetType = mapAssetType(asString(meta.instrumentType));
  const rawPrice = asNumber(meta.regularMarketPrice);
  const rawCurrency = asString(meta.currency);
  if (!assetType || rawPrice == null || rawPrice < 0 || !rawCurrency) return null;

  const price = normalizeQuotedMoney(rawCurrency, rawPrice);
  const previousRaw = asNumber(meta.chartPreviousClose) ?? asNumber(meta.previousClose);
  const previous =
    previousRaw == null ? null : normalizeQuotedMoney(rawCurrency, previousRaw).amount;
  const marketTime = asNumber(meta.regularMarketTime);
  const highRaw = asNumber(meta.regularMarketDayHigh);
  const lowRaw = asNumber(meta.regularMarketDayLow);

  return {
    symbol: asString(meta.symbol) ?? symbol.toUpperCase(),
    name: asString(meta.longName) ?? asString(meta.shortName) ?? symbol.toUpperCase(),
    assetType,
    exchange: asString(meta.fullExchangeName) ?? asString(meta.exchangeName),
    currency: price.currency,
    price: price.amount,
    previousClose: previous,
    asOf: marketTime == null ? null : new Date(marketTime * 1000).toISOString(),
    dayHigh: highRaw == null ? null : normalizeQuotedMoney(rawCurrency, highRaw).amount,
    dayLow: lowRaw == null ? null : normalizeQuotedMoney(rawCurrency, lowRaw).amount,
    volume: asNumber(meta.regularMarketVolume),
    marketCap: asNumber(meta.marketCap),
    fiftyTwoWeekHigh: (() => {
      const high = asNumber(meta.fiftyTwoWeekHigh);
      return high == null ? null : normalizeQuotedMoney(rawCurrency, high).amount;
    })(),
    fiftyTwoWeekLow: (() => {
      const low = asNumber(meta.fiftyTwoWeekLow);
      return low == null ? null : normalizeQuotedMoney(rawCurrency, low).amount;
    })(),
  };
}

export async function fetchYahooSearch(query: string, newsCount: number) {
  const url = yahooUrl(
    `/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=0&newsCount=${newsCount}`,
  );
  return fetchJson(url, 120);
}

function readBars(payload: unknown, interval: "1d" | "15m"): PriceBar[] {
  const result = asRecord(asArray(asRecord(asRecord(payload)?.chart)?.result)[0]);
  if (!result) return [];

  const timestamps = asArray(result.timestamp);
  const quote = asRecord(asArray(asRecord(result.indicators)?.quote)[0]);
  const closes = asArray(quote?.close);
  const volumes = asArray(quote?.volume);
  const meta = asRecord(result.meta);
  const currency = asString(meta?.currency) ?? "USD";
  const bars: PriceBar[] = [];

  timestamps.forEach((timestamp, index) => {
    const seconds = asNumber(timestamp);
    const close = asNumber(closes[index]);
    if (seconds == null || close == null || close < 0) return;
    const iso = new Date(seconds * 1000).toISOString();
    const money = normalizeQuotedMoney(currency, close);
    const volume = asNumber(volumes[index]);
    bars.push({
      time: interval === "1d" ? iso.slice(0, 10) : iso,
      close: money.amount,
      volume: volume != null && volume >= 0 ? volume : undefined,
    });
  });

  return bars;
}

export const yahooProvider: MarketDataProvider = {
  async searchAssets(query) {
    const trimmed = query.trim();
    if (trimmed.length < 1) return [];

    const url = yahooUrl(`/v1/finance/search?q=${encodeURIComponent(trimmed)}&quotesCount=12&newsCount=0`);
    const payload = asRecord(await fetchJson(url, 300));
    const results: AssetSearchResult[] = [];

    for (const item of asArray(payload?.quotes)) {
      const quote = asRecord(item);
      const assetType = mapAssetType(asString(quote?.quoteType));
      const symbol = asString(quote?.symbol);
      if (!quote || !assetType || !symbol) continue;

      const currency = asString(quote.currency);
      results.push({
        symbol,
        name: asString(quote.longname) ?? asString(quote.shortname) ?? symbol,
        assetType,
        exchange: asString(quote.exchDisp),
        currency: currency ? normalizeQuotedMoney(currency, 1).currency : null,
      });
    }

    return results;
  },

  async getAssetQuote(symbol) {
    const payload = await fetchJson(chartUrl(symbol, "interval=1d&range=5d"), 120);
    const chart = asRecord(payload);
    if (asRecord(asRecord(chart?.chart)?.error)) return null;
    return readQuote(symbol, payload);
  },

  async getAssetQuotes(symbols) {
    const unique = [...new Set(symbols.map((symbol) => symbol.trim()).filter(Boolean))];
    const quotes = await mapPool(unique, 4, async (symbol) => {
      try {
        return await yahooProvider.getAssetQuote(symbol);
      } catch {
        return null;
      }
    });
    const map = new Map<string, AssetQuote>();

    quotes.forEach((quote, index) => {
      if (quote) map.set(unique[index].toUpperCase(), quote);
    });

    return map;
  },

  async getHistoricalPrices(symbol, options) {
    const start = Math.floor(new Date(`${options.from}T00:00:00Z`).getTime() / 1000);
    const end = Math.floor(new Date(`${options.to}T23:59:59Z`).getTime() / 1000);
    const payload = await fetchJson(
      chartUrl(symbol, `interval=${options.interval}&period1=${start}&period2=${end}`),
      options.interval === "1d" ? 60 * 60 : 120,
    );
    if (asRecord(asRecord(asRecord(payload)?.chart)?.error)) return [];
    return readBars(payload, options.interval);
  },

  getExchangeRateSeries,
};

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, eachDay, todayISO } from "@/lib/dates";
import { latestRate, rateOn } from "@/lib/market-data/fx";
import { getAssetQuote, getExchangeRateSeries, getHistoricalPrices } from "@/lib/market-data/marketData";
import { buildPortfolioHistory, quantityAt } from "@/lib/portfolio/calculations";
import { getStoredPortfolio } from "@/lib/portfolio/load";
import { isHistoryRange, rangeStart, type HistoryRange } from "@/lib/portfolio/ranges";

export async function getPortfolioHistory(supabase: SupabaseClient | null, rangeInput: string) {
  if (!isHistoryRange(rangeInput)) {
    return { ok: false as const, message: "Choose a valid time range." };
  }

  try {
    const portfolio = await getStoredPortfolio(supabase);
    if (!portfolio) return { ok: false as const, message: "Please log in." };
    if (portfolio.stored.length === 0) {
      return { ok: true as const, points: [], incomplete: false, warning: null };
    }

    const today = todayISO();
    const firstDate = [...portfolio.stored].sort((left, right) => left.date.localeCompare(right.date))[0]?.date ?? today;
    const start = rangeStart(rangeInput, today, firstDate);
    const heldAssets = uniqueHeldAssets(portfolio.stored, start, today);

    if (rangeInput === "1D") {
      return await intradayHistory(portfolio, heldAssets, today);
    }

    const prices: Record<string, { date: string; price: number }[]> = {};
    let missing = false;

    for (const asset of heldAssets) {
      try {
        const series = await priceSeries(asset.symbol, asset.currency, addDays(start, -7), today, "1d");
        if (series.length === 0) missing = true;
        prices[asset.assetId] = series;
      } catch (error) {
        console.error("history price", error);
        missing = true;
        prices[asset.assetId] = [];
      }
    }

    const points = buildPortfolioHistory({
      transactions: portfolio.converted,
      prices,
      days: eachDay(start, today),
    });

    return {
      ok: true as const,
      points: points.map((point) => ({ date: point.date, value: point.value })),
      incomplete: missing || points.some((point) => point.incomplete),
      warning:
        missing || points.some((point) => point.incomplete)
          ? "Some historical prices are unavailable, so this chart is incomplete."
          : null,
    };
  } catch (error) {
    console.error("getPortfolioHistory", error);
    return { ok: false as const, message: "Unable to load market data." };
  }
}

function uniqueHeldAssets(
  stored: { assetId: string; symbol: string; currency: string; date: string; type: "buy" | "sell"; quantity: number; createdAt: string }[],
  from: string,
  to: string,
) {
  const assets = new Map<string, { assetId: string; symbol: string; currency: string }>();
  for (const transaction of stored) {
    assets.set(transaction.assetId, {
      assetId: transaction.assetId,
      symbol: transaction.symbol,
      currency: transaction.currency,
    });
  }

  return [...assets.values()].filter((asset) => {
    const transactions = stored.map((transaction) => ({
      assetId: transaction.assetId,
      type: transaction.type,
      quantity: transaction.quantity,
      date: transaction.date,
      createdAt: transaction.createdAt,
    }));
    return quantityAt(transactions, asset.assetId, to) > 0 || stored.some((transaction) => transaction.assetId === asset.assetId && transaction.date >= from && transaction.date <= to);
  });
}

async function priceSeries(
  symbol: string,
  currency: string,
  from: string,
  to: string,
  interval: "1d" | "15m",
) {
  const quote = await getAssetQuote(symbol);
  const listingCurrency = quote?.currency ?? currency;
  const bars = await getHistoricalPrices(symbol, { interval, from, to });
  const fx = listingCurrency === "EUR" ? null : await getExchangeRateSeries(listingCurrency, from.slice(0, 10), to.slice(0, 10));
  const latest = fx ? latestRate(fx) : 1;

  return bars.flatMap((bar) => {
    const rate = listingCurrency === "EUR" ? 1 : fx ? (rateOn(fx, bar.time.slice(0, 10)) ?? latest) : null;
    if (rate == null) return [];
    return [{ date: bar.time, price: bar.close * rate }];
  });
}

async function intradayHistory(
  portfolio: NonNullable<Awaited<ReturnType<typeof getStoredPortfolio>>>,
  assets: { assetId: string; symbol: string; currency: string }[],
  today: string,
) {
  const prices: Record<string, { date: string; price: number }[]> = {};
  const stamps = new Set<string>();
  let missing = false;

  for (const asset of assets) {
    try {
      const series = await priceSeries(asset.symbol, asset.currency, today, today, "15m");
      if (series.length === 0) missing = true;
      prices[asset.assetId] = series;
      series.forEach((point) => stamps.add(point.date));
    } catch {
      missing = true;
      prices[asset.assetId] = [];
    }
  }

  const days = [...stamps].sort();
  const points =
    days.length > 0
      ? buildPortfolioHistory({ transactions: portfolio.converted, prices, days })
      : [];

  return {
    ok: true as const,
    points: points.map((point) => ({ date: point.date, value: point.value })),
    incomplete: missing || points.some((point) => point.incomplete),
    warning: missing ? "Intraday prices are unavailable for part of this portfolio." : null,
  };
}

export type { HistoryRange };

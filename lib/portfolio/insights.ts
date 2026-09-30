import type { HoldingView, TransactionView } from "@/lib/portfolio/types";

export function dayReturnPct(holding: HoldingView) {
  if (holding.dayChange == null || holding.currentValue == null) return null;
  const previous = holding.currentValue - holding.dayChange;
  if (previous === 0) return null;
  return (holding.dayChange / previous) * 100;
}

export function investedValue(holding: HoldingView) {
  if (holding.averageCost == null) return null;
  return holding.quantity * holding.averageCost;
}

export function topWeight(holdings: HoldingView[], count: number) {
  const weights = holdings
    .map((holding) => holding.portfolioPercent)
    .filter((value): value is number => value != null)
    .sort((left, right) => right - left);
  if (weights.length === 0) return null;
  return weights.slice(0, count).reduce((sum, value) => sum + value, 0);
}

export type Performer = {
  name: string;
  symbol: string;
  percent: number;
  profit: number | null;
  value: number | null;
};

export function rankPerformers(holdings: HoldingView[], period: "today" | "all"): Performer[] {
  return holdings
    .map((holding) => {
      const percent = period === "today" ? dayReturnPct(holding) : holding.returnPct;
      const profit = period === "today" ? holding.dayChange : holding.profitLoss;
      if (percent == null) return null;
      return {
        name: holding.name,
        symbol: holding.symbol,
        percent,
        profit,
        value: holding.currentValue,
      };
    })
    .filter((row): row is Performer => row !== null)
    .sort((left, right) => right.percent - left.percent);
}

export function feesByCurrency(transactions: TransactionView[]) {
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    totals.set(transaction.currency, (totals.get(transaction.currency) ?? 0) + transaction.fees);
  }
  return [...totals.entries()].filter(([, amount]) => amount > 0);
}

export function allocationDetails(holdings: HoldingView[]) {
  const details: Record<string, { name: string; percent: number }[]> = { Stocks: [], ETFs: [], Crypto: [] };
  for (const holding of holdings) {
    if (holding.portfolioPercent == null) continue;
    const key = holding.assetType === "etf" ? "ETFs" : holding.assetType === "crypto" ? "Crypto" : "Stocks";
    details[key].push({ name: holding.name, percent: holding.portfolioPercent });
  }
  return details;
}

export function priceReturn(bars: { time: string; close: number }[], from: string) {
  const sorted = bars.filter((bar) => bar.close > 0).sort((left, right) => left.time.localeCompare(right.time));
  if (sorted.length < 2) return null;
  const end = sorted[sorted.length - 1];
  const start = [...sorted].reverse().find((bar) => bar.time.slice(0, 10) <= from) ?? null;
  if (!start || start.time === end.time || start.close === 0) return null;
  return ((end.close - start.close) / start.close) * 100;
}

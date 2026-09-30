import type { HoldingView, PortfolioView } from "@/lib/portfolio/types";

export function currencyExposure(holdings: HoldingView[]) {
  const totals = new Map<string, number>();
  let known = 0;
  for (const holding of holdings) {
    if (holding.currentValue == null || holding.currentValue <= 0 || !holding.listingCurrency) continue;
    known += holding.currentValue;
    totals.set(holding.listingCurrency, (totals.get(holding.listingCurrency) ?? 0) + holding.currentValue);
  }
  if (known <= 0) return [];
  return [...totals.entries()]
    .map(([currency, value]) => ({ currency, value, percent: (value / known) * 100 }))
    .sort((left, right) => right.value - left.value);
}

export function drawdownStats(values: number[]) {
  const series = values.filter((value) => value > 0);
  if (series.length < 2) return null;
  let peak = series[0];
  let max = 0;
  let current = 0;
  for (const value of series) {
    if (value >= peak) peak = value;
    const drop = peak === 0 ? 0 : ((value - peak) / peak) * 100;
    if (drop < max) max = drop;
    current = drop;
  }
  return { current, maximum: max };
}

export function pearson(left: number[], right: number[]) {
  const count = Math.min(left.length, right.length);
  if (count < 5) return null;
  const xs = left.slice(0, count);
  const ys = right.slice(0, count);
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let index = 0; index < count; index += 1) {
    const x = xs[index] - mx;
    const y = ys[index] - my;
    num += x * y;
    dx += x * x;
    dy += y * y;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

export function todayFacts(view: PortfolioView) {
  const facts: string[] = [];
  const missing: string[] = [];
  if (view.metrics.dayChange == null) missing.push("Today's euro move is unavailable because a previous close is missing.");
  else facts.push(`The portfolio moved ${view.metrics.dayChange.toFixed(2)} EUR today.`);
  const movers = view.holdings
    .filter((holding) => holding.dayChange != null)
    .sort((left, right) => Math.abs(right.dayChange ?? 0) - Math.abs(left.dayChange ?? 0))
    .slice(0, 3);
  for (const holding of movers) {
    const weight = holding.portfolioPercent == null ? "" : `, ${holding.portfolioPercent.toFixed(1)}% of the portfolio`;
    facts.push(`${holding.symbol} changed ${holding.dayChange?.toFixed(2)} EUR today${weight}.`);
  }
  if (movers.length === 0) missing.push("No holding has a previous close, so contributors are not listed.");
  missing.push("Dividends are not recorded.");
  missing.push("Currency movement is not separated from the euro prices.");
  missing.push("News was not loaded for this explanation.");
  return { facts, missing };
}

export function answerPortfolioQuestion(view: PortfolioView, question: string) {
  const text = question.trim().toLowerCase();
  if (!text) return "Ask about holdings, today's move, currencies, or dividends.";
  if (text.includes("technolog") || text.includes("sector") || text.includes("country") || text.includes("geograph")) {
    return "Sector and country exposure are not in the price feed, so that share is not calculated.";
  }
  if (text.includes("why")) {
    const explained = todayFacts(view);
    return [...explained.facts, ...explained.missing.map((line) => `Not included: ${line}`)].join(" ");
  }
  if (text.includes("dividend")) {
    return "No dividend payments are recorded, so dividend income is not available.";
  }
  if (text.includes("fee")) {
    return "Fees stay on each trade and are not converted into one currency here. Open the Plan page to see them by trade currency.";
  }
  if (text.includes("invested")) {
    if (view.metrics.totalInvested == null) return "Invested capital is unavailable.";
    return `Invested in open positions is ${view.metrics.totalInvested.toFixed(2)} EUR.`;
  }
  if (text.includes("realiz")) {
    if (view.metrics.realizedPl == null) return "Realized profit is unavailable because some trades could not be converted to EUR.";
    return `Realized profit on closed trades is ${view.metrics.realizedPl.toFixed(2)} EUR. This uses average cost, not a country tax rule.`;
  }
  if (text.includes("largest") || text.includes("top") || text.includes("holding")) {
    const rows = [...view.holdings].filter((holding) => holding.currentValue != null).sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0)).slice(0, 5);
    if (rows.length === 0) return "There are no priced holdings yet.";
    return rows.map((holding) => `${holding.symbol} ${holding.portfolioPercent == null ? "" : `${holding.portfolioPercent.toFixed(1)}%`}`).join(", ");
  }
  if (text.includes("today") || text.includes("move") || text.includes("this month")) {
    if (view.metrics.dayChange == null) return "Today's move is unavailable because a previous close is missing.";
    const monthNote = text.includes("month") ? " A separate figure for this calendar month is not stored." : "";
    return `Today's portfolio move is ${view.metrics.dayChange.toFixed(2)} EUR.${monthNote}`;
  }
  if (text.includes("usd") || text.includes("eur") || text.includes("currency")) {
    const rows = currencyExposure(view.holdings);
    if (rows.length === 0) return "Currency exposure needs a listing currency and a current value.";
    return rows.map((row) => `${row.currency} ${row.percent.toFixed(1)}%`).join(", ");
  }
  return "That is not available from the stored portfolio. Try largest holdings, today's move, currency, or dividends.";
}

export function annualizedVolatility(values: number[]) {
  const returns: number[] = [];
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const next = values[index];
    if (previous > 0 && next > 0) returns.push((next - previous) / previous);
  }
  if (returns.length < 5) return null;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

export function drawdownPath(points: { date: string; value: number }[]) {
  const series = points.filter((point) => point.value > 0);
  if (series.length < 2) return null;
  let peak = series[0].value;
  let peakDate = series[0].date;
  let maximum = 0;
  let maxPeak = peak;
  let maxPeakDate = peakDate;
  let troughDate = series[0].date;
  const path: { date: string; value: number; drawdown: number }[] = [];

  for (const point of series) {
    if (point.value >= peak) {
      peak = point.value;
      peakDate = point.date;
    }
    const drop = ((point.value - peak) / peak) * 100;
    path.push({ date: point.date, value: point.value, drawdown: drop });
    if (drop < maximum) {
      maximum = drop;
      maxPeak = peak;
      maxPeakDate = peakDate;
      troughDate = point.date;
    }
  }

  const last = series[series.length - 1];
  const current = ((last.value - peak) / peak) * 100;
  const troughIndex = series.findIndex((point) => point.date === troughDate);
  let recoveryDate: string | null = null;
  for (let index = troughIndex + 1; index < series.length; index += 1) {
    if (series[index].value + 1e-9 >= maxPeak) {
      recoveryDate = series[index].date;
      break;
    }
  }

  return {
    current,
    maximum,
    peakValue: peak,
    peakDate,
    maxPeakValue: maxPeak,
    maxPeakDate,
    troughDate,
    recoveryDate,
    path,
  };
}

export function holdingContributions(holdings: HoldingView[], portfolioValue: number | null) {
  if (portfolioValue == null || portfolioValue === 0) return [];
  return holdings
    .filter((holding) => holding.profitLoss != null)
    .map((holding) => ({
      assetId: holding.assetId,
      name: holding.name,
      symbol: holding.symbol,
      profit: holding.profitLoss ?? 0,
      contributionPct: ((holding.profitLoss ?? 0) / portfolioValue) * 100,
    }))
    .sort((left, right) => right.profit - left.profit);
}

export function exposureByType(holdings: HoldingView[], type: HoldingView["assetType"]) {
  const known = holdings.filter((holding) => holding.portfolioPercent != null);
  if (known.length === 0) return null;
  return known
    .filter((holding) => holding.assetType === type)
    .reduce((sum, holding) => sum + (holding.portfolioPercent ?? 0), 0);
}

export function alignBenchmarkReturn(dates: string[], closes: { date: string; close: number }[]) {
  const sorted = closes.filter((bar) => bar.close > 0).sort((left, right) => left.date.localeCompare(right.date));
  if (sorted.length < 2 || dates.length === 0) return null;
  let start: number | null = null;
  for (const bar of sorted) {
    if (bar.date.slice(0, 10) <= dates[0]) start = bar.close;
  }
  if (start == null) start = sorted[0].close;
  if (start === 0) return null;

  const result: (number | null)[] = [];
  let last: number | null = null;
  let index = 0;
  for (const date of dates) {
    while (index < sorted.length && sorted[index].date.slice(0, 10) <= date) {
      last = sorted[index].close;
      index += 1;
    }
    result.push(last == null ? null : ((last - start) / start) * 100);
  }
  return result;
}

export function portfolioMilestones(view: PortfolioView) {
  const notes: string[] = [];
  if (view.metrics.transactionCount > 0) notes.push(`${view.metrics.transactionCount} transaction${view.metrics.transactionCount === 1 ? "" : "s"} recorded.`);
  if (view.metrics.transactionCount >= 100) notes.push("100 transactions recorded.");
  const value = view.metrics.totalValue;
  for (const level of [1000, 10000, 25000, 100000]) {
    if (value != null && value >= level) notes.push(`Portfolio value is at least €${level.toLocaleString("en-IE")}.`);
  }
  return notes;
}

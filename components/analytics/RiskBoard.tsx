"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPercent, formatShortDate } from "@/lib/format";
import { addMonths, todayISO } from "@/lib/dates";
import { getHistoricalPrices } from "@/lib/market-data/marketData";
import { optionalClient } from "@/lib/supabase/client";
import { getPortfolioHistory } from "@/lib/portfolio/history";
import { annualizedVolatility, currencyExposure, drawdownPath, exposureByType, pearson } from "@/lib/portfolio/desk";
import { topWeight } from "@/lib/portfolio/insights";
import type { HistoryRange } from "@/lib/portfolio/ranges";
import type { PortfolioView } from "@/lib/portfolio/types";

const VOL_RANGES = ["1M", "3M", "6M", "1Y", "ALL"] as const;

export function RiskBoard({ view }: { view: PortfolioView }) {
  const holdings = view.holdings;
  const currencies = currencyExposure(holdings);
  const crypto = exposureByType(holdings, "crypto");
  const largest = topWeight(holdings, 1);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold tracking-tight">Concentration</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">Largest position</dt>
            <dd className="numeric mt-1">{largest == null ? "—" : formatPercent(largest).replace("+", "")}</dd>
          </div>
          <div>
            <dt className="text-muted">Top 5</dt>
            <dd className="numeric mt-1">{topWeight(holdings, 5) == null ? "—" : formatPercent(topWeight(holdings, 5) ?? 0).replace("+", "")}</dd>
          </div>
          <div>
            <dt className="text-muted">Crypto</dt>
            <dd className="numeric mt-1">{crypto == null ? "—" : formatPercent(crypto).replace("+", "")}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted">Weights use holdings that have a price. Sector and country concentration are not in this feed.</p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold tracking-tight">Currency concentration</h2>
        <p className="mt-1 text-xs text-muted">Listing currency, weighted by value in EUR. This is not the same as your base currency.</p>
        {currencies.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Currency weights appear when holdings have a listing currency and a value.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {currencies.map((row) => (
              <li key={row.currency}>
                <div className="flex justify-between text-sm">
                  <span>{row.currency}</span>
                  <span className="numeric text-muted">{formatPercent(row.percent).replace("+", "")}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-foreground/8">
                  <div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.min(100, row.percent)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <VolatilityPanel />
      <DrawdownPanel />
      <CorrelationPanel holdings={holdings.map((holding) => ({ symbol: holding.symbol, name: holding.name }))} />

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold tracking-tight">Not calculated</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          <li>Sector and geographic concentration need a sector and country for each holding. The price feed does not include them.</li>
          <li>ETF overlap needs underlying fund holdings. Those are not available.</li>
          <li>Dividend yield, growth, and a dividend calendar need recorded dividend payments. None are stored.</li>
          <li>Return split into sector, currency, and dividends is not estimated.</li>
        </ul>
      </section>
    </div>
  );
}

function VolatilityPanel() {
  const [range, setRange] = useState<(typeof VOL_RANGES)[number]>("1Y");
  const [value, setValue] = useState<number | null | undefined>(undefined);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setNote(null);
    const history = await getPortfolioHistory(optionalClient(), range);
    if (!history.ok) {
      setValue(null);
      setNote(history.message);
    } else {
      setValue(annualizedVolatility(history.points.map((point) => point.value)));
      setNote(history.warning ?? (history.points.length < 6 ? "Not enough daily portfolio values in this range." : null));
    }
    setLoading(false);
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold tracking-tight">Volatility</h2>
      <p className="mt-1 text-xs leading-5 text-muted">Annualized from daily portfolio value changes in the selected range. It needs at least five moves. It is not a forecast.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {VOL_RANGES.map((item) => (
          <button key={item} type="button" onClick={() => setRange(item)} className={`rounded-full border px-3 py-1 text-xs ${range === item ? "border-accent" : "border-border text-muted"}`}>{item}</button>
        ))}
        <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl border border-border px-3 py-1 text-xs disabled:opacity-60">{loading ? "Loading..." : "Calculate"}</button>
      </div>
      {value === undefined ? null : <p className="numeric mt-4 text-2xl">{value == null ? "—" : formatPercent(value).replace("+", "")}</p>}
      {note ? <p className="mt-2 text-sm text-muted">{note}</p> : null}
    </section>
  );
}

function DrawdownPanel() {
  const [path, setPath] = useState<ReturnType<typeof drawdownPath> | undefined>(undefined);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const history = await getPortfolioHistory(optionalClient(), "ALL");
    if (!history.ok) {
      setPath(null);
      setNote(history.message);
    } else {
      const next = drawdownPath(history.points);
      setPath(next);
      setNote(next ? history.warning : "Not enough portfolio history.");
    }
    setLoading(false);
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold tracking-tight">Drawdown</h2>
      <p className="mt-1 text-xs text-muted">Drop from the running peak of reconstructed portfolio value.</p>
      <button type="button" onClick={() => void load()} disabled={loading} className="mt-3 rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-60">{loading ? "Loading..." : "Load drawdown"}</button>
      {path ? (
        <>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">Current</dt><dd className="numeric mt-1">{formatPercent(path.current)}</dd></div>
            <div><dt className="text-muted">Maximum</dt><dd className="numeric mt-1">{formatPercent(path.maximum)}</dd></div>
            <div><dt className="text-muted">Peak before the largest drop</dt><dd className="mt-1">{formatShortDate(path.maxPeakDate)}</dd></div>
            <div><dt className="text-muted">Trough</dt><dd className="mt-1">{formatShortDate(path.troughDate)}</dd></div>
            <div><dt className="text-muted">Recovery</dt><dd className="mt-1">{path.recoveryDate ? formatShortDate(path.recoveryDate) : "Not recovered in this history"}</dd></div>
          </dl>
          <div className="mt-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={path.path}>
                <CartesianGrid stroke="rgba(141,149,168,0.18)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(value) => formatShortDate(String(value))} minTickGap={28} tick={{ fill: "#8d95a8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(value) => `${Number(value).toFixed(0)}%`} tick={{ fill: "#8d95a8", fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0].payload as { date: string; drawdown: number };
                    return (
                      <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                        <p>{formatShortDate(point.date)}</p>
                        <p className="numeric mt-1">{formatPercent(point.drawdown)}</p>
                      </div>
                    );
                  }}
                />
                <Area type="monotone" dataKey="drawdown" stroke="#e26d7a" fill="rgba(226,109,122,0.2)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : null}
      {note ? <p className="mt-3 text-sm text-muted">{note}</p> : null}
    </section>
  );
}

function CorrelationPanel({ holdings }: { holdings: { symbol: string; name: string }[] }) {
  const [selected, setSelected] = useState<string[]>(holdings.slice(0, 4).map((holding) => holding.symbol));
  const [range, setRange] = useState<HistoryRange>("1Y");
  const [matrix, setMatrix] = useState<(number | null)[][] | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const symbols = holdings.filter((holding) => selected.includes(holding.symbol));

  async function load() {
    setLoading(true);
    setNote(null);
    const today = todayISO();
    const from = range === "3M" ? addMonths(today, -3) : range === "5Y" ? addMonths(today, -60) : addMonths(today, -12);
    const series = await Promise.all(symbols.map(async (holding) => {
      try {
        const bars = await getHistoricalPrices(holding.symbol, { interval: "1d", from, to: today });
        const closes = new Map<string, number>();
        for (const bar of bars) closes.set(bar.time.slice(0, 10), bar.close);
        return closes;
      } catch {
        return new Map<string, number>();
      }
    }));
    const next = symbols.map((_, left) => symbols.map((__, right) => sharedCorrelation(series[left], series[right])));
    const missing = series.some((item) => item.size === 0);
    setMatrix(next);
    setNote(missing ? "Some price histories could not be loaded. A dash means fewer than five shared daily moves." : "A dash means fewer than five shared daily moves.");
    setLoading(false);
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold tracking-tight">Correlation</h2>
      <p className="mt-1 text-xs leading-5 text-muted">1 means daily price changes moved together in this sample. -1 means they moved in opposite directions. 0 means no linear relationship in the sample. This is not a prediction.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {holdings.map((holding) => {
          const on = selected.includes(holding.symbol);
          return (
            <button
              key={holding.symbol}
              type="button"
              onClick={() => setSelected((current) => {
                if (current.includes(holding.symbol)) return current.filter((symbol) => symbol !== holding.symbol);
                if (current.length >= 6) return current;
                return [...current, holding.symbol];
              })}
              className={`rounded-full border px-3 py-1 text-xs ${on ? "border-accent" : "border-border text-muted"}`}
            >
              {holding.symbol}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["3M", "1Y", "5Y"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setRange(item)} className={`rounded-full border px-3 py-1 text-xs ${range === item ? "border-accent" : "border-border text-muted"}`}>{item}</button>
        ))}
        <button type="button" onClick={() => void load()} disabled={loading || symbols.length < 2} className="rounded-xl border border-border px-3 py-1 text-xs disabled:opacity-60">{loading ? "Loading..." : "Load correlation"}</button>
      </div>
      {matrix ? (
        <div className="mt-4 overflow-x-auto">
          <table className="text-left text-xs">
            <thead>
              <tr>
                <th className="px-2 py-2" />
                {symbols.map((holding) => <th key={holding.symbol} className="px-2 py-2 font-medium">{holding.symbol}</th>)}
              </tr>
            </thead>
            <tbody>
              {symbols.map((holding, row) => (
                <tr key={holding.symbol}>
                  <th className="px-2 py-2 text-left font-medium">{holding.symbol}</th>
                  {matrix[row]?.map((value, column) => (
                    <td key={`${holding.symbol}-${symbols[column]?.symbol}`} className="numeric px-2 py-2" style={{ background: correlationColor(value) }}>
                      {value == null ? "—" : value.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {note ? <p className="mt-3 text-sm text-muted">{note}</p> : null}
    </section>
  );
}

function sharedCorrelation(left: Map<string, number>, right: Map<string, number>) {
  const dates = [...left.keys()].filter((date) => right.has(date)).sort();
  const xs: number[] = [];
  const ys: number[] = [];
  for (let index = 1; index < dates.length; index += 1) {
    const leftPrevious = left.get(dates[index - 1]) ?? 0;
    const rightPrevious = right.get(dates[index - 1]) ?? 0;
    const leftNext = left.get(dates[index]) ?? 0;
    const rightNext = right.get(dates[index]) ?? 0;
    if (leftPrevious > 0 && rightPrevious > 0) {
      xs.push((leftNext - leftPrevious) / leftPrevious);
      ys.push((rightNext - rightPrevious) / rightPrevious);
    }
  }
  return pearson(xs, ys);
}

function correlationColor(value: number | null) {
  if (value == null) return "transparent";
  const alpha = Math.min(0.45, Math.abs(value) * 0.45);
  return value >= 0 ? `rgba(61,190,140,${alpha})` : `rgba(226,109,122,${alpha})`;
}

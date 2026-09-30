"use client";

import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatLongDate, formatMoney, formatPercent, formatShortDate, formatSignedMoney } from "@/lib/format";
import { todayISO } from "@/lib/dates";
import { getHistoricalPrices } from "@/lib/market-data/marketData";
import { getPortfolioHistory } from "@/lib/portfolio/history";
import { alignBenchmarkReturn } from "@/lib/portfolio/desk";
import { HISTORY_RANGES, rangeStart, type HistoryRange } from "@/lib/portfolio/ranges";
import { optionalClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/Skeleton";

type Point = {
  date: string;
  value: number;
  invested: number | null;
  change: number | null;
  returnPct: number | null;
  benchmark: number | null;
};

const NO_CASH: { date: string; value: number }[] = [];

const COMPARE = [
  { id: "none", label: "None", symbol: "" },
  { id: "sp500", label: "S&P 500", symbol: "^GSPC" },
  { id: "nasdaq", label: "Nasdaq-100", symbol: "^NDX" },
  { id: "world", label: "MSCI World ETF", symbol: "URTH" },
  { id: "stoxx", label: "STOXX Europe 600 ETF", symbol: "EXSA.DE" },
  { id: "btc", label: "Bitcoin", symbol: "BTC-USD" },
] as const;

function cashAt(contributions: { date: string; value: number }[], date: string) {
  let value: number | null = null;
  for (const point of contributions) {
    if (point.date.slice(0, 10) <= date.slice(0, 10)) value = point.value;
  }
  return value;
}

export function PerformanceChart({ contributions = NO_CASH }: { contributions?: { date: string; value: number }[] }) {
  const [range, setRange] = useState<HistoryRange>("1M");
  const [points, setPoints] = useState<Point[] | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [compare, setCompare] = useState("none");
  const [customSymbol, setCustomSymbol] = useState("");
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);
  const [benchmarkLabel, setBenchmarkLabel] = useState<string | null>(null);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);
  const [asOf, setAsOf] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      getPortfolioHistory(optionalClient(), range)
        .then((body) => {
          if (cancelled) return;
          if (!body.ok) {
            setError(body.message);
            setPoints([]);
            return;
          }
          const first = body.points[0]?.value ?? 0;
          const next = body.points.map((point, index) => {
            const previous = index === 0 ? null : body.points[index - 1].value;
            return {
              date: point.date,
              value: point.value,
              invested: cashAt(contributions, point.date),
              change: previous == null ? null : point.value - previous,
              returnPct: first > 0 ? ((point.value - first) / first) * 100 : null,
              benchmark: null as number | null,
            };
          });
          setPoints(next);
          setWarning(body.warning);
        })
        .catch(() => {
          if (cancelled) return;
          setError("Unable to load market data.");
          setPoints([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [contributions, range]);

  const datesKey = points?.map((point) => point.date).join(",") ?? "";

  useEffect(() => {
    if (!activeSymbol || !datesKey) return;
    const dates = datesKey.split(",");
    let cancelled = false;
    const today = todayISO();
    const from = rangeStart(range, today, dates[0] ?? today);
    getHistoricalPrices(activeSymbol, { interval: "1d", from, to: today })
      .then((bars) => {
        if (cancelled) return;
        const aligned = alignBenchmarkReturn(
          dates.map((date) => date.slice(0, 10)),
          bars.map((bar) => ({ date: bar.time.slice(0, 10), close: bar.close })),
        );
        if (!aligned) {
          setBenchmarkError("Not enough history for this comparison.");
          setPoints((current) => current?.map((point) => ({ ...point, benchmark: null })) ?? current);
          return;
        }
        setBenchmarkError(null);
        setPoints((current) => current?.map((point, index) => ({ ...point, benchmark: aligned[index] ?? null })) ?? current);
      })
      .catch(() => {
        if (!cancelled) setBenchmarkError("This comparison could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [activeSymbol, datesKey, range]);

  const snapshot = useMemo(() => {
    if (!asOf || !points?.length) return null;
    const match = [...points].reverse().find((point) => point.date.slice(0, 10) <= asOf);
    return match ?? null;
  }, [asOf, points]);

  function chooseCompare(id: string) {
    setCompare(id);
    setBenchmarkError(null);
    if (id === "none") {
      setActiveSymbol(null);
      setBenchmarkLabel(null);
      setPoints((current) => current?.map((point) => ({ ...point, benchmark: null })) ?? current);
      return;
    }
    const item = COMPARE.find((entry) => entry.id === id);
    if (!item) return;
    setBenchmarkLabel(item.label);
    setActiveSymbol(item.symbol);
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Portfolio performance</h2>
          <p className="mt-1 text-xs text-muted">Value uses your transactions and saved prices. A comparison is not a recommendation.</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {HISTORY_RANGES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRange(item)}
              className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                item === range ? "bg-foreground/10 text-foreground" : "text-muted hover:bg-foreground/5"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {COMPARE.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => chooseCompare(item.id)}
            className={`rounded-full border px-3 py-1 text-xs ${compare === item.id ? "border-accent text-foreground" : "border-border text-muted"}`}
          >
            {item.label}
          </button>
        ))}
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const symbol = customSymbol.trim();
            if (!symbol) return;
            setCompare(`custom:${symbol.toUpperCase()}`);
            setBenchmarkError(null);
            setBenchmarkLabel(symbol.toUpperCase());
            setActiveSymbol(symbol);
          }}
        >
          <input
            value={customSymbol}
            onChange={(event) => setCustomSymbol(event.target.value)}
            placeholder="Custom symbol"
            aria-label="Custom comparison symbol"
            className="w-32 rounded-xl border border-border bg-background px-3 py-1 text-xs"
          />
          <button type="submit" className="rounded-xl border border-border px-3 py-1 text-xs">
            Compare
          </button>
        </form>
      </div>
      {loading ? <Skeleton className="mt-6 h-72" /> : null}
      {!loading && error ? <p className="mt-8 text-sm text-muted">{error}</p> : null}
      {!loading && !error && points && points.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Add an investment to see performance.</p>
      ) : null}
      {!loading && !error && points && points.length > 0 ? (
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ayvValue" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#c4b5fd" />
                  <stop offset="100%" stopColor="#f0abfc" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(243,240,247,0.08)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => formatShortDate(String(value))}
                minTickGap={28}
                tick={{ fill: "#8d95a8", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(value) =>
                  benchmarkLabel
                    ? `${Number(value).toFixed(0)}%`
                    : new Intl.NumberFormat("en-IE", {
                        notation: "compact",
                        style: "currency",
                        currency: "EUR",
                        maximumFractionDigits: 1,
                      }).format(Number(value))
                }
                width={72}
                tick={{ fill: "#8d95a8", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0].payload as Point;
                  return (
                    <div className="rounded-2xl border border-border bg-[#1a1622] px-3 py-2 text-sm shadow-[var(--shadow)]">
                      <p className="text-xs text-muted">{formatLongDate(point.date)}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="numeric text-base">{formatMoney(point.value)}</p>
                        {point.returnPct != null ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs ${point.returnPct >= 0 ? "bg-positive/15 text-positive" : "bg-negative/15 text-negative"}`}>
                            {formatPercent(point.returnPct)}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-muted">{point.change == null ? "Change —" : `Change ${formatSignedMoney(point.change)}`}</p>
                      {point.invested != null ? <p className="text-muted">Net cash invested {formatMoney(point.invested)}</p> : null}
                      {benchmarkLabel ? (
                        <p className="text-muted">
                          {benchmarkLabel} {point.benchmark == null ? "—" : formatPercent(point.benchmark)}
                        </p>
                      ) : null}
                    </div>
                  );
                }}
              />
              {benchmarkLabel ? (
                <Line type="monotone" dataKey="returnPct" name="Portfolio return" stroke="url(#ayvValue)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "#f0abfc" }} connectNulls={false} />
              ) : (
                <Line type="monotone" dataKey="value" name="Portfolio value" stroke="url(#ayvValue)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "#f0abfc" }} />
              )}
              {!benchmarkLabel && points.some((point) => point.invested != null) ? (
                <Line type="stepAfter" dataKey="invested" name="Net cash invested" stroke="#d4b483" strokeWidth={1.5} dot={false} />
              ) : null}
              {benchmarkLabel ? (
                <Line type="monotone" dataKey="benchmark" name={benchmarkLabel} stroke="#6fbfa8" strokeWidth={1.5} dot={false} connectNulls={false} />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
      {benchmarkLabel ? (
        <p className="mt-3 text-xs text-muted">
          Both lines are percent change from the start of this range. URTH and EXSA.DE are ETFs, not the indexes themselves. Net cash invested stays in the tooltip.
        </p>
      ) : null}
      {benchmarkError ? <p className="mt-2 text-sm text-muted">{benchmarkError}</p> : null}
      <label className="mt-4 block text-sm">
        <span className="text-muted">Portfolio value on a date</span>
        <input
          type="date"
          value={asOf}
          onChange={(event) => setAsOf(event.target.value)}
          className="mt-1 rounded-xl border border-border bg-background px-3 py-2"
        />
      </label>
      {asOf && !snapshot ? <p className="mt-2 text-sm text-muted">No portfolio value is stored on or before that date in this range.</p> : null}
      {snapshot ? (
        <p className="mt-2 text-sm">
          {formatLongDate(snapshot.date)} · {formatMoney(snapshot.value)}
          {snapshot.returnPct == null ? "" : ` · ${formatPercent(snapshot.returnPct)} from the start of this range`}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-muted">Allocation on a past date is not stored. This lookup is the reconstructed portfolio value only.</p>
      {warning ? <p className="mt-3 text-xs text-muted">{warning}</p> : null}
    </section>
  );
}

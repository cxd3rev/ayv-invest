"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatLongDate, formatMoney, formatShortDate } from "@/lib/format";
import { getPortfolioHistory } from "@/lib/portfolio/history";
import { HISTORY_RANGES, type HistoryRange } from "@/lib/portfolio/ranges";
import { optionalClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/Skeleton";

type Point = { date: string; value: number };

export function PerformanceChart() {
  const [range, setRange] = useState<HistoryRange>("1M");
  const [points, setPoints] = useState<Point[] | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
          setPoints(body.points);
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
  }, [range]);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h2 className="text-lg font-semibold tracking-tight">Portfolio performance</h2>
        <div className="flex flex-wrap gap-1">
          {HISTORY_RANGES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRange(item)}
              className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                item === range ? "bg-primary text-primary-foreground" : "text-muted hover:bg-foreground/5"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
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
              <CartesianGrid stroke="rgba(141,149,168,0.18)" vertical={false} />
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
                  new Intl.NumberFormat("en-IE", {
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
                    <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                      <p>{formatLongDate(point.date)}</p>
                      <p className="numeric mt-1">{formatMoney(point.value)}</p>
                    </div>
                  );
                }}
              />
              <Line type="monotone" dataKey="value" stroke="#8ea0d8" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
      {warning ? <p className="mt-3 text-xs text-muted">{warning}</p> : null}
    </section>
  );
}

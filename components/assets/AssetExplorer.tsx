"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AddInvestmentButton } from "@/components/portfolio/AddInvestmentModal";
import { assetTypeLabel, formatMoney, formatPercent, formatShortDate, formatSignedMoney } from "@/lib/format";
import { addMonths, todayISO } from "@/lib/dates";
import { getAssetQuote, getHistoricalPrices, searchAssets } from "@/lib/market-data/marketData";
import { Skeleton } from "@/components/ui/Skeleton";

type SearchResult = {
  symbol: string;
  name: string;
  assetType: "stock" | "etf" | "crypto";
  exchange: string | null;
  currency: string | null;
};

type Quote = {
  symbol: string;
  name: string;
  assetType: "stock" | "etf" | "crypto";
  exchange: string | null;
  currency: string;
  price: number;
  previousClose: number | null;
};

const fieldClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent";

export function AssetExplorer() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [points, setPoints] = useState<{ date: string; value: number }[] | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 1) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      setError(null);
      searchAssets(trimmed)
        .then((nextResults) => {
          if (!cancelled) setResults(nextResults);
        })
        .catch(() => {
          if (!cancelled) setError("Unable to load market data.");
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoadingDetail(true);
      setQuote(null);
      setPoints(null);
      const today = todayISO();
      Promise.all([
        getAssetQuote(selected),
        getHistoricalPrices(selected, { interval: "1d", from: addMonths(today, -6), to: today }),
      ])
        .then(([nextQuote, bars]) => {
          if (cancelled) return;
          if (!nextQuote) throw new Error("Asset not found.");
          setQuote(nextQuote);
          setPoints(bars.map((point) => ({ date: point.time, value: point.close })));
        })
        .catch((fetchError: unknown) => {
          if (cancelled) return;
          setError(fetchError instanceof Error && fetchError.message === "Asset not found." ? "Asset not found." : "Unable to load market data.");
        })
        .finally(() => {
          if (!cancelled) setLoadingDetail(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [selected]);

  const change =
    quote?.previousClose != null && quote.previousClose !== 0
      ? ((quote.price - quote.previousClose) / quote.previousClose) * 100
      : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section>
        <label className="block text-sm">
          <span className="mb-1.5 block text-muted">Search stocks, ETFs, and crypto</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="NVIDIA, AAPL, Bitcoin" className={fieldClass} />
        </label>
        {searching ? <p className="mt-4 text-sm text-muted">Searching...</p> : null}
        {error ? <p className="mt-4 text-sm text-negative">{error}</p> : null}
        <ul className="mt-4 space-y-2">
          {results.map((result) => (
            <li key={result.symbol}>
              <button
                type="button"
                onClick={() => setSelected(result.symbol)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                  selected === result.symbol ? "border-accent bg-foreground/5" : "border-border hover:bg-foreground/5"
                }`}
              >
                <span className="block font-medium">{result.name}</span>
                <span className="mt-1 block text-xs text-muted">
                  {result.symbol} · {assetTypeLabel(result.assetType)}
                  {result.exchange ? ` · ${result.exchange}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        {!selected ? <p className="text-sm text-muted">Select an asset to see its market price.</p> : null}
        {loadingDetail ? <Skeleton className="h-64" /> : null}
        {quote && !loadingDetail ? (
          <div>
            <p className="text-xs tracking-wide text-muted">{quote.symbol}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">{quote.name}</h2>
            <p className="mt-1 text-sm text-muted">
              {assetTypeLabel(quote.assetType)}
              {quote.exchange ? ` · ${quote.exchange}` : ""}
            </p>
            <p className="numeric mt-6 text-4xl font-medium tracking-tight">{formatMoney(quote.price, quote.currency)}</p>
            <p className={`mt-2 text-sm ${change != null && change < 0 ? "text-negative" : "text-positive"}`}>
              {quote.previousClose == null || change == null
                ? "Daily change unavailable"
                : `${formatSignedMoney(quote.price - quote.previousClose, quote.currency)} today (${formatPercent(change)})`}
            </p>
            <p className="mt-4 text-xs text-muted">Market data may be delayed. This is the listing price, not a recommendation.</p>
            {points && points.length > 1 ? (
              <div className="mt-6 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points}>
                    <CartesianGrid stroke="rgba(141,149,168,0.18)" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(value) => formatShortDate(String(value))} minTickGap={28} tick={{ fill: "#8d95a8", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis hide domain={["auto", "auto"]} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const point = payload[0].payload as { date: string; value: number };
                        return (
                          <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                            <p>{formatShortDate(point.date)}</p>
                            <p className="numeric mt-1">{formatMoney(point.value, quote.currency)}</p>
                          </div>
                        );
                      }}
                    />
                    <Line type="monotone" dataKey="value" stroke="#8ea0d8" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-6 text-sm text-muted">No price chart is available for this asset.</p>
            )}
            <div className="mt-6">
              <AddInvestmentButton
                label="Add to Portfolio"
                initialAsset={{
                  symbol: quote.symbol,
                  name: quote.name,
                  assetType: quote.assetType,
                  exchange: quote.exchange,
                  currency: quote.currency,
                }}
              />
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AssetSearch } from "@/components/assets/AssetSearch";
import { AddInvestmentButton } from "@/components/portfolio/AddInvestmentModal";
import { assetTypeLabel, formatMoney, formatPercent, formatShortDate, formatSignedMoney } from "@/lib/format";
import { displayTicker, shortAssetName } from "@/lib/market-data/identity";
import { addDays, addMonths, todayISO } from "@/lib/dates";
import type { SearchAssetType } from "@/lib/market-data/types";
import { getAssetQuote, getHistoricalPrices } from "@/lib/market-data/marketData";
import { Skeleton } from "@/components/ui/Skeleton";

type Quote = {
  symbol: string;
  name: string;
  assetType: SearchAssetType;
  exchange: string | null;
  currency: string;
  price: number;
  previousClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  marketCap: number | null;
  asOf: string | null;
};

export function AssetExplorer() {
  const [error, setError] = useState<string | null>(null);
  const urlSymbol = useSyncExternalStore(
    (callback) => {
      window.addEventListener("popstate", callback);
      return () => window.removeEventListener("popstate", callback);
    },
    () => new URLSearchParams(window.location.search).get("symbol"),
    () => null,
  );
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked ?? urlSymbol;
  const [quote, setQuote] = useState<Quote | null>(null);
  const [points, setPoints] = useState<{ date: string; value: number; volume?: number }[] | null>(null);
  const [range, setRange] = useState<"1D" | "1W" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "MAX">("6M");
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoadingDetail(true);
      setQuote(null);
      setPoints(null);
      const today = todayISO();
      const from = range === "1D" ? addDays(today, -1) : range === "1W" ? addDays(today, -7) : range === "1M" ? addMonths(today, -1) : range === "3M" ? addMonths(today, -3) : range === "6M" ? addMonths(today, -6) : range === "YTD" ? `${today.slice(0, 4)}-01-01` : range === "1Y" ? addMonths(today, -12) : range === "5Y" ? addMonths(today, -60) : "2000-01-01";
      Promise.all([
        getAssetQuote(selected),
        getHistoricalPrices(selected, { interval: range === "1D" ? "15m" : "1d", from, to: today }),
      ])
        .then(([nextQuote, bars]) => {
          if (cancelled) return;
          if (!nextQuote) throw new Error("Asset not found.");
          setQuote(nextQuote);
          setPoints(bars.map((point) => ({ date: point.time, value: point.close, volume: point.volume })));
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
  }, [selected, range]);

  const change =
    quote?.previousClose != null && quote.previousClose !== 0
      ? ((quote.price - quote.previousClose) / quote.previousClose) * 100
      : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section>
        <AssetSearch
          onSelect={(result) => {
            setError(null);
            setPicked(result.symbol);
            const url = new URL(window.location.href);
            url.searchParams.set("symbol", result.symbol);
            window.history.replaceState(null, "", url);
          }}
        />
        {error ? <p className="mt-4 text-sm text-negative">{error}</p> : null}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        {!selected ? <p className="text-sm text-muted">Select an asset to see its market price.</p> : null}
        {loadingDetail ? <Skeleton className="h-64" /> : null}
        {quote && !loadingDetail ? (
          <div>
            <p className="text-xs tracking-wide text-muted">{displayTicker(quote.symbol, quote.assetType)}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight" title={quote.name}>{shortAssetName(quote.name)}</h2>
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
            <p className="mt-4 text-xs text-muted">
              {quote.asOf ? `Last updated ${new Date(quote.asOf).toLocaleString()}. ` : "Update time unavailable. "}
              Market data may be delayed. Listing id {quote.symbol}. This is not a recommendation.
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-muted">Day high</dt><dd className="mt-1">{quote.dayHigh == null ? "N/A" : formatMoney(quote.dayHigh, quote.currency)}</dd></div>
              <div><dt className="text-xs text-muted">Day low</dt><dd className="mt-1">{quote.dayLow == null ? "N/A" : formatMoney(quote.dayLow, quote.currency)}</dd></div>
              <div><dt className="text-xs text-muted">Volume</dt><dd className="mt-1">{quote.volume == null ? "N/A" : quote.volume.toLocaleString("en-IE")}</dd></div>
              <div><dt className="text-xs text-muted">Market cap</dt><dd className="mt-1">{quote.marketCap == null ? "N/A" : quote.marketCap.toLocaleString("en-IE")}</dd></div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {(["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "5Y", "MAX"] as const).map((item) => (
                <button key={item} type="button" onClick={() => setRange(item)} className={`rounded-full border px-3 py-1 text-xs ${range === item ? "border-accent" : "border-border text-muted"}`}>{item}</button>
              ))}
            </div>
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
                        const point = payload[0].payload as { date: string; value: number; volume?: number };
                        return (
                          <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                            <p>{formatShortDate(point.date)}</p>
                            <p className="numeric mt-1">{formatMoney(point.value, quote.currency)}</p>
                            {point.volume != null ? <p className="mt-1 text-xs text-muted">Volume {point.volume.toLocaleString("en-IE")}</p> : null}
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

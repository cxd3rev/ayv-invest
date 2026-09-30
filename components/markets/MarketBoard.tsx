"use client";

import { useState } from "react";
import { formatMoney, formatPercent, formatSignedMoney } from "@/lib/format";
import { getAssetQuotes } from "@/lib/market-data/marketData";

const GROUPS = [
  { title: "Indices", symbols: ["^GSPC", "^NDX", "^DJI", "^GDAXI", "^FTSE", "^N225"] },
  { title: "Crypto", symbols: ["BTC-USD", "ETH-USD", "SOL-USD"] },
  { title: "Commodities", symbols: ["GC=F", "SI=F", "CL=F"] },
] as const;

const NAMES: Record<string, string> = {
  "^GSPC": "S&P 500",
  "^NDX": "Nasdaq-100",
  "^DJI": "Dow Jones",
  "^GDAXI": "DAX",
  "^FTSE": "FTSE 100",
  "^N225": "Nikkei 225",
  "BTC-USD": "Bitcoin",
  "ETH-USD": "Ethereum",
  "SOL-USD": "Solana",
  "GC=F": "Gold",
  "SI=F": "Silver",
  "CL=F": "Oil",
};

type Row = { symbol: string; price: number; currency: string; previous: number | null; asOf: string | null };

export function MarketBoard() {
  const [rows, setRows] = useState<Record<string, Row | null>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const symbols = GROUPS.flatMap((group) => [...group.symbols]);
      const quotes = await getAssetQuotes(symbols);
      const next: Record<string, Row | null> = {};
      for (const symbol of symbols) {
        const quote = quotes.get(symbol.toUpperCase());
        next[symbol] = quote
          ? { symbol, price: quote.price, currency: quote.currency, previous: quote.previousClose, asOf: quote.asOf }
          : null;
      }
      setRows(next);
    } catch {
      setError("Market prices could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-60">
        {loading ? "Loading..." : "Load market prices"}
      </button>
      {error ? <p className="text-sm text-muted">{error}</p> : null}
      <p className="text-xs text-muted">Prices come from the existing market feed and can be delayed. A missing row means that listing did not return a price.</p>
      {GROUPS.map((group) => (
        <section key={group.title} className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-medium">{group.title}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {group.symbols.map((symbol) => {
              const row = rows[symbol];
              const change = row?.previous != null && row.previous !== 0 ? ((row.price - row.previous) / row.previous) * 100 : null;
              return (
                <li key={symbol} className="flex items-center justify-between gap-3">
                  <span>{NAMES[symbol] ?? symbol}</span>
                  {row == null ? (
                    <span className="text-xs text-muted">{symbol in rows ? "Unavailable" : "—"}</span>
                  ) : (
                    <span className="text-right">
                      <span className="numeric block">{formatMoney(row.price, row.currency)}</span>
                      {change != null ? <span className={`text-xs ${change < 0 ? "text-negative" : "text-positive"}`}>{formatSignedMoney(row.price - (row.previous ?? row.price), row.currency)} ({formatPercent(change)})</span> : null}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

"use client";

import { useState, useSyncExternalStore } from "react";
import { AssetSearch } from "@/components/assets/AssetSearch";
import { formatMoney, formatPercent, formatSignedMoney } from "@/lib/format";
import { displayTicker } from "@/lib/market-data/identity";
import { getAssetQuotes } from "@/lib/market-data/marketData";
import type { AssetSearchResult } from "@/lib/market-data/types";

type List = { id: string; name: string; assets: AssetSearchResult[] };
const KEY = "ayv-invest.watchlists";

const EMPTY_LISTS: List[] = [];
let watchRaw = "";
let watchLists: List[] = EMPTY_LISTS;

function readLists(): List[] {
  if (typeof window === "undefined") return EMPTY_LISTS;
  const raw = window.localStorage.getItem(KEY) ?? "[]";
  if (raw === watchRaw) return watchLists;
  watchRaw = raw;
  try {
    const parsed = JSON.parse(raw) as List[];
    watchLists = Array.isArray(parsed) ? parsed : EMPTY_LISTS;
  } catch {
    watchLists = EMPTY_LISTS;
  }
  return watchLists;
}

export function WatchlistBoard() {
  const lists = useSyncExternalStore(
    (callback) => {
      window.addEventListener("ayv-watchlists", callback);
      return () => window.removeEventListener("ayv-watchlists", callback);
    },
    readLists,
    () => EMPTY_LISTS,
  );
  const [active, setActive] = useState("");
  const [name, setName] = useState("");
  const [quotes, setQuotes] = useState<Record<string, { price: number; currency: string; previous: number | null; volume: number | null; marketCap: number | null }>>({});
  const [note, setNote] = useState<string | null>(null);
  const current = lists.find((list) => list.id === active) ?? lists[0];

  function save(next: List[]) {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    watchRaw = "";
    window.dispatchEvent(new Event("ayv-watchlists"));
  }

  async function loadPrices(assets: AssetSearchResult[]) {
    const symbols = assets.filter((asset) => asset.assetType !== "index").map((asset) => asset.symbol);
    if (symbols.length === 0) return;
    try {
      const map = await getAssetQuotes(symbols);
      const next: typeof quotes = {};
      for (const symbol of symbols) {
        const quote = map.get(symbol.toUpperCase());
        if (quote) next[symbol.toUpperCase()] = { price: quote.price, currency: quote.currency, previous: quote.previousClose, volume: quote.volume, marketCap: quote.marketCap };
      }
      setQuotes((existing) => ({ ...existing, ...next }));
      setNote(null);
    } catch {
      setNote("Some prices could not be loaded.");
    }
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          const list = { id: crypto.randomUUID(), name: trimmed.slice(0, 40), assets: [] };
          const next = [...lists, list];
          save(next);
          setActive(list.id);
          setName("");
        }}
      >
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Watchlist name" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        <button type="submit" className="rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground">Create</button>
      </form>
      <div className="flex flex-wrap gap-2">
        {lists.map((list) => (
          <button key={list.id} type="button" onClick={() => setActive(list.id)} className={`rounded-full border px-3 py-1 text-xs ${current?.id === list.id ? "border-accent" : "border-border text-muted"}`}>
            {list.name}
          </button>
        ))}
      </div>
      {current ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium">{current.name}</h2>
            <button type="button" onClick={() => void loadPrices(current.assets)} className="text-xs text-muted">Refresh prices</button>
          </div>
          {note ? <p className="mt-2 text-xs text-muted">{note}</p> : null}
          <ul className="mt-3 space-y-2">
            {current.assets.length === 0 ? <li className="text-sm text-muted">Add an asset from search.</li> : null}
            {current.assets.map((asset) => {
              const quote = quotes[asset.symbol.toUpperCase()];
              const change = quote?.previous != null && quote.previous !== 0 ? ((quote.price - quote.previous) / quote.previous) * 100 : null;
              return (
                <li key={asset.symbol} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    <span className="block font-medium">{asset.name}</span>
                    <span className="text-xs text-muted">{displayTicker(asset.symbol, asset.assetType)}{asset.exchange ? ` · ${asset.exchange}` : ""}</span>
                  </span>
                  <span className="text-right">
                    {quote ? <span className="numeric block">{formatMoney(quote.price, quote.currency)}</span> : <span className="text-xs text-muted">Price not loaded</span>}
                    {change != null && quote ? <span className={`block text-xs ${change < 0 ? "text-negative" : "text-positive"}`}>{formatSignedMoney(quote.price - (quote.previous ?? quote.price), quote.currency)} ({formatPercent(change)})</span> : null}
                    <span className="block text-xs text-muted">{quote?.volume == null ? "Volume N/A" : `Vol ${quote.volume.toLocaleString("en-IE")}`}{quote?.marketCap == null ? "" : ` · Mkt cap ${quote.marketCap.toLocaleString("en-IE")}`}</span>
                    <button
                      type="button"
                      className="mt-1 block text-xs text-muted"
                      onClick={() => save(lists.map((list) => list.id === current.id ? { ...list, assets: list.assets.filter((item) => item.symbol !== asset.symbol) } : list))}
                    >
                      Remove
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-4">
            <AssetSearch
              inputId="watchlist-search"
              onSelect={(asset) => {
                if (asset.assetType === "index") return;
                if (current.assets.some((item) => item.symbol === asset.symbol)) return;
                const next = lists.map((list) => list.id === current.id ? { ...list, assets: [...list.assets, asset] } : list);
                save(next);
                void loadPrices([asset]);
              }}
            />
          </div>
        </section>
      ) : (
        <p className="text-sm text-muted">Create a watchlist such as Tech or Crypto.</p>
      )}
    </div>
  );
}

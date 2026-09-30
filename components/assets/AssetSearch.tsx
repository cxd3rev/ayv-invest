"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { assetTypeLabel, formatMoney } from "@/lib/format";
import { displayTicker, shortAssetName } from "@/lib/market-data/identity";
import { getAssetQuotes, searchAssets } from "@/lib/market-data/marketData";
import type { AssetSearchResult } from "@/lib/market-data/types";

const RECENT_KEY = "ayv-invest.recent-assets";

const fieldClass =
  "w-full rounded-xl border border-border bg-background px-3 py-3 text-base outline-none focus:border-accent sm:text-sm";

const EMPTY_RECENT: AssetSearchResult[] = [];
let recentRaw = "";
let recentList: AssetSearchResult[] = EMPTY_RECENT;

function readRecent(): AssetSearchResult[] {
  if (typeof window === "undefined") return EMPTY_RECENT;
  const raw = window.localStorage.getItem(RECENT_KEY) ?? "[]";
  if (raw === recentRaw) return recentList;
  recentRaw = raw;
  try {
    const parsed = JSON.parse(raw) as AssetSearchResult[];
    recentList = Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item.symbol === "string" && typeof item.name === "string")
      : EMPTY_RECENT;
  } catch {
    recentList = EMPTY_RECENT;
  }
  return recentList;
}

export function rememberAsset(result: AssetSearchResult) {
  const next = [result, ...readRecent().filter((item) => item.symbol !== result.symbol)].slice(0, 6);
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("ayv-recent-assets"));
}

export function AssetSearch({
  onSelect,
  inputId = "asset-search",
  autoFocus = false,
}: {
  onSelect: (result: AssetSearchResult) => void;
  inputId?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AssetSearchResult[]>([]);
  const recent = useSyncExternalStore(
    (callback) => {
      window.addEventListener("ayv-recent-assets", callback);
      return () => window.removeEventListener("ayv-recent-assets", callback);
    },
    readRecent,
    () => EMPTY_RECENT,
  );
  const [prices, setPrices] = useState<Record<string, { price: number; currency: string } | null>>({});
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    function focus() {
      document.getElementById(inputId)?.focus();
    }
    window.addEventListener("ayv-focus-asset-search", focus);
    return () => window.removeEventListener("ayv-focus-asset-search", focus);
  }, [inputId]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 1) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      setError(null);
      searchAssets(trimmed)
        .then((next) => {
          if (cancelled) return;
          setResults(next);
          setActive(0);
          const symbols = next.filter((item) => item.assetType !== "index").slice(0, 6).map((item) => item.symbol);
          if (symbols.length === 0) return;
          getAssetQuotes(symbols)
            .then((quotes) => {
              if (cancelled) return;
              setPrices((current) => {
                const copy = { ...current };
                for (const symbol of symbols) {
                  const quote = quotes.get(symbol.toUpperCase());
                  copy[symbol.toUpperCase()] = quote ? { price: quote.price, currency: quote.currency } : null;
                }
                return copy;
              });
            })
            .catch(() => {
              // The list still works when a price request fails.
            });
        })
        .catch(() => {
          if (!cancelled) {
            setResults([]);
            setError("Search is unavailable right now.");
          }
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const showingRecent = query.trim().length === 0;
  const rows = showingRecent ? recent : results;

  function choose(result: AssetSearchResult) {
    rememberAsset(result);
    onSelect(result);
  }

  return (
    <div>
      <label className="block text-sm" htmlFor={inputId}>
        <span className="mb-1.5 block text-muted">Search assets</span>
        <input
          id={inputId}
          value={query}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="NVDA, Bitcoin, VWCE"
          className={fieldClass}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setResults([]);
            setSearching(next.trim().length > 0);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => Math.min(index + 1, Math.max(rows.length - 1, 0)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter" && rows[active]) {
              event.preventDefault();
              choose(rows[active]);
            }
          }}
        />
      </label>
      {showingRecent && recent.length > 0 ? <p className="mt-4 text-xs text-muted">Recent</p> : null}
      {searching ? <p className="mt-4 text-sm text-muted">Searching...</p> : null}
      {error ? (
        <div className="mt-4">
          <p className="text-sm text-muted">Search is unavailable right now. Try again in a moment.</p>
          {/^[A-Za-z0-9.^=-]{1,32}$/.test(query.trim()) ? (
            <div className="mt-3">
              <p className="text-xs text-muted">Or save {query.trim().toUpperCase()} and enter the price yourself.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["stock", "etf", "crypto"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      choose({
                        symbol: query.trim().toUpperCase(),
                        name: query.trim().toUpperCase(),
                        assetType: type,
                        exchange: null,
                        currency: null,
                      })
                    }
                    className="rounded-xl border border-border px-3 py-2 text-sm"
                  >
                    {assetTypeLabel(type)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {!showingRecent && !searching && !error && results.length === 0 && query.trim().length > 0 ? (
        <p className="mt-4 text-sm text-muted">Asset not found. Try a ticker such as NVDA, AAPL, or BTC.</p>
      ) : null}
      <ul className="mt-3 space-y-2" role="listbox">
        {rows.map((result, index) => {
          const ticker = displayTicker(result.symbol, result.assetType);
          const price = prices[result.symbol.toUpperCase()];
          return (
            <li key={result.symbol}>
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(result)}
                className={`w-full rounded-xl border px-3 py-3 text-left ${index === active ? "border-accent bg-foreground/5" : "border-border"}`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span>
                    <span className="block font-medium" title={result.name}>{shortAssetName(result.name)}</span>
                    <span className="mt-1 block text-xs text-muted">
                      {ticker} · {assetTypeLabel(result.assetType)}
                      {result.exchange ? ` · ${result.exchange}` : ""}
                    </span>
                  </span>
                  {price ? <span className="numeric text-sm">{formatMoney(price.price, price.currency)}</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { displayTicker, shortAssetName } from "@/lib/market-data/identity";
import { searchAssets } from "@/lib/market-data/marketData";
import type { AssetSearchResult } from "@/lib/market-data/types";
import { listLocalPortfolios } from "@/lib/local/store";
import { assetTypeLabel } from "@/lib/format";

const PAGES = [
  ["Dashboard", "/dashboard"],
  ["Portfolio", "/portfolio"],
  ["Plan", "/plan"],
  ["Assets", "/assets"],
  ["Markets", "/markets"],
  ["Watchlists", "/watchlists"],
  ["Research", "/research"],
  ["Analytics", "/analytics"],
  ["Risk", "/risk"],
  ["Transactions", "/transactions"],
  ["Alerts", "/alerts"],
  ["Settings", "/settings"],
] as const;

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [assets, setAssets] = useState<AssetSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!open || trimmed.length < 1) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      searchAssets(trimmed)
        .then((results) => {
          if (!cancelled) setAssets(results);
        })
        .catch(() => {
          if (!cancelled) setSearchError("Asset search is unavailable right now.");
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  if (!open) return null;
  const needle = query.trim().toLowerCase();
  const pages = PAGES.filter(([label]) => !needle || label.toLowerCase().includes(needle));
  const portfolios = listLocalPortfolios().filter((book) => !needle || book.name.toLowerCase().includes(needle));

  function go(href: string) {
    setOpen(false);
    setQuery("");
    setAssets([]);
    router.push(href);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]" role="presentation" onClick={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="Search" className="max-h-[70vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow)]" onClick={(event) => event.stopPropagation()}>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="NVDA, Bitcoin, or a page"
          className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-accent"
        />
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-xs text-muted">Pages</p>
            <ul className="mt-1">
              {pages.map(([label, href]) => (
                <li key={href}>
                  <button type="button" onClick={() => go(href)} className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-foreground/5">{label}</button>
                </li>
              ))}
            </ul>
          </div>
          {portfolios.length > 0 ? (
            <div>
              <p className="text-xs text-muted">Portfolios</p>
              <ul className="mt-1">
                {portfolios.map((book) => (
                  <li key={book.id}>
                    <button type="button" onClick={() => go("/portfolio")} className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-foreground/5">{book.name}</button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <p className="text-xs text-muted">Assets</p>
            {searching ? <p className="mt-2 text-sm text-muted">Searching...</p> : null}
            {searchError ? <p className="mt-2 text-sm text-muted">{searchError}</p> : null}
            {!searching && needle && assets.length === 0 && !searchError ? <p className="mt-2 text-sm text-muted">No matching asset.</p> : null}
            <ul className="mt-1">
              {assets.map((asset) => (
                <li key={asset.symbol}>
                  <button type="button" onClick={() => go(`/assets?symbol=${encodeURIComponent(asset.symbol)}`)} className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-foreground/5">
                    <span className="block">{shortAssetName(asset.name)}</span>
                    <span className="text-xs text-muted">{displayTicker(asset.symbol, asset.assetType)} · {assetTypeLabel(asset.assetType)}{asset.exchange ? ` · ${asset.exchange}` : ""} · {asset.symbol}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">Ctrl or Cmd + K. The symbol shown is the listing id, not only the short ticker.</p>
      </div>
    </div>
  );
}

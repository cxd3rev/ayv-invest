"use client";

import { useEffect, useState } from "react";
import { AssetSearch } from "@/components/assets/AssetSearch";
import { createTransaction } from "@/lib/actions/transactions";
import { usePortfolio } from "@/components/portfolio/PortfolioProvider";
import { assetTypeLabel, formatMoney } from "@/lib/format";
import { displayTicker, shortAssetName } from "@/lib/market-data/identity";
import { getAssetQuote } from "@/lib/market-data/marketData";
import type { AssetSearchResult } from "@/lib/market-data/types";
import { CURRENCIES, isAssetType } from "@/lib/portfolio/validation";

type Quote = {
  symbol: string;
  name: string;
  assetType: "stock" | "etf" | "crypto";
  exchange: string | null;
  currency: string;
  price: number;
};

const fieldClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent";

export function AddInvestmentButton({
  initialAsset,
  label = "+ Add Investment",
}: {
  initialAsset?: AssetSearchResult;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
      >
        {label}
      </button>
      {open ? <AddInvestmentModal initialAsset={initialAsset} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function AddInvestmentModal({
  onClose,
  initialAsset,
}: {
  onClose: () => void;
  initialAsset?: AssetSearchResult;
}) {
  const { reload, state } = usePortfolio();
  const [selected, setSelected] = useState<AssetSearchResult | null>(initialAsset ?? null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!selected || !isAssetType(selected.assetType)) return;
    let cancelled = false;
    getAssetQuote(selected.symbol)
      .then((nextQuote) => {
        if (cancelled) return;
        if (!nextQuote || !isAssetType(nextQuote.assetType)) {
          setQuoteError("Unable to load market data.");
          return;
        }
        setQuote({
          symbol: nextQuote.symbol,
          name: nextQuote.name,
          assetType: nextQuote.assetType,
          exchange: nextQuote.exchange,
          currency: nextQuote.currency,
          price: nextQuote.price,
        });
      })
      .catch(() => {
        if (!cancelled) setQuoteError("Unable to load market data.");
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !isAssetType(selected.assetType)) return;
    setSaving(true);
    setFormError(null);
    const formData = new FormData(event.currentTarget);
    formData.set("symbol", selected.symbol);
    formData.set("assetName", selected.name);
    formData.set("assetType", selected.assetType);
    const result = await createTransaction(formData);
    setSaving(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    reload();
    onClose();
  }

  const today = new Date().toISOString().slice(0, 10);
  const canHold = selected != null && isAssetType(selected.assetType);
  const alreadyHeld =
    selected != null &&
    state.status === "ready" &&
    state.result.ok &&
    state.result.view.holdings.some((holding) => holding.symbol.toUpperCase() === selected.symbol.toUpperCase());

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-3 sm:items-center" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-investment-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow)]"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="add-investment-title" className="text-xl font-semibold tracking-tight">
            Add investment
          </h2>
          <button type="button" onClick={onClose} className="text-sm text-muted">
            Close
          </button>
        </div>

        {selected ? (
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div>
              <p className="font-medium" title={selected.name}>{shortAssetName(selected.name)}</p>
              <p className="text-sm text-muted">
                {displayTicker(selected.symbol, selected.assetType)} · {assetTypeLabel(selected.assetType)}
                {selected.exchange ? ` · ${selected.exchange}` : ""}
              </p>
              {quote ? (
                <p className="mt-3 text-sm">
                  <span className="text-muted">Current price: </span>
                  <span className="numeric">{formatMoney(quote.price, quote.currency)}</span>
                  <span className="text-muted"> · {quote.currency}</span>
                </p>
              ) : null}
              {quoteError ? <p className="mt-3 text-sm text-muted">Live price is unavailable. Enter the price you paid.</p> : null}
              {alreadyHeld ? (
                <p className="mt-3 text-sm text-muted">You already hold this asset. Saving adds another transaction to the same position.</p>
              ) : null}
              <button type="button" onClick={() => { setSelected(null); setQuote(null); setQuoteError(null); }} className="mt-2 text-sm text-muted underline-offset-4 hover:underline">
                Choose a different asset
              </button>
            </div>
            {canHold ? (
              <>
            <fieldset>
              <legend className="mb-1.5 text-sm text-muted">Transaction type</legend>
              <div className="grid grid-cols-2 gap-2">
                {(["buy", "sell"] as const).map((type) => (
                  <label key={type} className="rounded-xl border border-border px-3 py-2 text-sm uppercase has-[:checked]:border-accent">
                    <input type="radio" name="transactionType" value={type} defaultChecked={type === "buy"} className="mr-2" />
                    {type}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="block text-sm">
              <span className="mb-1.5 block text-muted">Quantity</span>
              <input name="quantity" inputMode="decimal" required className={fieldClass} />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-muted">Price per unit</span>
              <input name="price" inputMode="decimal" required className={fieldClass} />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-muted">Date</span>
              <input name="transactionDate" type="date" required max={today} defaultValue={today} className={fieldClass} />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-muted">Fees</span>
              <input name="fees" inputMode="decimal" defaultValue="0" className={fieldClass} />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-muted">Currency</span>
              <select name="currency" defaultValue={quote?.currency ?? selected.currency ?? "EUR"} className={fieldClass}>
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>
            {formError ? <p className="text-sm text-negative">{formError}</p> : null}
            <button type="submit" disabled={saving} className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {saving ? "Saving..." : "Add to portfolio"}
            </button>
              </>
            ) : (
              <p className="text-sm text-muted">This listing can be looked up, but only stocks, ETFs, and crypto are added to the portfolio.</p>
            )}
          </form>
        ) : (
          <div className="mt-5">
            <AssetSearch autoFocus inputId="add-investment-search" onSelect={(result) => { setQuote(null); setQuoteError(null); setSelected(result); }} />
          </div>
        )}
      </div>
    </div>
  );
}

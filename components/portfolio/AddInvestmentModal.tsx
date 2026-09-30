"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createTransaction } from "@/lib/actions/transactions";
import { assetTypeLabel, formatMoney } from "@/lib/format";
import { CURRENCIES } from "@/lib/portfolio/validation";

type SearchResult = {
  symbol: string;
  name: string;
  assetType: "stock" | "etf" | "crypto";
  exchange: string | null;
  currency: string | null;
};

type Quote = SearchResult & {
  price: number;
  currency: string;
};

const fieldClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent";

export function AddInvestmentButton({
  initialAsset,
  label = "+ Add Investment",
}: {
  initialAsset?: SearchResult;
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
  initialAsset?: SearchResult;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SearchResult | null>(initialAsset ?? null);
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
    if (!selected) return;
    const controller = new AbortController();
    fetch(`/api/market/quote?symbol=${encodeURIComponent(selected.symbol)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as { quote?: Quote; error?: string };
        if (!response.ok || !body.quote) throw new Error(body.error || "Unable to load market data.");
        setQuote(body.quote);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setQuoteError("Unable to load market data.");
      });
    return () => controller.abort();
  }, [selected]);

  useEffect(() => {
    if (selected) return;
    const trimmed = query.trim();
    if (trimmed.length < 1) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      fetch(`/api/market/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then(async (response) => {
          const body = (await response.json()) as { results?: SearchResult[]; error?: string };
          if (!response.ok) throw new Error(body.error || "Unable to load market data.");
          setResults(body.results ?? []);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setSearchError("Unable to load market data.");
        })
        .finally(() => setSearching(false));
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, selected]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setFormError(null);
    const formData = new FormData(event.currentTarget);
    formData.set("symbol", selected.symbol);
    const result = await createTransaction(formData);
    setSaving(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  const today = new Date().toISOString().slice(0, 10);

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
              <p className="font-medium">{selected.name}</p>
              <p className="text-sm text-muted">
                {selected.symbol} · {assetTypeLabel(selected.assetType)}
                {selected.exchange ? ` · ${selected.exchange}` : ""}
              </p>
              <button type="button" onClick={() => { setSelected(null); setQuote(null); }} className="mt-2 text-sm text-muted underline-offset-4 hover:underline">
                Choose a different asset
              </button>
            </div>
            {quote ? (
              <p className="text-sm text-muted">
                Latest market price: {formatMoney(quote.price, quote.currency)}. Enter the price you paid.
              </p>
            ) : null}
            {quoteError ? <p className="text-sm text-negative">{quoteError}</p> : null}

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
              {saving ? "Saving..." : "Save transaction"}
            </button>
          </form>
        ) : (
          <div className="mt-5">
            <label className="block text-sm">
              <span className="mb-1.5 block text-muted">Search asset</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="NVIDIA, BTC, Vanguard FTSE All-World"
                className={fieldClass}
                autoFocus
              />
            </label>
            {searching ? <p className="mt-4 text-sm text-muted">Searching...</p> : null}
            {searchError ? <p className="mt-4 text-sm text-negative">{searchError}</p> : null}
            <ul className="mt-4 space-y-2">
              {results.map((result) => (
                <li key={result.symbol}>
                  <button
                    type="button"
                    onClick={() => setSelected(result)}
                    className="w-full rounded-xl border border-border px-3 py-3 text-left transition-colors hover:bg-foreground/5"
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
          </div>
        )}
      </div>
    </div>
  );
}

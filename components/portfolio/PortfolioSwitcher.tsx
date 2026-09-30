"use client";

import { useState, useSyncExternalStore } from "react";
import { usePortfolio } from "@/components/portfolio/PortfolioProvider";
import { createLocalPortfolio, listLocalPortfolios, switchLocalPortfolio } from "@/lib/local/store";
import { getSupabaseEnv } from "@/lib/supabase/env";

const NO_BOOKS: { id: string; name: string; description: string; baseCurrency: string; active: boolean; simulated: boolean }[] = [];

export function PortfolioSwitcher() {
  const { reload } = usePortfolio();
  const books = useSyncExternalStore(
    (callback) => {
      window.addEventListener("ayv-portfolios", callback);
      return () => window.removeEventListener("ayv-portfolios", callback);
    },
    listLocalPortfolios,
    () => NO_BOOKS,
  );
  const [name, setName] = useState("");
  const [paper, setPaper] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (getSupabaseEnv()) {
    return <p className="text-xs text-muted">A connected account uses the portfolio stored in the database.</p>;
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-medium">Portfolios</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {books.map((book) => (
          <button
            key={book.id}
            type="button"
            onClick={() => {
              switchLocalPortfolio(book.id);
              reload();
            }}
            className={`rounded-full border px-3 py-1 text-xs ${book.active ? "border-accent" : "border-border text-muted"}`}
          >
            {book.name}{book.simulated ? " · Paper" : ""}
          </button>
        ))}
      </div>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          const result = createLocalPortfolio(name, "", paper);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setName("");
          setPaper(false);
          setError(null);
          reload();
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New portfolio name"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={paper} onChange={(event) => setPaper(event.target.checked)} />
          Paper
        </label>
        <button type="submit" className="rounded-xl border border-border px-3 py-2 text-sm">
          Create
        </button>
      </form>
      {error ? <p className="mt-2 text-xs text-negative">{error}</p> : null}
      <p className="mt-2 text-xs text-muted">Holdings stay in the portfolio you have open. A paper portfolio is practice only and is labeled separately. Totals are still calculated in EUR.</p>
    </section>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { MarketBoard } from "@/components/markets/MarketBoard";
import { HeadlineList } from "@/components/research/Headlines";
import { getHeadlines } from "@/lib/market-data/marketData";
import type { Headline } from "@/lib/market-data/headlines";

export default function MarketsPage() {
  const [headlines, setHeadlines] = useState<Headline[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Markets</h1>
        <p className="mt-2 text-sm text-muted">Major indices, crypto, and commodities from the existing price feed.</p>
      </div>
      <MarketBoard />
      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold tracking-tight">Headlines</h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          These are Yahoo search results for “markets”, not a sector feed. Movers, sector performance, an earnings calendar, and an economic calendar are not in this feed.{" "}
          <Link href="/research" className="underline-offset-4 hover:underline">Open research</Link>
        </p>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setError(null);
            getHeadlines("markets")
              .then((result) => setHeadlines(result.headlines))
              .catch(() => setError("Headlines could not be loaded."))
              .finally(() => setLoading(false));
          }}
          className="mt-3 rounded-full border border-border px-4 py-2 text-sm disabled:opacity-60"
        >
          {loading ? "Loading..." : "Load headlines"}
        </button>
        {error ? <p className="mt-3 text-sm text-muted">{error}</p> : null}
        <HeadlineList items={headlines} empty="No headlines were returned." />
      </section>
    </div>
  );
}

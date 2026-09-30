"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { assetTypeLabel, formatPercent, formatQuantity } from "@/lib/format";
import { displayTicker, shortAssetName } from "@/lib/market-data/identity";
import { dayReturnPct, investedValue } from "@/lib/portfolio/insights";
import type { HoldingView } from "@/lib/portfolio/types";
import { Money, SignedMoney } from "@/components/portfolio/Money";

const COLUMN_KEY = "ayv-invest.holding-columns";
const COLUMNS = [
  ["type", "Type"],
  ["quantity", "Quantity"],
  ["average", "Average cost"],
  ["price", "Price"],
  ["invested", "Invested"],
  ["value", "Market value"],
  ["weight", "Weight"],
  ["day", "Day %"],
  ["return", "Total return"],
  ["pl", "P&L"],
] as const;

type ColumnId = (typeof COLUMNS)[number][0];

export type HoldingFocus = { kind: "asset" | "type" | "currency"; value: string } | null;

function readHiddenColumns() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(COLUMN_KEY) ?? "";
}

function matchesFocus(holding: HoldingView, focus: HoldingFocus) {
  if (!focus) return true;
  if (focus.kind === "asset") return holding.name === focus.value || holding.symbol === focus.value;
  if (focus.kind === "currency") return holding.listingCurrency === focus.value;
  if (focus.value === "Stocks") return holding.assetType === "stock";
  if (focus.value === "ETFs") return holding.assetType === "etf";
  if (focus.value === "Crypto") return holding.assetType === "crypto";
  return false;
}

export function HoldingCard({ holding }: { holding: HoldingView }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium" title={holding.name}>{shortAssetName(holding.name)}</h3>
          <p className="mt-1 text-xs text-muted">
            {displayTicker(holding.symbol, holding.assetType)} · {assetTypeLabel(holding.assetType)}
          </p>
        </div>
        <p className="text-right text-sm">
          <Money value={holding.currentValue} />
        </p>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Quantity</dt>
          <dd className="numeric mt-1">{formatQuantity(holding.quantity)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Average cost</dt>
          <dd className="mt-1">
            <Money value={holding.averageCost} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Current price</dt>
          <dd className="mt-1">
            <Money value={holding.currentPrice} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Return</dt>
          <dd className="mt-1">
            <SignedMoney value={holding.profitLoss} percent={holding.returnPct} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Day</dt>
          <dd className="mt-1">{dayReturnPct(holding) == null ? "—" : formatPercent(dayReturnPct(holding) ?? 0)}</dd>
        </div>
      </dl>
      {holding.portfolioPercent != null ? (
        <p className="mt-3 text-xs text-muted">{formatPercent(holding.portfolioPercent).replace("+", "")} of portfolio</p>
      ) : null}
    </article>
  );
}

export function HoldingsTable({
  holdings,
  focus = null,
  onClearFocus,
}: {
  holdings: HoldingView[];
  focus?: HoldingFocus;
  onClearFocus?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<"value" | "name" | "pl" | "return" | "weight" | "day">("value");
  const hiddenRaw = useSyncExternalStore(
    (callback) => {
      window.addEventListener("ayv-columns", callback);
      return () => window.removeEventListener("ayv-columns", callback);
    },
    readHiddenColumns,
    () => "",
  );
  const hidden = hiddenRaw.split(",").filter(Boolean);
  const show = (id: ColumnId) => !hidden.includes(id);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = holdings.filter((holding) => {
      if (!matchesFocus(holding, focus)) return false;
      if (needle && !`${holding.name} ${holding.symbol}`.toLowerCase().includes(needle)) return false;
      if (filter === "stock" || filter === "etf" || filter === "crypto") return holding.assetType === filter;
      if (filter.startsWith("currency:")) return holding.listingCurrency === filter.slice("currency:".length);
      if (filter === "winners") return (holding.returnPct ?? 0) > 0;
      if (filter === "losers") return (holding.returnPct ?? 0) < 0;
      return filter !== "cash";
    });
    return [...filtered].sort((left, right) => {
      if (sort === "name") return left.name.localeCompare(right.name);
      if (sort === "pl") return (right.profitLoss ?? -Infinity) - (left.profitLoss ?? -Infinity);
      if (sort === "return") return (right.returnPct ?? -Infinity) - (left.returnPct ?? -Infinity);
      if (sort === "weight") return (right.portfolioPercent ?? -Infinity) - (left.portfolioPercent ?? -Infinity);
      if (sort === "day") return (dayReturnPct(right) ?? -Infinity) - (dayReturnPct(left) ?? -Infinity);
      return (right.currentValue ?? -Infinity) - (left.currentValue ?? -Infinity);
    });
  }, [filter, focus, holdings, query, sort]);

  if (holdings.length === 0) return null;
  const currencies = [...new Set(holdings.map((holding) => holding.listingCurrency).filter((currency): currency is string => Boolean(currency)))];

  function toggleColumn(id: ColumnId) {
    const next = hidden.includes(id) ? hidden.filter((item) => item !== id) : [...hidden, id];
    window.localStorage.setItem(COLUMN_KEY, next.join(","));
    window.dispatchEvent(new Event("ayv-columns"));
  }

  return (
    <section>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <h2 className="text-lg font-semibold tracking-tight">Holdings</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search holdings"
            aria-label="Search holdings"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter holdings" className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <option value="all">All</option>
            <option value="stock">Stocks</option>
            <option value="etf">ETFs</option>
            <option value="crypto">Crypto</option>
            <option value="cash">Cash</option>
            <option value="winners">Winners</option>
            <option value="losers">Losers</option>
            {currencies.map((currency) => (
              <option key={currency} value={`currency:${currency}`}>{currency}</option>
            ))}
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Sort holdings" className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <option value="value">Value</option>
            <option value="name">Name</option>
            <option value="pl">Profit/loss</option>
            <option value="return">Return %</option>
            <option value="weight">Allocation</option>
            <option value="day">Day %</option>
          </select>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {COLUMNS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => toggleColumn(id)}
            className={`rounded-full border px-2.5 py-1 text-xs ${show(id) ? "border-accent" : "border-border text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {focus ? (
        <p className="mt-3 text-sm text-muted">
          Filtered to {focus.value}.{" "}
          <button type="button" onClick={onClearFocus} className="underline-offset-4 hover:underline">Show all holdings</button>
        </p>
      ) : null}
      {filter === "cash" ? (
        <p className="mt-4 text-sm text-muted">No cash balance is recorded. Totals are the investments you entered.</p>
      ) : visible.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No holdings match this filter.</p>
      ) : (
        <>
      <div className="mt-4 space-y-3 md:hidden">
        {visible.map((holding) => (
          <HoldingCard key={holding.assetId} holding={holding} />
        ))}
      </div>
      <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-border md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-foreground/4 text-xs tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Asset</th>
              {show("type") ? <th className="px-4 py-3 font-medium">Type</th> : null}
              {show("quantity") ? <th className="px-4 py-3 font-medium">Quantity</th> : null}
              {show("average") ? <th className="px-4 py-3 font-medium">Average cost</th> : null}
              {show("price") ? <th className="px-4 py-3 font-medium">Price</th> : null}
              {show("invested") ? <th className="px-4 py-3 font-medium">Invested</th> : null}
              {show("value") ? <th className="px-4 py-3 font-medium">Market value</th> : null}
              {show("pl") ? <th className="px-4 py-3 font-medium">P&L</th> : null}
              {show("return") ? <th className="px-4 py-3 font-medium">Total return</th> : null}
              {show("day") ? <th className="px-4 py-3 font-medium">Day %</th> : null}
              {show("weight") ? <th className="px-4 py-3 font-medium">Weight</th> : null}
            </tr>
          </thead>
          <tbody>
            {visible.map((holding) => (
              <tr key={holding.assetId} className="border-t border-border">
                <td className="px-4 py-3">
                  <p className="font-medium" title={holding.name}>{shortAssetName(holding.name)}</p>
                  <p className="text-xs text-muted">{displayTicker(holding.symbol, holding.assetType)}</p>
                </td>
                {show("type") ? <td className="px-4 py-3 text-muted">{assetTypeLabel(holding.assetType)}</td> : null}
                {show("quantity") ? <td className="numeric px-4 py-3">{formatQuantity(holding.quantity)}</td> : null}
                {show("average") ? (
                  <td className="px-4 py-3">
                    <Money value={holding.averageCost} />
                  </td>
                ) : null}
                {show("price") ? (
                  <td className="px-4 py-3">
                    <Money value={holding.currentPrice} />
                    {holding.listingCurrency && holding.listingCurrency !== "EUR" && holding.listingPrice != null ? (
                      <p className="text-xs text-muted">
                        {holding.listingPrice.toLocaleString("en-IE", { maximumFractionDigits: 2 })} {holding.listingCurrency}
                      </p>
                    ) : null}
                  </td>
                ) : null}
                {show("invested") ? (
                  <td className="px-4 py-3">
                    <Money value={investedValue(holding)} />
                  </td>
                ) : null}
                {show("value") ? (
                  <td className="px-4 py-3">
                    <Money value={holding.currentValue} />
                  </td>
                ) : null}
                {show("pl") ? (
                  <td className="px-4 py-3">
                    <SignedMoney value={holding.profitLoss} />
                  </td>
                ) : null}
                {show("return") ? (
                  <td className="px-4 py-3">
                    {holding.returnPct == null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <span className={holding.returnPct > 0 ? "text-positive" : holding.returnPct < 0 ? "text-negative" : "text-muted"}>
                        {formatPercent(holding.returnPct)}
                      </span>
                    )}
                  </td>
                ) : null}
                {show("day") ? (
                  <td className="px-4 py-3">
                    {dayReturnPct(holding) == null ? <span className="text-muted">—</span> : formatPercent(dayReturnPct(holding) ?? 0)}
                  </td>
                ) : null}
                {show("weight") ? (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-14 rounded-full bg-foreground/8">
                        <div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.min(100, holding.portfolioPercent ?? 0)}%` }} />
                      </div>
                      <span className="numeric text-muted">{holding.portfolioPercent == null ? "—" : formatPercent(holding.portfolioPercent).replace("+", "")}</span>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        </>
      )}
    </section>
  );
}

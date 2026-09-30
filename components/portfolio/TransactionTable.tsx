"use client";

import { useMemo, useState } from "react";
import { deleteTransaction } from "@/lib/actions/transactions";
import { usePortfolio } from "@/components/portfolio/PortfolioProvider";
import { assetTypeLabel, formatMoney, formatQuantity, formatShortDate } from "@/lib/format";
import type { TransactionView } from "@/lib/portfolio/types";

const fieldClass =
  "rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

export function TransactionTable({ transactions }: { transactions: TransactionView[] }) {
  const [asset, setAsset] = useState("all");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<"date" | "total" | "asset">("date");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const { reload } = usePortfolio();

  const assets = useMemo(() => {
    const names = new Map<string, string>();
    transactions.forEach((transaction) => names.set(transaction.symbol, transaction.name));
    return [...names.entries()];
  }, [transactions]);

  const visible = transactions
    .filter((transaction) => (asset === "all" ? true : transaction.symbol === asset))
    .filter((transaction) => (type === "all" ? true : transaction.type === type))
    .filter((transaction) => (from ? transaction.date >= from : true))
    .filter((transaction) => (to ? transaction.date <= to : true))
    .sort((left, right) => {
      const factor = direction === "asc" ? 1 : -1;
      if (sort === "total") return (left.total - right.total) * factor;
      if (sort === "asset") return left.name.localeCompare(right.name) * factor;
      return left.date.localeCompare(right.date) * factor;
    });

  async function onDelete(id: string) {
    if (!window.confirm("Delete this transaction?")) return;
    setPendingId(id);
    setError(null);
    const formData = new FormData();
    formData.set("id", id);
    const result = await deleteTransaction(formData);
    setPendingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    reload();
  }

  return (
    <section>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <select value={asset} onChange={(event) => setAsset(event.target.value)} className={fieldClass} aria-label="Filter by asset">
          <option value="all">All assets</option>
          {assets.map(([symbol, name]) => (
            <option key={symbol} value={symbol}>
              {name}
            </option>
          ))}
        </select>
        <select value={type} onChange={(event) => setType(event.target.value)} className={fieldClass} aria-label="Filter by type">
          <option value="all">Buy and sell</option>
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
        </select>
        <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={fieldClass} aria-label="From date" />
        <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className={fieldClass} aria-label="To date" />
        <select
          value={`${sort}:${direction}`}
          onChange={(event) => {
            const [nextSort, nextDirection] = event.target.value.split(":");
            if (nextSort === "date" || nextSort === "total" || nextSort === "asset") setSort(nextSort);
            if (nextDirection === "asc" || nextDirection === "desc") setDirection(nextDirection);
          }}
          className={fieldClass}
          aria-label="Sort transactions"
        >
          <option value="date:desc">Newest first</option>
          <option value="date:asc">Oldest first</option>
          <option value="asset:asc">Asset A–Z</option>
          <option value="total:desc">Largest total</option>
        </select>
      </div>
      {error ? <p className="mt-4 text-sm text-negative">{error}</p> : null}
      {visible.length === 0 ? <p className="mt-8 text-sm text-muted">No transactions match these filters.</p> : null}

      <div className="mt-4 space-y-3 md:hidden">
        {visible.map((transaction) => (
          <article key={transaction.id} className="rounded-2xl border border-border bg-card p-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{transaction.name}</p>
                <p className="mt-1 text-xs text-muted">
                  {formatShortDate(transaction.date)} · {transaction.type.toUpperCase()} · {assetTypeLabel(transaction.assetType)}
                </p>
              </div>
              <p className="numeric">{formatMoney(transaction.total, transaction.currency)}</p>
            </div>
            <p className="mt-3 text-muted">
              {formatQuantity(transaction.quantity)} @ {formatMoney(transaction.price, transaction.currency)} · Fees {formatMoney(transaction.fees, transaction.currency)}
            </p>
            <button type="button" onClick={() => onDelete(transaction.id)} disabled={pendingId === transaction.id} className="mt-3 text-xs text-muted underline-offset-4 hover:underline">
              {pendingId === transaction.id ? "Saving..." : "Delete"}
            </button>
          </article>
        ))}
      </div>

      <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-border md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-foreground/4 text-xs tracking-wide text-muted">
            <tr>
              {["Date", "Asset", "Type", "Quantity", "Price", "Fees", "Total", ""].map((heading) => (
                <th key={heading || "actions"} className="px-4 py-3 font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((transaction) => (
              <tr key={transaction.id} className="border-t border-border">
                <td className="px-4 py-3">{formatShortDate(transaction.date)}</td>
                <td className="px-4 py-3">
                  <p>{transaction.name}</p>
                  <p className="text-xs text-muted">{transaction.symbol}</p>
                </td>
                <td className="px-4 py-3 uppercase text-muted">{transaction.type}</td>
                <td className="numeric px-4 py-3">{formatQuantity(transaction.quantity)}</td>
                <td className="px-4 py-3">{formatMoney(transaction.price, transaction.currency)}</td>
                <td className="px-4 py-3">{formatMoney(transaction.fees, transaction.currency)}</td>
                <td className="px-4 py-3">{formatMoney(transaction.total, transaction.currency)}</td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => onDelete(transaction.id)} disabled={pendingId === transaction.id} className="text-xs text-muted underline-offset-4 hover:underline">
                    {pendingId === transaction.id ? "Saving..." : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function RecentTransactions({ transactions }: { transactions: TransactionView[] }) {
  const recent = transactions.slice(0, 5);
  if (recent.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight">Recent transactions</h2>
      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border">
        {recent.map((transaction) => (
          <li key={transaction.id} className="grid grid-cols-[1fr_auto] gap-3 bg-card px-4 py-3 text-sm sm:grid-cols-4">
            <span>{formatShortDate(transaction.date)}</span>
            <span className="hidden sm:block">{transaction.name}</span>
            <span className="hidden uppercase text-muted sm:block">{transaction.type}</span>
            <span className="numeric text-right">{formatMoney(transaction.total, transaction.currency)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

"use client";

import { useState } from "react";
import { usePortfolio } from "@/components/portfolio/PortfolioProvider";
import { insertLocalTransaction, readLocalPortfolio } from "@/lib/local/store";
import { parseTransactionCsv, transactionsToCsv } from "@/lib/portfolio/csv";
import { getSupabaseEnv } from "@/lib/supabase/env";

export function PortfolioTransfer() {
  const { reload } = usePortfolio();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function exportCsv() {
    const portfolio = readLocalPortfolio();
    const csv = transactionsToCsv(portfolio.transactions);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${portfolio.portfolioName.replace(/\s+/g, "-").toLowerCase()}-transactions.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(file: File) {
    setError(null);
    setMessage(null);
    const parsed = parseTransactionCsv(await file.text());
    if (parsed.rows.length === 0) {
      setError(parsed.errors[0] ?? "Nothing to import.");
      return;
    }
    let saved = 0;
    for (const row of parsed.rows) {
      const result = insertLocalTransaction({ ...row, origin: "manual" });
      if (!result.ok) {
        setError(`${row.symbol}: ${result.error}`);
        break;
      }
      saved += 1;
    }
    setMessage(`Imported ${saved} transaction${saved === 1 ? "" : "s"}. Existing transactions were kept.${parsed.errors.length ? ` ${parsed.errors.length} row${parsed.errors.length === 1 ? "" : "s"} skipped.` : ""}`);
    reload();
  }

  if (getSupabaseEnv()) {
    return <p className="text-xs text-muted">CSV import and export are available for the portfolio saved in this browser.</p>;
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-medium">Import and export</h2>
      <p className="mt-2 text-xs leading-5 text-muted">Exports the open portfolio. Import adds buy and sell rows and does not delete what is already there.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={exportCsv} className="rounded-xl border border-border px-3 py-2 text-sm">Export CSV</button>
        <label className="rounded-xl border border-border px-3 py-2 text-sm">
          Import CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importCsv(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {message ? <p className="mt-2 text-sm">{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-negative">{error}</p> : null}
    </section>
  );
}

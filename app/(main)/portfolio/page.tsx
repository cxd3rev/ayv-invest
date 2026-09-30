"use client";

import { AddInvestmentButton } from "@/components/portfolio/AddInvestmentModal";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { Money, SignedMoney } from "@/components/portfolio/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { formatMoney, formatPercent, formatSignedMoney } from "@/lib/format";
import { PortfolioBody } from "@/components/portfolio/PortfolioProvider";
import { PortfolioSwitcher } from "@/components/portfolio/PortfolioSwitcher";
import { PortfolioTransfer } from "@/components/portfolio/PortfolioTransfer";

export default function PortfolioPage() {
  return (
    <PortfolioBody>
      {(view) => (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Portfolio</h1>
          <p className="mt-2 text-sm text-muted">Every holding is calculated from your transactions.</p>
        </div>
        <AddInvestmentButton />
      </div>
      <PortfolioSwitcher />
      <PortfolioTransfer />
      {view.warnings.map((warning) => (
        <Notice key={warning}>{warning}</Notice>
      ))}
      {view.empty ? (
        <EmptyState
          title="Your portfolio starts here."
          body="Add your first investment to begin tracking your performance."
          action={<AddInvestmentButton />}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted">Total value</p>
              <p className="mt-2 text-xl">
                <Money value={view.metrics.totalValue} />
              </p>
            </article>
            <article className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted">Invested</p>
              <p className="numeric mt-2 text-xl">{formatMoney(view.metrics.totalInvested ?? 0)}</p>
            </article>
            <article className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted">Unrealized P&L</p>
              <p className="mt-2 text-xl">
                <SignedMoney value={view.metrics.profitLoss} percent={view.metrics.returnPct} />
              </p>
            </article>
            <article className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted">Realized P&L</p>
              <p className="numeric mt-2 text-xl">{view.metrics.realizedPl == null ? "—" : formatSignedMoney(view.metrics.realizedPl)}</p>
            </article>
          </div>
          <HoldingsTable holdings={view.holdings} />
          {view.metrics.largestHolding ? (
            <p className="text-sm text-muted">
              Largest holding: {view.metrics.largestHolding.name} · {formatPercent(view.metrics.largestHolding.percent).replace("+", "")}
            </p>
          ) : null}
        </>
      )}
    </div>
      )}
    </PortfolioBody>
  );
}

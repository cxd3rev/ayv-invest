"use client";

import { AddInvestmentButton } from "@/components/portfolio/AddInvestmentModal";
import { AllocationChart } from "@/components/portfolio/AllocationChart";
import { Greeting } from "@/components/dashboard/Greeting";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { SignedMoney } from "@/components/portfolio/Money";
import { PerformanceChart } from "@/components/portfolio/PerformanceChart";
import { RecentTransactions } from "@/components/portfolio/TransactionTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { formatMoney } from "@/lib/format";
import { PortfolioBody } from "@/components/portfolio/PortfolioProvider";

export default function DashboardPage() {
  return (
    <PortfolioBody>
      {(view) => (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Greeting name={view.displayName} />
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your portfolio</h1>
        </div>
        <AddInvestmentButton />
      </div>

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
          <section className="rounded-2xl border border-border bg-card p-6">
            <p className="text-sm text-muted">Total portfolio value</p>
            <p className="numeric mt-2 text-4xl font-medium tracking-tight sm:text-5xl">
              {view.metrics.totalValue == null ? "—" : formatMoney(view.metrics.totalValue)}
            </p>
            <p className="mt-4 text-sm">
              <span className="text-muted">Today&apos;s change: </span>
              <SignedMoney value={view.metrics.dayChange} percent={view.metrics.dayChangePct} />
            </p>
            <p className="mt-1 text-sm">
              <span className="text-muted">Total return: </span>
              <SignedMoney value={view.metrics.profitLoss} percent={view.metrics.returnPct} />
            </p>
            {!view.metrics.valuesComplete ? (
              <p className="mt-3 text-xs text-muted">This total excludes holdings without a current price.</p>
            ) : null}
            <p className="mt-4 text-xs text-muted">Values in EUR. Market data may be delayed.</p>
          </section>

          <PerformanceChart />

          <div className="grid gap-4 lg:grid-cols-2">
            <AllocationChart title="Allocation" items={view.assetAllocation} />
            <AllocationChart title="Asset types" items={view.typeAllocation} />
          </div>

          <HoldingsTable holdings={view.holdings} />
          <RecentTransactions transactions={view.transactions} />
        </>
      )}
    </div>
      )}
    </PortfolioBody>
  );
}

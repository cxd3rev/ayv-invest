"use client";

import { ContributionChart, ProfitLossChart } from "@/components/portfolio/AnalyticsCharts";
import { AllocationChart } from "@/components/portfolio/AllocationChart";
import { MetricCard } from "@/components/portfolio/MetricCard";
import { PerformanceChart } from "@/components/portfolio/PerformanceChart";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { AddInvestmentButton } from "@/components/portfolio/AddInvestmentModal";
import { PortfolioBody } from "@/components/portfolio/PortfolioProvider";
import { AnalyticsSuite } from "@/components/analytics/AnalyticsSuite";
import { ResearchDesk } from "@/components/research/ResearchDesk";
import { allocationDetails } from "@/lib/portfolio/insights";
import { currencyExposure } from "@/lib/portfolio/desk";
import { formatMoney, formatPercent, formatSignedMoney } from "@/lib/format";
import Link from "next/link";

export default function AnalyticsPage() {
  return (
    <PortfolioBody>
      {(view) => {
        if (view.empty) {
          return (
            <div className="space-y-6">
              <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
              <EmptyState
                title="Your portfolio starts here."
                body="Add your first investment to begin tracking your performance."
                action={<AddInvestmentButton />}
              />
            </div>
          );
        }

        const metrics = view.metrics;

        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
              <p className="mt-2 text-sm text-muted">Objective figures calculated from your transactions and market prices.</p>
            </div>
            {view.warnings.map((warning) => (
              <Notice key={warning}>{warning}</Notice>
            ))}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Total profit/loss" value={metrics.profitLoss == null ? "—" : formatSignedMoney(metrics.profitLoss)} detail={metrics.returnPct == null ? undefined : formatPercent(metrics.returnPct)} />
              <MetricCard label="Total invested" value={formatMoney(metrics.totalInvested ?? 0)} />
              <MetricCard label="Realized profit/loss" value={metrics.realizedPl == null ? "—" : formatSignedMoney(metrics.realizedPl)} detail="Closed trades, in EUR" />
              <MetricCard label="Holdings" value={String(metrics.holdingsCount)} detail={`${metrics.transactionCount} transactions`} />
              <MetricCard
                label="Largest holding"
                value={metrics.largestHolding?.name ?? "—"}
                detail={metrics.largestHolding ? formatPercent(metrics.largestHolding.percent).replace("+", "") : undefined}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard
                label="Highest return"
                value={metrics.highestReturn?.name ?? "—"}
                detail={metrics.highestReturn ? formatPercent(metrics.highestReturn.percent) : undefined}
              />
              <MetricCard
                label="Lowest return"
                value={metrics.lowestReturn?.name ?? "—"}
                detail={metrics.lowestReturn ? formatPercent(metrics.lowestReturn.percent) : undefined}
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <AllocationChart title="Asset types" items={view.typeAllocation} details={allocationDetails(view.holdings)} />
              <AllocationChart title="Holdings" items={view.assetAllocation} />
            </div>
            <ProfitLossChart
              items={view.holdings
                .filter((holding) => holding.profitLoss != null)
                .map((holding) => ({ name: holding.symbol, profitLoss: holding.profitLoss ?? 0 }))}
            />
            <ContributionChart points={view.contributions} />
            <PerformanceChart contributions={view.contributions} />
            <AllocationChart
              title="Listing currency"
              items={currencyExposure(view.holdings).map((row) => ({ name: row.currency, value: row.value, percent: row.percent }))}
            />
            <p className="text-sm text-muted">
              Currency weights use the listing currency and the value in EUR. Sector and country charts are not shown, because that data is not in the price feed.{" "}
              <Link href="/risk" className="underline-offset-4 hover:underline">Open risk</Link>
            </p>
            <AnalyticsSuite view={view} />
            <ResearchDesk view={view} />
          </div>
        );
      }}
    </PortfolioBody>
  );
}

"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AddInvestmentButton } from "@/components/portfolio/AddInvestmentModal";
import { AllocationChart } from "@/components/portfolio/AllocationChart";
import { Greeting } from "@/components/dashboard/Greeting";
import { HoldingsTable, type HoldingFocus } from "@/components/portfolio/HoldingsTable";
import { SignedMoney } from "@/components/portfolio/Money";
import { PerformanceChart } from "@/components/portfolio/PerformanceChart";
import { RecentTransactions } from "@/components/portfolio/TransactionTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { formatMoney, formatPercent, formatSignedMoney } from "@/lib/format";
import { displayTicker, shortAssetName } from "@/lib/market-data/identity";
import { allocationDetails, dayReturnPct } from "@/lib/portfolio/insights";
import { PortfolioBody } from "@/components/portfolio/PortfolioProvider";
import { TodayMovers } from "@/components/analytics/AnalyticsSuite";
import { todayFacts } from "@/lib/portfolio/desk";

const DASHBOARD_KEY = "ayv-invest.dashboard";

function readDashboardHidden() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(DASHBOARD_KEY) ?? "";
}

function setDashboardHidden(next: string) {
  window.localStorage.setItem(DASHBOARD_KEY, next);
  window.dispatchEvent(new Event("ayv-dashboard"));
}

export default function DashboardPage() {
  const [focus, setFocus] = useState<HoldingFocus>(null);
  const hiddenRaw = useSyncExternalStore(
    (callback) => {
      window.addEventListener("ayv-dashboard", callback);
      return () => window.removeEventListener("ayv-dashboard", callback);
    },
    readDashboardHidden,
    () => "",
  );
  const hidden = new Set(hiddenRaw.split(",").filter(Boolean));
  function toggle(id: string) {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDashboardHidden([...next].join(","));
  }
  return (
    <PortfolioBody>
      {(view) => (
    <div className="space-y-6">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Welcome, {view.displayName}</h1>
          <p className="mt-1 text-sm text-muted">
            <Greeting name={view.displayName} withName={false} />. Here&apos;s your portfolio overview.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
            className="rounded-full border border-border bg-black/30 px-4 py-2 text-sm text-muted"
          >
            Search
          </button>
          <Link href="/plan" className="rounded-full border border-border px-3 py-2 text-sm text-muted hover:text-foreground">
            Plan
          </Link>
          <Link href="/alerts" className="rounded-full border border-border px-3 py-2 text-sm text-muted hover:text-foreground">
            Alerts
          </Link>
          <Link href="/settings" className="rounded-full border border-border px-3 py-2 text-sm text-muted hover:text-foreground">
            Settings
          </Link>
          <div className="flex items-center gap-2 rounded-full border border-border bg-black/20 py-1 pr-3 pl-1">
            <span className="grid size-8 place-items-center rounded-full bg-accent/25 text-xs font-medium">
              {view.displayName.slice(0, 1).toUpperCase()}
            </span>
            <span className="max-w-32 truncate text-sm">{view.displayName}</span>
          </div>
        </div>
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
          <div className="flex flex-wrap gap-2 text-xs text-muted">
            {(["portfolio", "today", "holdings", "chart", "allocation", "table", "activity"] as const).map((id) => (
              <button key={id} type="button" onClick={() => toggle(id)} className="rounded-full border border-border px-2 py-1">
                {hidden.has(id) ? `Show ${id}` : `Hide ${id}`}
              </button>
            ))}
          </div>
          <div className="grid min-w-0 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {hidden.has("portfolio") ? null : <section className="relative min-w-0 overflow-hidden rounded-3xl border border-border bg-card p-6">
            <div className="pointer-events-none absolute -top-10 left-6 size-40 rounded-full bg-accent/25 blur-3xl" />
            <div className="relative flex items-center justify-between gap-3">
              <p className="text-sm text-muted">Total holding</p>
              <AddInvestmentButton />
            </div>
            <p className="numeric relative mt-6 text-4xl font-medium tracking-tight sm:text-5xl">
              {view.metrics.totalValue == null ? "—" : formatMoney(view.metrics.totalValue)}
            </p>
            <dl className="relative mt-6 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted">Invested</dt>
                <dd className="numeric mt-1">{view.metrics.totalInvested == null ? "—" : formatMoney(view.metrics.totalInvested)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Total return</dt>
                <dd className="numeric mt-1">
                  {view.metrics.profitLoss == null || view.metrics.realizedPl == null
                    ? "—"
                    : formatSignedMoney(view.metrics.profitLoss + view.metrics.realizedPl)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Unrealized</dt>
                <dd className="mt-1"><SignedMoney value={view.metrics.profitLoss} percent={view.metrics.returnPct} /></dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Realized</dt>
                <dd className="numeric mt-1">{view.metrics.realizedPl == null ? "—" : formatSignedMoney(view.metrics.realizedPl)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Today</dt>
                <dd className="mt-1"><SignedMoney value={view.metrics.dayChange} percent={view.metrics.dayChangePct} /></dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Dividends</dt>
                <dd className="mt-1">Not recorded</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Cash</dt>
                <dd className="mt-1">Not recorded</dd>
              </div>
            </dl>
            {!view.metrics.valuesComplete ? (
              <p className="mt-3 text-xs text-muted">This total excludes holdings without a current price.</p>
            ) : null}
            <p className="relative mt-4 text-xs text-muted">Values in EUR. Market data may be delayed.</p>
          </section>}

          {hidden.has("today") ? null : <section className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">Today</h2>
              <Link href="/plan" className="text-sm text-muted underline-offset-4 hover:underline">Why it moved</Link>
            </div>
            <div className="mt-4">
              <TodayMovers holdings={view.holdings} />
            </div>
            <ul className="mt-4 space-y-1 text-xs text-muted">
              {todayFacts(view).facts.map((fact) => <li key={fact}>{fact}</li>)}
              {todayFacts(view).missing.map((fact) => <li key={fact}>{fact}</li>)}
            </ul>
          </section>}

          {hidden.has("holdings") ? null : <section className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">My portfolio</h2>
              <Link href="/portfolio" className="text-sm text-muted underline-offset-4 hover:underline">See all</Link>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {view.holdings.slice(0, 4).map((holding) => {
                const day = dayReturnPct(holding);
                return (
                  <Link
                    key={holding.assetId}
                    href={`/assets?symbol=${encodeURIComponent(holding.symbol)}`}
                    className="rounded-2xl border border-border bg-black/25 p-3"
                  >
                    <p className="numeric text-sm">{holding.currentValue == null ? "—" : formatMoney(holding.currentValue)}</p>
                    <p className={`mt-1 text-xs ${day == null ? "text-muted" : day > 0 ? "text-positive" : day < 0 ? "text-negative" : "text-muted"}`}>
                      {day == null ? "Day —" : formatPercent(day)}
                    </p>
                    <p className="mt-4 truncate text-sm font-medium">{shortAssetName(holding.name)}</p>
                    <p className="truncate text-xs text-muted">
                      {displayTicker(holding.symbol, holding.assetType)} · {holding.quantity} units
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>}
          </div>

          {hidden.has("chart") ? null : <PerformanceChart contributions={view.contributions} />}

          {hidden.has("allocation") ? null : <div className="grid gap-4 lg:grid-cols-2">
            <AllocationChart
              title="Allocation"
              items={view.assetAllocation}
              selected={focus?.kind === "asset" ? focus.value : null}
              onSelect={(name) => setFocus(name ? { kind: "asset", value: name } : null)}
            />
            <AllocationChart
              title="Asset types"
              items={view.typeAllocation}
              details={allocationDetails(view.holdings)}
              selected={focus?.kind === "type" ? focus.value : null}
              onSelect={(name) => setFocus(name ? { kind: "type", value: name } : null)}
            />
          </div>}

          {hidden.has("table") ? null : <HoldingsTable holdings={view.holdings} focus={focus} onClearFocus={() => setFocus(null)} />}
          {hidden.has("activity") ? null : <RecentTransactions transactions={view.transactions} />}
        </>
      )}
    </div>
      )}
    </PortfolioBody>
  );
}

import { AddInvestmentButton } from "@/components/portfolio/AddInvestmentModal";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { Money, SignedMoney } from "@/components/portfolio/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { formatMoney, formatPercent } from "@/lib/format";
import { loadPortfolio } from "@/lib/portfolio/load";

export default async function PortfolioPage() {
  const result = await loadPortfolio();
  if (!result.ok) return <Notice>{result.message}</Notice>;
  const { view } = result;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Portfolio</h1>
          <p className="mt-2 text-sm text-muted">Every holding is calculated from your transactions.</p>
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
          <div className="grid gap-3 sm:grid-cols-3">
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
              <p className="text-xs text-muted">Total return</p>
              <p className="mt-2 text-xl">
                <SignedMoney value={view.metrics.profitLoss} percent={view.metrics.returnPct} />
              </p>
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
  );
}

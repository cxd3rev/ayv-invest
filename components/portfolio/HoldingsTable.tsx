import { assetTypeLabel, formatPercent, formatQuantity } from "@/lib/format";
import type { HoldingView } from "@/lib/portfolio/types";
import { Money, SignedMoney } from "@/components/portfolio/Money";

export function HoldingCard({ holding }: { holding: HoldingView }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{holding.name}</h3>
          <p className="mt-1 text-xs text-muted">
            {holding.symbol} · {assetTypeLabel(holding.assetType)}
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
      </dl>
      {holding.portfolioPercent != null ? (
        <p className="mt-3 text-xs text-muted">{formatPercent(holding.portfolioPercent).replace("+", "")} of portfolio</p>
      ) : null}
    </article>
  );
}

export function HoldingsTable({ holdings }: { holdings: HoldingView[] }) {
  if (holdings.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight">Holdings</h2>
      <div className="mt-4 space-y-3 md:hidden">
        {holdings.map((holding) => (
          <HoldingCard key={holding.assetId} holding={holding} />
        ))}
      </div>
      <div className="mt-4 hidden overflow-hidden rounded-2xl border border-border md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-foreground/4 text-xs tracking-wide text-muted">
            <tr>
              {["Asset", "Type", "Quantity", "Average cost", "Current price", "Current value", "Profit/Loss", "Return"].map(
                (heading) => (
                  <th key={heading} className="px-4 py-3 font-medium">
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {holdings.map((holding) => (
              <tr key={holding.assetId} className="border-t border-border">
                <td className="px-4 py-3">
                  <p className="font-medium">{holding.name}</p>
                  <p className="text-xs text-muted">{holding.symbol}</p>
                </td>
                <td className="px-4 py-3 text-muted">{assetTypeLabel(holding.assetType)}</td>
                <td className="numeric px-4 py-3">{formatQuantity(holding.quantity)}</td>
                <td className="px-4 py-3">
                  <Money value={holding.averageCost} />
                </td>
                <td className="px-4 py-3">
                  <Money value={holding.currentPrice} />
                  {holding.listingCurrency && holding.listingCurrency !== "EUR" && holding.listingPrice != null ? (
                    <p className="text-xs text-muted">
                      {holding.listingPrice.toLocaleString("en-IE", { maximumFractionDigits: 2 })} {holding.listingCurrency}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <Money value={holding.currentValue} />
                </td>
                <td className="px-4 py-3">
                  <SignedMoney value={holding.profitLoss} />
                </td>
                <td className="px-4 py-3">
                  {holding.returnPct == null ? (
                    <span className="text-muted">—</span>
                  ) : (
                    <span
                      className={
                        holding.returnPct > 0 ? "text-positive" : holding.returnPct < 0 ? "text-negative" : "text-muted"
                      }
                    >
                      {formatPercent(holding.returnPct)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

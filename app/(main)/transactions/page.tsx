import { TransactionTable } from "@/components/portfolio/TransactionTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { AddInvestmentButton } from "@/components/portfolio/AddInvestmentModal";
import { loadPortfolio } from "@/lib/portfolio/load";

export default async function TransactionsPage() {
  const result = await loadPortfolio();
  if (!result.ok) return <Notice>{result.message}</Notice>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Transactions</h1>
        <p className="mt-2 text-sm text-muted">Buys and sells are the source of truth for your holdings.</p>
      </div>
      {result.view.transactions.length === 0 ? (
        <EmptyState
          title="No transactions yet."
          body="Add a buy to start the history of your portfolio."
          action={<AddInvestmentButton />}
        />
      ) : (
        <TransactionTable transactions={result.view.transactions} />
      )}
    </div>
  );
}

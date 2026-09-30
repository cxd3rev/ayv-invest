"use client";

import { TransactionTable } from "@/components/portfolio/TransactionTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { AddInvestmentButton } from "@/components/portfolio/AddInvestmentModal";
import { PortfolioBody } from "@/components/portfolio/PortfolioProvider";

export default function TransactionsPage() {
  return (
    <PortfolioBody>
      {(view) => (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Transactions</h1>
        <p className="mt-2 text-sm text-muted">Buys and sells are the source of truth for your holdings.</p>
      </div>
      {view.transactions.length === 0 ? (
        <EmptyState
          title="No transactions yet."
          body="Add a buy to start the history of your portfolio."
          action={<AddInvestmentButton />}
        />
      ) : (
        <TransactionTable transactions={view.transactions} />
      )}
    </div>
      )}
    </PortfolioBody>
  );
}

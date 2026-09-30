"use client";

import Link from "next/link";
import { RiskBoard } from "@/components/analytics/RiskBoard";
import { AddInvestmentButton } from "@/components/portfolio/AddInvestmentModal";
import { PortfolioBody } from "@/components/portfolio/PortfolioProvider";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";

export default function RiskPage() {
  return (
    <PortfolioBody>
      {(view) => {
        if (view.empty) {
          return (
            <div className="space-y-6">
              <h1 className="text-3xl font-semibold tracking-tight">Risk</h1>
              <EmptyState
                title="Your portfolio starts here."
                body="Add your first investment to begin tracking your performance."
                action={<AddInvestmentButton />}
              />
            </div>
          );
        }

        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Risk</h1>
              <p className="mt-2 text-sm text-muted">
                Figures come from your transactions and price history.{" "}
                <Link href="/analytics" className="underline-offset-4 hover:underline">Back to analytics</Link>
              </p>
            </div>
            {view.warnings.map((warning) => (
              <Notice key={warning}>{warning}</Notice>
            ))}
            <RiskBoard view={view} />
          </div>
        );
      }}
    </PortfolioBody>
  );
}

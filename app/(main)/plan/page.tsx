"use client";

import { PlanBoard } from "@/components/planning/PlanBoard";
import { PortfolioBody } from "@/components/portfolio/PortfolioProvider";
import { EmptyState } from "@/components/ui/EmptyState";
import { AddInvestmentButton } from "@/components/portfolio/AddInvestmentModal";

export default function PlanPage() {
  return (
    <PortfolioBody>
      {(view) => (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Plan</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">Goals and schedules use your stored portfolio. Projections stay labeled as assumptions.</p>
          </div>
          {view.empty ? (
            <EmptyState title="Your portfolio starts here." body="You can still set a manual goal. Portfolio progress appears after the first investment." action={<AddInvestmentButton />} />
          ) : null}
          <PlanBoard view={view} />
        </div>
      )}
    </PortfolioBody>
  );
}

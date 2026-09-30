"use client";

import { ResearchCenter } from "@/components/research/ResearchCenter";

export default function ResearchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Research</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Quotes and headlines come from Yahoo Finance. Financial statements, valuation ratios, earnings, dividends, ownership, filings, and the economic calendar are shown only when that feed includes them.
        </p>
      </div>
      <ResearchCenter />
    </div>
  );
}

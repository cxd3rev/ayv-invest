import { describe, expect, it } from "vitest";
import { dayReturnPct, feesByCurrency, priceReturn, rankPerformers, topWeight } from "@/lib/portfolio/insights";
import type { HoldingView } from "@/lib/portfolio/types";

function holding(partial: Partial<HoldingView> & Pick<HoldingView, "name" | "symbol">): HoldingView {
  return {
    assetId: partial.symbol,
    assetType: "stock",
    quantity: 1,
    averageCost: 100,
    currentPrice: 110,
    listingPrice: 110,
    listingCurrency: "EUR",
    currentValue: 110,
    profitLoss: 10,
    returnPct: 10,
    dayChange: 1,
    portfolioPercent: 100,
    ...partial,
  };
}

describe("portfolio insights", () => {
  it("calculates today's return from the previous value", () => {
    expect(dayReturnPct(holding({ name: "Apple", symbol: "AAPL", currentValue: 110, dayChange: 10 }))).toBeCloseTo(10);
    expect(dayReturnPct(holding({ name: "Apple", symbol: "AAPL", dayChange: null }))).toBeNull();
  });

  it("sums the largest weights without inventing missing prices", () => {
    const holdings = [
      holding({ name: "A", symbol: "A", portfolioPercent: 40 }),
      holding({ name: "B", symbol: "B", portfolioPercent: 25 }),
      holding({ name: "C", symbol: "C", portfolioPercent: null }),
    ];
    expect(topWeight(holdings, 5)).toBe(65);
    expect(topWeight([], 5)).toBeNull();
  });

  it("ranks only holdings that have a return", () => {
    const ranked = rankPerformers(
      [
        holding({ name: "Low", symbol: "LOW", returnPct: -4 }),
        holding({ name: "High", symbol: "HIGH", returnPct: 12 }),
        holding({ name: "Missing", symbol: "MISS", returnPct: null }),
      ],
      "all",
    );
    expect(ranked.map((row) => row.symbol)).toEqual(["HIGH", "LOW"]);
  });

  it("adds fees in the currency they were recorded", () => {
    expect(
      feesByCurrency([
        { currency: "USD", fees: 1 },
        { currency: "USD", fees: 2 },
        { currency: "EUR", fees: 0 },
      ] as never),
    ).toEqual([["USD", 3]]);
  });

  it("does not invent a price return when history is missing", () => {
    expect(priceReturn([], "2026-01-01")).toBeNull();
    expect(
      priceReturn(
        [
          { time: "2026-01-01", close: 100 },
          { time: "2026-02-01", close: 110 },
        ],
        "2026-01-01",
      ),
    ).toBeCloseTo(10);
  });
});

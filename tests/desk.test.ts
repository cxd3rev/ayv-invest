import { describe, expect, it } from "vitest";
import { alignBenchmarkReturn, annualizedVolatility, currencyExposure, drawdownPath, drawdownStats, exposureByType, holdingContributions, pearson } from "@/lib/portfolio/desk";
import type { HoldingView } from "@/lib/portfolio/types";

function holding(partial: Partial<HoldingView> & Pick<HoldingView, "symbol">): HoldingView {
  return {
    assetId: partial.symbol,
    name: partial.symbol,
    assetType: "stock",
    quantity: 1,
    averageCost: 1,
    currentPrice: 1,
    listingPrice: 1,
    listingCurrency: "USD",
    currentValue: 100,
    profitLoss: 0,
    returnPct: 0,
    dayChange: 0,
    portfolioPercent: 100,
    ...partial,
  };
}

describe("portfolio desk", () => {
  it("weights currencies from current values", () => {
    const rows = currencyExposure([
      holding({ symbol: "A", listingCurrency: "USD", currentValue: 75 }),
      holding({ symbol: "B", listingCurrency: "EUR", currentValue: 25 }),
    ]);
    expect(rows[0]).toMatchObject({ currency: "USD", percent: 75 });
  });

  it("measures the deepest drop from a running peak", () => {
    const stats = drawdownStats([100, 120, 90]);
    expect(stats?.maximum).toBeCloseTo(-25);
    expect(stats?.current).toBeCloseTo(-25);
  });

  it("returns null correlation without enough points", () => {
    expect(pearson([1, 2], [1, 2])).toBeNull();
    expect(pearson([1, 2, 3, 4, 5], [1, 2, 3, 4, 5])).toBeCloseTo(1);
  });

  it("annualizes daily portfolio moves only when there are enough days", () => {
    expect(annualizedVolatility([100, 110])).toBeNull();
    expect(annualizedVolatility([100, 100, 100, 100, 100, 100])).toBe(0);
  });

  it("finds the trough and a later recovery", () => {
    const path = drawdownPath([
      { date: "2024-01-01", value: 100 },
      { date: "2024-01-02", value: 80 },
      { date: "2024-01-03", value: 100 },
    ]);
    expect(path?.maximum).toBeCloseTo(-20);
    expect(path?.troughDate).toBe("2024-01-02");
    expect(path?.recoveryDate).toBe("2024-01-03");
    expect(path?.current).toBeCloseTo(0);
  });

  it("states each holding's profit as a share of current value", () => {
    const rows = holdingContributions(
      [holding({ symbol: "NVDA", name: "NVIDIA", profitLoss: 420, currentValue: 1000 })],
      10000,
    );
    expect(rows[0]?.contributionPct).toBeCloseTo(4.2);
    expect(holdingContributions([], null)).toEqual([]);
  });

  it("sums crypto weight from priced holdings only", () => {
    expect(exposureByType([holding({ symbol: "BTC", assetType: "crypto", portfolioPercent: 30 })], "crypto")).toBe(30);
    expect(exposureByType([holding({ symbol: "A", portfolioPercent: null })], "stock")).toBeNull();
  });

  it("aligns a benchmark to portfolio dates without filling missing prices", () => {
    const aligned = alignBenchmarkReturn(
      ["2024-01-02", "2024-01-03"],
      [
        { date: "2024-01-01", close: 100 },
        { date: "2024-01-03", close: 110 },
      ],
    );
    expect(aligned?.[0]).toBeCloseTo(0);
    expect(aligned?.[1]).toBeCloseTo(10);
    expect(alignBenchmarkReturn(["2024-01-01"], [{ date: "2024-01-01", close: 1 }])).toBeNull();
  });
});

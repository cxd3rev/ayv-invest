import { describe, expect, it } from "vitest";
import { eachDay } from "@/lib/dates";
import {
  averageCost,
  buildPortfolioHistory,
  buildPositions,
  cumulativeContributions,
  openPositions,
  PositionError,
  type PositionTransaction,
} from "@/lib/portfolio/calculations";

function tx(partial: Partial<PositionTransaction> & Pick<PositionTransaction, "type" | "quantity" | "price" | "date">): PositionTransaction {
  return {
    assetId: partial.assetId ?? "nvda",
    type: partial.type,
    quantity: partial.quantity,
    price: partial.price,
    fees: partial.fees ?? 0,
    date: partial.date,
    createdAt: partial.createdAt ?? `${partial.date}T12:00:00.000Z`,
  };
}

describe("portfolio positions", () => {
  it("calculates multiple buys with average cost", () => {
    const positions = buildPositions([
      tx({ type: "buy", quantity: 10, price: 140, date: "2026-09-01" }),
      tx({ type: "buy", quantity: 5, price: 150, date: "2026-10-01" }),
    ]);
    const position = positions.get("nvda");
    expect(position?.quantity).toBe(15);
    expect(position?.costBasis).toBe(2150);
    expect(averageCost(position!)).toBeCloseTo(143.333333, 5);
  });

  it("adds buy fees to the cost basis", () => {
    const position = buildPositions([
      tx({ type: "buy", quantity: 10, price: 142.5, fees: 2.5, date: "2026-09-12" }),
    ]).get("nvda");
    expect(position?.costBasis).toBe(1427.5);
    expect(averageCost(position!)).toBeCloseTo(142.75, 5);
  });

  it("reduces a position after a sell and keeps the remaining average cost", () => {
    const position = buildPositions([
      tx({ type: "buy", quantity: 10, price: 140, date: "2026-09-01" }),
      tx({ type: "buy", quantity: 5, price: 150, date: "2026-10-01" }),
      tx({ type: "sell", quantity: 5, price: 180, date: "2026-10-15" }),
    ]).get("nvda");

    expect(position?.quantity).toBe(10);
    expect(position?.costBasis).toBeCloseTo(1433.333333, 4);
    expect(position?.realizedPl).toBeCloseTo(183.333333, 4);
  });

  it("clears cost basis when a holding is fully sold", () => {
    const position = buildPositions([
      tx({ type: "buy", quantity: 2, price: 100, date: "2026-01-01" }),
      tx({ type: "sell", quantity: 2, price: 130, fees: 1, date: "2026-02-01" }),
    ]).get("nvda");

    expect(position?.quantity).toBe(0);
    expect(position?.costBasis).toBe(0);
    expect(position?.realizedPl).toBe(59);
    expect(openPositions([
      tx({ type: "buy", quantity: 2, price: 100, date: "2026-01-01" }),
      tx({ type: "sell", quantity: 2, price: 130, fees: 1, date: "2026-02-01" }),
    ])).toEqual([]);
  });

  it("rejects a sell larger than the owned quantity", () => {
    expect(() =>
      buildPositions([
        tx({ type: "buy", quantity: 15, price: 140, date: "2026-09-01" }),
        tx({ type: "sell", quantity: 16, price: 180, date: "2026-09-02" }),
      ]),
    ).toThrow(PositionError);
  });

  it("rejects a backdated sell that would make the position negative", () => {
    expect(() =>
      buildPositions([
        tx({ type: "sell", quantity: 5, price: 180, date: "2026-09-01" }),
        tx({ type: "buy", quantity: 10, price: 140, date: "2026-10-01" }),
      ]),
    ).toThrow(PositionError);
  });

  it("keeps separate assets independent", () => {
    const positions = buildPositions([
      tx({ assetId: "nvda", type: "buy", quantity: 2, price: 100, date: "2026-01-01" }),
      tx({ assetId: "btc", type: "buy", quantity: 0.5, price: 1000, date: "2026-01-02" }),
      tx({ assetId: "nvda", type: "sell", quantity: 1, price: 120, date: "2026-01-03" }),
    ]);

    expect(positions.get("nvda")?.quantity).toBe(1);
    expect(positions.get("btc")?.quantity).toBe(0.5);
    expect(positions.get("btc")?.costBasis).toBe(500);
  });

  it("returns an empty portfolio for no transactions", () => {
    expect(openPositions([])).toEqual([]);
    expect(cumulativeContributions([])).toEqual([]);
  });
});

describe("portfolio history", () => {
  it("reconstructs value from quantities and recorded prices", () => {
    const points = buildPortfolioHistory({
      transactions: [
        tx({ type: "buy", quantity: 10, price: 100, date: "2026-01-01" }),
        tx({ type: "buy", quantity: 5, price: 110, date: "2026-01-02" }),
      ],
      prices: {
        nvda: [
          { date: "2026-01-01", price: 100 },
          { date: "2026-01-02", price: 110 },
        ],
      },
      days: eachDay("2026-01-01", "2026-01-02"),
    });

    expect(points).toEqual([
      { date: "2026-01-01", value: 1000, incomplete: false },
      { date: "2026-01-02", value: 1650, incomplete: false },
    ]);
  });

  it("carries forward the last real close and skips days with no price at all", () => {
    const points = buildPortfolioHistory({
      transactions: [tx({ type: "buy", quantity: 2, price: 50, date: "2026-01-01" })],
      prices: {
        nvda: [{ date: "2026-01-01", price: 50 }],
      },
      days: ["2026-01-01", "2026-01-02", "2026-01-03"],
    });

    expect(points[1]).toEqual({ date: "2026-01-02", value: 100, incomplete: false });
  });

  it("does not plot a zero value when the only holding has no price", () => {
    const points = buildPortfolioHistory({
      transactions: [tx({ type: "buy", quantity: 2, price: 50, date: "2026-01-01" })],
      prices: {},
      days: ["2026-01-01"],
    });

    expect(points).toEqual([]);
  });
});

describe("contributions", () => {
  it("tracks cash invested and cash returned", () => {
    const series = cumulativeContributions([
      tx({ type: "buy", quantity: 10, price: 140, fees: 2, date: "2026-09-01" }),
      tx({ type: "sell", quantity: 4, price: 160, fees: 1, date: "2026-09-20" }),
    ]);

    expect(series).toEqual([
      { date: "2026-09-01", value: 1402 },
      { date: "2026-09-20", value: 763 },
    ]);
  });
});

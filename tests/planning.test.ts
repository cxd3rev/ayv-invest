import { describe, expect, it } from "vitest";
import { compoundProjection, contributionStats, nextContributionDate, progressPercent, requiredMonthlyAmount, wholeMonthsUntil } from "@/lib/planning/math";

describe("planning math", () => {
  it("measures progress without inventing a target", () => {
    expect(progressPercent(250, 1000)).toBe(25);
    expect(progressPercent(null, 1000)).toBeNull();
  });

  it("divides a remaining gap by whole months", () => {
    expect(wholeMonthsUntil("2026-01-15", "2026-07-15")).toBe(6);
    expect(requiredMonthlyAmount(400, 1000, 6)).toBe(100);
    expect(requiredMonthlyAmount(400, 1000, 0)).toBeNull();
  });

  it("labels a zero-return projection as contributions only", () => {
    const result = compoundProjection({ start: 1000, monthly: 100, annualPercent: 0, years: 1 });
    expect(result?.contributed).toBe(2200);
    expect(result?.growth).toBe(0);
    expect(result?.finalValue).toBe(2200);
  });

  it("finds the next date on a monthly schedule", () => {
    expect(nextContributionDate("2026-01-01", "month", "2026-03-15")).toBe("2026-04-01");
  });

  it("does not add contributions in different currencies", () => {
    expect(contributionStats([
      { type: "buy", quantity: 1, price: 10, fees: 0, currency: "EUR" },
      { type: "buy", quantity: 1, price: 10, fees: 0, currency: "USD" },
    ])).toEqual({ mixed: true });
    expect(contributionStats([{ type: "buy", quantity: 2, price: 10, fees: 1, currency: "EUR" }])).toMatchObject({
      contributed: 21,
      average: 10.5,
    });
  });
});

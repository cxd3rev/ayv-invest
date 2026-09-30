import { describe, expect, it } from "vitest";
import { parseTransactionCsv, transactionsToCsv } from "@/lib/portfolio/csv";
import type { StoredTransaction } from "@/lib/portfolio/types";

const row: StoredTransaction = {
  id: "1",
  assetId: "AAPL",
  symbol: "AAPL",
  name: "Apple Inc.",
  assetType: "stock",
  exchange: "NASDAQ",
  type: "buy",
  quantity: 2,
  price: 180,
  fees: 1,
  currency: "EUR",
  date: "2026-09-30",
  createdAt: "2026-09-30T00:00:00.000Z",
  origin: "manual",
};

describe("transaction csv", () => {
  it("round-trips a buy without dropping fields", () => {
    const parsed = parseTransactionCsv(transactionsToCsv([row]));
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({ symbol: "AAPL", quantity: 2, price: 180, type: "buy" });
  });

  it("rejects a dividend row instead of inventing a position", () => {
    const text = "date,type,symbol,name,asset_type,quantity,price,fees,currency,exchange\n2026-09-30,dividend,AAPL,Apple,stock,1,1,0,EUR,";
    const parsed = parseTransactionCsv(text);
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.errors[0]).toMatch(/buy and sell/);
  });
});

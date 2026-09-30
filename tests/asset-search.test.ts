import { describe, expect, it } from "vitest";
import { displayTicker, rankSearchResults, searchScore, shortAssetName } from "@/lib/market-data/identity";

const nvda = { symbol: "NVDA", name: "NVIDIA Corporation", assetType: "stock" as const, exchange: "NASDAQ", currency: "USD" };
const nvax = { symbol: "NVAX", name: "Novavax, Inc.", assetType: "stock" as const, exchange: "NASDAQ", currency: "USD" };
const btc = { symbol: "BTC-USD", name: "Bitcoin USD", assetType: "crypto" as const, exchange: "CCC", currency: "USD" };
const apple = { symbol: "AAPL", name: "Apple Inc.", assetType: "stock" as const, exchange: "NASDAQ", currency: "USD" };

describe("asset search ranking", () => {
  it("prefers an exact ticker over a name that merely contains the letters", () => {
    const ranked = rankSearchResults("NVDA", [nvax, nvda]);
    expect(ranked[0]?.symbol).toBe("NVDA");
    expect(searchScore("nvid", nvda)).toBeGreaterThan(searchScore("nvid", nvax));
  });

  it("puts the Nasdaq ticker ahead of other NVIDIA listings", () => {
    const german = { symbol: "NVD.DE", name: "NVIDIA", assetType: "stock" as const, exchange: "XETRA", currency: "EUR" };
    const ranked = rankSearchResults("nvid", [german, nvda]);
    expect(ranked[0]?.symbol).toBe("NVDA");
  });
  it("matches a partial name without selecting it automatically", () => {
    const ranked = rankSearchResults("nvid", [nvax, nvda]);
    expect(ranked.map((item) => item.symbol)).toContain("NVDA");
    expect(ranked).toHaveLength(2);
  });

  it("resolves a crypto pair to the short ticker", () => {
    expect(displayTicker("BTC-USD", "crypto")).toBe("BTC");
    expect(searchScore("btc", btc)).toBe(1000);
    expect(searchScore("bit", btc)).toBeGreaterThan(0);
  });

  it("keeps a one-character typo behind exact matches", () => {
    expect(searchScore("nvida", nvda)).toBe(200);
    expect(searchScore("nvida", nvda)).toBeLessThan(searchScore("NVDA", nvda));
  });

  it("shortens legal suffixes for display", () => {
    expect(shortAssetName(apple.name)).toBe("Apple");
    expect(shortAssetName("Vanguard FTSE All-World")).toBe("Vanguard FTSE All-World");
  });
});

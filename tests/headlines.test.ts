import { describe, expect, it } from "vitest";
import { parseHeadlines } from "@/lib/market-data/headlines";

const payload = {
  news: [
    { uuid: "a", title: "Apple update", publisher: "Desk", providerPublishTime: 1_700_000_000, link: "https://example.com/a", relatedTickers: ["AAPL"] },
    { uuid: "a", title: "Apple update duplicate", publisher: "Desk", link: "https://example.com/a", relatedTickers: ["AAPL"] },
    { uuid: "b", title: "Other name", publisher: "Wire", relatedTickers: ["MSFT"] },
    { uuid: "c", title: "  " },
  ],
};

describe("headlines", () => {
  it("drops duplicates and keeps the source", () => {
    const rows = parseHeadlines(payload);
    expect(rows.map((row) => row.id)).toEqual(["a", "b"]);
    expect(rows[0]?.source).toBe("Desk");
    expect(rows[0]?.publishedAt).toContain("2023-11-14");
  });

  it("keeps only articles tagged with the symbol when tags exist", () => {
    expect(parseHeadlines(payload, "AAPL").map((row) => row.id)).toEqual(["a"]);
    expect(parseHeadlines(payload, "MSFT").map((row) => row.id)).toEqual(["b"]);
  });
});

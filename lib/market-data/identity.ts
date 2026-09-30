import type { SearchAssetType } from "@/lib/market-data/types";

const LEGAL_SUFFIX = /(?:,?\s+|\s+)(Inc\.?|Incorporated|Corporation|Corp\.?|Ltd\.?|Limited|PLC|N\.V\.|S\.A\.|AG)$/i;

export function shortAssetName(name: string) {
  const trimmed = name.trim();
  const shortened = trimmed.replace(LEGAL_SUFFIX, "").trim();
  return shortened.length > 0 ? shortened : trimmed;
}

export function displayTicker(symbol: string, assetType: SearchAssetType | string) {
  const upper = symbol.trim().toUpperCase();
  if (assetType === "crypto") return upper.replace(/-(USD|EUR)$/, "");
  return upper;
}

function distance(left: string, right: string) {
  if (Math.abs(left.length - right.length) > 2) return 99;
  const rows = Array.from({ length: left.length + 1 }, (_, index) => index);
  for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
    let previous = rows[0];
    rows[0] = rightIndex;
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      const current = rows[leftIndex];
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      rows[leftIndex] = Math.min(rows[leftIndex] + 1, rows[leftIndex - 1] + 1, previous + cost);
      previous = current;
    }
  }
  return rows[left.length];
}

export function searchScore(query: string, result: { symbol: string; name: string; assetType: SearchAssetType | string }) {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const ticker = displayTicker(result.symbol, result.assetType).toLowerCase();
  const canonical = result.symbol.trim().toLowerCase();
  const name = result.name.trim().toLowerCase();
  const short = shortAssetName(result.name).toLowerCase();

  if (ticker === q || canonical === q) return 1000;
  if (name === q || short === q) return 900;
  if (ticker.startsWith(q) || canonical.startsWith(q)) return 800;
  if (short.startsWith(q) || name.startsWith(q)) return 700;
  if (ticker.includes(q) || canonical.includes(q)) return 600;
  if (name.includes(q) || short.includes(q)) return 500;

  const typo = Math.min(distance(q, ticker), distance(q, short));
  if (q.length >= 4 && typo === 1) return 200;
  if (q.length >= 5 && typo === 2) return 120;
  return 1;
}

export function rankSearchResults<T extends { symbol: string; name: string; assetType: SearchAssetType | string }>(query: string, results: T[]) {
  const seen = new Set<string>();
  const q = query.trim().toLowerCase();
  return results
    .filter((result) => {
      const key = result.symbol.toUpperCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((result) => {
      const ticker = displayTicker(result.symbol, result.assetType).toLowerCase();
      const listingPenalty = result.symbol.includes(".") ? 20 : 0;
      const pairPenalty = result.symbol.toUpperCase().endsWith("-USD") ? 0 : result.symbol.includes("-") ? 5 : 0;
      return { result, score: searchScore(query, result), tie: listingPenalty + pairPenalty + distance(q, ticker) };
    })
    .sort((left, right) => right.score - left.score || left.tie - right.tie || left.result.symbol.localeCompare(right.result.symbol))
    .slice(0, 8)
    .map((entry) => entry.result);
}

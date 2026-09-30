import { MarketDataError } from "@/lib/market-data/types";

const HEADERS = {
  Accept: "application/json",
  "User-Agent": "AYVInvest/1.0",
};

export async function fetchJson(url: string, revalidateSeconds: number): Promise<unknown> {
  try {
    const response = await fetch(url, {
      headers: HEADERS,
      next: { revalidate: revalidateSeconds },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) throw new MarketDataError();
    return await response.json();
  } catch (error) {
    if (error instanceof MarketDataError) throw error;
    throw new MarketDataError();
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function mapPool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function run() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

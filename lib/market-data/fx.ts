import { frankfurterUrl } from "@/lib/market-data/hosts";
import { asNumber, asRecord, asString, fetchJson } from "@/lib/market-data/http";
import { MarketDataError, normalizeQuotedMoney } from "@/lib/market-data/types";

export async function getExchangeRateSeries(fromCurrency: string, start: string, end: string) {
  const currency = normalizeQuotedMoney(fromCurrency, 1).currency;
  if (currency === "EUR") return new Map<string, number>();

  const from = start <= end ? start : end;
  const to = start <= end ? end : start;
  const url =
    from === to
      ? frankfurterUrl(`/${from}?from=${encodeURIComponent(currency)}&to=EUR`)
      : frankfurterUrl(`/${from}..${to}?from=${encodeURIComponent(currency)}&to=EUR`);

  const payload = asRecord(await fetchJson(url, 60 * 60 * 12));
  const ratesObject = asRecord(payload?.rates);
  if (!ratesObject) throw new MarketDataError();

  const rates = new Map<string, number>();
  const direct = asNumber(ratesObject.EUR);

  if (direct != null && direct > 0) {
    rates.set(asString(payload?.date) ?? from, direct);
    return rates;
  }

  for (const [date, value] of Object.entries(ratesObject)) {
    const rate = asNumber(asRecord(value)?.EUR);
    if (rate != null && rate > 0) rates.set(date, rate);
  }

  if (rates.size === 0) throw new MarketDataError();
  return rates;
}

export function rateOn(series: Map<string, number>, date: string) {
  if (series.has(date)) return series.get(date) ?? null;

  let chosen: number | null = null;
  for (const key of [...series.keys()].sort()) {
    if (key <= date) chosen = series.get(key) ?? null;
    else break;
  }

  return chosen;
}

export function latestRate(series: Map<string, number>) {
  const last = [...series.keys()].sort().at(-1);
  return last ? (series.get(last) ?? null) : null;
}

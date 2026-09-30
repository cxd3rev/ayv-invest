import { BASE_CURRENCY, PORTFOLIO_TIME_ZONE } from "@/lib/dates";

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatMoney(value: number, currency = BASE_CURRENCY) {
  const absolute = Math.abs(value);
  const maximumFractionDigits = absolute !== 0 && absolute < 0.01 ? 6 : 2;

  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits,
  }).format(value);
}

export function formatSignedMoney(value: number, currency = BASE_CURRENCY) {
  if (value > 0) return `+${formatMoney(value, currency)}`;
  if (value < 0) return `-${formatMoney(Math.abs(value), currency)}`;
  return formatMoney(0, currency);
}

export function formatPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-IE", { maximumFractionDigits: 8 }).format(value);
}

export function formatLongDate(value: string) {
  const hasTime = value.length > 10;
  const date = hasTime ? new Date(value) : new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: hasTime ? PORTFOLIO_TIME_ZONE : "UTC",
  }).format(date);
}

export function formatShortDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function assetTypeLabel(type: string) {
  if (type === "etf") return "ETF";
  if (type === "crypto") return "Crypto";
  return "Stock";
}

import { addDays, isISODate, todayISO } from "@/lib/dates";
import type { AssetType } from "@/lib/market-data/types";
import type { TransactionType } from "@/lib/portfolio/calculations";

const NUMBER_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD", "AUD", "JPY", "SEK", "NOK", "DKK", "PLN"];

export type TransactionInput = {
  symbol: string;
  type: TransactionType;
  quantity: number;
  price: number;
  fees: number;
  currency: string;
  date: string;
};

export type TransactionParseResult =
  | { ok: true; value: TransactionInput }
  | { ok: false; error: string };

function readNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!NUMBER_PATTERN.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseTransactionForm(formData: FormData): TransactionParseResult {
  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  const type = String(formData.get("transactionType") ?? "");
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  const date = String(formData.get("transactionDate") ?? "");
  const quantity = readNumber(formData.get("quantity"));
  const price = readNumber(formData.get("price"));
  const fees = readNumber(formData.get("fees") ?? "0");

  if (!/^[A-Z0-9.^=-]{1,32}$/.test(symbol)) {
    return { ok: false, error: "Asset not found." };
  }

  if (type !== "buy" && type !== "sell") {
    return { ok: false, error: "Choose buy or sell." };
  }

  if (quantity == null || quantity <= 0) {
    return { ok: false, error: "Please enter a valid quantity." };
  }

  if (price == null || price < 0) {
    return { ok: false, error: "Please enter a valid price." };
  }

  if (fees == null || fees < 0) {
    return { ok: false, error: "Please enter valid fees." };
  }

  if (!CURRENCIES.includes(currency)) {
    return { ok: false, error: "Choose a supported currency." };
  }

  if (!isISODate(date) || date > addDays(todayISO(), 1)) {
    return { ok: false, error: "Please choose a valid date." };
  }

  return {
    ok: true,
    value: { symbol, type, quantity, price, fees, currency, date },
  };
}

export function isAssetType(value: string): value is AssetType {
  return value === "stock" || value === "etf" || value === "crypto";
}

export { CURRENCIES };

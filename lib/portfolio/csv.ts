import type { AssetType } from "@/lib/market-data/types";
import type { StoredTransaction } from "@/lib/portfolio/types";
import { CURRENCIES, isAssetType } from "@/lib/portfolio/validation";

export type CsvTransaction = {
  date: string;
  type: "buy" | "sell";
  symbol: string;
  name: string;
  assetType: AssetType;
  quantity: number;
  price: number;
  fees: number;
  currency: string;
  exchange: string | null;
};

const HEADER = "date,type,symbol,name,asset_type,quantity,price,fees,currency,exchange";

function cell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function transactionsToCsv(rows: StoredTransaction[]) {
  const lines = rows.map((row) =>
    [row.date, row.type, row.symbol, row.name, row.assetType, String(row.quantity), String(row.price), String(row.fees), row.currency, row.exchange ?? ""]
      .map((value) => cell(String(value)))
      .join(","),
  );
  return [HEADER, ...lines].join("\n");
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else current += char;
  }
  cells.push(current);
  return cells.map((value) => value.trim());
}

export function parseTransactionCsv(text: string): { rows: CsvTransaction[]; errors: string[] } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return { rows: [], errors: ["The file is empty."] };
  const header = splitCsvLine(lines[0]).map((value) => value.toLowerCase());
  if (header.join(",") !== HEADER) return { rows: [], errors: ["Use the AYV Invest transaction CSV header."] };
  const rows: CsvTransaction[] = [];
  const errors: string[] = [];
  lines.slice(1).forEach((line, index) => {
    const cells = splitCsvLine(line);
    const [date, type, symbol, name, assetType, quantity, price, fees, currency, exchange] = cells;
    const qty = Number(quantity);
    const px = Number(price);
    const fee = Number(fees || "0");
    const lineNo = index + 2;
    if (type !== "buy" && type !== "sell") {
      errors.push(`Line ${lineNo}: only buy and sell can be imported.`);
      return;
    }
    if (!assetType || !isAssetType(assetType)) {
      errors.push(`Line ${lineNo}: asset type must be stock, etf, or crypto.`);
      return;
    }
    if (!/^[A-Z0-9.^=-]{1,32}$/i.test(symbol ?? "") || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(px) || px < 0 || !Number.isFinite(fee) || fee < 0) {
      errors.push(`Line ${lineNo}: check the symbol, quantity, price, and fees.`);
      return;
    }
    if (!CURRENCIES.includes((currency ?? "").toUpperCase()) || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
      errors.push(`Line ${lineNo}: use a supported currency and an ISO date.`);
      return;
    }
    rows.push({
      date,
      type,
      symbol: symbol.toUpperCase(),
      name: name || symbol.toUpperCase(),
      assetType,
      quantity: qty,
      price: px,
      fees: fee,
      currency: currency.toUpperCase(),
      exchange: exchange || null,
    });
  });
  return { rows, errors };
}

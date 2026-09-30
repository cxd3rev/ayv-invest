import type { Account } from "@/lib/portfolio/account";
import { buildPositions, PositionError, type PositionTransaction } from "@/lib/portfolio/calculations";
import type { StoredTransaction } from "@/lib/portfolio/types";
import { isAssetType } from "@/lib/portfolio/validation";

const STORAGE_KEY = "ayv-invest.local";

type LocalPortfolio = {
  displayName: string;
  theme: Account["theme"];
  transactions: StoredTransaction[];
};

const empty: LocalPortfolio = {
  displayName: "Investor",
  theme: "dark",
  transactions: [],
};

function isTransaction(value: unknown): value is StoredTransaction {
  if (!value || typeof value !== "object") return false;
  const row = value as StoredTransaction;
  return (
    typeof row.id === "string" &&
    typeof row.assetId === "string" &&
    typeof row.symbol === "string" &&
    typeof row.name === "string" &&
    isAssetType(row.assetType) &&
    (row.type === "buy" || row.type === "sell") &&
    typeof row.quantity === "number" &&
    typeof row.price === "number" &&
    typeof row.fees === "number" &&
    typeof row.currency === "string" &&
    typeof row.date === "string" &&
    typeof row.createdAt === "string"
  );
}

export function readLocalPortfolio(): LocalPortfolio {
  if (typeof window === "undefined") return empty;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<LocalPortfolio>;
    const displayName = typeof parsed.displayName === "string" ? parsed.displayName.trim() : "";
    return {
      displayName: displayName.length > 0 ? displayName.slice(0, 40) : "Investor",
      theme: parsed.theme === "light" || parsed.theme === "system" ? parsed.theme : "dark",
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions.filter(isTransaction) : [],
    };
  } catch {
    return empty;
  }
}

function writeLocalPortfolio(next: LocalPortfolio) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function localAccount(): Account {
  const state = readLocalPortfolio();
  return {
    userId: "local",
    email: "",
    displayName: state.displayName,
    theme: state.theme,
    portfolioId: "local",
    baseCurrency: "EUR",
  };
}

export function saveLocalSettings(displayName: string, theme: Account["theme"]) {
  const state = readLocalPortfolio();
  writeLocalPortfolio({ ...state, displayName, theme });
}

export function insertLocalTransaction(input: Omit<StoredTransaction, "id" | "createdAt" | "assetId">): { ok: true } | { ok: false; error: string } {
  const state = readLocalPortfolio();
  const assetId = input.symbol.toUpperCase();
  const draft: PositionTransaction[] = state.transactions
    .filter((row) => row.assetId === assetId)
    .map((row) => ({
      assetId,
      type: row.type,
      quantity: row.quantity,
      price: 1,
      fees: 0,
      date: row.date,
      createdAt: row.createdAt,
    }));

  const createdAt = new Date().toISOString();
  draft.push({
    assetId,
    type: input.type,
    quantity: input.quantity,
    price: 1,
    fees: 0,
    date: input.date,
    createdAt,
  });

  try {
    buildPositions(draft);
  } catch (error) {
    if (error instanceof PositionError) return { ok: false, error: error.message };
    return { ok: false, error: "Unable to save transaction." };
  }

  writeLocalPortfolio({
    ...state,
    transactions: [
      ...state.transactions,
      {
        ...input,
        symbol: assetId,
        assetId,
        id: crypto.randomUUID(),
        createdAt,
      },
    ],
  });

  return { ok: true };
}

export function deleteLocalTransaction(id: string): { ok: true } | { ok: false; error: string } {
  const state = readLocalPortfolio();
  const target = state.transactions.find((row) => row.id === id);
  if (!target) return { ok: false, error: "Unable to save transaction." };

  const remaining = state.transactions.filter((row) => row.id !== id);
  const sameAsset = remaining.filter((row) => row.assetId === target.assetId);
  try {
    buildPositions(
      sameAsset.map((row) => ({
        assetId: row.assetId,
        type: row.type,
        quantity: row.quantity,
        price: 1,
        fees: 0,
        date: row.date,
        createdAt: row.createdAt,
      })),
    );
  } catch (error) {
    if (error instanceof PositionError) return { ok: false, error: error.message };
    return { ok: false, error: "Unable to save transaction." };
  }

  writeLocalPortfolio({ ...state, transactions: remaining });
  return { ok: true };
}

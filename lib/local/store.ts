import type { Account } from "@/lib/portfolio/account";
import { buildPositions, PositionError, type PositionTransaction } from "@/lib/portfolio/calculations";
import type { StoredTransaction } from "@/lib/portfolio/types";
import { isAssetType } from "@/lib/portfolio/validation";

const STORAGE_KEY = "ayv-invest.local";

type LocalBook = {
  id: string;
  name: string;
  description: string;
  baseCurrency: string;
  simulated: boolean;
  transactions: StoredTransaction[];
};

type LocalState = {
  displayName: string;
  theme: Account["theme"];
  activePortfolioId: string;
  portfolios: LocalBook[];
};

export type LocalPortfolio = {
  displayName: string;
  theme: Account["theme"];
  portfolioId: string;
  portfolioName: string;
  transactions: StoredTransaction[];
};

const emptyBook = (transactions: StoredTransaction[] = []): LocalBook => ({
  id: "personal",
  name: "Personal",
  description: "",
  baseCurrency: "EUR",
  simulated: false,
  transactions,
});

const emptyState = (): LocalState => ({
  displayName: "Investor",
  theme: "dark",
  activePortfolioId: "personal",
  portfolios: [emptyBook()],
});

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

function readState(): LocalState {
  if (typeof window === "undefined") return emptyState();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<LocalState> & { transactions?: StoredTransaction[] };
    const displayName = typeof parsed.displayName === "string" && parsed.displayName.trim() ? parsed.displayName.trim().slice(0, 40) : "Investor";
    const theme = parsed.theme === "light" || parsed.theme === "system" ? parsed.theme : "dark";

    if (Array.isArray(parsed.portfolios) && parsed.portfolios.length > 0) {
      const portfolios = parsed.portfolios
        .map((book) => {
          if (!book || typeof book !== "object") return null;
          const row = book as LocalBook;
          if (typeof row.id !== "string" || typeof row.name !== "string") return null;
          return {
            id: row.id,
            name: row.name.slice(0, 40),
            description: typeof row.description === "string" ? row.description.slice(0, 160) : "",
            baseCurrency: typeof row.baseCurrency === "string" ? row.baseCurrency : "EUR",
            simulated: row.simulated === true,
            transactions: Array.isArray(row.transactions) ? row.transactions.filter(isTransaction) : [],
          };
        })
        .filter((book): book is LocalBook => book !== null);
      if (portfolios.length === 0) return { ...emptyState(), displayName, theme };
      const activePortfolioId = portfolios.some((book) => book.id === parsed.activePortfolioId)
        ? String(parsed.activePortfolioId)
        : portfolios[0].id;
      return { displayName, theme, activePortfolioId, portfolios };
    }

    const legacy = Array.isArray(parsed.transactions) ? parsed.transactions.filter(isTransaction) : [];
    return { displayName, theme, activePortfolioId: "personal", portfolios: [emptyBook(legacy)] };
  } catch {
    return emptyState();
  }
}

export function readLocalPortfolio(): LocalPortfolio {
  const state = readState();
  const active = state.portfolios.find((book) => book.id === state.activePortfolioId) ?? state.portfolios[0];
  return {
    displayName: state.displayName,
    theme: state.theme,
    portfolioId: active.id,
    portfolioName: active.name,
    transactions: active.transactions,
  };
}

let portfolioSnapshot = "";
let portfolioList: { id: string; name: string; description: string; baseCurrency: string; active: boolean; simulated: boolean }[] = [];

export function listLocalPortfolios() {
  const state = readState();
  const snapshot = `${state.activePortfolioId}|${state.portfolios.map((book) => `${book.id}:${book.name}:${book.simulated ? "paper" : "real"}`).join(",")}`;
  if (snapshot === portfolioSnapshot) return portfolioList;
  portfolioSnapshot = snapshot;
  portfolioList = state.portfolios.map((book) => ({
    id: book.id,
    name: book.name,
    description: book.description,
    baseCurrency: book.baseCurrency,
    active: book.id === state.activePortfolioId,
    simulated: book.simulated === true,
  }));
  return portfolioList;
}

function writeState(next: LocalState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("ayv-portfolios"));
}

function writeLocalPortfolio(next: LocalPortfolio) {
  const state = readState();
  writeState({
    ...state,
    displayName: next.displayName,
    theme: next.theme,
    activePortfolioId: next.portfolioId,
    portfolios: state.portfolios.map((book) =>
      book.id === next.portfolioId ? { ...book, transactions: next.transactions } : book,
    ),
  });
}

export function createLocalPortfolio(name: string, description = "", simulated = false) {
  const state = readState();
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) return { ok: false as const, error: "Enter a portfolio name." };
  const book: LocalBook = {
    id: crypto.randomUUID(),
    name: trimmed,
    description: description.trim().slice(0, 160),
    baseCurrency: "EUR",
    simulated,
    transactions: [],
  };
  writeState({ ...state, activePortfolioId: book.id, portfolios: [...state.portfolios, book] });
  return { ok: true as const };
}

export function switchLocalPortfolio(id: string) {
  const state = readState();
  if (!state.portfolios.some((book) => book.id === id)) return;
  writeState({ ...state, activePortfolioId: id });
}

export function localAccount(): Account {
  const state = readLocalPortfolio();
  return {
    userId: "local",
    email: "",
    displayName: state.displayName,
    theme: state.theme,
    portfolioId: readLocalPortfolio().portfolioId,
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

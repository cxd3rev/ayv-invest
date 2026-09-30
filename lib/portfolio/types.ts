import type { AssetType } from "@/lib/market-data/types";
import type { TransactionType } from "@/lib/portfolio/calculations";

export type StoredTransaction = {
  id: string;
  assetId: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  exchange: string | null;
  type: TransactionType;
  quantity: number;
  price: number;
  fees: number;
  currency: string;
  date: string;
  createdAt: string;
  origin: "manual" | "sample";
};

export type HoldingView = {
  assetId: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  quantity: number;
  averageCost: number | null;
  currentPrice: number | null;
  listingPrice: number | null;
  listingCurrency: string | null;
  currentValue: number | null;
  profitLoss: number | null;
  returnPct: number | null;
  dayChange: number | null;
  portfolioPercent: number | null;
};

export type TransactionView = {
  id: string;
  date: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  type: TransactionType;
  quantity: number;
  price: number;
  fees: number;
  currency: string;
  total: number;
  origin: "manual" | "sample";
};

export type AllocationSlice = {
  name: string;
  value: number;
  percent: number;
};

export type PortfolioMetrics = {
  totalValue: number | null;
  totalInvested: number | null;
  profitLoss: number | null;
  returnPct: number | null;
  dayChange: number | null;
  dayChangePct: number | null;
  realizedPl: number | null;
  holdingsCount: number;
  transactionCount: number;
  largestHolding: { name: string; percent: number } | null;
  highestReturn: { name: string; percent: number } | null;
  lowestReturn: { name: string; percent: number } | null;
  valuesComplete: boolean;
};

export type PortfolioView = {
  displayName: string;
  theme: "dark" | "light" | "system";
  email: string;
  portfolioId: string;
  empty: boolean;
  holdings: HoldingView[];
  transactions: TransactionView[];
  assetAllocation: AllocationSlice[];
  typeAllocation: AllocationSlice[];
  contributions: { date: string; value: number }[];
  metrics: PortfolioMetrics;
  warnings: string[];
};

export type PortfolioResult =
  | { ok: true; view: PortfolioView }
  | { ok: false; message: string };

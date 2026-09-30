import "server-only";

import { todayISO } from "@/lib/dates";
import { getAssetQuotes, getExchangeRateSeries } from "@/lib/market-data/marketData";
import { latestRate, rateOn } from "@/lib/market-data/fx";
import { MarketDataError, normalizeQuotedMoney, type AssetQuote, type AssetType } from "@/lib/market-data/types";
import { getAccount } from "@/lib/portfolio/account";
import {
  averageCost,
  buildPositions,
  cumulativeContributions,
  openPositions,
  type PositionTransaction,
  type TransactionType,
} from "@/lib/portfolio/calculations";
import type {
  HoldingView,
  PortfolioResult,
  PortfolioView,
  StoredTransaction,
  TransactionView,
} from "@/lib/portfolio/types";
import { createClient } from "@/lib/supabase/server";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asAssetType(value: unknown): AssetType | null {
  return value === "stock" || value === "etf" || value === "crypto" ? value : null;
}

function asTransactionType(value: unknown): TransactionType | null {
  return value === "buy" || value === "sell" ? value : null;
}

function parseTransaction(row: unknown): StoredTransaction | null {
  const record = asRecord(row);
  const asset = asRecord(record?.assets);
  if (!record || !asset) return null;

  const type = asTransactionType(record.transaction_type);
  const assetType = asAssetType(asset.asset_type);
  const quantity = asNumber(record.quantity);
  const price = asNumber(record.price);
  const fees = asNumber(record.fees) ?? 0;
  const id = asString(record.id);
  const assetId = asString(record.asset_id);
  const symbol = asString(asset.symbol);
  const name = asString(asset.name);
  const currency = asString(record.currency);
  const date = asString(record.transaction_date);
  const createdAt = asString(record.created_at);

  if (!type || !assetType || quantity == null || price == null || !id || !assetId || !symbol || !name || !currency || !date || !createdAt) {
    return null;
  }

  return {
    id,
    assetId,
    symbol,
    name,
    assetType,
    exchange: asString(asset.exchange),
    type,
    quantity,
    price,
    fees,
    currency,
    date: date.slice(0, 10),
    createdAt,
    origin: record.origin === "sample" ? "sample" : "manual",
  };
}

async function loadTransactions(portfolioId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, asset_id, transaction_type, quantity, price, fees, currency, transaction_date, origin, created_at, assets(symbol, name, asset_type, exchange, currency)",
    )
    .eq("portfolio_id", portfolioId)
    .order("transaction_date", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(parseTransaction).filter((row): row is StoredTransaction => row !== null);
}

async function convertToPortfolioCurrency(transactions: StoredTransaction[]) {
  const warnings: string[] = [];
  const failedAssets = new Set<string>();
  const currencies = [
    ...new Set(
      transactions
        .map((transaction) => normalizeQuotedMoney(transaction.currency, 1).currency)
        .filter((currency) => currency !== "EUR"),
    ),
  ];
  const dates = transactions.map((transaction) => transaction.date).sort();
  const series = new Map<string, Map<string, number>>();

  if (dates.length > 0) {
    await Promise.all(
      currencies.map(async (currency) => {
        try {
          series.set(currency, await getExchangeRateSeries(currency, dates[0], todayISO()));
        } catch (error) {
          if (!(error instanceof MarketDataError)) console.error("fx", error);
          warnings.push(`Unable to convert ${currency} to EUR.`);
        }
      }),
    );
  }

  const converted: PositionTransaction[] = [];

  for (const transaction of transactions) {
    const price = normalizeQuotedMoney(transaction.currency, transaction.price);
    const fees = normalizeQuotedMoney(transaction.currency, transaction.fees);
    let rate = 1;

    if (price.currency !== "EUR") {
      const table = series.get(price.currency);
      const found = table ? (rateOn(table, transaction.date) ?? latestRate(table)) : null;
      if (found == null) {
        failedAssets.add(transaction.assetId);
        continue;
      }
      rate = found;
    }

    converted.push({
      assetId: transaction.assetId,
      type: transaction.type,
      quantity: transaction.quantity,
      price: price.amount * rate,
      fees: fees.amount * rate,
      date: transaction.date,
      createdAt: transaction.createdAt,
    });
  }

  return {
    converted: converted.filter((transaction) => !failedAssets.has(transaction.assetId)),
    failedAssets,
    warnings,
  };
}

function transactionViews(transactions: StoredTransaction[]): TransactionView[] {
  return [...transactions]
    .sort((left, right) => (left.date === right.date ? right.createdAt.localeCompare(left.createdAt) : right.date.localeCompare(left.date)))
    .map((transaction) => {
      const gross = transaction.quantity * transaction.price;
      const total = transaction.type === "buy" ? gross + transaction.fees : gross - transaction.fees;
      return {
        id: transaction.id,
        date: transaction.date,
        symbol: transaction.symbol,
        name: transaction.name,
        assetType: transaction.assetType,
        type: transaction.type,
        quantity: transaction.quantity,
        price: transaction.price,
        fees: transaction.fees,
        currency: normalizeQuotedMoney(transaction.currency, 1).currency,
        total,
        origin: transaction.origin,
      };
    });
}

export async function loadPortfolio(): Promise<PortfolioResult> {
  try {
    const account = await getAccount();
    if (!account) return { ok: false, message: "Please log in." };

    const stored = await loadTransactions(account.portfolioId);
    const transactions = transactionViews(stored);

    if (stored.length === 0) {
      return {
        ok: true,
        view: emptyView(account, transactions),
      };
    }

    const { converted, failedAssets, warnings } = await convertToPortfolioCurrency(stored);
    const positions = buildPositions(converted);
    const open = openPositions(converted);
    const symbols = open
      .map((position) => stored.find((transaction) => transaction.assetId === position.assetId)?.symbol)
      .filter((symbol): symbol is string => Boolean(symbol));

    const quotes = new Map<string, AssetQuote>();
    try {
      const loaded = await getAssetQuotes(symbols);
      loaded.forEach((quote, symbol) => quotes.set(symbol, quote));
    } catch (error) {
      if (!(error instanceof MarketDataError)) console.error("quotes", error);
      warnings.push("Unable to load market data.");
    }

    if (symbols.length > 0 && quotes.size === 0) {
      warnings.push("Unable to load market data.");
    }

    const quoteCurrencies = [
      ...new Set([...quotes.values()].map((quote) => quote.currency).filter((currency) => currency !== "EUR")),
    ];
    const quoteRates = new Map<string, number>();
    await Promise.all(
      quoteCurrencies.map(async (currency) => {
        try {
          const table = await getExchangeRateSeries(currency, todayISO(), todayISO());
          const rate = latestRate(table);
          if (rate != null) quoteRates.set(currency, rate);
        } catch {
          warnings.push(`Unable to convert ${currency} to EUR.`);
        }
      }),
    );

    const holdings: HoldingView[] = open.map((position) => {
      const sample = stored.find((transaction) => transaction.assetId === position.assetId);
      const quote = sample ? quotes.get(sample.symbol.toUpperCase()) ?? quotes.get(sample.symbol) : undefined;
      const missing = !sample || failedAssets.has(position.assetId) || !quote;
      const fx = !quote || quote.currency === "EUR" ? 1 : (quoteRates.get(quote.currency) ?? null);
      const currentPrice = !missing && quote && fx != null ? quote.price * fx : null;
      const previous = quote?.previousClose != null && fx != null ? quote.previousClose * fx : null;
      const currentValue = currentPrice == null ? null : position.quantity * currentPrice;
      const profitLoss = currentValue == null ? null : currentValue - position.costBasis;
      const returnPct =
        profitLoss == null || position.costBasis <= 0 ? null : (profitLoss / position.costBasis) * 100;

      return {
        assetId: position.assetId,
        symbol: sample?.symbol ?? "",
        name: sample?.name ?? "Unknown asset",
        assetType: sample?.assetType ?? "stock",
        quantity: position.quantity,
        averageCost: missing ? null : averageCost(position),
        currentPrice,
        listingPrice: quote?.price ?? null,
        listingCurrency: quote?.currency ?? null,
        currentValue,
        profitLoss,
        returnPct,
        dayChange: currentPrice == null || previous == null ? null : (currentPrice - previous) * position.quantity,
        portfolioPercent: null,
      };
    });

    const knownValue = holdings.reduce((sum, holding) => sum + (holding.currentValue ?? 0), 0);
    for (const holding of holdings) {
      holding.portfolioPercent =
        holding.currentValue != null && knownValue > 0 ? (holding.currentValue / knownValue) * 100 : null;
    }

    holdings.sort((left, right) => (right.currentValue ?? 0) - (left.currentValue ?? 0));

    const valuesComplete = holdings.length > 0 && holdings.every((holding) => holding.currentValue != null);
    const included = holdings.filter((holding) => holding.currentValue != null);
    const missingSymbols = holdings
      .filter((holding) => holding.currentValue == null)
      .map((holding) => holding.symbol)
      .filter(Boolean);
    if (missingSymbols.length > 0) {
      warnings.push(`Price unavailable for ${missingSymbols.join(", ")}.`);
    }
    const totalInvested = included.reduce(
      (sum, holding) => sum + (positions.get(holding.assetId)?.costBasis ?? 0),
      0,
    );
    const totalValue =
      included.length === 0 ? null : included.reduce((sum, holding) => sum + (holding.currentValue ?? 0), 0);
    const profitLoss = totalValue == null ? null : totalValue - totalInvested;
    const dayChanges = holdings.map((holding) => holding.dayChange);
    const dayChange = dayChanges.every((value) => value != null)
      ? dayChanges.reduce((sum, value) => sum + (value ?? 0), 0)
      : null;
    const previousValue = totalValue != null && dayChange != null ? totalValue - dayChange : null;

    const ranked = holdings.filter((holding) => holding.returnPct != null);
    const byReturn = [...ranked].sort((left, right) => (right.returnPct ?? 0) - (left.returnPct ?? 0));
    const largest = [...holdings].sort((left, right) => (right.portfolioPercent ?? 0) - (left.portfolioPercent ?? 0))[0];

    const assetAllocation = holdings
      .filter((holding) => holding.currentValue != null && holding.portfolioPercent != null)
      .map((holding) => ({
        name: holding.name,
        value: holding.currentValue ?? 0,
        percent: holding.portfolioPercent ?? 0,
      }));

    const typeAllocation = (["stock", "etf", "crypto"] as const)
      .map((type) => {
        const value = holdings
          .filter((holding) => holding.assetType === type)
          .reduce((sum, holding) => sum + (holding.currentValue ?? 0), 0);
        return {
          name: type === "etf" ? "ETFs" : type === "stock" ? "Stocks" : "Crypto",
          value,
          percent: knownValue > 0 ? (value / knownValue) * 100 : 0,
        };
      })
      .filter((slice) => slice.value > 0);

    if (valuesComplete && totalValue != null) {
      const supabase = await createClient();
      await supabase.from("portfolio_snapshots").upsert(
        {
          portfolio_id: account.portfolioId,
          snapshot_date: todayISO(),
          total_value: totalValue,
          total_invested: totalInvested,
        },
        { onConflict: "portfolio_id,snapshot_date" },
      );
    }

    return {
      ok: true,
      view: {
        displayName: account.displayName,
        theme: account.theme,
        email: account.email,
        portfolioId: account.portfolioId,
        empty: false,
        holdings,
        transactions,
        assetAllocation,
        typeAllocation,
        contributions: cumulativeContributions(converted),
        metrics: {
          totalValue,
          totalInvested,
          profitLoss,
          returnPct: profitLoss == null || totalInvested <= 0 ? null : (profitLoss / totalInvested) * 100,
          dayChange,
          dayChangePct: previousValue != null && previousValue !== 0 && dayChange != null ? (dayChange / previousValue) * 100 : null,
          holdingsCount: holdings.length,
          transactionCount: stored.length,
          largestHolding:
            largest?.portfolioPercent != null ? { name: largest.name, percent: largest.portfolioPercent } : null,
          highestReturn:
            byReturn[0]?.returnPct != null ? { name: byReturn[0].name, percent: byReturn[0].returnPct } : null,
          lowestReturn:
            byReturn.length > 0 && byReturn[byReturn.length - 1]?.returnPct != null
              ? { name: byReturn[byReturn.length - 1].name, percent: byReturn[byReturn.length - 1].returnPct ?? 0 }
              : null,
          valuesComplete,
        },
        warnings: [...new Set(warnings)],
      },
    };
  } catch (error) {
    console.error("loadPortfolio", error);
    return { ok: false, message: "Unable to load your portfolio." };
  }
}

function emptyView(
  account: { displayName: string; theme: "dark" | "light" | "system"; email: string; portfolioId: string },
  transactions: TransactionView[],
): PortfolioView {
  return {
    displayName: account.displayName,
    theme: account.theme,
    email: account.email,
    portfolioId: account.portfolioId,
    empty: true,
    holdings: [],
    transactions,
    assetAllocation: [],
    typeAllocation: [],
    contributions: [],
    metrics: {
      totalValue: 0,
      totalInvested: 0,
      profitLoss: 0,
      returnPct: null,
      dayChange: null,
      dayChangePct: null,
      holdingsCount: 0,
      transactionCount: 0,
      largestHolding: null,
      highestReturn: null,
      lowestReturn: null,
      valuesComplete: true,
    },
    warnings: [],
  };
}

export async function getStoredPortfolio() {
  const account = await getAccount();
  if (!account) return null;
  const stored = await loadTransactions(account.portfolioId);
  const prepared = await convertToPortfolioCurrency(stored);
  return { account, stored, ...prepared };
}

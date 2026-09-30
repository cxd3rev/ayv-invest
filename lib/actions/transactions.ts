"use client";

import { addMonths, todayISO } from "@/lib/dates";
import { insertLocalTransaction, deleteLocalTransaction, localAccount, readLocalPortfolio } from "@/lib/local/store";
import { getAssetQuote } from "@/lib/market-data/marketData";
import type { AssetType } from "@/lib/market-data/types";
import { getAccount } from "@/lib/portfolio/account";
import { buildPositions, PositionError, type PositionTransaction } from "@/lib/portfolio/calculations";
import { isAssetType, parseTransactionForm } from "@/lib/portfolio/validation";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ActionResult = { ok: true } | { ok: false; error: string };

function friendlyDatabaseError(error: { message?: string }) {
  if (error.message?.includes("SELL_EXCEEDS_POSITION")) {
    return "You cannot sell more than you own.";
  }
  return "Unable to save transaction.";
}

export async function createTransaction(formData: FormData): Promise<ActionResult> {
  const parsed = parseTransactionForm(formData);
  if (!parsed.ok) return parsed;

  try {
    const supabase = getSupabaseEnv() ? createClient() : null;
    const account = supabase ? await getAccount(supabase) : localAccount();
    if (!account) return { ok: false, error: "Please log in." };

    let quote = null;
    try {
      quote = await getAssetQuote(parsed.value.symbol);
    } catch (error) {
      console.error("quote", error);
    }

    const requestedType = String(formData.get("assetType") ?? "");
    const assetType: AssetType = quote?.assetType ?? (isAssetType(requestedType) ? requestedType : "stock");
    const name = quote?.name ?? (String(formData.get("assetName") ?? "").trim() || parsed.value.symbol);

    const input = {
      portfolioId: account.portfolioId,
      symbol: quote?.symbol ?? parsed.value.symbol,
      name,
      assetType,
      exchange: quote?.exchange ?? null,
      assetCurrency: quote?.currency ?? parsed.value.currency,
      type: parsed.value.type,
      quantity: parsed.value.quantity,
      price: parsed.value.price,
      fees: parsed.value.fees,
      currency: parsed.value.currency,
      date: parsed.value.date,
      origin: "manual" as const,
    };

    if (!supabase) {
      return insertLocalTransaction({
        symbol: input.symbol,
        name: input.name,
        assetType: input.assetType,
        exchange: input.exchange,
        type: input.type,
        quantity: input.quantity,
        price: input.price,
        fees: input.fees,
        currency: input.currency,
        date: input.date,
        origin: input.origin,
      });
    }

    return insertTransaction(supabase, input);
  } catch (error) {
    console.error("createTransaction", error);
    return { ok: false, error: "Unable to save transaction." };
  }
}

export async function deleteTransaction(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Unable to save transaction." };

  try {
    if (!getSupabaseEnv()) return deleteLocalTransaction(id);

    const supabase = createClient();
    const account = await getAccount(supabase);
    if (!account) return { ok: false, error: "Please log in." };
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id)
      .eq("portfolio_id", account.portfolioId);

    if (error) {
      console.error("deleteTransaction", error);
      return { ok: false, error: friendlyDatabaseError(error) };
    }

    return { ok: true };
  } catch (error) {
    console.error("deleteTransaction", error);
    return { ok: false, error: "Unable to save transaction." };
  }
}

type InsertInput = {
  portfolioId: string;
  symbol: string;
  name: string;
  assetType: "stock" | "etf" | "crypto";
  exchange: string | null;
  assetCurrency: string;
  type: "buy" | "sell";
  quantity: number;
  price: number;
  fees: number;
  currency: string;
  date: string;
  origin: "manual" | "sample";
};

async function insertTransaction(supabase: SupabaseClient, input: InsertInput): Promise<ActionResult> {
  const { data: assetId, error: assetError } = await supabase.rpc("upsert_asset", {
    p_symbol: input.symbol,
    p_name: input.name,
    p_asset_type: input.assetType,
    p_exchange: input.exchange ?? "",
    p_currency: input.assetCurrency,
    p_external_id: input.symbol,
  });

  if (assetError || typeof assetId !== "string") {
    console.error("upsert_asset", assetError);
    return { ok: false, error: "Unable to save transaction." };
  }

  const existing = await supabase
    .from("transactions")
    .select("transaction_type, quantity, transaction_date, created_at")
    .eq("portfolio_id", input.portfolioId)
    .eq("asset_id", assetId);

  if (existing.error) {
    console.error("load existing", existing.error);
    return { ok: false, error: "Unable to save transaction." };
  }

  const draft: PositionTransaction[] = (existing.data ?? []).map((row) => ({
    assetId,
    type: row.transaction_type === "sell" ? "sell" : "buy",
    quantity: Number(row.quantity),
    price: 1,
    fees: 0,
    date: String(row.transaction_date).slice(0, 10),
    createdAt: String(row.created_at),
  }));

  draft.push({
    assetId,
    type: input.type,
    quantity: input.quantity,
    price: 1,
    fees: 0,
    date: input.date,
    createdAt: new Date().toISOString(),
  });

  try {
    buildPositions(draft);
  } catch (error) {
    if (error instanceof PositionError) return { ok: false, error: error.message };
    throw error;
  }

  const { error } = await supabase.from("transactions").insert({
    portfolio_id: input.portfolioId,
    asset_id: assetId,
    transaction_type: input.type,
    quantity: input.quantity,
    price: input.price,
    fees: input.fees,
    currency: input.currency,
    transaction_date: input.date,
    origin: input.origin,
  });

  if (error) {
    console.error("insert transaction", error);
    return { ok: false, error: friendlyDatabaseError(error) };
  }

  return { ok: true };
}

export async function loadSampleTransactions(): Promise<ActionResult> {
  if (process.env.NODE_ENV !== "development") {
    return { ok: false, error: "Sample data is only available in development." };
  }

  const supabase = getSupabaseEnv() ? createClient() : null;
  const account = supabase ? await getAccount(supabase) : localAccount();
  if (!account) return { ok: false, error: "Please log in." };

  const today = todayISO();
  const samples = [
    { symbol: "AAPL", type: "buy" as const, quantity: 8, price: 220, fees: 1, currency: "USD", date: addMonths(today, -4) },
    { symbol: "VWCE.DE", type: "buy" as const, quantity: 12, price: 130, fees: 2, currency: "EUR", date: addMonths(today, -3) },
    { symbol: "BTC-USD", type: "buy" as const, quantity: 0.05, price: 60000, fees: 5, currency: "USD", date: addMonths(today, -3) },
    { symbol: "ETH-USD", type: "buy" as const, quantity: 0.4, price: 3200, fees: 2, currency: "USD", date: addMonths(today, -2) },
    { symbol: "NVDA", type: "buy" as const, quantity: 10, price: 140, fees: 1, currency: "USD", date: addMonths(today, -2) },
    { symbol: "NVDA", type: "buy" as const, quantity: 5, price: 150, fees: 1, currency: "USD", date: addMonths(today, -1) },
    { symbol: "AAPL", type: "sell" as const, quantity: 2, price: 230, fees: 1, currency: "USD", date: addMonths(today, -1) },
  ];

  for (const sample of samples) {
    let quote = null;
    try {
      quote = await getAssetQuote(sample.symbol);
    } catch {
      quote = null;
    }

    const saved = supabase
      ? await insertTransaction(supabase, {
          portfolioId: account.portfolioId,
          symbol: quote?.symbol ?? sample.symbol,
          name: quote?.name ?? sample.symbol,
          assetType: quote?.assetType ?? (sample.symbol.includes("BTC") || sample.symbol.includes("ETH") ? "crypto" : sample.symbol.includes(".") ? "etf" : "stock"),
          exchange: quote?.exchange ?? null,
          assetCurrency: quote?.currency ?? sample.currency,
          type: sample.type,
          quantity: sample.quantity,
          price: sample.price,
          fees: sample.fees,
          currency: sample.currency,
          date: sample.date,
          origin: "sample",
        })
      : insertLocalTransaction({
          symbol: sample.symbol,
          name: quote?.name ?? sample.symbol,
          assetType: quote?.assetType ?? (sample.symbol.includes("BTC") || sample.symbol.includes("ETH") ? "crypto" : sample.symbol.includes(".") ? "etf" : "stock"),
          exchange: quote?.exchange ?? null,
          type: sample.type,
          quantity: sample.quantity,
          price: sample.price,
          fees: sample.fees,
          currency: sample.currency,
          date: sample.date,
          origin: "sample",
        });

    if (!saved.ok) return saved;
  }

  return { ok: true };
}

export async function clearSampleTransactions(): Promise<ActionResult> {
  if (process.env.NODE_ENV !== "development") {
    return { ok: false, error: "Sample data is only available in development." };
  }

  if (!getSupabaseEnv()) {
    const ordered = readLocalPortfolio()
      .transactions.filter((row) => row.origin === "sample")
      .sort((left, right) => (left.type === right.type ? 0 : left.type === "sell" ? -1 : 1));
    for (const row of ordered) {
      const deleted = deleteLocalTransaction(row.id);
      if (!deleted.ok) return deleted;
    }
    return { ok: true };
  }

  const supabase = createClient();
  const account = await getAccount(supabase);
  if (!account) return { ok: false, error: "Please log in." };
  const { data, error } = await supabase
    .from("transactions")
    .select("id, transaction_type")
    .eq("portfolio_id", account.portfolioId)
    .eq("origin", "sample");

  if (error) return { ok: false, error: "Unable to save transaction." };

  const ordered = [...(data ?? [])].sort((left, right) => {
    if (left.transaction_type === right.transaction_type) return 0;
    return left.transaction_type === "sell" ? -1 : 1;
  });
  for (const row of ordered) {
    const deleted = await supabase.from("transactions").delete().eq("id", row.id);
    if (deleted.error) return { ok: false, error: "You cannot sell more than you own." };
  }

  return { ok: true };
}

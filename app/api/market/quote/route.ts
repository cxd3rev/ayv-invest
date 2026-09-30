import { NextResponse } from "next/server";
import { getAssetQuote } from "@/lib/market-data/marketData";
import { MarketDataError } from "@/lib/market-data/types";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function GET(request: Request) {
  if (!getSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured yet." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const symbol = new URL(request.url).searchParams.get("symbol")?.trim() ?? "";
  if (!/^[A-Za-z0-9.^=-]{1,32}$/.test(symbol)) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  try {
    const quote = await getAssetQuote(symbol);
    if (!quote) return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    return NextResponse.json({ quote, delayed: true });
  } catch (error) {
    if (!(error instanceof MarketDataError)) console.error("quote", error);
    return NextResponse.json({ error: "Unable to load market data." }, { status: 502 });
  }
}

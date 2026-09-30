import { NextResponse } from "next/server";
import { searchAssets } from "@/lib/market-data/marketData";
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

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 1) return NextResponse.json({ results: [] });
  if (query.length > 40) return NextResponse.json({ error: "Asset not found." }, { status: 400 });

  try {
    const results = await searchAssets(query);
    return NextResponse.json({ results });
  } catch (error) {
    if (!(error instanceof MarketDataError)) console.error("search", error);
    return NextResponse.json({ error: "Unable to load market data." }, { status: 502 });
  }
}

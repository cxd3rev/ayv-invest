import { NextResponse } from "next/server";
import { getPortfolioHistory } from "@/lib/portfolio/history";

export async function GET(request: Request) {
  const range = new URL(request.url).searchParams.get("range") ?? "1M";
  const result = await getPortfolioHistory(range);

  if (!result.ok) {
    const status = result.message === "Please log in." ? 401 : 502;
    return NextResponse.json({ error: result.message }, { status });
  }

  return NextResponse.json({
    points: result.points,
    incomplete: result.incomplete,
    warning: result.warning,
    delayed: true,
  });
}

import "server-only";

import { createClient } from "@/lib/supabase/server";

export type Account = {
  userId: string;
  email: string;
  displayName: string;
  theme: "dark" | "light" | "system";
  portfolioId: string;
  baseCurrency: string;
};

function themeOf(value: unknown): Account["theme"] {
  return value === "light" || value === "system" ? value : "dark";
}

export async function getAccount(): Promise<Account | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const fallbackName = user.email?.split("@")[0] || "Investor";
  const profileResult = await supabase
    .from("profiles")
    .select("display_name, theme")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileResult.error) throw profileResult.error;

  let profile = profileResult.data;
  if (!profile) {
    const inserted = await supabase
      .from("profiles")
      .insert({ user_id: user.id, display_name: fallbackName })
      .select("display_name, theme")
      .single();
    if (inserted.error) throw inserted.error;
    profile = inserted.data;
  }

  const portfolioResult = await supabase
    .from("portfolios")
    .select("id, base_currency")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (portfolioResult.error) throw portfolioResult.error;

  let portfolio = portfolioResult.data;
  if (!portfolio) {
    const inserted = await supabase
      .from("portfolios")
      .insert({ user_id: user.id, name: "Main", base_currency: "EUR" })
      .select("id, base_currency")
      .single();
    if (inserted.error) throw inserted.error;
    portfolio = inserted.data;
  }

  return {
    userId: user.id,
    email: user.email ?? "",
    displayName: profile.display_name?.trim() || fallbackName,
    theme: themeOf(profile.theme),
    portfolioId: portfolio.id,
    baseCurrency: portfolio.base_currency || "EUR",
  };
}

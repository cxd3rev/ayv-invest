"use server";

import { revalidatePath } from "next/cache";
import { getAccount } from "@/lib/portfolio/account";
import { createClient } from "@/lib/supabase/server";

export type SettingsResult = { ok: true } | { ok: false; error: string };

export async function updateSettings(formData: FormData): Promise<SettingsResult> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const theme = String(formData.get("theme") ?? "dark");
  const baseCurrency = String(formData.get("baseCurrency") ?? "EUR").toUpperCase();

  if (displayName.length < 1 || displayName.length > 40) {
    return { ok: false, error: "Enter a display name of up to 40 characters." };
  }

  if (theme !== "dark" && theme !== "light" && theme !== "system") {
    return { ok: false, error: "Choose a theme." };
  }

  if (baseCurrency !== "EUR") {
    return { ok: false, error: "Only EUR is available right now." };
  }

  try {
    const account = await getAccount();
    if (!account) return { ok: false, error: "Please log in." };
    const supabase = await createClient();

    const profile = await supabase
      .from("profiles")
      .update({ display_name: displayName, theme })
      .eq("user_id", account.userId);

    if (profile.error) {
      console.error("update profile", profile.error);
      return { ok: false, error: "Unable to save your settings." };
    }

    const portfolio = await supabase
      .from("portfolios")
      .update({ base_currency: baseCurrency })
      .eq("id", account.portfolioId);

    if (portfolio.error) {
      console.error("update portfolio", portfolio.error);
      return { ok: false, error: "Unable to save your settings." };
    }

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    console.error("updateSettings", error);
    return { ok: false, error: "Unable to save your settings." };
  }
}

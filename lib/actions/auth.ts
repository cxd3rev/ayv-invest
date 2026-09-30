"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export type AuthResult = { error: string } | { message: string };

function cleanEmail(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toLowerCase();
}

async function siteOrigin() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  if (!host) return null;
  return `${proto}://${host}`;
}

export async function signIn(formData: FormData): Promise<AuthResult | void> {
  if (!getSupabaseEnv()) {
    return { error: "Supabase is not configured yet." };
  }

  const email = cleanEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");

  if (!email.includes("@") || password.length < 8) {
    return { error: "Enter a valid email and a password of at least 8 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Unable to sign in. Check your email and password." };
  }

  redirect("/dashboard");
}

export async function signUp(formData: FormData): Promise<AuthResult | void> {
  if (!getSupabaseEnv()) {
    return { error: "Supabase is not configured yet." };
  }

  const email = cleanEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!email.includes("@") || password.length < 8) {
    return { error: "Enter a valid email and a password of at least 8 characters." };
  }

  if (displayName.length < 1 || displayName.length > 40) {
    return { error: "Enter a display name of up to 40 characters." };
  }

  const origin = await siteOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
    },
  });

  if (error) {
    const alreadyExists = error.message.toLowerCase().includes("already");
    return {
      error: alreadyExists
        ? "An account with this email already exists."
        : "Unable to create your account. Please try again.",
    };
  }

  if (!data.session) {
    return {
      message: "Account created. Check your email to confirm it, then log in.",
    };
  }

  redirect("/dashboard");
}

export async function signOut() {
  if (getSupabaseEnv()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect("/login");
}

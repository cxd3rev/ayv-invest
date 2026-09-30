"use client";

import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";

export type AuthResult = { error: string } | { message: string } | { ok: true };

function cleanEmail(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toLowerCase();
}

function callbackUrl() {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const slash = process.env.NEXT_PUBLIC_GITHUB_PAGES === "true" ? "/" : "";
  return `${window.location.origin}${base}/auth/callback${slash}`;
}

export async function signIn(formData: FormData): Promise<AuthResult> {
  if (!getSupabaseEnv()) {
    return { error: "Supabase is not configured yet." };
  }

  const email = cleanEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");

  if (!email.includes("@") || password.length < 8) {
    return { error: "Enter a valid email and a password of at least 8 characters." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Unable to sign in. Check your email and password." };
  }

  return { ok: true };
}

export async function signUp(formData: FormData): Promise<AuthResult> {
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

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: callbackUrl(),
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

  return { ok: true };
}

export async function signOut() {
  if (getSupabaseEnv()) {
    const supabase = createClient();
    await supabase.auth.signOut();
  }
}

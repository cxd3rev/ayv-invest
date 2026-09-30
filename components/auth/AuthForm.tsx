"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { signIn, signUp, type AuthResult } from "@/lib/actions/auth";

const fieldClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-accent";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isSignup = mode === "signup";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    const result: AuthResult | void = isSignup ? await signUp(formData) : await signIn(formData);

    if (result && "error" in result) {
      setError(result.error);
      setPending(false);
      return;
    }

    if (result && "message" in result) {
      setMessage(result.message);
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <p className="text-[13px] font-semibold tracking-[0.18em]">AYV INVEST</p>
      <p className="mt-1 text-[10px] tracking-[0.22em] text-muted">BY AYV WRLD</p>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight">
        {isSignup ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        {isSignup
          ? "Track the investments you enter. AYV Invest does not recommend what to buy or sell."
          : "Log in to view your portfolio."}
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {isSignup ? (
          <label className="block text-sm">
            <span className="mb-1.5 block text-muted">Display name</span>
            <input name="displayName" required maxLength={40} autoComplete="name" className={fieldClass} />
          </label>
        ) : null}
        <label className="block text-sm">
          <span className="mb-1.5 block text-muted">Email</span>
          <input name="email" type="email" required autoComplete="email" className={fieldClass} />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-muted">Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={isSignup ? "new-password" : "current-password"}
            className={fieldClass}
          />
        </label>

        {error ? (
          <p className="rounded-xl border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground" role="status">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-60"
        >
          {pending ? "Please wait..." : isSignup ? "Create account" : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        {isSignup ? "Already have an account?" : "New to AYV Invest?"}{" "}
        <Link href={isSignup ? "/login" : "/signup"} className="text-foreground underline-offset-4 hover:underline">
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </main>
  );
}

import Link from "next/link";
import { SessionRedirect } from "@/components/home/SessionRedirect";
import { getSupabaseEnv } from "@/lib/supabase/env";

export default function HomePage() {
  const configured = Boolean(getSupabaseEnv());

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-16">
      <SessionRedirect />
      <p className="text-[13px] font-semibold tracking-[0.18em]">AYV INVEST</p>
      <p className="mt-1 text-[10px] tracking-[0.22em] text-muted">BY AYV WRLD</p>
      <h1 className="mt-8 text-4xl font-semibold tracking-tight sm:text-5xl">A personal portfolio tracker.</h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-muted">
        AYV Invest keeps the stocks, ETFs, and crypto you enter, then shows value, profit, and allocation in euros. It does not recommend what to buy or sell. Market data may be delayed.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {configured ? (
          <>
            <Link href="/login" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
              Log in
            </Link>
            <Link href="/signup" className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium">
              Create an account
            </Link>
          </>
        ) : (
          <Link href="/dashboard" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
            Open AYV Invest
          </Link>
        )}
      </div>
      {configured ? null : (
        <p className="mt-4 max-w-xl text-sm leading-6 text-muted">
          You can use the portfolio now. What you add stays in this browser until Supabase is connected.
        </p>
      )}
    </main>
  );
}

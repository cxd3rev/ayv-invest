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
      {configured ? (
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
            Log in
          </Link>
          <Link href="/signup" className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium">
            Create an account
          </Link>
        </div>
      ) : (
        <section className="mt-10 max-w-xl rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold tracking-tight">Accounts are not connected on this build</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            This page is live. Sign-in uses your own Supabase project. Add the public project URL and anon key to the GitHub Actions variables, run the SQL migration, and publish again. The service-role key is not used.
          </p>
        </section>
      )}
    </main>
  );
}

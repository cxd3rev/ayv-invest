"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/navigation/AppShell";
import { PortfolioProvider } from "@/components/portfolio/PortfolioProvider";
import { SetupGuide } from "@/components/setup/SetupGuide";
import { ThemeSync } from "@/components/theme/ThemeSync";
import { Skeleton } from "@/components/ui/Skeleton";
import { getAccount, type Account } from "@/lib/portfolio/account";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";

type Gate = "loading" | "setup" | "database" | "ready";

export function MainShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const configured = Boolean(getSupabaseEnv());
  const [gate, setGate] = useState<Gate>(configured ? "loading" : "setup");
  const [theme, setTheme] = useState<Account["theme"]>("dark");

  useEffect(() => {
    if (!configured) return;

    let cancelled = false;
    getAccount(createClient())
      .then((account) => {
        if (cancelled) return;
        if (!account) {
          router.replace("/login");
          return;
        }
        setTheme(account.theme);
        setGate("ready");
      })
      .catch((error) => {
        console.error("account", error);
        if (!cancelled) setGate("database");
      });

    return () => {
      cancelled = true;
    };
  }, [configured, router]);

  if (gate === "setup") return <SetupGuide />;

  if (gate === "database") {
    return (
      <AppShell>
        <section className="max-w-xl">
          <h1 className="text-2xl font-semibold tracking-tight">Database setup needed</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            AYV Invest could not read your profile. Run the SQL file in supabase/migrations in the Supabase SQL editor, then refresh this page.
          </p>
        </section>
      </AppShell>
    );
  }

  if (gate !== "ready") {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <AppShell>
      <ThemeSync theme={theme} />
      <PortfolioProvider>{children}</PortfolioProvider>
    </AppShell>
  );
}

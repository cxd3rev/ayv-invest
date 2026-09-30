import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/navigation/AppShell";
import { SetupGuide } from "@/components/setup/SetupGuide";
import { ThemeSync } from "@/components/theme/ThemeSync";
import { getAccount } from "@/lib/portfolio/account";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: ReactNode }) {
  if (!getSupabaseEnv()) return <SetupGuide />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let account = null;
  let failed = false;

  try {
    account = await getAccount();
  } catch (error) {
    console.error("account", error);
    failed = true;
  }

  if (failed) {
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

  if (!account) redirect("/login");

  return (
    <AppShell>
      <ThemeSync theme={account.theme} />
      {children}
    </AppShell>
  );
}

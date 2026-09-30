import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/navigation/AppShell";
import { SetupGuide } from "@/components/setup/SetupGuide";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export default async function MainLayout({ children }: { children: ReactNode }) {
  if (!getSupabaseEnv()) return <SetupGuide />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <AppShell>{children}</AppShell>;
}

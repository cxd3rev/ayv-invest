"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";

export function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      const code = searchParams.get("code");
      if (code && getSupabaseEnv()) {
        const supabase = createClient();
        await supabase.auth.exchangeCodeForSession(code);
      }
      if (!cancelled) router.replace("/dashboard");
    }

    void finish();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
      <p className="text-sm text-muted">Signing you in...</p>
    </main>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";

export function SessionRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (!getSupabaseEnv()) return;

    let cancelled = false;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!cancelled && data.user) router.replace("/dashboard");
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}

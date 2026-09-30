"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { loadPortfolio } from "@/lib/portfolio/load";
import type { PortfolioResult, PortfolioView } from "@/lib/portfolio/types";
import { createClient } from "@/lib/supabase/client";

type PortfolioState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; result: PortfolioResult };

const PortfolioContext = createContext<{ state: PortfolioState; reload: () => void } | null>(null);

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<PortfolioState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadPortfolio(createClient())
      .then((result) => {
        if (!cancelled) setState({ status: "ready", result });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", message: "Unable to load your portfolio." });
      });

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return <PortfolioContext.Provider value={{ state, reload }}>{children}</PortfolioContext.Provider>;
}

export function usePortfolio() {
  const value = useContext(PortfolioContext);
  if (!value) throw new Error("Portfolio is unavailable.");
  return value;
}

export function PortfolioBody({ children }: { children: (view: PortfolioView) => ReactNode }) {
  const { state } = usePortfolio();

  if (state.status === "loading") {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (state.status === "error") return <Notice>{state.message}</Notice>;
  if (!state.result.ok) return <Notice>{state.result.message}</Notice>;

  return children(state.result.view);
}

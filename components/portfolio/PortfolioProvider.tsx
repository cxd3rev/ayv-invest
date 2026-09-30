"use client";

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { listLocalPortfolios } from "@/lib/local/store";
import { loadPortfolio } from "@/lib/portfolio/load";
import type { PortfolioResult, PortfolioView } from "@/lib/portfolio/types";
import { optionalClient } from "@/lib/supabase/client";

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
    loadPortfolio(optionalClient())
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

  return (
    <>
      <PaperBanner />
      {children(state.result.view)}
    </>
  );
}

const NO_BOOKS: ReturnType<typeof listLocalPortfolios> = [];

function PaperBanner() {
  const books = useSyncExternalStore(
    (callback) => {
      window.addEventListener("ayv-portfolios", callback);
      return () => window.removeEventListener("ayv-portfolios", callback);
    },
    listLocalPortfolios,
    () => NO_BOOKS,
  );
  const active = books.find((book) => book.active);
  if (!active?.simulated) return null;
  return (
    <p className="mb-4 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
      This is a paper portfolio. The positions are practice records, not the investments in your other portfolios.
    </p>
  );
}

import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { NavLinks } from "@/components/navigation/NavLinks";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[4.75rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-card/70 px-3 py-5 backdrop-blur md:flex">
        <div className="px-2 pb-6">
          <div className="xl:hidden">
            <Wordmark compact />
          </div>
          <div className="hidden xl:block">
            <Wordmark />
          </div>
        </div>
        <NavLinks />
        <p className="mt-auto hidden px-3 pt-6 text-[11px] leading-5 text-muted xl:block">
          Portfolio tracking only. Not investment advice. Market data may be delayed.
        </p>
      </aside>

      <div className="min-w-0">
        <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-28 sm:px-6 lg:px-8 md:pb-10">
          {children}
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/90 px-2 py-1 backdrop-blur md:hidden">
        <NavLinks compact />
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { AssetSearchHotkey } from "@/components/assets/AssetSearchHotkey";
import { CommandPalette } from "@/components/navigation/CommandPalette";
import { Wordmark } from "@/components/brand/Wordmark";
import { NavLinks, SettingsNavLink } from "@/components/navigation/NavLinks";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen md:p-4">
      <div className="min-h-screen md:grid md:min-h-[calc(100vh-2rem)] md:grid-cols-[4.75rem_minmax(0,1fr)] md:overflow-hidden md:rounded-[28px] md:border md:border-border md:bg-card/40 md:shadow-[var(--shadow)] xl:grid-cols-[15.5rem_minmax(0,1fr)]">
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] flex-col border-r border-border bg-black/20 px-3 py-5 md:flex">
          <div className="px-2 pb-6">
            <div className="xl:hidden">
              <Wordmark compact />
            </div>
            <div className="hidden xl:block">
              <Wordmark />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <NavLinks omitSettings />
          </div>
          <div className="space-y-3 pt-4">
            <SettingsNavLink />
            <p className="hidden px-3 text-[11px] leading-5 text-muted xl:block">
              Portfolio tracking only. Not investment advice. Market data may be delayed.
            </p>
          </div>
        </aside>

        <AssetSearchHotkey />
        <CommandPalette />
        <div className="min-w-0">
          <main className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 pb-28 sm:px-6 md:pb-10 lg:px-8">
            {children}
          </main>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-2 py-1 backdrop-blur md:hidden">
        <NavLinks compact />
      </div>
    </div>
  );
}

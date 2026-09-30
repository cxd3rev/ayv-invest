"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import {
  AnalyticsIcon,
  AssetsIcon,
  DashboardIcon,
  MarketsIcon,
  PlanIcon,
  PortfolioIcon,
  ResearchIcon,
  RiskIcon,
  SettingsIcon,
  TransactionsIcon,
  WatchIcon,
} from "@/components/navigation/icons";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export const NAV_ITEMS: { href: string; label: string; icon: Icon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/portfolio", label: "Portfolio", icon: PortfolioIcon },
  { href: "/plan", label: "Plan", icon: PlanIcon },
  { href: "/assets", label: "Assets", icon: AssetsIcon },
  { href: "/markets", label: "Markets", icon: MarketsIcon },
  { href: "/watchlists", label: "Watch", icon: WatchIcon },
  { href: "/research", label: "Research", icon: ResearchIcon },
  { href: "/analytics", label: "Analytics", icon: AnalyticsIcon },
  { href: "/risk", label: "Risk", icon: RiskIcon },
  { href: "/transactions", label: "Transactions", icon: TransactionsIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function NavLinks({ compact = false, omitSettings = false }: { compact?: boolean; omitSettings?: boolean }) {
  const pathname = usePathname();
  const items = omitSettings ? NAV_ITEMS.filter((item) => item.href !== "/settings") : NAV_ITEMS;

  return (
    <nav className={compact ? "flex gap-1 overflow-x-auto" : "flex flex-col gap-1"}>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors ${
              compact ? "min-w-14 flex-col gap-1 px-1 py-2 text-[10px] leading-none" : ""
            } ${
              active
                ? "bg-accent/20 text-foreground shadow-[inset_0_0_0_1px_rgba(196,181,253,0.28)]"
                : "text-muted hover:bg-foreground/5 hover:text-foreground"
            }`}
          >
            <Icon className="size-[18px] shrink-0" />
            <span className={compact ? "" : "hidden xl:inline"}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function SettingsNavLink() {
  const pathname = usePathname();
  const active = pathname === "/settings" || pathname.startsWith("/settings/");
  return (
    <Link
      href="/settings"
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm ${
        active ? "bg-accent/20 text-foreground" : "text-muted hover:bg-foreground/5 hover:text-foreground"
      }`}
    >
      <SettingsIcon className="size-[18px] shrink-0" />
      <span className="hidden xl:inline">Settings</span>
    </Link>
  );
}

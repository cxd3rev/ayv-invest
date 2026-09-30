"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import {
  AnalyticsIcon,
  AssetsIcon,
  DashboardIcon,
  PortfolioIcon,
  SettingsIcon,
  TransactionsIcon,
} from "@/components/navigation/icons";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export const NAV_ITEMS: { href: string; label: string; icon: Icon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/portfolio", label: "Portfolio", icon: PortfolioIcon },
  { href: "/assets", label: "Assets", icon: AssetsIcon },
  { href: "/analytics", label: "Analytics", icon: AnalyticsIcon },
  { href: "/transactions", label: "Transactions", icon: TransactionsIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function NavLinks({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className={compact ? "grid grid-cols-6" : "flex flex-col gap-1"}>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
              compact ? "flex-col gap-1 px-1 py-2 text-[10px] leading-none" : ""
            } ${
              active
                ? "bg-foreground/8 text-foreground"
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

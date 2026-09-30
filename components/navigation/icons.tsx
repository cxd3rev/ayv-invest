import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export function DashboardIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function PortfolioIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 19V9.5" />
      <path d="M10 19V5" />
      <path d="M16 19v-7" />
      <path d="M20 19H3" />
    </svg>
  );
}

export function AssetsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16.5 20 20.5" />
    </svg>
  );
}

export function AnalyticsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 16.5 9 11l3 3 7.5-8" />
      <path d="M15 6h4.5V10.5" />
    </svg>
  );
}

export function TransactionsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 7h11" />
      <path d="M14 4.5 17.5 7 14 9.5" />
      <path d="M17 17H6" />
      <path d="M10 14.5 6.5 17 10 19.5" />
    </svg>
  );
}

export function WatchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 8v4.5l3 1.5" />
    </svg>
  );
}

export function MarketsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 16.5 9 11l3 3 8-8" />
      <path d="M15 6h5v5" />
    </svg>
  );
}
export function RiskIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5 19 6.5v5.2c0 4.2-2.8 7.2-7 8.8-4.2-1.6-7-4.6-7-8.8V6.5L12 3.5Z" />
      <path d="M12 8v4.5" />
      <path d="M12 15.5h.01" />
    </svg>
  );
}

export function ResearchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 4.5h9.5A2.5 2.5 0 0 1 18 7v12.5H8.5A2.5 2.5 0 0 0 6 22V4.5Z" />
      <path d="M6 17.5h12" />
    </svg>
  );
}

export function PlanIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 19.5h14" />
      <path d="M7 16l3-6 3 3 4-7" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.8 6.8l1.6 1.6M17.6 15.6l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.8 17.2l1.6-1.6M17.6 8.4l1.6-1.6" />
    </svg>
  );
}

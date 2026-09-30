import { formatMoney, formatPercent, formatSignedMoney } from "@/lib/format";

export function toneClass(value: number | null) {
  if (value == null || value === 0) return "text-muted";
  return value > 0 ? "text-positive" : "text-negative";
}

export function SignedMoney({
  value,
  percent,
}: {
  value: number | null;
  percent?: number | null;
}) {
  if (value == null) return <span className="text-muted">—</span>;

  return (
    <span className={toneClass(value)}>
      {formatSignedMoney(value)}
      {percent != null ? ` (${formatPercent(percent)})` : ""}
    </span>
  );
}

export function Money({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted">—</span>;
  return <span className="numeric">{formatMoney(value)}</span>;
}

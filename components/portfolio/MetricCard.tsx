export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card px-4 py-4">
      <p className="text-xs tracking-wide text-muted">{label}</p>
      <p className="numeric mt-2 text-lg font-medium">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted">{detail}</p> : null}
    </article>
  );
}

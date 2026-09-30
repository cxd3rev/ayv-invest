export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[13px] font-semibold tracking-[0.18em] text-foreground">
        {compact ? "AYV" : "AYV INVEST"}
      </p>
      <p className={`mt-1 text-[10px] tracking-[0.22em] text-muted ${compact ? "hidden" : ""}`}>
        BY AYV WRLD
      </p>
    </div>
  );
}

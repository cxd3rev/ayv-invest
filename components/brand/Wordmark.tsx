export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent/20 text-sm font-semibold text-foreground">A</span>
      <div className={compact ? "sr-only" : "min-w-0"}>
        <p className="truncate text-[13px] font-semibold tracking-[0.16em] text-foreground">AYV INVEST</p>
        <p className="mt-0.5 text-[10px] tracking-[0.2em] text-muted">BY AYV WRLD</p>
      </div>
    </div>
  );
}

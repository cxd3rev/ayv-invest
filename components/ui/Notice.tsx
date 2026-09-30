export function Notice({ children }: { children: string }) {
  return (
    <p className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted" role="status">
      {children}
    </p>
  );
}

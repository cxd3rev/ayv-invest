"use client";

export default function MainError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="max-w-lg rounded-2xl border border-border bg-card p-6">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        AYV Invest could not load this page. Please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
      >
        Try again
      </button>
    </section>
  );
}

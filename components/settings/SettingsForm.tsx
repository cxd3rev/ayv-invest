"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { signOut } from "@/lib/actions/auth";
import { updateSettings } from "@/lib/actions/settings";
import { clearSampleTransactions, loadSampleTransactions } from "@/lib/actions/transactions";

const fieldClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent";

export function SettingsForm({
  displayName,
  email,
  theme,
  showSampleTools,
}: {
  displayName: string;
  email: string;
  theme: "dark" | "light" | "system";
  showSampleTools: boolean;
}) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [samplePending, setSamplePending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const formData = new FormData(event.currentTarget);
    const result = await updateSettings(formData);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const nextTheme = String(formData.get("theme") ?? "dark");
    if (nextTheme === "dark" || nextTheme === "light" || nextTheme === "system") setTheme(nextTheme);
    setMessage("Settings saved.");
    router.refresh();
  }

  async function runSample(action: "load" | "clear") {
    setSamplePending(true);
    setError(null);
    const result = action === "load" ? await loadSampleTransactions() : await clearSampleTransactions();
    setSamplePending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(action === "load" ? "Sample transactions added." : "Sample transactions removed.");
    router.refresh();
  }

  return (
    <div className="max-w-xl space-y-8">
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1.5 block text-muted">Display name</span>
          <input name="displayName" defaultValue={displayName} maxLength={40} required className={fieldClass} />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-muted">Base currency</span>
          <select name="baseCurrency" defaultValue="EUR" className={fieldClass}>
            <option value="EUR">EUR</option>
          </select>
          <span className="mt-1 block text-xs text-muted">Portfolio totals are shown in euros. Other base currencies can be added later.</span>
        </label>
        <fieldset>
          <legend className="mb-1.5 text-sm text-muted">Theme</legend>
          <div className="grid grid-cols-3 gap-2">
            {(["dark", "light", "system"] as const).map((option) => (
              <label key={option} className="rounded-xl border border-border px-3 py-2 text-sm capitalize has-[:checked]:border-accent">
                <input type="radio" name="theme" value={option} defaultChecked={theme === option} className="mr-2" />
                {option}
              </label>
            ))}
          </div>
        </fieldset>
        {error ? <p className="text-sm text-negative">{error}</p> : null}
        {message ? <p className="text-sm text-muted">{message}</p> : null}
        <button type="submit" disabled={pending} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
          {pending ? "Saving..." : "Save settings"}
        </button>
      </form>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-medium">Account</h2>
        <p className="mt-2 text-sm text-muted">{email}</p>
        <form action={signOut} className="mt-4">
          <button type="submit" className="rounded-xl border border-border px-4 py-2.5 text-sm">
            Log out
          </button>
        </form>
      </section>

      {showSampleTools ? (
        <section className="rounded-2xl border border-dashed border-border p-5">
          <h2 className="font-medium">Development sample data</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Adds sample buy and sell transactions to this account so you can test calculations. Current prices still come from the market-data provider. Remove them before using a real portfolio.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={samplePending} onClick={() => runSample("load")} className="rounded-xl border border-border px-4 py-2 text-sm disabled:opacity-60">
              {samplePending ? "Saving..." : "Load sample transactions"}
            </button>
            <button type="button" disabled={samplePending} onClick={() => runSample("clear")} className="rounded-xl border border-border px-4 py-2 text-sm disabled:opacity-60">
              Remove sample transactions
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

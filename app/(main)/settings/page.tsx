import { signOut } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <section className="max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-2 text-sm text-muted">Signed in as {user?.email}</p>
      <form action={signOut} className="mt-8">
        <button
          type="submit"
          className="rounded-xl border border-border px-4 py-2.5 text-sm transition-colors hover:bg-foreground/5"
        >
          Log out
        </button>
      </form>
    </section>
  );
}

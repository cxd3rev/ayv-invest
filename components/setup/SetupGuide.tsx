export function SetupGuide() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-16">
      <p className="text-[13px] font-semibold tracking-[0.18em]">AYV INVEST</p>
      <p className="mt-1 text-[10px] tracking-[0.22em] text-muted">BY AYV WRLD</p>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight">Connect Supabase to continue</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        AYV Invest stores accounts and transactions in your own Supabase project. Add the public
        project URL and anon key, then run the SQL migration. The service-role key is not used.
      </p>
      <ol className="mt-6 space-y-3 text-sm leading-6 text-muted">
        <li>1. Create a Supabase project.</li>
        <li>2. Copy `.env.example` to `.env.local` and fill in the two public values.</li>
        <li>3. Run `supabase/migrations` in the Supabase SQL editor.</li>
        <li>4. Restart the dev server and open the app again.</li>
      </ol>
    </main>
  );
}

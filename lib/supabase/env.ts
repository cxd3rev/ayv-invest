export type SupabaseEnv = {
  url: string;
  anonKey: string;
};

/**
 * Public Supabase values. The anon key is designed for the browser.
 * Row Level Security decides what a signed-in user can read or write.
 * The service-role key is never used by this app.
 */
export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) return null;
  if (url.includes("your-project") || anonKey.includes("your-anon-key")) return null;

  return { url, anonKey };
}

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Use createBrowserClient from @supabase/ssr for proper cookie handling
  // This automatically handles httpOnly cookies via server requests
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}


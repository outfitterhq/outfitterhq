import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { headers, cookies } from "next/headers";

/**
 * Server Component client (READ cookies, can write for token refresh)
 * For layouts/pages. Token refreshes will be persisted.
 */
export async function supabasePage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const cookieStore = await cookies();
  const h = await headers();

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        // Read from cookies() API - this is what Next.js recommends
        return cookieStore.getAll().map((c) => ({
          name: c.name,
          value: c.value,
        }));
      },
      setAll(cookiesToSet) {
        // Write cookies to persist token refreshes
        for (const c of cookiesToSet) {
          try {
            cookieStore.set(c.name, c.value, {
              path: c.options?.path ?? "/",
              httpOnly: c.options?.httpOnly ?? true,
              sameSite: (c.options?.sameSite as "lax" | "strict" | "none") ?? "lax",
              secure: c.options?.secure ?? process.env.NODE_ENV === "production",
              maxAge: c.options?.maxAge ?? 60 * 60 * 24 * 365,
            });
          } catch (error) {
            // Log but don't throw - some Next.js versions may restrict this
            console.debug(`Could not set cookie ${c.name} in Server Component`);
          }
        }
      },
    },
  });
}

/**
 * Route Handler / Server Action client (READ+WRITE cookies)
 * Use in app/api/* and server actions.
 */
export async function supabaseRoute() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const cookieStore = await cookies();

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        // Read from cookies() API
        return cookieStore.getAll().map((c) => ({
          name: c.name,
          value: c.value,
        }));
      },
      setAll(cookiesToSet) {
        for (const c of cookiesToSet) {
          try {
            cookieStore.set(c.name, c.value, {
              path: c.options?.path ?? "/",
              httpOnly: c.options?.httpOnly ?? true,
              sameSite: (c.options?.sameSite as "lax" | "strict" | "none") ?? "lax",
              secure: c.options?.secure ?? process.env.NODE_ENV === "production",
              maxAge: c.options?.maxAge ?? 60 * 60 * 24 * 365,
            });
          } catch (error) {
            console.error(`Failed to set cookie ${c.name}:`, error);
          }
        }
      },
    },
  });
}

/**
 * Service Role client - bypasses RLS
 * ONLY use for admin operations where user auth has already been verified
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL");
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  
  if (!serviceKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY - Check Vercel environment variables");
    console.error("Variable name must be exactly: SUPABASE_SERVICE_ROLE_KEY");
    console.error("Available env vars:", Object.keys(process.env).filter(k => k.includes("SUPABASE")));
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY - Check Vercel environment variables. Variable name must be exactly: SUPABASE_SERVICE_ROLE_KEY");
  }
  
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

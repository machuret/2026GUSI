import { createClient } from "@/lib/supabase/client";

/**
 * Fetches the current Supabase session access token from the browser client.
 * Returns null if not logged in.
 */
export async function getAccessToken(): Promise<string | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/**
 * fetch() wrapper that automatically attaches the Supabase Bearer token.
 * Use this for calls to edge routes that require requireEdgeAuth().
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

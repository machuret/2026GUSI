import { createClient } from "@/lib/supabase/client";

// Singleton so auto-refresh listener stays alive
let _client: ReturnType<typeof createClient> | null = null;
function getBrowserClient() {
  if (!_client) _client = createClient();
  return _client;
}

/**
 * Fetches the current Supabase session access token from the browser client.
 * Uses getUser() first to force a token refresh if the JWT has expired,
 * then reads the refreshed session. Falls back to getSession() if getUser()
 * succeeds but session read fails.
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = getBrowserClient();

    // getUser() forces a round-trip to Supabase Auth, which triggers
    // an automatic token refresh if the access token has expired.
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      console.warn("[authFetch] getUser() failed — user may be logged out", userErr?.message);
      return null;
    }

    // Now getSession() returns the freshly-refreshed token
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch (err) {
    console.error("[authFetch] getAccessToken error:", err);
    return null;
  }
}

/**
 * fetch() wrapper that automatically attaches the Supabase Bearer token.
 * Use this for calls to edge routes that require requireEdgeAuth().
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  if (!token) console.warn(`[authFetch] No token for ${options.method ?? "GET"} ${url}`);
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

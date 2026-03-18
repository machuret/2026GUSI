import { createClient } from "@/lib/supabase/client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Build the full URL for a Supabase Edge Function */
export function edgeFn(name: string) {
  return `${SUPABASE_URL}/functions/v1/${name}`;
}

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
  let token = await getAccessToken();

  // If no token, try one forced refresh before giving up
  if (!token) {
    try {
      const supabase = getBrowserClient();
      const { data } = await supabase.auth.refreshSession();
      token = data.session?.access_token ?? null;
    } catch {
      // ignore refresh error
    }
  }

  if (!token) {
    console.warn(`[authFetch] No token for ${options.method ?? "GET"} ${url} — session may have expired`);
  }

  const isSupabase = url.startsWith(SUPABASE_URL);
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(isSupabase ? { apikey: SUPABASE_ANON_KEY } : {}),
    },
  });
}

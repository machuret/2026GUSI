import { NextResponse } from "next/server";

const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "*";

/**
 * Returns CORS headers for edge API routes.
 * Set NEXT_PUBLIC_APP_URL in production to restrict to your domain.
 */
export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

/** Handle OPTIONS preflight for edge routes */
export function handleOptions() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

/** Attach CORS headers to an existing NextResponse */
export function withCors(res: NextResponse): NextResponse {
  const headers = corsHeaders();
  Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

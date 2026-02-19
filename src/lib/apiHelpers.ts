import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * Verify the request has a valid Supabase session.
 * Returns the auth user or a 401 NextResponse.
 */
export async function requireAuth() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { user, response: null };
}

/**
 * Standard API error handler — call in every route's catch block.
 */
export function handleApiError(error: unknown, context = "API") {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", details: error.errors },
      { status: 400 }
    );
  }
  logger.error(context, error instanceof Error ? error.message : "Unknown error", error);
  const message = error instanceof Error ? error.message : "Internal server error";
  return NextResponse.json({ error: message }, { status: 500 });
}

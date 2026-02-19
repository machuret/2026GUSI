import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { hasRole } from "@/lib/auth";

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
 * Require ADMIN or SUPER_ADMIN role.
 * Use on Settings routes: company, vault, templates, prompts, lessons.
 */
export async function requireAdminAuth() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, appUser: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: appUser } = await db.from("User").select("id, role, active").eq("authId", user.id).maybeSingle();
  if (!appUser || !appUser.active) return { user: null, appUser: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!hasRole(appUser.role, "ADMIN")) return { user: null, appUser: null, response: NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 }) };

  return { user, appUser, response: null };
}

/**
 * Require SUPER_ADMIN role.
 * Use on User Management routes.
 */
export async function requireSuperAdminAuth() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, appUser: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: appUser } = await db.from("User").select("id, role, active").eq("authId", user.id).maybeSingle();
  if (!appUser || !appUser.active) return { user: null, appUser: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!hasRole(appUser.role, "SUPER_ADMIN")) return { user: null, appUser: null, response: NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 }) };

  return { user, appUser, response: null };
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

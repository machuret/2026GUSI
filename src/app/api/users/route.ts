export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperAdminAuth, handleApiError } from "@/lib/apiHelpers";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "USER", "EDITOR"]),
});

// GET /api/users — list all users (SUPER_ADMIN only)
export async function GET() {
  try {
    const { response: authError } = await requireSuperAdminAuth();
    if (authError) return authError;

    const { data: users } = await db
      .from("User")
      .select("id, authId, email, name, role, active, permissions, createdAt")
      .order("createdAt", { ascending: false });

    return NextResponse.json({ users: users ?? [] });
  } catch (error) {
    return handleApiError(error, "Users GET");
  }
}

// POST /api/users — create a new user with email + password
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireSuperAdminAuth();
    if (authError) return authError;

    const body = await req.json();
    const { email, password, name, role } = createUserSchema.parse(body);

    // Create auth user via service role (bypasses email confirmation)
    const admin = serviceClient();
    const { data: authData, error: authError2 } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authError2) {
      return NextResponse.json({ error: authError2.message }, { status: 400 });
    }

    const authId = authData.user.id;
    const now = new Date().toISOString();

    // Create app user profile
    const { data: appUser, error: dbError } = await db
      .from("User")
      .insert({ authId, email, name, role, active: true, updatedAt: now })
      .select("id, email, name, role, active, permissions, createdAt")
      .single();

    if (dbError) {
      // Rollback auth user if DB insert fails
      await admin.auth.admin.deleteUser(authId);
      throw new Error(dbError.message);
    }

    return NextResponse.json({ success: true, user: appUser });
  } catch (error) {
    return handleApiError(error, "Users POST");
  }
}

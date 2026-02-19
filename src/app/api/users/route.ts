export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperAdminAuth, handleApiError } from "@/lib/apiHelpers";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(["SUPER_ADMIN", "EDITOR"]),
});

// GET /api/users — list all users (SUPER_ADMIN only)
export async function GET() {
  try {
    const { response: authError } = await requireSuperAdminAuth();
    if (authError) return authError;

    const { data: users } = await db
      .from("User")
      .select("id, authId, email, name, role, active, createdAt")
      .order("createdAt", { ascending: false });

    return NextResponse.json({ users: users ?? [] });
  } catch (error) {
    return handleApiError(error, "Users GET");
  }
}

// POST /api/users — disabled; users are created via Supabase Auth dashboard
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireSuperAdminAuth();
    if (authError) return authError;
    return NextResponse.json(
      { error: "User creation must be done via Supabase Auth dashboard. This endpoint is disabled." },
      { status: 501 }
    );
  } catch (error) {
    return handleApiError(error, "Users POST");
  }
}

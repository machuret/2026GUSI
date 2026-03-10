export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  grantName: z.string().optional(),
  funder: z.string().optional(),
  amount: z.string().optional(),
  outcome: z.string().optional(),
  section: z.string().optional(),
  content: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// GET /api/grants/examples/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { data, error } = await db
      .from("GrantExample")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ example: data });
  } catch (err) {
    return handleApiError(err, "Grant Example GET");
  }
}

// PUT /api/grants/examples/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { data, error } = await db
      .from("GrantExample")
      .update({ ...parsed.data, updatedAt: new Date().toISOString() })
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, example: data });
  } catch (err) {
    return handleApiError(err, "Grant Example PUT");
  }
}

// DELETE /api/grants/examples/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { error } = await db
      .from("GrantExample")
      .delete()
      .eq("id", params.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, "Grant Example DELETE");
  }
}

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getActivityLogs } from "@/lib/activity";

// GET /api/activity — list all activity logs
export async function GET() {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const logs = await getActivityLogs(200);
    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Activity GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

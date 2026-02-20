import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEMO_COMPANY_ID } from "@/lib/constants";

export const runtime = "nodejs";

export async function GET() {
  const { data, error } = await db
    .from("MailchimpCampaign")
    .select("*")
    .eq("companyId", DEMO_COMPANY_ID)
    .order("sendTime", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ campaigns: data ?? [] });
}

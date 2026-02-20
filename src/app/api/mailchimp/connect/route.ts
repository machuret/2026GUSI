export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { MailchimpClient, extractDataCenter } from "@/lib/mailchimp";

export const runtime = "nodejs";

export async function GET() {
  const { data } = await db
    .from("MailchimpConnection")
    .select("id, accountName, accountEmail, dataCenter, connectedAt")
    .eq("companyId", DEMO_COMPANY_ID)
    .maybeSingle();

  return NextResponse.json({ connection: data ?? null });
}

export async function POST(req: NextRequest) {
  const { apiKey } = await req.json();
  if (!apiKey || typeof apiKey !== "string") {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  }

  const dc = extractDataCenter(apiKey);
  if (!dc) {
    return NextResponse.json(
      { error: "Invalid API key format — expected format: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-us6" },
      { status: 400 }
    );
  }

  try {
    const client  = new MailchimpClient(apiKey, dc);
    const account = await client.getAccount();

    const now = new Date().toISOString();
    await db.from("MailchimpConnection").upsert(
      {
        companyId:    DEMO_COMPANY_ID,
        apiKey,
        dataCenter:   dc,
        accountName:  account.account_name,
        accountEmail: account.email,
        connectedAt:  now,
        updatedAt:    now,
      },
      { onConflict: "companyId" }
    );

    return NextResponse.json({
      success: true,
      account: { name: account.account_name, email: account.email, dc },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Connection failed" },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  await db
    .from("MailchimpConnection")
    .delete()
    .eq("companyId", DEMO_COMPANY_ID);

  return NextResponse.json({ success: true });
}


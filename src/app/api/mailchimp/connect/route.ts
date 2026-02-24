export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
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
  const { response: authError } = await requireAuth();
  if (authError) return authError;

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

    // Auto-sync audiences + campaigns on connect
    let audiences: { id: string; name: string; memberCount: number; openRate: number; clickRate: number; syncedAt: string }[] = [];
    let campaigns: { id: string; title: string; status: string }[] = [];
    try {
      const [rawAud, rawCamp] = await Promise.all([
        client.getAudiences(),
        client.getCampaigns(200),
      ]);

      if (rawAud.length > 0) {
        await db.from("MailchimpAudience").upsert(
          rawAud.map((a) => ({
            id:          a.id,
            companyId:   DEMO_COMPANY_ID,
            name:        a.name,
            memberCount: a.stats?.member_count ?? 0,
            openRate:    a.stats?.open_rate    ?? 0,
            clickRate:   a.stats?.click_rate   ?? 0,
            syncedAt:    now,
          })),
          { onConflict: "id" }
        );
        audiences = rawAud.map((a) => ({
          id: a.id, name: a.name,
          memberCount: a.stats?.member_count ?? 0,
          openRate: a.stats?.open_rate ?? 0,
          clickRate: a.stats?.click_rate ?? 0,
          syncedAt: now,
        }));
      }

      if (rawCamp.length > 0) {
        await db.from("MailchimpCampaign").upsert(
          rawCamp.map((c) => ({
            id:               c.id,
            companyId:        DEMO_COMPANY_ID,
            audienceId:       c.recipients?.list_id ?? null,
            title:            c.settings?.title ?? "(untitled)",
            subjectLine:      c.settings?.subject_line ?? null,
            status:           c.status,
            sendTime:         c.send_time ?? null,
            emailsSent:       c.emails_sent ?? 0,
            openRate:         c.report_summary?.open_rate         ?? 0,
            clickRate:        c.report_summary?.click_rate        ?? 0,
            unsubscribeRate:  c.report_summary?.unsubscribe_rate  ?? 0,
            syncedAt:         now,
          })),
          { onConflict: "id" }
        );
        campaigns = rawCamp.map((c) => ({
          id: c.id, title: c.settings?.title ?? "(untitled)", status: c.status,
        }));
      }
    } catch { /* sync errors are non-fatal on connect */ }

    return NextResponse.json({
      success: true,
      account: { name: account.account_name, email: account.email, dc },
      synced: { audiences: audiences.length, campaigns: campaigns.length },
    });
  } catch (err) {
    return handleApiError(err, "Mailchimp Connect");
  }
}

export async function DELETE() {
  const { response: authError } = await requireAuth();
  if (authError) return authError;

  // Delete all mailchimp data for this company
  await Promise.all([
    db.from("MailchimpCampaign").delete().eq("companyId", DEMO_COMPANY_ID),
    db.from("MailchimpAudience").delete().eq("companyId", DEMO_COMPANY_ID),
    db.from("MailchimpConnection").delete().eq("companyId", DEMO_COMPANY_ID),
  ]);

  return NextResponse.json({ success: true });
}


export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { MailchimpClient } from "@/lib/mailchimp";
import { requireAuth } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function POST() {
  const { response: authError } = await requireAuth();
  if (authError) return authError;
  const { data: conn } = await db
    .from("MailchimpConnection")
    .select("apiKey, dataCenter")
    .eq("companyId", DEMO_COMPANY_ID)
    .maybeSingle();

  if (!conn) {
    return NextResponse.json({ error: "No Mailchimp connection found" }, { status: 400 });
  }

  const client = new MailchimpClient(conn.apiKey, conn.dataCenter);
  const now    = new Date().toISOString();

  try {
    const [audiences, campaigns] = await Promise.all([
      client.getAudiences(),
      client.getCampaigns(200),
    ]);

    if (audiences.length > 0) {
      const { error: audErr } = await db.from("MailchimpAudience").upsert(
        audiences.map((a) => ({
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
      if (audErr) throw new Error(`Failed to save audiences: ${audErr.message}`);
    }

    if (campaigns.length > 0) {
      const { error: campErr } = await db.from("MailchimpCampaign").upsert(
        campaigns.map((c) => ({
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
      if (campErr) throw new Error(`Failed to save campaigns: ${campErr.message}`);
    }

    return NextResponse.json({
      success:   true,
      audiences: audiences.length,
      campaigns: campaigns.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}


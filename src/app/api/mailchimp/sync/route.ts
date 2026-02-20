import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { MailchimpClient } from "@/lib/mailchimp";

export const runtime = "nodejs";

export async function POST() {
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
      await db.from("MailchimpAudience").upsert(
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
    }

    if (campaigns.length > 0) {
      await db.from("MailchimpCampaign").upsert(
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

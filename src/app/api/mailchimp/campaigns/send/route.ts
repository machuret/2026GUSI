import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { MailchimpClient } from "@/lib/mailchimp";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { audienceId, subjectLine, title, fromName, replyTo, htmlBody, scheduleTime } = await req.json();

  if (!audienceId || !subjectLine || !htmlBody) {
    return NextResponse.json(
      { error: "audienceId, subjectLine, and htmlBody are required" },
      { status: 400 }
    );
  }

  const { data: conn } = await db
    .from("MailchimpConnection")
    .select("apiKey, dataCenter, accountEmail, accountName")
    .eq("companyId", DEMO_COMPANY_ID)
    .maybeSingle();

  if (!conn) {
    return NextResponse.json({ error: "No Mailchimp connection found" }, { status: 400 });
  }

  const client = new MailchimpClient(conn.apiKey, conn.dataCenter);

  try {
    const campaign = await client.createCampaign({
      type: "regular",
      recipients: { list_id: audienceId },
      settings: {
        subject_line: subjectLine,
        title:        title || subjectLine,
        from_name:    fromName  || conn.accountName  || "Your Organisation",
        reply_to:     replyTo   || conn.accountEmail || "",
      },
    });

    await client.setCampaignContent(campaign.id, htmlBody);

    if (scheduleTime) {
      await client.scheduleCampaign(campaign.id, scheduleTime);
    } else {
      await client.sendCampaign(campaign.id);
    }

    return NextResponse.json({
      success:    true,
      campaignId: campaign.id,
      scheduled:  !!scheduleTime,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed" },
      { status: 500 }
    );
  }
}

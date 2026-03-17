export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { google } from "googleapis";
import { Readable } from "stream";

const ALL_SECTIONS = [
  "Cover Letter",
  "Executive Summary",
  "Organisational Background",
  "Needs Statement",
  "Goals & Objectives",
  "Project Description & Narrative",
  "Evaluation Plan",
  "Budget & Budget Narrative",
  "Sustainability Plan",
  "Appendices & Supporting Documents",
  "Contact Details",
] as const;

function getDrive() {
  const email  = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!email || !keyRaw) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_KEY");

  let privateKey: string;
  try {
    const parsed = JSON.parse(keyRaw);
    privateKey = parsed.private_key ?? keyRaw;
  } catch {
    privateKey = keyRaw.replace(/\\n/g, "\n");
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({ version: "v3", auth });
}

// POST /api/grants/export-doc
// Body: { grantName: string, sections: Record<string, string>, enabledList?: string[] }
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const grantName: string   = body.grantName ?? "Grant Application";
    const sections: Record<string, string> = body.sections ?? {};
    const enabledList: string[] = body.enabledList ?? [...ALL_SECTIONS];

    // Build plain-text document content
    const lines: string[] = [
      `GRANT APPLICATION — ${grantName.toUpperCase()}`,
      `Generated: ${new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney" })}`,
      "=".repeat(70),
      "",
    ];

    for (const s of enabledList) {
      const text = sections[s];
      if (text?.trim()) {
        lines.push("=".repeat(70), s.toUpperCase(), "=".repeat(70), "", text.trim(), "", "");
      }
    }

    const plainText = lines.join("\n");

    // Upload as plain text but convert to Google Doc format
    const drive = getDrive();
    const stream = new Readable();
    stream.push(Buffer.from(plainText, "utf-8"));
    stream.push(null);

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || undefined;

    const created = await drive.files.create({
      requestBody: {
        name: `${grantName} — Grant Application`,
        mimeType: "application/vnd.google-apps.document",
        ...(folderId ? { parents: [folderId] } : {}),
      },
      media: {
        mimeType: "text/plain",
        body: stream,
      },
      fields: "id, webViewLink",
    });

    const fileId = created.data.id;
    if (!fileId) throw new Error("Google Drive did not return a file ID");

    // Make viewable by anyone with the link
    await drive.permissions.create({
      fileId,
      requestBody: { role: "writer", type: "anyone" },
    });

    const docUrl = created.data.webViewLink ?? `https://docs.google.com/document/d/${fileId}/edit`;

    return NextResponse.json({ url: docUrl, fileId });
  } catch (err) {
    return handleApiError(err, "Grant export-doc");
  }
}

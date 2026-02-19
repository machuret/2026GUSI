export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";

// POST /api/vault/upload — parse a file and save to vault
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as string) || "general";
    const titleOverride = (formData.get("title") as string) || "";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";

    if (ext === "txt" || ext === "md") {
      text = buffer.toString("utf-8");
    } else if (ext === "csv") {
      // Convert CSV to readable text — keep headers + rows
      text = buffer.toString("utf-8");
    } else if (ext === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (ext === "pdf") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse");
      const result = await pdfParse(buffer);
      text = result.text;
    } else {
      return NextResponse.json({ error: `Unsupported file type: .${ext}. Supported: txt, md, csv, pdf, docx` }, { status: 400 });
    }

    text = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

    if (text.length < 10) {
      return NextResponse.json({ error: "File appears to be empty or could not be parsed" }, { status: 422 });
    }

    const filename = titleOverride.trim() || file.name;

    const { data, error } = await db
      .from("Document")
      .insert({
        companyId: DEMO_COMPANY_ID,
        filename,
        content: text,
        fileType: `${ext}:${category}`,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
      item: data,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      charCount: text.length,
    });
  } catch (err) {
    return handleApiError(err, "Vault Upload");
  }
}

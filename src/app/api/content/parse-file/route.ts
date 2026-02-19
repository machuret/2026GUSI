import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";

    if (ext === "txt" || ext === "md") {
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
      return NextResponse.json({ error: `Unsupported file type: .${ext}` }, { status: 400 });
    }

    // Clean up whitespace
    text = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

    return NextResponse.json({
      success: true,
      text,
      filename: file.name,
      wordCount: text.split(/\s+/).filter(Boolean).length,
    });
  } catch (err: any) {
    console.error("parse-file error:", err);
    return NextResponse.json({ error: err.message || "Failed to parse file" }, { status: 500 });
  }
}

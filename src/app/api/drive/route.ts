export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { listFiles, uploadFile, createFolder } from "@/lib/googleDrive";

// GET /api/drive?folderId=xxx&q=search&pageToken=xxx
export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const sp = req.nextUrl.searchParams;
    const result = await listFiles({
      folderId: sp.get("folderId") || undefined,
      query: sp.get("q") || undefined,
      pageToken: sp.get("pageToken") || undefined,
      pageSize: sp.get("pageSize") ? parseInt(sp.get("pageSize")!) : 50,
      orderBy: sp.get("orderBy") || undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, "Drive LIST");
  }
}

// POST /api/drive — upload a file or create a folder
// Body: FormData with file field, or JSON { action: "createFolder", name, parentId }
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const contentType = req.headers.get("content-type") || "";

    // JSON action (create folder)
    if (contentType.includes("application/json")) {
      const body = await req.json();

      if (body.action === "createFolder") {
        if (!body.name) return NextResponse.json({ error: "Folder name required" }, { status: 400 });
        const folder = await createFolder(body.name, body.parentId);
        return NextResponse.json({ file: folder });
      }

      // Upload from text/JSON payload
      if (body.action === "uploadText") {
        if (!body.name || !body.content) {
          return NextResponse.json({ error: "name and content required" }, { status: 400 });
        }
        const file = await uploadFile({
          name: body.name,
          mimeType: body.mimeType || "text/plain",
          content: body.content,
          folderId: body.folderId,
          description: body.description,
        });
        return NextResponse.json({ file });
      }

      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    // FormData upload (binary files)
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const folderId = (formData.get("folderId") as string) || undefined;
    const description = (formData.get("description") as string) || undefined;

    const uploaded = await uploadFile({
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      content: buffer,
      folderId,
      description,
    });

    return NextResponse.json({ file: uploaded });
  } catch (err) {
    return handleApiError(err, "Drive POST");
  }
}

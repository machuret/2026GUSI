export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import {
  getFile,
  downloadFileContent,
  downloadFileBuffer,
  updateFileMetadata,
  updateFileContent,
  trashFile,
  deleteFile,
  shareFile,
  exportFile,
} from "@/lib/googleDrive";

type Ctx = { params: Promise<{ fileId: string }> };

// GET /api/drive/[fileId]?action=metadata|download|export&mimeType=...
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { fileId } = await ctx.params;
    const action = req.nextUrl.searchParams.get("action") || "metadata";

    if (action === "metadata") {
      const file = await getFile(fileId);
      return NextResponse.json({ file });
    }

    if (action === "download") {
      const meta = await getFile(fileId);
      // Google Workspace files need export instead
      if (meta.mimeType.startsWith("application/vnd.google-apps.")) {
        const exportMime = req.nextUrl.searchParams.get("mimeType") || "text/plain";
        const buf = await exportFile(fileId, exportMime);
        return new NextResponse(new Uint8Array(buf), {
          headers: {
            "Content-Type": exportMime,
            "Content-Disposition": `attachment; filename="${encodeURIComponent(meta.name)}"`,
          },
        });
      }
      const buf = await downloadFileBuffer(fileId);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": meta.mimeType || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(meta.name)}"`,
        },
      });
    }

    if (action === "content") {
      const content = await downloadFileContent(fileId);
      return NextResponse.json({ content });
    }

    if (action === "export") {
      const mimeType = req.nextUrl.searchParams.get("mimeType") || "application/pdf";
      const buf = await exportFile(fileId, mimeType);
      const meta = await getFile(fileId);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": mimeType,
          "Content-Disposition": `attachment; filename="${encodeURIComponent(meta.name)}"`,
        },
      });
    }

    if (action === "share") {
      const role = (req.nextUrl.searchParams.get("role") as "reader" | "writer") || "reader";
      const link = await shareFile(fileId, role);
      return NextResponse.json({ link });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return handleApiError(err, "Drive GET [fileId]");
  }
}

// PATCH /api/drive/[fileId] — update metadata or content
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { fileId } = await ctx.params;
    const body = await req.json();

    // Update content
    if (body.content !== undefined) {
      const mimeType = body.mimeType || "text/plain";
      const file = await updateFileContent(fileId, body.content, mimeType);
      return NextResponse.json({ file });
    }

    // Update metadata (name, description)
    const updates: { name?: string; description?: string } = {};
    if (body.name) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const file = await updateFileMetadata(fileId, updates);
    return NextResponse.json({ file });
  } catch (err) {
    return handleApiError(err, "Drive PATCH [fileId]");
  }
}

// DELETE /api/drive/[fileId]?permanent=true
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { fileId } = await ctx.params;
    const permanent = req.nextUrl.searchParams.get("permanent") === "true";

    if (permanent) {
      await deleteFile(fileId);
    } else {
      await trashFile(fileId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, "Drive DELETE [fileId]");
  }
}

export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { logActivity } from "@/lib/activity";

// Content type → category key mapping (matches CATEGORIES in content.ts)
const CONTENT_TYPE_TO_CATEGORY: Record<string, string> = {
  newsletter:   "newsletter",
  social_media: "social_media",
  blog_post:    "blog_post",
};

// Category key → table name mapping (mirrors content.ts CATEGORIES)
const CATEGORY_TO_TABLE: Record<string, string> = {
  newsletter:     "Newsletter",
  social_media:   "SocialMedia",
  blog_post:      "BlogPost",
  offer:          "Offer",
  webinar:        "Webinar",
  announcement:   "Announcement",
  course_content: "CourseContent",
  sales_page:     "SalesPage",
  cold_email:     "ColdEmail",
};

// POST /api/ideas/[id]/approve
// Marks the idea as approved and creates a linked draft in the content table.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user: authUser, response: authError } = await requireAuth();
    if (authError) return authError;

    // Fetch the idea
    const { data: idea, error: ideaError } = await db
      .from("Idea")
      .select("*")
      .eq("id", params.id)
      .eq("companyId", DEMO_COMPANY_ID)
      .single();

    if (ideaError || !idea) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }

    if (idea.status === "approved" && idea.contentId) {
      // Already approved — return existing draft info
      return NextResponse.json({
        idea,
        contentId: idea.contentId,
        contentTable: idea.contentTable,
        category: CONTENT_TYPE_TO_CATEGORY[idea.contentType] ?? idea.contentType,
        alreadyApproved: true,
      });
    }

    // Resolve category and table
    const categoryKey = CONTENT_TYPE_TO_CATEGORY[idea.contentType] ?? "blog_post";
    const tableName   = CATEGORY_TO_TABLE[categoryKey] ?? "BlogPost";

    // Get or create app user for tracking
    const appUser = await logActivity(
      authUser.id,
      authUser.email || "",
      "ideas.approve",
      `Approved idea: ${idea.title.slice(0, 80)}`
    );

    // Create a draft content row pre-filled from the idea
    const { data: draft, error: draftError } = await db
      .from(tableName)
      .insert({
        companyId:      DEMO_COMPANY_ID,
        userId:         appUser.id,
        prompt:         idea.title,
        output:         `[Draft from idea]\n\n${idea.summary}\n\nCategory: ${idea.category}`,
        status:         "PENDING",
        revisionNumber: 0,
      })
      .select()
      .single();

    if (draftError) throw new Error(`Failed to create draft: ${draftError.message}`);

    // Mark idea as approved and link to the draft
    const { data: updatedIdea, error: updateError } = await db
      .from("Idea")
      .update({
        status:       "approved",
        contentId:    draft.id,
        contentTable: tableName,
        updatedAt:    new Date().toISOString(),
      })
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({
      idea:         updatedIdea,
      contentId:    draft.id,
      contentTable: tableName,
      category:     categoryKey,
    });
  } catch (err) {
    return handleApiError(err, "Ideas Approve");
  }
}

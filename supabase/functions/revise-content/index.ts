import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TABLE_MAP: Record<string, string> = {
  newsletter: "Newsletter", offer: "Offer", webinar: "Webinar",
  social_media: "SocialMedia", announcement: "Announcement",
  blog_post: "BlogPost", course_content: "CourseContent",
  sales_page: "SalesPage", cold_email: "ColdEmail",
};

const CATEGORY_LABELS: Record<string, string> = {
  newsletter: "Newsletter", offer: "Offer", webinar: "Webinar",
  social_media: "Social Media", announcement: "Announcement",
  blog_post: "Blog Post", course_content: "Course Content",
  sales_page: "Sales Page", cold_email: "Cold Email",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { contentId, category, additionalFeedback } = await req.json();
    if (!contentId || !category) {
      return Response.json({ error: "contentId and category are required" }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    const { data: { user }, error: authError } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } }).auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });

    const table = TABLE_MAP[category];
    if (!table) return Response.json({ error: `Invalid category: ${category}` }, { status: 400, headers: corsHeaders });
    const catLabel = CATEGORY_LABELS[category];

    // Fetch original content
    const { data: original, error: fetchError } = await db.from(table).select("*, company:Company(name, industry)").eq("id", contentId).single();
    if (fetchError || !original) return Response.json({ error: "Content not found" }, { status: 404, headers: corsHeaders });

    // Fetch lessons + style profile in parallel
    const [lessonsRes, styleRes, infoRes] = await Promise.all([
      db.from("Lesson").select("*").eq("companyId", original.companyId).eq("active", true)
        .or(`contentType.eq.${category},contentType.is.null`)
        .order("createdAt", { ascending: false }).limit(20),
      db.from("StyleProfile").select("*").eq("companyId", original.companyId).maybeSingle(),
      db.from("CompanyInfo").select("bulkContent, values, corePhilosophy").eq("companyId", original.companyId).maybeSingle(),
    ]);

    const lessons = lessonsRes.data ?? [];
    const styleProfile = styleRes.data;
    const companyInfo = infoRes.data;

    const dnaBlock = companyInfo?.bulkContent
      ? `\n\n═══ COMPANY WRITING DNA ═══\n${companyInfo.bulkContent}\n═══ END OF WRITING DNA ═══`
      : "";

    const lessonsContext = lessons.length > 0
      ? "\n\nLESSONS LEARNED (apply these strictly):\n" +
        [...lessons.filter((l: any) => l.severity === "high"), ...lessons.filter((l: any) => l.severity !== "high")]
          .map((l: any, i: number) => `${i + 1}. [${l.severity.toUpperCase()}] ${l.feedback}`)
          .join("\n")
      : "";

    const allFeedback = [original.feedback, additionalFeedback].filter(Boolean).join("\n\nAdditional feedback: ");

    const systemPrompt = `You are revising ${catLabel} content for ${original.company?.name ?? "this company"}. The previous version was REJECTED. Fix ALL issues in the feedback while maintaining the company's voice.
${dnaBlock}
${styleProfile ? `\nStyle: ${styleProfile.tone}. Vocabulary: ${(styleProfile.vocabulary || []).join(", ")}` : ""}
${lessonsContext}

OUTPUT RULES:
1. Fix every issue mentioned in the feedback below — this is mandatory.
2. Maintain the company's established voice and writing DNA.
3. Output ONLY the revised content — no meta-commentary.
4. Never use: game-changer, unlock, next-level, crushing it, skyrocketing, disrupt.`;

    const userMessage = `ORIGINAL CONTENT:\n${original.output}\n\nREJECTION FEEDBACK:\n${allFeedback}\n\nPlease revise the content to address all feedback points.`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
        temperature: 0.6,
        max_tokens: 2500,
      }),
    });

    const openaiData = await openaiRes.json();
    const output = openaiData.choices?.[0]?.message?.content?.trim() ?? "";

    // Mark original as REVISED
    await db.from(table).update({ status: "REVISED" }).eq("id", contentId);

    // Get or create app user
    const { data: existingUser } = await db.from("User").select("id").eq("authId", user.id).maybeSingle();
    let userId = existingUser?.id;
    if (!userId) {
      const { data: newUser } = await db.from("User").insert({ authId: user.id, email: user.email, name: user.email?.split("@")[0], role: "EDITOR" }).select("id").single();
      userId = newUser?.id;
    }

    // Save revised content
    const { data: revised, error: saveError } = await db.from(table).insert({
      companyId: original.companyId,
      userId,
      prompt: original.prompt,
      output,
      status: "PENDING",
      revisionOf: original.id,
      revisionNumber: (original.revisionNumber ?? 0) + 1,
    }).select().single();

    if (saveError) throw new Error(`Save failed: ${saveError.message}`);

    // Log activity
    if (userId) {
      await db.from("ActivityLog").insert({
        userId,
        action: "content.revise",
        details: `Revised ${catLabel}: applied ${lessons.length} lessons`,
      });
    }

    return Response.json({ success: true, revised, category, lessonsApplied: lessons.length }, { headers: corsHeaders });

  } catch (err: any) {
    console.error("revise-content error:", err);
    return Response.json({ error: err.message || "Internal server error" }, { status: 500, headers: corsHeaders });
  }
});

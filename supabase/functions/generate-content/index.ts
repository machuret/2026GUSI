import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { companyId, prompt, category, extraFields } = await req.json();

    if (!companyId || !prompt || !category) {
      return Response.json({ error: "companyId, prompt, and category are required" }, { status: 400, headers: corsHeaders });
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

    // Category → table mapping
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

    const table = TABLE_MAP[category];
    if (!table) return Response.json({ error: `Invalid category: ${category}` }, { status: 400, headers: corsHeaders });
    const catLabel = CATEGORY_LABELS[category];

    // Fetch all context in parallel
    const [companyRes, infoRes, styleRes, postsRes, promptRes, lessonsRes] = await Promise.all([
      db.from("Company").select("*").eq("id", companyId).maybeSingle(),
      db.from("CompanyInfo").select("*").eq("companyId", companyId).maybeSingle(),
      db.from("StyleProfile").select("*").eq("companyId", companyId).maybeSingle(),
      db.from("ContentPost").select("*").eq("companyId", companyId).order("createdAt", { ascending: false }).limit(5),
      db.from("PromptTemplate").select("*").eq("companyId", companyId).eq("contentType", category).eq("active", true).limit(1),
      db.from("Lesson").select("*").eq("companyId", companyId).eq("active", true).or(`contentType.eq.${category},contentType.is.null`).order("createdAt", { ascending: false }).limit(30),
    ]);

    const company = companyRes.data;
    if (!company) return Response.json({ error: "Company not found" }, { status: 404, headers: corsHeaders });

    const companyInfo = infoRes.data;
    const styleProfile = styleRes.data;
    const recentPosts = postsRes.data ?? [];
    const promptTemplate = promptRes.data?.[0] ?? null;
    const lessons = lessonsRes.data ?? [];

    // Build system prompt
    const dnaBlock = companyInfo?.bulkContent
      ? `\n\n═══ COMPANY WRITING DNA — FOLLOW THIS PRECISELY ═══\n${companyInfo.bulkContent}\n═══ END OF WRITING DNA ═══`
      : "";

    const identityParts: string[] = [];
    if (companyInfo?.values) identityParts.push(`Values: ${companyInfo.values}`);
    if (companyInfo?.corePhilosophy) identityParts.push(`Philosophy: ${companyInfo.corePhilosophy}`);
    if (companyInfo?.founders) identityParts.push(`Founders/Team: ${companyInfo.founders}`);
    if (companyInfo?.achievements) identityParts.push(`Achievements: ${companyInfo.achievements}`);
    const identityBlock = identityParts.length > 0 ? `\n\nCOMPANY IDENTITY:\n${identityParts.join("\n")}` : "";

    const styleBlock = styleProfile
      ? `\n\nANALYSED STYLE PROFILE:\n- Tone: ${styleProfile.tone}\n- Avg word count: ${styleProfile.avgWordCount}\n- Vocabulary: ${(styleProfile.vocabulary || []).join(", ")}\n- Common phrases: ${(styleProfile.commonPhrases || []).join(" | ")}`
      : "";

    const examplesBlock = recentPosts.length > 0
      ? "\n\nEXAMPLE POSTS (match this style exactly):\n" +
        recentPosts.map((p: any, i: number) => `--- Example ${i + 1} (${p.platform}, ${p.contentType}) ---\n${p.title ? p.title + "\n" : ""}${p.body}`).join("\n\n")
      : "";

    const customBlock = promptTemplate ? `\n\nCUSTOM INSTRUCTIONS FOR ${catLabel.toUpperCase()}:\n${promptTemplate.systemPrompt}` : "";

    const lessonsBlock = lessons.length > 0
      ? `\n\nLESSONS FROM PAST REJECTIONS — APPLY ALL STRICTLY (${lessons.length} total):\n` +
        [...lessons.filter((l: any) => l.severity === "high"), ...lessons.filter((l: any) => l.severity !== "high")]
          .map((l: any, i: number) => `${i + 1}. [${l.severity.toUpperCase()}]${l.contentType ? ` (${l.contentType})` : ""} ${l.feedback}`)
          .join("\n")
      : "";

    const systemPrompt = `You are the content writer for ${company.name}${company.industry ? ` (${company.industry})` : ""}. You are writing a ${catLabel}.
${dnaBlock}${identityBlock}${styleBlock}${examplesBlock}${customBlock}${lessonsBlock}

OUTPUT RULES:
1. Follow the Writing DNA above as your primary instruction.
2. Content type: ${catLabel}. Write content appropriate for this format.
3. Output ONLY the finished content — no meta-commentary, no explanations.
4. Target length: ~${styleProfile?.avgWordCount || 200} words unless the format demands otherwise.
5. Apply every lesson from past rejections — these are mandatory corrections.
6. Never use: game-changer, unlock, next-level, crushing it, skyrocketing, disrupt, or any hype adjectives.`;

    // Call OpenAI
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
        temperature: 0.65,
        max_tokens: 2500,
      }),
    });

    const openaiData = await openaiRes.json();
    const output = openaiData.choices?.[0]?.message?.content?.trim() ?? "";

    // Get or create app user
    const { data: existingUser } = await db.from("User").select("id").eq("authId", user.id).maybeSingle();
    let userId = existingUser?.id;
    if (!userId) {
      const { data: newUser } = await db.from("User").insert({ authId: user.id, email: user.email, name: user.email?.split("@")[0], role: "EDITOR" }).select("id").single();
      userId = newUser?.id;
    }

    // Save to category table
    const { data: generated, error: saveError } = await db.from(table).insert({
      companyId,
      userId,
      prompt,
      output,
      status: "PENDING",
      revisionNumber: 0,
      ...(extraFields || {}),
    }).select().single();

    if (saveError) throw new Error(`Save failed: ${saveError.message}`);

    // Log activity
    await db.from("ActivityLog").insert({ userId, action: "content.generate", details: `${catLabel}: ${prompt.slice(0, 100)}` });

    return Response.json({ success: true, generated, category }, { headers: corsHeaders });

  } catch (err: any) {
    console.error("generate-content error:", err);
    return Response.json({ error: err.message || "Internal server error" }, { status: 500, headers: corsHeaders });
  }
});

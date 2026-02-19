import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { companyId } = await req.json();
    if (!companyId) return Response.json({ error: "companyId is required" }, { status: 400, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    const { data: { user }, error: authError } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } }).auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });

    // Verify company exists
    const { data: company } = await db.from("Company").select("id, name").eq("id", companyId).maybeSingle();
    if (!company) return Response.json({ error: "Company not found" }, { status: 404, headers: corsHeaders });

    // Fetch posts and documents
    const [postsRes, docsRes] = await Promise.all([
      db.from("ContentPost").select("*").eq("companyId", companyId).order("createdAt", { ascending: false }).limit(50),
      db.from("Document").select("*").eq("companyId", companyId).order("createdAt", { ascending: false }).limit(10),
    ]);

    const posts = postsRes.data ?? [];
    const docs = docsRes.data ?? [];

    if (posts.length === 0 && docs.length === 0) {
      return Response.json({ error: "No content found. Please ingest some content first." }, { status: 400, headers: corsHeaders });
    }

    const totalWords = posts.reduce((sum: number, p: any) => sum + p.body.split(/\s+/).length, 0);
    const avgWordCount = posts.length > 0 ? Math.round(totalWords / posts.length) : 0;

    const postSamples = posts.slice(0, 15)
      .map((p: any, i: number) => `--- Post ${i + 1} (${p.platform}, ${p.contentType}) ---\n${p.title ? p.title + "\n" : ""}${p.body}`)
      .join("\n\n");

    const docSamples = docs.slice(0, 3)
      .map((d: any, i: number) => `--- Document ${i + 1} (${d.filename}) ---\n${d.content.slice(0, 2000)}`)
      .join("\n\n");

    const prompt = `You are a content style analyst. Analyse the following content samples and extract the writing style fingerprint.

CONTENT SAMPLES:
${postSamples}

${docSamples ? `DOCUMENTS:\n${docSamples}` : ""}

Respond in valid JSON with exactly these fields:
{
  "tone": "one or two words describing the overall tone",
  "vocabulary": ["array", "of", "10-20", "signature", "words"],
  "commonPhrases": ["array of 5-10 recurring phrases or sentence patterns"],
  "preferredFormats": ["array of content format types they prefer"],
  "summary": "A 2-3 sentence description of this company's writing style, voice, and content approach."
}

Return ONLY the JSON, no markdown fences.`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    const openaiData = await openaiRes.json();
    const raw = openaiData.choices?.[0]?.message?.content?.trim() ?? "{}";

    let parsed: any;
    try { parsed = JSON.parse(raw); }
    catch { return Response.json({ error: "Failed to parse AI response", raw: raw.slice(0, 300) }, { status: 500, headers: corsHeaders }); }

    parsed.avgWordCount = avgWordCount;

    // Upsert style profile
    const { data: styleProfile, error: saveError } = await db
      .from("StyleProfile")
      .upsert({ companyId, ...parsed }, { onConflict: "companyId" })
      .select().single();

    if (saveError) throw new Error(`Save failed: ${saveError.message}`);

    // Log activity
    const { data: appUser } = await db.from("User").select("id").eq("authId", user.id).maybeSingle();
    if (appUser?.id) {
      await db.from("ActivityLog").insert({ userId: appUser.id, action: "style.analyze", details: `Style analysis for company ${companyId}` });
    }

    return Response.json({ success: true, styleProfile }, { headers: corsHeaders });

  } catch (err: any) {
    console.error("analyze-style error:", err);
    return Response.json({ error: err.message || "Internal server error" }, { status: 500, headers: corsHeaders });
  }
});

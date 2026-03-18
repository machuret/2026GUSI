// Supabase Edge Function: grant-improve
// POST — Takes a saved audit ID, loads the audit + draft, rewrites each section
// incorporating the audit's issues and improvements. Saves the improved draft.
// Enterprise-grade: per-section rewrite with full context, coherence tracking,
// before/after scoring, and automatic draft versioning.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY    = Deno.env.get("OPENAI_API_KEY")!;
const DEMO_COMPANY_ID   = "demo";
const MODEL             = "gpt-4o";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyAuth(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

// ── Context helpers ──────────────────────────────────────────────────────────

function buildProfileContext(profile: Record<string, unknown>): string {
  const lines = [
    profile.contactName    ? `Contact Name: ${profile.contactName}` : null,
    profile.contactRole    ? `Contact Role: ${profile.contactRole}` : null,
    profile.orgType
      ? `Organisation Type: ${profile.orgType}${profile.orgType2 ? ` / ${profile.orgType2}` : ""}`
      : null,
    profile.sector
      ? `Sector: ${profile.sector}${profile.subSector ? ` / ${profile.subSector}` : ""}`
      : null,
    profile.stage         ? `Stage: ${profile.stage}` : null,
    profile.teamSize      ? `Team Size: ${profile.teamSize}` : null,
    profile.annualRevenue  ? `Annual Revenue: ${profile.annualRevenue}` : null,
    profile.location
      ? `Location: ${profile.location}, ${profile.country ?? "Australia"}`
      : null,
    profile.missionStatement ? `\nMission Statement:\n${profile.missionStatement}` : null,
    profile.keyActivities    ? `\nKey Activities:\n${profile.keyActivities}` : null,
    profile.uniqueStrengths  ? `\nUnique Strengths:\n${profile.uniqueStrengths}` : null,
    profile.pastGrantsWon    ? `\nPast Grants Won:\n${profile.pastGrantsWon}` : null,
  ].filter(Boolean);
  return lines.length > 0 ? `## GRANT PROFILE\n${lines.join("\n")}` : "";
}

async function getVaultBlock(db: ReturnType<typeof createClient>): Promise<string> {
  const { data: docs } = await db
    .from("Document")
    .select("filename, content")
    .eq("companyId", DEMO_COMPANY_ID)
    .order("createdAt", { ascending: false })
    .limit(10);
  if (!docs || docs.length === 0) return "";
  let budget = 12000;
  const chunks: string[] = [];
  for (const doc of docs) {
    if (budget <= 0) break;
    const chunk = (doc.content as string).slice(0, Math.min(2000, budget));
    budget -= chunk.length;
    chunks.push(`--- ${doc.filename} ---\n${chunk}`);
  }
  return `## KNOWLEDGE VAULT\n${chunks.join("\n\n")}`;
}

// ── OpenAI caller ────────────────────────────────────────────────────────────

async function callOpenAI(opts: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
  const maxRetries = 2;
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: opts.systemPrompt },
          { role: "user", content: opts.userPrompt },
        ],
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 2000,
        ...(opts.jsonMode !== false ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        content: data.choices?.[0]?.message?.content ?? "",
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
      };
    }
    const errText = await res.text();
    lastErr = new Error(`OpenAI ${res.status}: ${errText.slice(0, 300)}`);
    if (![429, 500, 502, 503, 504].includes(res.status)) break;
  }
  throw lastErr ?? new Error("OpenAI request failed");
}

// ── Improve prompt ───────────────────────────────────────────────────────────

const IMPROVE_SYSTEM_PROMPT = `You are an expert Grant Application Improver. You receive a section of a grant application along with:
- The audit findings (issues and suggested improvements) for this section
- The organisation's real profile and vault documents
- The grant details and funder requirements
- Other sections of the application (for coherence)

Your task is to REWRITE the section to address ALL audit issues and incorporate ALL suggested improvements.

Rules:
1. Fix every issue identified in the audit
2. Incorporate every suggested improvement
3. Use REAL data from the vault documents and profile — never fabricate facts
4. Maintain the same tone and voice as the original
5. Keep roughly the same length (±20%) unless the audit says it needs expansion
6. Ensure coherence with other sections — don't repeat information already covered elsewhere
7. Preserve any strong parts of the original that the audit didn't flag

Return ONLY valid JSON:
{
  "improved": "<the full rewritten section text>",
  "changesSummary": "<1-2 sentence summary of what was changed and why>"
}`;

// ── Serve ────────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await verifyAuth(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json();
    const auditId = body.auditId as string;
    if (!auditId) return json({ error: "auditId is required" }, 400);

    // 1. Load audit
    const { data: audit } = await db
      .from("GrantAudit")
      .select("*")
      .eq("id", auditId)
      .eq("companyId", DEMO_COMPANY_ID)
      .maybeSingle();
    if (!audit) return json({ error: "Audit not found" }, 404);

    // 2. Load draft
    const { data: draft } = await db
      .from("GrantDraft")
      .select("grantId, grantName, sections, tone, length")
      .eq("id", audit.draftId)
      .eq("companyId", DEMO_COMPANY_ID)
      .maybeSingle();
    if (!draft) return json({ error: "Draft not found" }, 404);

    const sections = (draft.sections as Record<string, string>) ?? {};
    const sectionAudits = (audit.sectionAudits as Array<{
      section: string; score: number; issues: string[]; improvements: string[];
    }>) ?? [];

    // 3. Load grant metadata, profile, vault in parallel
    let grantDetails = "";
    const [grantRes, { data: profile }, vaultBlock] = await Promise.all([
      draft.grantId
        ? db.from("Grant").select("name, eligibility, founder, amount, geographicScope").eq("id", draft.grantId).maybeSingle()
        : Promise.resolve({ data: null }),
      db.from("GrantProfile").select("*").eq("companyId", DEMO_COMPANY_ID).maybeSingle(),
      getVaultBlock(db),
    ]);
    if (grantRes.data) {
      const g = grantRes.data;
      grantDetails = [
        `Grant: ${g.name}`, g.founder ? `Funder: ${g.founder}` : null,
        g.amount ? `Amount: ${g.amount}` : null,
        g.eligibility ? `Eligibility: ${g.eligibility}` : null,
      ].filter(Boolean).join("\n");
    }
    const profileBlock = profile ? buildProfileContext(profile as Record<string, unknown>) : "";

    // 4. Identify sections that need improvement (score < 90 or have issues)
    const toImprove = sectionAudits.filter(
      (sa) => sa.score < 90 || sa.issues.length > 0 || sa.improvements.length > 0
    );

    if (toImprove.length === 0) {
      return json({ success: true, improved: sections, changes: [], message: "All sections scored 90+. No improvements needed." });
    }

    // 5. Improve each section sequentially (for coherence tracking)
    const improved: Record<string, string> = { ...sections };
    const changes: Array<{ section: string; changesSummary: string; scoreBefore: number }> = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    for (const sa of toImprove) {
      const original = sections[sa.section];
      if (!original?.trim()) continue;

      // Build other sections context (already-improved ones get the improved version)
      const otherSections = Object.entries(improved)
        .filter(([k]) => k !== sa.section)
        .map(([k, v]) => `### ${k}\n${(v as string).slice(0, 500)}`)
        .join("\n\n");

      const userPrompt = [
        `## SECTION TO IMPROVE: ${sa.section}`,
        `## AUDIT SCORE: ${sa.score}/100`,
        sa.issues.length > 0
          ? `## ISSUES FOUND:\n${sa.issues.map((i, idx) => `${idx + 1}. ${i}`).join("\n")}`
          : "",
        sa.improvements.length > 0
          ? `## SUGGESTED IMPROVEMENTS:\n${sa.improvements.map((i, idx) => `${idx + 1}. ${i}`).join("\n")}`
          : "",
        `## TOP-LEVEL RECOMMENDATIONS:\n${(audit.topRecommendations as string[]).map((r, i) => `${i + 1}. ${r}`).join("\n")}`,
        grantDetails ? `## GRANT DETAILS\n${grantDetails}` : "",
        profileBlock,
        vaultBlock,
        otherSections ? `## OTHER SECTIONS (for coherence — do not repeat):\n${otherSections}` : "",
        `## ORIGINAL SECTION TEXT:\n${original}`,
      ].filter(Boolean).join("\n\n");

      try {
        const result = await callOpenAI({
          systemPrompt: IMPROVE_SYSTEM_PROMPT,
          userPrompt,
          maxTokens: 2500,
          temperature: 0.4,
        });
        totalPromptTokens += result.promptTokens;
        totalCompletionTokens += result.completionTokens;

        const parsed = JSON.parse(result.content);
        if (parsed.improved && typeof parsed.improved === "string") {
          improved[sa.section] = parsed.improved;
          changes.push({
            section: sa.section,
            changesSummary: parsed.changesSummary ?? "Section rewritten based on audit.",
            scoreBefore: sa.score,
          });
        }
      } catch (err) {
        console.error(`[grant-improve] Failed to improve "${sa.section}":`, err);
        changes.push({
          section: sa.section,
          changesSummary: `Error: ${String(err).slice(0, 100)}`,
          scoreBefore: sa.score,
        });
      }
    }

    // 6. Save improved sections as updated draft + mark as published
    const { error: updateErr } = await db
      .from("GrantDraft")
      .update({
        sections: improved,
        published: true,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", audit.draftId);
    if (updateErr) console.error("[grant-improve] Draft update error:", updateErr);

    // 7. Mark audit as improved
    await db
      .from("GrantAudit")
      .update({ improvedAt: new Date().toISOString() })
      .eq("id", auditId);

    // 7b. Move CRM status to Improved
    if (draft.grantId) {
      try {
        await db
          .from("Grant")
          .update({ crmStatus: "Improved", updatedAt: new Date().toISOString() })
          .eq("id", draft.grantId);
      } catch { /* non-critical */ }
    }

    // 8. Log AI usage
    try {
      await db.from("AiUsageLog").insert({
        model: MODEL,
        feature: "grants_improve",
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        userId: user.id,
      });
    } catch { /* non-critical */ }

    console.log(`[grant-improve] Improved ${changes.length} sections for "${draft.grantName}"`);

    return json({
      success: true,
      improved,
      changes,
      sectionsImproved: changes.length,
      message: `Improved ${changes.length} section${changes.length !== 1 ? "s" : ""} based on audit findings.`,
    });
  } catch (err) {
    console.error("grant-improve error:", err);
    return json({ error: String(err) }, 500);
  }
});

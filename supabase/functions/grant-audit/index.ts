// Supabase Edge Function: grant-audit
// POST — Runs AI audit on a grant draft, saves result to GrantAudit table.
// GET  — Lists saved audits for the company.
// Replaces Next.js /api/grants/audit.

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
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
    profile.yearFounded   ? `Year Founded: ${profile.yearFounded}` : null,
    (profile.focusAreas as string[] | null)?.length
      ? `Focus Areas: ${(profile.focusAreas as string[]).join(", ")}`
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

// ── OpenAI caller with retries ───────────────────────────────────────────────

async function callOpenAI(opts: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
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
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 2000,
        response_format: { type: "json_object" },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        content: data.choices?.[0]?.message?.content ?? "{}",
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

// ── Default audit prompt ─────────────────────────────────────────────────────

const DEFAULT_AUDIT_PROMPT = `You are a Grant Application Auditor. Your job is to review a draft grant application and assess its accuracy and quality against the organisation's real information (vault documents and grant profile).

Audit the following dimensions:
1. **Accuracy** — Does the content accurately reflect the organisation's actual activities, mission, financials, and team?
2. **Completeness** — Are there gaps where key information is missing or vague?
3. **Alignment** — Does the application align with the grant's stated eligibility criteria and funder priorities?
4. **Evidence** — Are claims supported by specific, verifiable evidence from the vault?
5. **Improvements** — What concrete improvements can be made based on available vault content?

For each section of the draft, provide:
- An accuracy score (0-100)
- Specific issues found (if any)
- Concrete improvements using real information from the vault

Return ONLY valid JSON in this exact format, no markdown:
{
  "overallScore": <integer 0-100>,
  "overallVerdict": "<Excellent | Good | Needs Work | Poor>",
  "summary": "<2-3 sentence plain-English summary>",
  "sectionAudits": [
    {
      "section": "<section name>",
      "score": <0-100>,
      "issues": ["<specific issue 1>", ...],
      "improvements": ["<concrete improvement 1>", ...]
    }
  ],
  "topRecommendations": ["<priority action 1>", "<priority action 2>", "<priority action 3>"]
}`;

// ── Serve ────────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await verifyAuth(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // GET — list saved audits
    if (req.method === "GET") {
      const { data, error } = await db
        .from("GrantAudit")
        .select("id, draftId, grantName, overallScore, overallVerdict, summary, sectionAudits, topRecommendations, improvedAt, createdAt")
        .eq("companyId", DEMO_COMPANY_ID)
        .order("createdAt", { ascending: false })
        .limit(50);
      if (error) throw error;
      return json({ audits: data ?? [] });
    }

    // POST — run audit
    if (req.method === "POST") {
      const body = await req.json();
      const draftId = body.draftId as string;
      if (!draftId) return json({ error: "draftId is required" }, 400);

      // 1. Load draft
      const { data: draft } = await db
        .from("GrantDraft")
        .select("grantId, grantName, sections")
        .eq("id", draftId)
        .eq("companyId", DEMO_COMPANY_ID)
        .maybeSingle();
      if (!draft) return json({ error: "Draft not found" }, 404);

      const grantName = draft.grantName as string;
      const sections = (draft.sections as Record<string, string>) ?? {};

      // 2. Load grant metadata
      let grantDetails = "";
      if (draft.grantId) {
        const { data: grant } = await db
          .from("Grant")
          .select("name, eligibility, founder, amount, geographicScope, howToApply")
          .eq("id", draft.grantId)
          .maybeSingle();
        if (grant) {
          grantDetails = [
            `Grant: ${grant.name}`,
            grant.founder         ? `Funder: ${grant.founder}` : null,
            grant.amount          ? `Amount: ${grant.amount}` : null,
            grant.eligibility     ? `Eligibility: ${grant.eligibility}` : null,
            grant.geographicScope ? `Geographic Scope: ${grant.geographicScope}` : null,
            grant.howToApply      ? `How to Apply: ${grant.howToApply}` : null,
          ].filter(Boolean).join("\n");
        }
      }

      // 3. Load profile + vault + custom prompt in parallel
      const [{ data: profile }, vaultBlock, { data: promptRow }] = await Promise.all([
        db.from("GrantProfile").select("*").eq("companyId", DEMO_COMPANY_ID).maybeSingle(),
        getVaultBlock(db),
        db.from("PromptTemplate")
          .select("systemPrompt")
          .eq("companyId", DEMO_COMPANY_ID)
          .eq("contentType", "grant_audit")
          .order("updatedAt", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const systemPrompt = promptRow?.systemPrompt ?? DEFAULT_AUDIT_PROMPT;
      const profileBlock = profile ? buildProfileContext(profile as Record<string, unknown>) : "";

      // 4. Build draft content block
      const draftBlock = Object.entries(sections)
        .filter(([, v]) => v?.trim())
        .map(([k, v]) => `### ${k}\n${(v as string).trim()}`)
        .join("\n\n");

      const userPrompt = [
        `## GRANT APPLICATION BEING AUDITED: ${grantName}`,
        grantDetails ? `## GRANT DETAILS\n${grantDetails}` : "",
        profileBlock,
        vaultBlock,
        `## DRAFT APPLICATION CONTENT\n${draftBlock}`,
      ].filter(Boolean).join("\n\n");

      // 5. Call OpenAI
      const result = await callOpenAI({
        systemPrompt,
        userPrompt,
        maxTokens: 3000,
        temperature: 0.3,
      });

      let audit: Record<string, unknown>;
      try {
        audit = JSON.parse(result.content);
      } catch {
        return json({ error: "AI returned invalid JSON" }, 500);
      }

      // 6. Save audit to DB
      const { data: saved, error: saveErr } = await db
        .from("GrantAudit")
        .insert({
          companyId: DEMO_COMPANY_ID,
          draftId,
          grantName,
          overallScore: audit.overallScore ?? 0,
          overallVerdict: audit.overallVerdict ?? "Poor",
          summary: audit.summary ?? "",
          sectionAudits: audit.sectionAudits ?? [],
          topRecommendations: audit.topRecommendations ?? [],
          fullResult: audit,
        })
        .select("id")
        .single();
      if (saveErr) console.error("[grant-audit] DB save error:", saveErr);

      // 7. Log AI usage
      try {
        await db.from("AiUsageLog").insert({
          model: MODEL,
          feature: "grants_audit",
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          userId: user.id,
        });
      } catch { /* non-critical */ }

      console.log(`[grant-audit] Audit complete for "${grantName}" — score ${audit.overallScore}, saved as ${saved?.id}`);
      return json({ success: true, audit, auditId: saved?.id ?? null });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error("grant-audit error:", err);
    return json({ error: String(err) }, 500);
  }
});

/**
 * grant-write — Supabase Edge Function
 *
 * Handles all three grant-writing modes:
 *   brief       → analyse grant + org, return strategic writing brief (JSON)
 *   requirements → extract funder evaluation criteria from crawled page (JSON)
 *   section     → generate a single grant section (streaming text)
 *
 * Section mode streams raw text back to the client so the user sees live output.
 * Brief and requirements modes return standard JSON responses.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildProfileContext,
  buildCriteriaBlock,
  crawlUrl,
  getFunderTemplateBlock,
  getSemanticVaultBlock,
  getCompanyBlock,
  getLessonsBlock,
  getExamplesBlock,
} from "../_shared/grantContext.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("grant-write");

// ── Environment ───────────────────────────────────────────────────────────────

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY    = Deno.env.get("OPENAI_API_KEY")!;
const DEMO_COMPANY_ID   = Deno.env.get("DEMO_COMPANY_ID") ?? "demo";
const MODEL             = "gpt-4o-mini";

// ── CORS ──────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── OpenAI helpers ────────────────────────────────────────────────────────────

async function callOpenAIJson(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number,
): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
  const MAX_RETRIES = 2;
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        content:          data.choices?.[0]?.message?.content ?? "{}",
        promptTokens:     data.usage?.prompt_tokens     ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
      };
    }
    const errText = await res.text();
    lastErr = new Error(`OpenAI ${res.status}: ${errText.slice(0, 300)}`);
    if (![429, 500, 502, 503, 504].includes(res.status)) break;
  }
  throw lastErr ?? new Error("OpenAI request failed");
}

/**
 * Calls OpenAI with streaming=true and returns a ReadableStream of raw text chunks.
 * The caller returns this stream directly as the HTTP response body.
 */
function callOpenAIStream(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
          body: JSON.stringify({
            model: MODEL,
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            temperature,
            max_tokens: maxTokens,
            stream: true,
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          controller.error(new Error(`OpenAI ${res.status}: ${errText.slice(0, 200)}`));
          return;
        }
        const reader  = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6).trim();
            if (data === "[DONE]") { controller.close(); return; }
            try {
              const parsed = JSON.parse(data);
              const delta  = parsed.choices?.[0]?.delta?.content ?? "";
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch { /* skip malformed SSE chunk */ }
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });
}

// ── Usage logger ──────────────────────────────────────────────────────────────

function logUsage(
  db: ReturnType<typeof createClient>,
  feature: string,
  promptTokens: number,
  completionTokens: number,
) {
  const pricing = { input: 0.15, output: 0.60 }; // gpt-4o-mini per 1M tokens
  const costUsd  = (promptTokens / 1_000_000) * pricing.input + (completionTokens / 1_000_000) * pricing.output;
  void db.from("AiUsageLog").insert({
    companyId: DEMO_COMPANY_ID,
    model: MODEL,
    feature,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    costUsd,
  });
}

// ── Prompt constants ──────────────────────────────────────────────────────────

const WORD_TARGETS: Record<string, number>      = { concise: 150, standard: 300, detailed: 500 };
const MAX_TOKEN_TARGETS: Record<string, number> = { concise: 600, standard: 1200, detailed: 2000 };

const EMPHASIS_MAP: Record<string, { lead: string; suppress: string; keywords: string }> = {
  "Technology & Innovation":      { lead: "the technical solution, how it works, its novelty/differentiation, scalability, deployment approach, proof-of-concept evidence, and any IP or proprietary methodology", suppress: "anecdotal program stories, general community narrative, and capacity-building examples unrelated to the tech itself", keywords: "platform, algorithm, scalable, system, deploy, data pipeline, proof of concept, technical validation, interoperable" },
  "Research & Development":       { lead: "research questions, methodology, team credentials/publications, expected outcomes, how findings will be disseminated, and the gap in existing knowledge", suppress: "operational program detail, general community impact stories", keywords: "hypothesis, methodology, peer review, findings, evidence base, pilot study, R&D, commercialisation pathway" },
  "Training & Capacity Building": { lead: "curriculum design, learning outcomes, participant numbers, facilitator qualifications, assessment methods, and long-term skill retention evidence", suppress: "technology infrastructure detail, product roadmap, financial projections", keywords: "training, skills development, cohorts, modules, facilitators, accredited, certification, workforce capability" },
  "Community Development":        { lead: "community need evidence, co-design with community, partnerships, geographic reach, lived-experience voices, and measurable social outcomes", suppress: "technology stack, financial modelling, academic research framing", keywords: "grassroots, community-led, partnership, local, co-design, belonging, social cohesion, inclusion" },
  "Health & Wellbeing":           { lead: "clinical or wellbeing evidence, target population health needs, intervention approach, health outcome metrics, and alignment with public health priorities", suppress: "technology features without clinical validation, general capacity narrative", keywords: "health outcomes, evidence-based, clinical, wellbeing, prevention, early intervention, population health" },
  "Education & Youth":            { lead: "learning outcomes, age/cohort specifics, pedagogical approach, teacher/facilitator training, and measurable academic or developmental outcomes", suppress: "technology detail beyond pedagogy, adult workforce framing", keywords: "students, curriculum, pedagogy, learning outcomes, engagement, school, youth, early childhood" },
  "Environment & Sustainability": { lead: "environmental impact metrics, carbon/ecological baseline, measurable sustainability outcomes, circular economy principles, and scientific evidence", suppress: "social program stories unrelated to environmental outcomes", keywords: "emissions, biodiversity, circular economy, net zero, ecological, sustainability, regenerative, carbon offset" },
  "Economic Development":         { lead: "job creation, revenue growth potential, market opportunity, export readiness, supply-chain impact, and economic multiplier evidence", suppress: "community narrative, wellbeing framing not tied to economic outcomes", keywords: "jobs created, revenue, market opportunity, export, commercialisation, investment leverage, economic multiplier" },
  "Arts & Culture":               { lead: "artistic vision, cultural significance, audience reach, community cultural value, and the credentials/track record of key creatives", suppress: "technology or financial infrastructure detail", keywords: "artistic, cultural, creative, audience, heritage, expression, community engagement, cultural value" },
  "Housing & Infrastructure":     { lead: "housing need data, construction/delivery approach, partnership with planning/government bodies, affordability model, and tenancy outcomes", suppress: "technology innovation framing, health or education narrative", keywords: "housing supply, affordable, tenancy, infrastructure, planning, construction, social housing, amenity" },
  "Emergency Relief":             { lead: "immediacy of need, speed of response capability, geographic reach of emergency, coordination with official bodies, and accountability for rapid expenditure", suppress: "long-term program design, research framing", keywords: "emergency, rapid response, relief, crisis, coordination, immediate need, distribution, resilience" },
  "Diversity & Inclusion":        { lead: "representation data, systemic barriers being addressed, co-design with affected groups, intersectionality, and measurable equity outcomes", suppress: "technology product framing, general program volume statistics", keywords: "equity, inclusion, representation, intersectionality, belonging, cultural safety, accessible, barrier reduction" },
};

const SECTION_INSTRUCTIONS: Record<string, string> = {
  "Cover Letter":                    "Write a formal 1–3 paragraph cover letter addressed to the funder by name. Paragraph 1: who is applying and the amount requested. Paragraph 2: a snapshot of the project and why it aligns with the funder's priorities. Paragraph 3: professional close with contact invitation. Mirror the funder's own language. This is the first impression — make it count.",
  "Executive Summary":               "Write a concise overview of the entire proposal (often read first, written last). Cover: the need/problem, the proposed solution, the organisation's credibility, the funding ask, and the expected impact. Follow this arc: hook → problem → solution → org credibility → ask → impact. Max 250 words. Every sentence must earn its place.",
  "Organisational Background":       "Establish credibility. Cover: legal status and registration, founding story and mission, key programs and services delivered, team size and governance structure, notable achievements and milestones, past grants won and track record, and any relevant accreditations, partnerships, or endorsements. Write this to answer: 'Why should we trust this organisation to deliver?'",
  "Needs Statement":                 "This is the most persuasive section. Open with the gap, problem, or unmet need — NOT with the organisation. Use data, research, statistics, and real-world evidence to demonstrate urgency. Connect explicitly to the funder's stated priorities using their own language. Show the human impact of inaction. End by positioning the organisation as uniquely placed to solve it.",
  "Goals & Objectives":              "Write 2–3 broad goals (what you hope to achieve overall), then 4–6 SMART objectives beneath them (Specific, Measurable, Achievable, Relevant, Time-bound). Each objective must have: a clear outcome, a measurable KPI, a timeframe, and a responsible party. Format as a structured list. Use numbers and dates — never vague language.",
  "Project Description & Narrative": "The core of the proposal. Answer: who, what, when, where, why, and how. Cover: specific activities and their sequence, methodology and evidence base, implementation timeline tied to the grant's project duration, key milestones and deliverables, target beneficiaries and how they are reached, and any partners or collaborators. Be concrete and specific.",
  "Evaluation Plan":                 "Describe how you will measure whether the project succeeded. Cover: quantitative metrics tied to each objective, qualitative methods (surveys, interviews, case studies), data collection tools and frequency, who is responsible for evaluation, how findings will be reported to the funder, and whether any external evaluator is involved.",
  "Budget & Budget Narrative":       "Provide a detailed breakdown of all anticipated costs, then justify each line item. Categories: personnel (salaries, contractor fees), equipment and materials, travel and accommodation, overheads/indirect costs, evaluation costs, and any contingency. For each item explain what it is, why it is needed, and how the cost was calculated. Tie every dollar directly to a project activity.",
  "Sustainability Plan":             "Explain specifically how the project or its outcomes will continue after the grant period ends. Cover: revenue model, partnerships that will sustain the work, plans to scale or embed into ongoing operations, community ownership or handover plans, and any commitments already secured. Be concrete — 'we will seek further funding' is not a sustainability plan.",
  "Contact Details":                 "Provide the primary contact person for this grant application. Format as: Full Name, Position/Title, Organisation Name, Phone Number, Email Address, Mailing Address. If available, also include a secondary contact. Present in a clear, professional format suitable for a formal grant application.",
};

const FOCUS_CATEGORY_LIST = [
  "Training & Capacity Building", "Technology & Innovation", "Research & Development",
  "Community Development", "Health & Wellbeing", "Environment & Sustainability",
  "Education & Youth", "Arts & Culture", "Housing & Infrastructure",
  "Economic Development", "Emergency Relief", "Diversity & Inclusion", "Other",
].join(" | ");

// ── Context builders ──────────────────────────────────────────────────────────

function buildGrantContext(grant: Record<string, unknown>): string {
  const lines = [
    `Grant Name: ${grant.name}`,
    grant.founder        ? `Funder / Organisation: ${grant.founder}` : null,
    grant.amount         ? `Funding Amount: ${grant.amount}` : null,
    grant.geographicScope ? `Geographic Scope: ${grant.geographicScope}` : null,
    grant.eligibility    ? `Eligibility: ${grant.eligibility}` : null,
    grant.howToApply     ? `How to Apply: ${grant.howToApply}` : null,
    grant.projectDuration ? `Project Duration: ${grant.projectDuration}` : null,
    grant.notes          ? `Notes: ${grant.notes}` : null,
    grant.deadlineDate   ? `Deadline: ${grant.deadlineDate}` : null,
  ].filter(Boolean);
  const analysis = grant.aiAnalysis as Record<string, unknown> | null | undefined;
  if (analysis) {
    if (Array.isArray(analysis.strengths) && analysis.strengths.length > 0)
      lines.push(`\nAI-Identified Strengths:\n${(analysis.strengths as string[]).map((s) => `- ${s}`).join("\n")}`);
    if (Array.isArray(analysis.gaps) && analysis.gaps.length > 0)
      lines.push(`\nAI-Identified Gaps/Risks:\n${(analysis.gaps as string[]).map((g) => `- ${g}`).join("\n")}`);
  }
  return `## GRANT DETAILS\n${lines.join("\n")}`;
}

function buildGusiFacts(
  profile: Record<string, unknown> | null,
  company: { name: string; industry: string; website: string },
): string {
  if (!profile && !company.name) return "";
  const lines: string[] = [];
  lines.push(`Organisation Name: ${company.name}`);
  if (company.website)           lines.push(`Website: ${company.website}`);
  if (profile?.location)         lines.push(`Location: ${profile.location}${profile.country ? `, ${profile.country}` : ""}`);
  if (profile?.yearFounded)      lines.push(`Year Founded: ${profile.yearFounded}`);
  if (profile?.teamSize)         lines.push(`Team Size: ${profile.teamSize}`);
  if (profile?.orgType)          lines.push(`Organisation Type: ${profile.orgType}${profile.orgType2 ? ` / ${profile.orgType2}` : ""}`);
  if (profile?.sector)           lines.push(`Sector: ${profile.sector}${profile.subSector ? ` / ${profile.subSector}` : ""}`);
  if (profile?.stage)            lines.push(`Stage: ${profile.stage}`);
  if (profile?.annualRevenue)    lines.push(`Annual Revenue: ${profile.annualRevenue}`);
  if (profile?.isRegisteredCharity) lines.push("Registered Charity: Yes");
  if (profile?.womanOwned)       lines.push("Woman-owned: Yes");
  if (profile?.indigenousOwned)  lines.push("Indigenous-owned: Yes");
  const areas = profile?.focusAreas as string[] | null;
  if (areas?.length)             lines.push(`Focus Areas: ${areas.join(", ")}`);
  if (profile?.missionStatement) lines.push(`\nMission Statement:\n${profile.missionStatement}`);
  if (profile?.keyActivities)    lines.push(`\nKey Programs & Activities:\n${profile.keyActivities}`);
  if (profile?.uniqueStrengths)  lines.push(`\nUnique Strengths & Differentiators:\n${profile.uniqueStrengths}`);
  if (profile?.pastGrantsWon)    lines.push(`\nPast Grants Won:\n${profile.pastGrantsWon}`);
  const contacts = profile?.contacts as { name: string; role?: string; email?: string }[] | null;
  if (contacts?.length) {
    lines.push(`\nFounders / Key Contacts:`);
    contacts.forEach((c) => lines.push(`  - ${[c.name, c.role, c.email].filter(Boolean).join(" | ")}`));
  } else if (profile?.contactName) {
    lines.push(`\nPrimary Contact: ${profile.contactName}${profile.contactRole ? `, ${profile.contactRole}` : ""}`);
  }
  const notDocumented: string[] = [];
  if (!profile?.keyActivities)  notDocumented.push("specific learner/beneficiary counts");
  if (!profile?.annualRevenue)  notDocumented.push("annual revenue or financials");
  if (!profile?.teamSize)       notDocumented.push("exact team size");
  if (!profile?.pastGrantsWon)  notDocumented.push("specific past grants or funding history");
  if (notDocumented.length > 0) {
    lines.push(`\n⚠ NOT DOCUMENTED (do NOT invent these — describe qualitatively or omit):\n${notDocumented.map((x) => `- ${x}`).join("\n")}`);
  }
  return `## GUSI FACTS — USE THESE BY NAME IN EVERY SECTION\nGround your writing in these specifics:\n\n${lines.join("\n")}`;
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── Auth ───────────────────────────────────────────────────────────────
    const authHeader   = req.headers.get("authorization") ?? "";
    const isServiceCall = authHeader === `Bearer ${SERVICE_ROLE_KEY}`;
    if (!isServiceCall) {
      const token = authHeader.replace("Bearer ", "").trim();
      if (token.length < 10) return json({ error: "Unauthorized" }, 401);
    }

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ── Parse body ─────────────────────────────────────────────────────────
    const body = await req.json();
    const { grantId, mode } = body as Record<string, unknown>;
    if (!grantId || typeof grantId !== "string") return json({ error: "grantId required" }, 400);
    if (!mode || !["brief", "requirements", "section"].includes(mode as string))
      return json({ error: "mode must be brief | requirements | section" }, 400);

    // ── Parallel data fetch ────────────────────────────────────────────────
    const [grantRes, profileRes, company] = await Promise.all([
      db.from("Grant").select("*").eq("id", grantId).maybeSingle(),
      db.from("GrantProfile").select("*").eq("companyId", DEMO_COMPANY_ID).maybeSingle(),
      getCompanyBlock(db, DEMO_COMPANY_ID),
    ]);
    if (!grantRes.data) return json({ error: "Grant not found" }, 404);
    const grant   = grantRes.data as Record<string, unknown>;
    const profile = profileRes.data as Record<string, unknown> | null;

    const crawledContent = grant.url ? await crawlUrl(grant.url as string, 12000) : "";

    // ── MODE: requirements ─────────────────────────────────────────────────
    if (mode === "requirements") {
      if (!crawledContent || crawledContent.length < 100) {
        return json({ success: true, requirements: { criteria: [], wordLimits: {}, evaluationRubric: [], mandatoryRequirements: [] }, note: "No crawled content — requirements could not be extracted." });
      }
      const sysPrompt = `You are a grant requirements analyst. Extract structured application requirements from the grant page content provided.\n\nReturn ONLY valid JSON:\n{\n  "criteria": ["<evaluation criterion 1>"],\n  "wordLimits": { "<Section Name>": <word limit as number> },\n  "evaluationRubric": ["<rubric item>"],\n  "mandatoryRequirements": ["<hard requirement>"]\n}\n\nRULES:\n- criteria: things the funder will assess — extract from headings, scoring guides, FAQs. Up to 12.\n- wordLimits: only include if explicit limits are mentioned.\n- evaluationRubric: scoring weights if mentioned.\n- mandatoryRequirements: eligibility hard gates.\n- Never invent criteria not present in the text.`;
      const usrPrompt = `Extract grant requirements from this page.\nGrant: ${grant.name}\nFunder: ${grant.founder ?? "Unknown"}\n\nPAGE CONTENT:\n${crawledContent.slice(0, 12000)}`;
      let requirements: Record<string, unknown> = { criteria: [], wordLimits: {}, evaluationRubric: [], mandatoryRequirements: [] };
      try {
        const result = await callOpenAIJson(sysPrompt, usrPrompt, 800, 0);
        logUsage(db, "grants_requirements", result.promptTokens, result.completionTokens);
        requirements = JSON.parse(result.content);
      } catch { /* return empty on failure */ }
      await db.from("Grant").update({ aiRequirements: requirements, updatedAt: new Date().toISOString() }).eq("id", grantId);
      return json({ success: true, requirements });
    }

    // ── Fetch remaining context (shared by brief + section) ────────────────
    const [examplesBlock, funderTemplateBlock, lessonsBlock] = await Promise.all([
      getExamplesBlock(db, DEMO_COMPANY_ID, mode === "section" ? (body.section as string | undefined) : undefined),
      getFunderTemplateBlock(db, DEMO_COMPANY_ID, (grant.founder as string | null) ?? null),
      getLessonsBlock(db, DEMO_COMPANY_ID, "grant"),
    ]);

    const profileBlock  = profile ? buildProfileContext(profile) : "";
    const grantBlock    = buildGrantContext(grant);
    const gusiFactsBlock = buildGusiFacts(profile, company);

    const masterContext = [
      grantBlock,
      gusiFactsBlock,
      profileBlock,
      funderTemplateBlock,
      company.block,
      lessonsBlock,
      crawledContent ? `## LIVE GRANT PAGE CONTENT (crawled from ${grant.url})\n${crawledContent}` : "",
    ].filter(Boolean).join("\n\n");

    // ── Date context ───────────────────────────────────────────────────────
    const now        = new Date();
    const todayStr   = now.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const deadlineDateStr = grant.deadlineDate
      ? (() => {
          const d    = new Date(grant.deadlineDate as string);
          const days = Math.ceil((d.getTime() - now.getTime()) / 86400000);
          const fmt  = d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
          if (days < 0) return `${fmt} (EXPIRED ${Math.abs(days)} days ago)`;
          if (days === 0) return `${fmt} (Due TODAY)`;
          return `${fmt} (${days} days from today)`;
        })()
      : "Not specified";
    const dateContextBlock = `## DATE CONTEXT — CRITICAL\nToday's Date: ${todayStr}\nGrant Deadline: ${deadlineDateStr}${grant.projectDuration ? `\nProject Duration: ${grant.projectDuration}` : ""}\n\nDATE RULES:\n- All future dates MUST be calculated from today (${todayStr})\n- Never reference any date in the past as if it is upcoming\n- For timelines, calculate real calendar dates using today as Month 1\n- Never invent a year — use the actual current year (${now.getFullYear()}) and near-future years only`;

    // ── MODE: brief ────────────────────────────────────────────────────────
    if (mode === "brief") {
      const sysPrompt = `You are a senior grant writing strategist. Analyse the grant and organisation data and produce a strategic writing brief.${examplesBlock ? "\n\nYou have been given reference examples of real grant applications. Study their tone, structure, and specificity to inform your brief." : ""}\n\nReturn ONLY valid JSON — no markdown, no explanation:\n{\n  "funderPriorities": ["<priority 1>", "<priority 2>", "<priority 3>"],\n  "keyThemes": ["<theme 1>", "<theme 2>"],\n  "eligibilityStrengths": ["<strength 1>", "<strength 2>"],\n  "eligibilityRisks": ["<risk 1>", "<risk 2>"],\n  "suggestedAsk": "<amount or range to request>",\n  "toneGuidance": "<brief style guidance for this specific funder>",\n  "winningAngle": "<the single most compelling narrative angle — 1-2 sentences>",\n  "keywordsToUse": ["<funder keyword 1>", "<funder keyword 2>", "<funder keyword 3>"],\n  "focusArea": {\n    "primary": "<one of: ${FOCUS_CATEGORY_LIST}>",\n    "tags": ["<specific sub-topic 1>", "<specific sub-topic 2>", "<specific sub-topic 3>"]\n  }\n}\n\nfocusArea rules:\n- primary: pick exactly ONE category from the list that best describes what this grant funds\n- tags: 2–4 short, specific sub-topics relevant to this grant\n- Base detection on the grant name, funder description, eligibility criteria, and crawled page content`;
      const usrPrompt = `Analyse this grant opportunity and organisation profile, then produce the strategic writing brief.\n\n${dateContextBlock}\n\n${masterContext}${examplesBlock ? `\n\n${examplesBlock}` : ""}`;
      const result = await callOpenAIJson(sysPrompt, usrPrompt, 600, 0.2);
      logUsage(db, "grants_write_brief", result.promptTokens, result.completionTokens);
      let brief: Record<string, unknown>;
      try { brief = JSON.parse(result.content); }
      catch { return json({ error: "AI returned invalid brief JSON" }, 500); }
      await db.from("Grant").update({ aiBrief: brief, updatedAt: new Date().toISOString() }).eq("id", grantId);
      return json({ success: true, brief, grantName: grant.name });
    }

    // ── MODE: section ──────────────────────────────────────────────────────
    const {
      section,
      brief,
      tone             = "first_person",
      length           = "standard",
      previousSections = {},
      customInstructions,
      regenNote,
      requirements,
    } = body as {
      section: string;
      brief: Record<string, unknown>;
      tone?: string;
      length?: string;
      previousSections?: Record<string, string>;
      customInstructions?: string;
      regenNote?: string;
      requirements?: Record<string, unknown>;
    };

    if (!section) return json({ error: "section required in section mode" }, 400);
    if (!brief)   return json({ error: "brief required in section mode" }, 400);

    // ── Contact Details: assembled directly from profile, no AI ───────────
    if (section === "Contact Details") {
      const contacts = (profile?.contacts as { name: string; role?: string; email?: string; phone?: string }[] | null);
      const lines: string[] = [];
      if (contacts?.length) {
        contacts.forEach((c, i) => {
          lines.push(i === 0 ? "PRIMARY CONTACT" : `ADDITIONAL CONTACT ${i + 1}`);
          lines.push(`Name: ${c.name}`);
          if (c.role)  lines.push(`Position: ${c.role}`);
          if (c.email) lines.push(`Email: ${c.email}`);
          if (c.phone) lines.push(`Phone: ${c.phone}`);
          lines.push("");
        });
      } else {
        if (profile?.contactName)    lines.push(`Name: ${profile.contactName}`);
        if (profile?.contactRole)    lines.push(`Position: ${profile.contactRole}`);
        if (profile?.contactEmail)   lines.push(`Email: ${profile.contactEmail}`);
        if (profile?.contactPhone)   lines.push(`Phone: ${profile.contactPhone}`);
        if (profile?.contactAddress) lines.push(`Address: ${profile.contactAddress}`);
      }
      const content = lines.filter(Boolean).join("\n").trim()
        || "Please complete your Grant Profile contact details to populate this section.";
      return new Response(content, {
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // ── Semantic vault for this section ────────────────────────────────────
    const vaultBlock = await getSemanticVaultBlock(
      db, DEMO_COMPANY_ID,
      `${grant.name as string} ${section} ${(brief.keyThemes as string[] | undefined)?.join(" ") ?? ""}`,
      OPENAI_API_KEY,
    );

    // Override masterContext's basic vault with semantic version
    const sectionMasterContext = [
      grantBlock, gusiFactsBlock, profileBlock, funderTemplateBlock, company.block,
      lessonsBlock, vaultBlock,
      crawledContent ? `## LIVE GRANT PAGE CONTENT (crawled from ${grant.url})\n${crawledContent}` : "",
    ].filter(Boolean).join("\n\n");

    const wordTarget  = WORD_TARGETS[length]      ?? 300;
    const maxTokens   = MAX_TOKEN_TARGETS[length]  ?? 1200;
    const toneInstruction = tone === "first_person"
      ? 'Write in first person ("We are…", "Our organisation…", "We will…")'
      : 'Write in third person ("The organisation is…", "The team will…")';

    // ── Criteria / requirements block ──────────────────────────────────────
    const reqObj = requirements ?? (grant.aiRequirements as Record<string, unknown> | null) ?? {};
    const criteriaBlock = buildCriteriaBlock({
      criteria:             (reqObj.criteria             as string[] | undefined) ?? [],
      evaluationRubric:     (reqObj.evaluationRubric     as string[] | undefined) ?? [],
      mandatoryRequirements: (reqObj.mandatoryRequirements as string[] | undefined) ?? [],
    });

    // ── Focus emphasis block ───────────────────────────────────────────────
    const focusAreaObj = brief.focusArea as { primary?: string; tags?: string[] } | undefined;
    const focusPrimary = focusAreaObj?.primary?.trim();
    const focusTags    = focusAreaObj?.tags?.filter(Boolean) ?? [];
    const emphasisRule = focusPrimary ? EMPHASIS_MAP[focusPrimary] : null;
    const focusEmphasisBlock = emphasisRule
      ? `\n\n## CONTENT EMPHASIS FOR THIS GRANT TYPE: ${focusPrimary}${focusTags.length > 0 ? ` (${focusTags.join(", ")})` : ""}\nLEAD WITH: ${emphasisRule.lead}\nSUPPRESS OR MINIMISE: ${emphasisRule.suppress}\nUSE THESE DOMAIN KEYWORDS: ${emphasisRule.keywords}\nThis is a ${focusPrimary} grant — every paragraph should reinforce this framing.`
      : "";

    const suggestedAsk = (brief.suggestedAsk as string | undefined)?.trim() || null;
    const briefBlock = `## STRATEGIC WRITING BRIEF${suggestedAsk ? `\n⚠ REQUESTED FUNDING AMOUNT (LOCKED): ${suggestedAsk} — every section MUST use this exact figure.` : ""}
Funder Priorities: ${(brief.funderPriorities as string[] | undefined)?.join(", ") ?? "N/A"}
Key Themes: ${(brief.keyThemes as string[] | undefined)?.join(", ") ?? "N/A"}
Winning Angle: ${brief.winningAngle ?? "N/A"}
Tone Guidance: ${brief.toneGuidance ?? "N/A"}
Keywords to use: ${(brief.keywordsToUse as string[] | undefined)?.join(", ") ?? "N/A"}
Eligibility Strengths: ${(brief.eligibilityStrengths as string[] | undefined)?.join(", ") ?? "N/A"}
Eligibility Risks to address: ${(brief.eligibilityRisks as string[] | undefined)?.join(", ") ?? "N/A"}${criteriaBlock ? `\n\n${criteriaBlock}` : ""}`;

    // ── Previously written sections (anti-repetition context) ──────────────
    let prevSectionsBlock = "";
    if (previousSections && Object.keys(previousSections).length > 0) {
      const entries = Object.entries(previousSections).map(([name, text]) => {
        const words   = text.trim().split(/\s+/).length;
        const preview = text.slice(0, 2500).trim();
        return `### ${name} (${words} words)\n${preview}${text.length > 2500 ? "…" : ""}`;
      });
      prevSectionsBlock = `\n\n## PREVIOUSLY WRITTEN SECTIONS\nCRITICAL — do NOT reuse any statistic, dollar figure, program name, achievement, or anecdote that already appears here. Each section must introduce only new information.\n${entries.join("\n\n")}`;
    }

    const systemPrompt = `You are a professional grant writer with 15 years of experience winning competitive grants. You write compelling, specific, evidence-based applications that speak directly to funders' priorities.

WRITING RULES:
- ${toneInstruction}
- MAXIMUM word count: ${wordTarget} words — stop the moment your point is made. Never pad or repeat to reach a length.
- Mirror the funder's own language and keywords back to them
- Be specific — names, numbers, dates, outcomes — never vague
- Every claim must be grounded in the data provided
- Do NOT use generic grant-writing clichés ("passionate about", "committed to excellence")
- Write flowing prose, not bullet points (unless the section calls for a list)
- This section will be read by a grant assessor — make it easy to assess against criteria${focusEmphasisBlock}
- NO REPETITION: every statistic, achievement, or example may appear in only ONE section
- DATE ACCURACY (critical): all dates and timelines must be grounded in the DATE CONTEXT block — never use past dates as future ones, never guess a year
- NUMBERS INTEGRITY (critical): never invent specific figures unless explicitly stated in the GUSI FACTS, vault, or profile. If a number is not documented, describe impact qualitatively or state data collection is underway${suggestedAsk ? `
- FUNDING CONSISTENCY (critical): The total funding request is ${suggestedAsk}. Every section must state this same figure. Never reference a different amount.${section === "Budget & Budget Narrative" ? ` For this Budget section, all line items MUST sum exactly to ${suggestedAsk}.` : ""}` : ""}${examplesBlock ? "\n- Study the REFERENCE EXAMPLES provided — match their quality, specificity, and professional tone. Do NOT copy them directly." : ""}${customInstructions ? `\n\nPERMANENT SECTION INSTRUCTIONS (applied every time this section is generated — follow closely):\n${customInstructions}` : ""}${regenNote ? `\n\nONE-SHOT REGEN NOTE (for this regeneration only — override or extend the permanent instructions above as needed):\n${regenNote}` : ""}`;

    const userPrompt = `Write the "${section}" section of this grant application.

SECTION INSTRUCTIONS:
${SECTION_INSTRUCTIONS[section] ?? "Write a professional, evidence-based section for this grant application."}

${dateContextBlock}

${briefBlock}

FULL CONTEXT:
${sectionMasterContext}

Write only the section content — no heading, no preamble. Just the prose.
IMPORTANT: Reference the organisation by its real name, mention specific programs, real team members, and real achievements from the GUSI FACTS block.${examplesBlock ? `\n\n${examplesBlock}` : ""}${prevSectionsBlock}`;

    // ── Stream response ────────────────────────────────────────────────────
    log.info("Streaming section", { section, grantId: grantId.slice(0, 8) });
    const stream = callOpenAIStream(systemPrompt, userPrompt, maxTokens, 0.45);
    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });

  } catch (err) {
    log.error("Unhandled error", { error: String(err), stack: err instanceof Error ? err.stack : undefined });
    return json({ error: String(err) }, 500);
  }
});

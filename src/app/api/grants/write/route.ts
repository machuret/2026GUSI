export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { callOpenAIWithUsage, MODEL_CONFIG } from "@/lib/openai";
import { logAiUsage } from "@/lib/aiUsage";
import { getCompanyContext, getVaultContext } from "@/lib/aiContext";
import { stripHtml } from "@/lib/htmlUtils";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const SECTIONS = [
  "Cover Letter",
  "Executive Summary",
  "Organisational Background",
  "Needs Statement",
  "Goals & Objectives",
  "Project Description & Narrative",
  "Evaluation Plan",
  "Budget & Budget Narrative",
  "Sustainability Plan",
  "Appendices & Supporting Documents",
] as const;

type Section = typeof SECTIONS[number];

const briefSchema = z.object({
  grantId: z.string().min(1),
  mode: z.literal("brief"),
});

const sectionSchema = z.object({
  grantId: z.string().min(1),
  mode: z.literal("section"),
  section: z.enum(SECTIONS),
  brief: z.record(z.unknown()),
  tone: z.enum(["first_person", "third_person"]).default("first_person"),
  length: z.enum(["concise", "standard", "detailed"]).default("standard"),
});

const bodySchema = z.discriminatedUnion("mode", [briefSchema, sectionSchema]);

const WORD_TARGETS: Record<string, number> = {
  concise: 150,
  standard: 300,
  detailed: 500,
};

const SECTION_INSTRUCTIONS: Record<Section, string> = {
  "Cover Letter": "Write a formal 1–3 paragraph cover letter addressed to the funder by name. Paragraph 1: who is applying and the amount requested. Paragraph 2: a snapshot of the project and why it aligns with the funder's priorities. Paragraph 3: professional close with contact invitation. Mirror the funder's own language. This is the first impression — make it count.",
  "Executive Summary": "Write a concise overview of the entire proposal (often read first, written last). Cover: the need/problem, the proposed solution, the organisation's credibility, the funding ask, and the expected impact. Follow this arc: hook → problem → solution → org credibility → ask → impact. Max 250 words. Every sentence must earn its place.",
  "Organisational Background": "Establish credibility. Cover: legal status and registration (ABN, charity status, etc.), founding story and mission, key programs and services delivered, team size and governance structure, notable achievements and milestones, past grants won and track record, and any relevant accreditations, partnerships, or endorsements. Write this to answer: 'Why should we trust this organisation to deliver?'",
  "Needs Statement": "This is the most persuasive section. Open with the gap, problem, or unmet need — NOT with the organisation. Use data, research, statistics, and real-world evidence to demonstrate urgency. Connect explicitly to the funder's stated priorities using their own language. Show the human impact of inaction. End by positioning the organisation as uniquely placed to solve it. Never assume the funder already knows the problem.",
  "Goals & Objectives": "Write 2–3 broad goals (what you hope to achieve overall), then 4–6 SMART objectives beneath them (Specific, Measurable, Achievable, Relevant, Time-bound). Each objective must have: a clear outcome, a measurable KPI, a timeframe, and a responsible party. Format as a structured list. Avoid vague language like 'improve' or 'increase' — use numbers and dates.",
  "Project Description & Narrative": "The core of the proposal. Answer: who, what, when, where, why, and how. Cover: specific activities and their sequence, methodology and evidence base, implementation timeline tied to the grant's project duration, key milestones and deliverables, target beneficiaries and how they are reached, and any partners or collaborators. Be concrete and specific — assessors score on detail. Avoid jargon.",
  "Evaluation Plan": "Describe how you will measure whether the project succeeded. Cover: quantitative metrics (numbers, percentages, counts) tied to each objective, qualitative methods (surveys, interviews, case studies), data collection tools and frequency, who is responsible for evaluation, how findings will be reported to the funder, and whether any external evaluator is involved. Show rigour and accountability.",
  "Budget & Budget Narrative": "Provide a detailed breakdown of all anticipated costs, then justify each line item. Categories: personnel (salaries, contractor fees), equipment and materials, travel and accommodation, overheads/indirect costs, evaluation costs, and any contingency. For each item explain: what it is, why it is needed, how the cost was calculated. Show any co-contributions or in-kind support. Tie every dollar directly to a project activity. Demonstrate value for money.",
  "Sustainability Plan": "Explain specifically how the project or its outcomes will continue after the grant period ends. Cover: revenue model (earned income, future grants, government contracts, membership fees), partnerships that will sustain the work, plans to scale or embed into ongoing operations, community ownership or handover plans, and any commitments already secured. Be concrete — 'we will seek further funding' is not a sustainability plan.",
  "Appendices & Supporting Documents": "List and briefly describe the supporting documents that accompany this application. Common appendices include: organisational chart, key staff biosketches (1 page each), letters of support from partners or community, evidence of legal status (ABN, charity registration, incorporation), audited financial statements, board member list, relevant research or data cited in the proposal, and any required forms. Note which documents are attached and what each demonstrates.",
};

async function crawlGrantUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    return stripHtml(html).slice(0, 8000);
  } catch {
    return "";
  }
}

function buildGrantContext(grant: Record<string, unknown>): string {
  const lines = [
    `Grant Name: ${grant.name}`,
    grant.founder ? `Funder / Organisation: ${grant.founder}` : null,
    grant.amount ? `Funding Amount: ${grant.amount}` : null,
    grant.geographicScope ? `Geographic Scope: ${grant.geographicScope}` : null,
    grant.eligibility ? `Eligibility: ${grant.eligibility}` : null,
    grant.howToApply ? `How to Apply: ${grant.howToApply}` : null,
    grant.projectDuration ? `Project Duration: ${grant.projectDuration}` : null,
    grant.notes ? `Notes: ${grant.notes}` : null,
    grant.aiVerdict ? `AI Fit Verdict: ${grant.aiVerdict}` : null,
    grant.fitScore != null ? `Fit Score: ${grant.fitScore}/5` : null,
    grant.matchScore != null ? `Profile Match Score: ${grant.matchScore}/100` : null,
    grant.complexityLabel ? `Application Complexity: ${grant.complexityLabel}` : null,
  ].filter(Boolean);
  return `## GRANT DETAILS\n${lines.join("\n")}`;
}

function buildProfileContext(profile: Record<string, unknown>): string {
  const lines = [
    profile.orgType ? `Organisation Type: ${profile.orgType}` : null,
    profile.sector ? `Sector: ${profile.sector}${profile.subSector ? ` / ${profile.subSector}` : ""}` : null,
    profile.stage ? `Stage: ${profile.stage}` : null,
    profile.teamSize ? `Team Size: ${profile.teamSize}` : null,
    profile.annualRevenue ? `Annual Revenue: ${profile.annualRevenue}` : null,
    profile.location ? `Location: ${profile.location}, ${profile.country ?? "Australia"}` : null,
    profile.yearFounded ? `Year Founded: ${profile.yearFounded}` : null,
    (profile.focusAreas as string[] | null)?.length ? `Focus Areas: ${(profile.focusAreas as string[]).join(", ")}` : null,
    profile.isRegisteredCharity ? `Registered Charity: Yes` : null,
    profile.indigenousOwned ? `Indigenous-owned: Yes` : null,
    profile.womanOwned ? `Woman-owned: Yes` : null,
    profile.regionalOrRural ? `Regional/Rural: Yes` : null,
    profile.missionStatement ? `\nMission Statement:\n${profile.missionStatement}` : null,
    profile.keyActivities ? `\nKey Activities:\n${profile.keyActivities}` : null,
    profile.uniqueStrengths ? `\nUnique Strengths:\n${profile.uniqueStrengths}` : null,
    profile.pastGrantsWon ? `\nPast Grants Won:\n${profile.pastGrantsWon}` : null,
  ].filter(Boolean);
  return `## GRANT PROFILE\n${lines.join("\n")}`;
}

export async function POST(req: NextRequest) {
  try {
    const { user: authUser, response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { grantId, mode } = parsed.data;

    // ── Parallel data fetch ────────────────────────────────────────────────
    const [
      { data: grant, error: grantErr },
      { data: profile },
      company,
      vault,
    ] = await Promise.all([
      db.from("Grant").select("*").eq("id", grantId).maybeSingle(),
      db.from("GrantProfile").select("*").eq("companyId", DEMO_COMPANY_ID).maybeSingle(),
      getCompanyContext(DEMO_COMPANY_ID),
      getVaultContext(DEMO_COMPANY_ID),
    ]);

    if (grantErr || !grant) {
      return NextResponse.json({ error: "Grant not found" }, { status: 404 });
    }

    // ── Crawl grant URL if available ───────────────────────────────────────
    let crawledContent = "";
    if (grant.url) {
      crawledContent = await crawlGrantUrl(grant.url as string);
    }

    // ── Assemble master context block ──────────────────────────────────────
    const contextParts: string[] = [
      buildGrantContext(grant as Record<string, unknown>),
      profile ? buildProfileContext(profile as Record<string, unknown>) : "",
      company.block,
      vault.block,
      crawledContent
        ? `## LIVE GRANT PAGE CONTENT (crawled from ${grant.url})\nUse this to understand the funder's current language, priorities, and criteria:\n\n${crawledContent}`
        : "",
    ].filter(Boolean);

    const masterContext = contextParts.join("\n\n");

    // ── MODE: brief ────────────────────────────────────────────────────────
    if (mode === "brief") {
      const systemPrompt = `You are a senior grant writing strategist. Analyse the grant and organisation data provided and produce a strategic writing brief that will guide the entire application.

Return ONLY valid JSON — no markdown, no explanation:
{
  "funderPriorities": ["<priority 1>", "<priority 2>", "<priority 3>"],
  "keyThemes": ["<theme 1>", "<theme 2>"],
  "eligibilityStrengths": ["<strength 1>", "<strength 2>"],
  "eligibilityRisks": ["<risk 1>", "<risk 2>"],
  "suggestedAsk": "<amount or range to request>",
  "toneGuidance": "<brief style guidance for this specific funder>",
  "winningAngle": "<the single most compelling narrative angle for this application — 1-2 sentences>",
  "keywordsToUse": ["<funder keyword 1>", "<funder keyword 2>", "<funder keyword 3>"]
}`;

      const userPrompt = `Analyse this grant opportunity and organisation profile, then produce the strategic writing brief.\n\n${masterContext}`;

      const result = await callOpenAIWithUsage({
        systemPrompt,
        userPrompt,
        model: MODEL_CONFIG.grantsWrite,
        maxTokens: 600,
        temperature: 0.2,
        jsonMode: true,
      });

      logAiUsage({
        model: MODEL_CONFIG.grantsWrite,
        feature: "grants_write_brief",
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        userId: authUser?.id,
      });

      let brief: Record<string, unknown>;
      try {
        brief = JSON.parse(result.content);
      } catch {
        return NextResponse.json({ error: "AI returned invalid brief JSON" }, { status: 500 });
      }

      return NextResponse.json({ success: true, brief, grantName: grant.name });
    }

    // ── MODE: section ──────────────────────────────────────────────────────
    const { section, brief, tone, length } = parsed.data as z.infer<typeof sectionSchema>;
    const wordTarget = WORD_TARGETS[length];
    const toneInstruction = tone === "first_person"
      ? 'Write in first person ("We are…", "Our organisation…", "We will…")'
      : 'Write in third person ("The organisation is…", "The team will…")';

    const briefBlock = `## STRATEGIC WRITING BRIEF\nFunder Priorities: ${(brief.funderPriorities as string[] | undefined)?.join(", ") ?? "N/A"}
Key Themes: ${(brief.keyThemes as string[] | undefined)?.join(", ") ?? "N/A"}
Winning Angle: ${brief.winningAngle ?? "N/A"}
Tone Guidance: ${brief.toneGuidance ?? "N/A"}
Keywords to use: ${(brief.keywordsToUse as string[] | undefined)?.join(", ") ?? "N/A"}
Eligibility Strengths: ${(brief.eligibilityStrengths as string[] | undefined)?.join(", ") ?? "N/A"}
Eligibility Risks to address: ${(brief.eligibilityRisks as string[] | undefined)?.join(", ") ?? "N/A"}`;

    const systemPrompt = `You are a professional grant writer with 15 years of experience winning competitive grants. You write compelling, specific, evidence-based applications that speak directly to funders' priorities.

WRITING RULES:
- ${toneInstruction}
- Target word count: ~${wordTarget} words for this section
- Mirror the funder's own language and keywords back to them
- Be specific — names, numbers, dates, outcomes — never vague
- Every claim must be grounded in the data provided
- Do NOT use generic grant-writing clichés ("passionate about", "committed to excellence")
- Write flowing prose, not bullet points (unless the section calls for a list)
- This section will be read by a grant assessor — make it easy to assess against criteria`;

    const userPrompt = `Write the "${section}" section of this grant application.

SECTION INSTRUCTIONS:
${SECTION_INSTRUCTIONS[section]}

${briefBlock}

FULL CONTEXT:
${masterContext}

Write only the section content — no heading, no preamble, no "Here is the section:" intro. Just the prose.`;

    const result = await callOpenAIWithUsage({
      systemPrompt,
      userPrompt,
      model: MODEL_CONFIG.grantsWrite,
      maxTokens: 1200,
      temperature: 0.45,
      jsonMode: false,
    });

    logAiUsage({
      model: MODEL_CONFIG.grantsWrite,
      feature: `grants_write_${section.toLowerCase().replace(/[^a-z]/g, "_")}`,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      userId: authUser?.id,
    });

    const content = result.content.trim();
    const wordCount = content.split(/\s+/).filter(Boolean).length;

    return NextResponse.json({ success: true, section, content, wordCount });
  } catch (err) {
    return handleApiError(err, "Grant Write");
  }
}

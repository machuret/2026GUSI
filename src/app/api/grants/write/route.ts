export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { callOpenAIWithUsage, MODEL_CONFIG } from "@/lib/openai";
import { logAiUsage } from "@/lib/aiUsage";
import { getCompanyContext, getVaultContext, getLessonsContext } from "@/lib/aiContext";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { crawlGrantUrl, buildProfileContext } from "@/lib/grantCrawl";
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
  "Contact Details",
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
  previousSections: z.record(z.string()).optional(),
  customInstructions: z.string().optional(),
});

const bodySchema = z.discriminatedUnion("mode", [briefSchema, sectionSchema]);

const WORD_TARGETS: Record<string, number> = {
  concise: 150,
  standard: 300,
  detailed: 500,
};

const MAX_TOKEN_TARGETS: Record<string, number> = {
  concise: 600,
  standard: 1200,
  detailed: 2000,
};

const SECTION_INSTRUCTIONS: Record<Section, string> = {
  "Cover Letter": "Write a formal 1–3 paragraph cover letter addressed to the funder by name. Paragraph 1: who is applying and the amount requested. Paragraph 2: a snapshot of the project and why it aligns with the funder's priorities. Paragraph 3: professional close with contact invitation. Mirror the funder's own language. This is the first impression — make it count.",
  "Executive Summary": "Write a concise overview of the entire proposal (often read first, written last). Cover: the need/problem, the proposed solution, the organisation's credibility, the funding ask, and the expected impact. Follow this arc: hook → problem → solution → org credibility → ask → impact. Max 250 words. Every sentence must earn its place.",
  "Organisational Background": "Establish credibility. Cover: legal status and registration (e.g. 501(c)(3) status, state incorporation), founding story and mission, key programs and services delivered, team size and governance structure, notable achievements and milestones, past grants won and track record, and any relevant accreditations, partnerships, or endorsements. Write this to answer: 'Why should we trust this organisation to deliver?'",
  "Needs Statement": "This is the most persuasive section. Open with the gap, problem, or unmet need — NOT with the organisation. Use data, research, statistics, and real-world evidence to demonstrate urgency. Connect explicitly to the funder's stated priorities using their own language. Show the human impact of inaction. End by positioning the organisation as uniquely placed to solve it. Never assume the funder already knows the problem.",
  "Goals & Objectives": "Write 2–3 broad goals (what you hope to achieve overall), then 4–6 SMART objectives beneath them (Specific, Measurable, Achievable, Relevant, Time-bound). Each objective must have: a clear outcome, a measurable KPI, a timeframe, and a responsible party. Format as a structured list. Avoid vague language like 'improve' or 'increase' — use numbers and dates.",
  "Project Description & Narrative": "The core of the proposal. Answer: who, what, when, where, why, and how. Cover: specific activities and their sequence, methodology and evidence base, implementation timeline tied to the grant's project duration, key milestones and deliverables, target beneficiaries and how they are reached, and any partners or collaborators. Be concrete and specific — assessors score on detail. Avoid jargon.",
  "Evaluation Plan": "Describe how you will measure whether the project succeeded. Cover: quantitative metrics (numbers, percentages, counts) tied to each objective, qualitative methods (surveys, interviews, case studies), data collection tools and frequency, who is responsible for evaluation, how findings will be reported to the funder, and whether any external evaluator is involved. Show rigour and accountability.",
  "Budget & Budget Narrative": "Provide a detailed breakdown of all anticipated costs, then justify each line item. Categories: personnel (salaries, contractor fees), equipment and materials, travel and accommodation, overheads/indirect costs, evaluation costs, and any contingency. For each item explain: what it is, why it is needed, how the cost was calculated. Show any co-contributions or in-kind support. Tie every dollar directly to a project activity. Demonstrate value for money.",
  "Sustainability Plan": "Explain specifically how the project or its outcomes will continue after the grant period ends. Cover: revenue model (earned income, future grants, government contracts, membership fees), partnerships that will sustain the work, plans to scale or embed into ongoing operations, community ownership or handover plans, and any commitments already secured. Be concrete — 'we will seek further funding' is not a sustainability plan.",
  "Contact Details": "Provide the primary contact person for this grant application. Format as: Full Name, Position/Title, Organisation Name, Phone Number, Email Address, Mailing Address. If available, also include a secondary contact. Use the organisation details from the company profile. Present the information in a clear, professional format suitable for a formal grant application.",
};

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
    grant.aiScore != null ? `AI Score: ${grant.aiScore}/100` : null,
    grant.matchScore != null ? `Profile Match Score: ${grant.matchScore}/100` : null,
    grant.complexityLabel ? `Application Complexity: ${grant.complexityLabel}` : null,
    grant.deadlineDate ? `Deadline: ${grant.deadlineDate}` : null,
  ].filter(Boolean);

  // Include AI analysis strengths/gaps if available
  const analysis = grant.aiAnalysis as Record<string, unknown> | null | undefined;
  if (analysis) {
    if (Array.isArray(analysis.strengths) && analysis.strengths.length > 0) {
      lines.push(`\nAI-Identified Strengths:\n${(analysis.strengths as string[]).map((s: string) => `- ${s}`).join("\n")}`);
    }
    if (Array.isArray(analysis.gaps) && analysis.gaps.length > 0) {
      lines.push(`\nAI-Identified Gaps/Risks:\n${(analysis.gaps as string[]).map((g: string) => `- ${g}`).join("\n")}`);
    }
    if (analysis.recommendation) {
      lines.push(`\nAI Recommendation: ${analysis.recommendation}`);
    }
    if (analysis.summary) {
      lines.push(`\nAI Summary: ${analysis.summary}`);
    }
  }

  return `## GRANT DETAILS\n${lines.join("\n")}`;
}

export async function POST(req: NextRequest) {
  try {
    // Allow service-role key auth for internal/webhook calls
    const authHeader = req.headers.get("authorization") ?? "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const isServiceCall = serviceKey && authHeader === `Bearer ${serviceKey}`;

    let authUser: { id: string } | null = null;
    if (!isServiceCall) {
      const { user, response: authError } = await requireAuth();
      if (authError) return authError;
      authUser = user;
    }

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
      { data: allExamples },
      lessons,
    ] = await Promise.all([
      db.from("Grant").select("*").eq("id", grantId).maybeSingle(),
      db.from("GrantProfile").select("*").eq("companyId", DEMO_COMPANY_ID).maybeSingle(),
      getCompanyContext(DEMO_COMPANY_ID),
      getVaultContext(DEMO_COMPANY_ID),
      db.from("GrantExample").select("*").eq("companyId", DEMO_COMPANY_ID).order("updatedAt", { ascending: false }).limit(20),
      getLessonsContext({ companyId: DEMO_COMPANY_ID, contentType: "grant" }),
    ]);

    if (grantErr || !grant) {
      return NextResponse.json({ error: "Grant not found" }, { status: 404 });
    }

    // ── Crawl grant URL if available ───────────────────────────────────────
    let crawledContent = "";
    if (grant.url) {
      crawledContent = await crawlGrantUrl(grant.url as string);
    }

    // ── Build examples context ──────────────────────────────────────────────
    const examples: Record<string, unknown>[] = allExamples ?? [];

    const buildExamplesContext = (sectionFilter?: string): string => {
      if (examples.length === 0) return "";
      // Prioritise examples matching the current section, then "Won" outcomes, then most recent
      let relevant = sectionFilter
        ? examples.filter((e) => e.section === sectionFilter || e.section === "Full Application")
        : examples;
      // If no section-specific examples, fall back to all
      if (relevant.length === 0) relevant = examples;
      // Limit to top 3 to avoid bloating context
      const top = relevant.slice(0, 3);
      const blocks = top.map((e, i) => {
        const header = [`EXAMPLE ${i + 1}: ${e.title}`];
        if (e.grantName) header.push(`Grant: ${e.grantName}`);
        if (e.funder) header.push(`Funder: ${e.funder}`);
        if (e.outcome) header.push(`Outcome: ${e.outcome}`);
        if (e.notes) header.push(`Why it worked: ${e.notes}`);
        // Limit content to ~2000 chars per example to manage token usage
        const content = typeof e.content === "string" ? (e.content as string).slice(0, 2000) : "";
        return `${header.join(" | ")}\n${content}`;
      });
      return `## REFERENCE EXAMPLES (real grant applications — study the tone, structure, and specificity)\n\n${blocks.join("\n\n---\n\n")}`;
    }

    // ── Assemble master context block ──────────────────────────────────────
    const contextParts: string[] = [
      buildGrantContext(grant as Record<string, unknown>),
      profile ? buildProfileContext(profile as Record<string, unknown>) : "",
      company.block,
      vault.block,
      lessons.block,
      crawledContent
        ? `## LIVE GRANT PAGE CONTENT (crawled from ${grant.url})\nUse this to understand the funder's current language, priorities, and criteria:\n\n${crawledContent}`
        : "",
    ].filter(Boolean);

    const masterContext = contextParts.join("\n\n");

    // ── MODE: brief ────────────────────────────────────────────────────────
    if (mode === "brief") {
      const examplesBlock = buildExamplesContext();
      const systemPrompt = `You are a senior grant writing strategist. Analyse the grant and organisation data provided and produce a strategic writing brief that will guide the entire application.${examplesBlock ? "\n\nYou have been given reference examples of real grant applications. Study their tone, structure, and specificity to inform your strategic brief." : ""}

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

      // Add deadline context to brief
      const deadlineStr = grant.deadlineDate ? (() => {
        const d = new Date(grant.deadlineDate as string);
        const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
        if (days < 0) return `EXPIRED (${Math.abs(days)} days ago)`;
        if (days === 0) return "Due TODAY";
        return `${days} days remaining (${d.toLocaleDateString("en-AU")})`;
      })() : "No deadline specified";

      const userPrompt = `Analyse this grant opportunity and organisation profile, then produce the strategic writing brief.\n\nDEADLINE: ${deadlineStr}\n\n${masterContext}${examplesBlock ? `\n\n${examplesBlock}` : ""}`;

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

      // If service call, persist brief to Grant record
      if (isServiceCall) {
        await db.from("Grant").update({
          aiBrief: brief,
          updatedAt: new Date().toISOString(),
        }).eq("id", grantId);
      }

      return NextResponse.json({ success: true, brief, grantName: grant.name });
    }

    // ── MODE: section ──────────────────────────────────────────────────────
    const { section, brief, tone, length, previousSections, customInstructions } = parsed.data as z.infer<typeof sectionSchema>;
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

    const sectionExamplesBlock = buildExamplesContext(section);

    const systemPrompt = `You are a professional grant writer with 15 years of experience winning competitive grants. You write compelling, specific, evidence-based applications that speak directly to funders' priorities.

WRITING RULES:
- ${toneInstruction}
- Target word count: ~${wordTarget} words for this section
- Mirror the funder's own language and keywords back to them
- Be specific — names, numbers, dates, outcomes — never vague
- Every claim must be grounded in the data provided
- Do NOT use generic grant-writing clichés ("passionate about", "committed to excellence")
- Write flowing prose, not bullet points (unless the section calls for a list)
- This section will be read by a grant assessor — make it easy to assess against criteria${sectionExamplesBlock ? "\n- Study the REFERENCE EXAMPLES provided — match their quality, specificity, and professional tone. Do NOT copy them directly, but learn from their structure and approach." : ""}${customInstructions ? `\n\nUSER INSTRUCTIONS FOR THIS SECTION (follow these closely):\n${customInstructions}` : ""}`;

    // Build previousSections context block
    let prevSectionsBlock = "";
    if (previousSections && Object.keys(previousSections).length > 0) {
      const entries = Object.entries(previousSections).map(([name, text]) => {
        const words = text.trim().split(/\s+/).length;
        const preview = text.slice(0, 300).trim();
        return `### ${name} (${words} words)\n${preview}${text.length > 300 ? "…" : ""}`;
      });
      prevSectionsBlock = `\n\n## PREVIOUSLY WRITTEN SECTIONS (maintain consistency — do not repeat the same phrases or examples)\n${entries.join("\n\n")}`;
    }

    const userPrompt = `Write the "${section}" section of this grant application.

SECTION INSTRUCTIONS:
${SECTION_INSTRUCTIONS[section]}

${briefBlock}

FULL CONTEXT:
${masterContext}

Write only the section content — no heading, no preamble, no "Here is the section:" intro. Just the prose.${sectionExamplesBlock ? `\n\n${sectionExamplesBlock}` : ""}${prevSectionsBlock}`;

    const result = await callOpenAIWithUsage({
      systemPrompt,
      userPrompt,
      model: MODEL_CONFIG.grantsWrite,
      maxTokens: MAX_TOKEN_TARGETS[length] ?? 1200,
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

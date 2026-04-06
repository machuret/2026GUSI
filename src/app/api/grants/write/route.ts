export const dynamic = "force-dynamic";
export const maxDuration = 120;
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/apiHelpers";
import { requireEdgeAuth } from "@/lib/edgeAuth";
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

const requirementsSchema = z.object({
  grantId: z.string().min(1),
  mode: z.literal("requirements"),
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
  regenNote: z.string().optional(),
  requirements: z.record(z.unknown()).optional(),
});

const bodySchema = z.discriminatedUnion("mode", [briefSchema, requirementsSchema, sectionSchema]);

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

const EMPHASIS_MAP: Record<string, { lead: string; suppress: string; keywords: string }> = {
  "Technology & Innovation": {
    lead:     "the technical solution, how it works, its novelty/differentiation, scalability, deployment approach, proof-of-concept evidence, and any IP or proprietary methodology",
    suppress: "anecdotal program stories, general community narrative, and capacity-building examples unrelated to the tech itself",
    keywords: "platform, algorithm, scalable, system, deploy, data pipeline, proof of concept, technical validation, interoperable",
  },
  "Research & Development": {
    lead:     "research questions, methodology, team credentials/publications, expected outcomes, how findings will be disseminated, and the gap in existing knowledge",
    suppress: "operational program detail, general community impact stories",
    keywords: "hypothesis, methodology, peer review, findings, evidence base, pilot study, R&D, commercialisation pathway",
  },
  "Training & Capacity Building": {
    lead:     "curriculum design, learning outcomes, participant numbers, facilitator qualifications, assessment methods, and long-term skill retention evidence",
    suppress: "technology infrastructure detail, product roadmap, financial projections",
    keywords: "training, skills development, cohorts, modules, facilitators, accredited, certification, workforce capability",
  },
  "Community Development": {
    lead:     "community need evidence, co-design with community, partnerships, geographic reach, lived-experience voices, and measurable social outcomes",
    suppress: "technology stack, financial modelling, academic research framing",
    keywords: "grassroots, community-led, partnership, local, co-design, belonging, social cohesion, inclusion",
  },
  "Health & Wellbeing": {
    lead:     "clinical or wellbeing evidence, target population health needs, intervention approach, health outcome metrics, and alignment with public health priorities",
    suppress: "technology features without clinical validation, general capacity narrative",
    keywords: "health outcomes, evidence-based, clinical, wellbeing, prevention, early intervention, population health",
  },
  "Education & Youth": {
    lead:     "learning outcomes, age/cohort specifics, pedagogical approach, teacher/facilitator training, and measurable academic or developmental outcomes",
    suppress: "technology detail beyond pedagogy, adult workforce framing",
    keywords: "students, curriculum, pedagogy, learning outcomes, engagement, school, youth, early childhood",
  },
  "Environment & Sustainability": {
    lead:     "environmental impact metrics, carbon/ecological baseline, measurable sustainability outcomes, circular economy principles, and scientific evidence",
    suppress: "social program stories unrelated to environmental outcomes",
    keywords: "emissions, biodiversity, circular economy, net zero, ecological, sustainability, regenerative, carbon offset",
  },
  "Economic Development": {
    lead:     "job creation, revenue growth potential, market opportunity, export readiness, supply-chain impact, and economic multiplier evidence",
    suppress: "community narrative, wellbeing framing not tied to economic outcomes",
    keywords: "jobs created, revenue, market opportunity, export, commercialisation, investment leverage, economic multiplier",
  },
  "Arts & Culture": {
    lead:     "artistic vision, cultural significance, audience reach, community cultural value, and the credentials/track record of key creatives",
    suppress: "technology or financial infrastructure detail",
    keywords: "artistic, cultural, creative, audience, heritage, expression, community engagement, cultural value",
  },
  "Housing & Infrastructure": {
    lead:     "housing need data, construction/delivery approach, partnership with planning/government bodies, affordability model, and tenancy outcomes",
    suppress: "technology innovation framing, health or education narrative",
    keywords: "housing supply, affordable, tenancy, infrastructure, planning, construction, social housing, amenity",
  },
  "Emergency Relief": {
    lead:     "immediacy of need, speed of response capability, geographic reach of emergency, coordination with official bodies, and accountability for rapid expenditure",
    suppress: "long-term program design, research framing",
    keywords: "emergency, rapid response, relief, crisis, coordination, immediate need, distribution, resilience",
  },
  "Diversity & Inclusion": {
    lead:     "representation data, systemic barriers being addressed, co-design with affected groups, intersectionality, and measurable equity outcomes",
    suppress: "technology product framing, general program volume statistics",
    keywords: "equity, inclusion, representation, intersectionality, belonging, cultural safety, accessible, barrier reduction",
  },
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

/** Build a rich GUSI-specific facts block so AI uses real org details by name */
function buildGusiFacts(profile: Record<string, unknown> | null, company: { companyName: string; industry: string; website: string }): string {
  if (!profile && !company.companyName) return "";
  const lines: string[] = [];
  const name = company.companyName || "our organisation";
  lines.push(`Organisation Name: ${name}`);
  if (company.website)            lines.push(`Website: ${company.website}`);
  if (profile?.location)          lines.push(`Location: ${profile.location}${profile.country ? `, ${profile.country}` : ""}`);
  if (profile?.yearFounded)       lines.push(`Year Founded: ${profile.yearFounded}`);
  if (profile?.teamSize)          lines.push(`Team Size: ${profile.teamSize}`);
  if (profile?.orgType)           lines.push(`Organisation Type: ${profile.orgType}${profile.orgType2 ? ` / ${profile.orgType2}` : ""}`);
  if (profile?.sector)            lines.push(`Sector: ${profile.sector}${profile.subSector ? ` / ${profile.subSector}` : ""}`);
  if (profile?.stage)             lines.push(`Stage: ${profile.stage}`);
  if (profile?.annualRevenue)     lines.push(`Annual Revenue: ${profile.annualRevenue}`);
  if (profile?.isRegisteredCharity) lines.push("Registered Charity: Yes");
  if (profile?.hasEIN)            lines.push("Has EIN (tax-exempt): Yes");
  if (profile?.womanOwned)        lines.push("Woman-owned: Yes");
  if (profile?.indigenousOwned)   lines.push("Indigenous-owned: Yes");
  const areas = profile?.focusAreas as string[] | null;
  if (areas?.length)              lines.push(`Focus Areas: ${areas.join(", ")}`);

  if (profile?.missionStatement)  lines.push(`\nMission Statement:\n${profile.missionStatement}`);
  if (profile?.keyActivities)     lines.push(`\nKey Programs & Activities:\n${profile.keyActivities}`);
  if (profile?.uniqueStrengths)   lines.push(`\nUnique Strengths & Differentiators:\n${profile.uniqueStrengths}`);
  if (profile?.pastGrantsWon)     lines.push(`\nPast Grants Won (use these as proof of track record):\n${profile.pastGrantsWon}`);

  // Contacts/founders — use real names
  const contacts = profile?.contacts as { name: string; role?: string; email?: string }[] | null;
  if (contacts?.length) {
    lines.push(`\nFounders / Key Contacts:`);
    contacts.forEach((c) => {
      const parts = [c.name, c.role, c.email].filter(Boolean).join(" | ");
      lines.push(`  - ${parts}`);
    });
  } else if (profile?.contactName) {
    lines.push(`\nPrimary Contact: ${profile.contactName}${profile.contactRole ? `, ${profile.contactRole}` : ""}`);
  }

  // ── Signal what is NOT documented so the AI doesn't invent it ──────────────
  const notDocumented: string[] = [];
  if (!profile?.keyActivities)  notDocumented.push("specific learner/beneficiary counts");
  if (!profile?.annualRevenue)  notDocumented.push("annual revenue or financials");
  if (!profile?.teamSize)       notDocumented.push("exact team size");
  if (!profile?.pastGrantsWon)  notDocumented.push("specific past grants or funding history");
  if (notDocumented.length > 0) {
    lines.push(`\n⚠ NOT DOCUMENTED (do NOT invent these — describe qualitatively or omit):\n${notDocumented.map((x) => `- ${x}`).join("\n")}`);
  }

  return `## GUSI FACTS — USE THESE BY NAME IN EVERY SECTION\nThese are real, verified facts about the applicant organisation. Ground your writing in these specifics:\n\n${lines.join("\n")}`;
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

    if (!isServiceCall) {
      const { error: authError } = requireEdgeAuth(req);
      if (authError) return authError;
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
      { data: funderTemplates },
      { data: budgetLineItems },
      { data: budgetTemplates },
    ] = await Promise.all([
      db.from("Grant").select("*").eq("id", grantId).maybeSingle(),
      db.from("GrantProfile").select("*").eq("companyId", DEMO_COMPANY_ID).maybeSingle(),
      getCompanyContext(DEMO_COMPANY_ID),
      getVaultContext(DEMO_COMPANY_ID),
      db.from("GrantExample").select("*").eq("companyId", DEMO_COMPANY_ID).order("updatedAt", { ascending: false }).limit(20),
      getLessonsContext({ companyId: DEMO_COMPANY_ID, contentType: "grant" }),
      db.from("FunderTemplate").select("*").eq("companyId", DEMO_COMPANY_ID),
      db.from("BudgetLineItem").select("*").eq("companyId", DEMO_COMPANY_ID).eq("active", true).order("category", { ascending: true }),
      db.from("BudgetTemplate").select("*").eq("companyId", DEMO_COMPANY_ID).eq("active", true),
    ]);

    if (grantErr || !grant) {
      return NextResponse.json({ error: "Grant not found" }, { status: 404 });
    }

    // ── Crawl grant URL if available ───────────────────────────────────────
    let crawledContent = "";
    if (grant.url) {
      crawledContent = await crawlGrantUrl(grant.url as string);
    }

    // ── MODE: requirements ─────────────────────────────────────────────────
    if (mode === "requirements") {
      if (!crawledContent || crawledContent.length < 100) {
        return NextResponse.json({
          success: true,
          requirements: { criteria: [], wordLimits: {}, evaluationRubric: [], mandatoryRequirements: [] },
          note: "No crawled content available — requirements could not be extracted.",
        });
      }

      const reqSystemPrompt = `You are a grant requirements analyst. Extract structured application requirements from the grant page content provided.

Return ONLY valid JSON:
{
  "criteria": ["<evaluation criterion 1>", "<evaluation criterion 2>"],
  "wordLimits": { "<Section Name>": <word limit as number> },
  "evaluationRubric": ["<rubric item e.g. Innovation (30%)>"],
  "mandatoryRequirements": ["<hard requirement e.g. Must be registered non-profit>"]
}

RULES:
- criteria: the specific things the funder will assess — extract from headings, scoring guides, FAQs. Up to 12.
- wordLimits: only include if explicit word/character limits are mentioned for specific sections.
- evaluationRubric: scoring weights if mentioned (e.g. "Innovation worth 40%").
- mandatoryRequirements: eligibility hard gates, registration requirements, geography restrictions.
- If a field has nothing to extract, return an empty array or empty object.
- Never invent criteria not present in the text.`;

      const reqUserPrompt = `Extract grant application requirements from this grant page.
Grant: ${grant.name as string}
Funder: ${(grant.founder as string) ?? "Unknown"}

PAGE CONTENT:
${crawledContent.slice(0, 12000)}`;

      let requirements: Record<string, unknown> = { criteria: [], wordLimits: {}, evaluationRubric: [], mandatoryRequirements: [] };
      try {
        const reqResult = await callOpenAIWithUsage({
          systemPrompt: reqSystemPrompt,
          userPrompt: reqUserPrompt,
          model: MODEL_CONFIG.grantsWrite,
          maxTokens: 800,
          temperature: 0,
          jsonMode: true,
        });
        logAiUsage({ model: MODEL_CONFIG.grantsWrite, feature: "grants_requirements", promptTokens: reqResult.promptTokens, completionTokens: reqResult.completionTokens });
        requirements = JSON.parse(reqResult.content);
      } catch { /* return empty on failure */ }

      // Persist to Grant record
      await db.from("Grant").update({ aiRequirements: requirements, updatedAt: new Date().toISOString() }).eq("id", grantId);

      return NextResponse.json({ success: true, requirements });
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

    // ── Build budget template block ────────────────────────────────────────
    const buildBudgetContext = (grantType?: string, requestedAmount?: string): string => {
      try {
        // Validate input data
        if (!budgetLineItems || budgetLineItems.length === 0) {
          console.warn("[Budget Template] No line items found for company:", DEMO_COMPANY_ID);
          return "## BUDGET TEMPLATE UNAVAILABLE\n\nNo budget line items configured. Please use general cost estimates and justify each line item with market research.";
        }

        const lines: string[] = [
          "## GUSI BUDGET TEMPLATE — REAL UNIT COSTS",
          "⚠ CRITICAL: Use these ACTUAL costs, not AI estimates. Every budget line item must be grounded in this template.",
          ""
        ];

        // Find matching template by grant type with null safety
        let matchingTemplate: Record<string, unknown> | undefined;
        try {
          const focusAreaObj = (grant.aiBrief as Record<string, unknown> | null)?.focusArea as { primary?: string } | undefined;
          const grantFocusArea = grantType || focusAreaObj?.primary;
          
          if (budgetTemplates && budgetTemplates.length > 0) {
            matchingTemplate = budgetTemplates.find(
              (t: Record<string, unknown>) => t.grantType === grantFocusArea
            ) || budgetTemplates.find((t: Record<string, unknown>) => t.grantType === "General");
          }
        } catch (err) {
          console.error("[Budget Template] Error finding template:", err);
        }

        // Add template info with null safety
        if (matchingTemplate) {
          try {
            lines.push(`Template: ${matchingTemplate.name || "Unknown"}`);
            lines.push(`Grant Type: ${matchingTemplate.grantType || "General"}`);
            lines.push(`Typical Range: ${matchingTemplate.typicalAmount || "Varies"}`);
            lines.push(`Overhead Rate: ${matchingTemplate.overheadRate || 15}%`);
            lines.push("");
            
            // Handle allocations with null safety
            const allocations = matchingTemplate.allocations as { category: string; percentage: number; notes: string }[] | null | undefined;
            if (allocations && Array.isArray(allocations) && allocations.length > 0) {
              lines.push("Recommended Allocation:");
              allocations.forEach((a) => {
                if (a && a.category && typeof a.percentage === "number") {
                  lines.push(`  - ${a.category}: ${a.percentage}% — ${a.notes || ""}`);
                }
              });
              lines.push("");
            }
          } catch (err) {
            console.error("[Budget Template] Error processing template:", err);
          }
        }

        lines.push("AVAILABLE LINE ITEMS (use these exact costs):");
        lines.push("");

        // Group by category with error handling
        const byCategory: Record<string, unknown[]> = {};
        budgetLineItems.forEach((item: Record<string, unknown>) => {
          try {
            const cat = (item.category as string) || "Other";
            if (!byCategory[cat]) byCategory[cat] = [];
            byCategory[cat].push(item);
          } catch (err) {
            console.error("[Budget Template] Error categorizing item:", err);
          }
        });

        // Format line items with validation
        Object.entries(byCategory).forEach(([category, items]) => {
          try {
            lines.push(`### ${category}`);
            (items as Record<string, unknown>[]).forEach((item) => {
              try {
                const unitCost = Number(item.unitCost);
                if (isNaN(unitCost) || unitCost <= 0) {
                  console.warn("[Budget Template] Invalid unit cost for item:", item.name);
                  return;
                }
                
                const cost = `$${unitCost.toFixed(2)}`;
                const unit = (item.unitType as string) || "unit";
                const qty = item.defaultQuantity ? ` (typical: ${item.defaultQuantity} ${unit})` : "";
                lines.push(`  - ${item.name || "Unnamed"}: ${cost}/${unit}${qty}`);
                if (item.description) lines.push(`    ${item.description}`);
                if (item.notes) lines.push(`    Note: ${item.notes}`);
              } catch (err) {
                console.error("[Budget Template] Error formatting line item:", err);
              }
            });
            lines.push("");
          } catch (err) {
            console.error("[Budget Template] Error processing category:", category, err);
          }
        });

        lines.push("BUDGET RULES:");
        lines.push("1. Use ONLY the unit costs listed above — never invent costs");
        lines.push("2. Calculate totals by multiplying unit cost × quantity");
        lines.push("3. All line items must sum to the requested funding amount");
        lines.push("4. Include overhead/indirect costs at the template rate");
        lines.push("5. Justify each line item by tying it to specific project activities");
        lines.push("6. Show calculations clearly (e.g., 'Senior Developer: $85/hr × 160 hrs = $13,600')");
        if (requestedAmount) {
          lines.push(`7. TOTAL BUDGET MUST EQUAL: ${requestedAmount}`);
        }

        return lines.join("\n");
      } catch (err) {
        console.error("[Budget Template] Critical error building budget context:", err);
        return "## BUDGET TEMPLATE ERROR\n\nAn error occurred loading the budget template. Please use general cost estimates based on market rates and justify each line item.";
      }
    };

    // ── Build funder template block ────────────────────────────────────────
    let funderTemplateBlock = "";
    if (funderTemplates && funderTemplates.length > 0 && grant.founder) {
      const funderName = (grant.founder as string).toLowerCase();
      const match = funderTemplates.find(
        (t: Record<string, unknown>) =>
          typeof t.funderName === "string" &&
          (t.funderName.toLowerCase() === funderName || funderName.includes(t.funderName.toLowerCase()) || t.funderName.toLowerCase().includes(funderName))
      );
      if (match) {
        const parts = [`## FUNDER TEMPLATE — ${match.funderName}\nThis funder has a known preference profile. Apply these insights throughout the application.`];
        if (match.preferences) parts.push(`What this funder loves:\n${match.preferences}`);
        if (match.patterns) parts.push(`Winning patterns from past applications:\n${match.patterns}`);
        if (match.avoid) parts.push(`What to AVOID with this funder:\n${match.avoid}`);
        if (match.notes) parts.push(`Additional notes:\n${match.notes}`);
        funderTemplateBlock = parts.join("\n\n");
      }
    }

    // ── Assemble master context block ──────────────────────────────────────
    const contextParts: string[] = [
      buildGrantContext(grant as Record<string, unknown>),
      buildGusiFacts(profile as Record<string, unknown> | null, company),
      profile ? buildProfileContext(profile as Record<string, unknown>) : "",
      funderTemplateBlock,
      company.block,
      vault.block,
      lessons.block,
      crawledContent
        ? `## LIVE GRANT PAGE CONTENT (crawled from ${grant.url})\nUse this to understand the funder's current language, priorities, and criteria:\n\n${crawledContent}`
        : "",
    ].filter(Boolean);

    const masterContext = contextParts.join("\n\n");

    // ── Date context (injected into every mode) ────────────────────────────
    const now = new Date();
    const todayStr = now.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const deadlineDateStr = grant.deadlineDate
      ? (() => {
          const d = new Date(grant.deadlineDate as string);
          const days = Math.ceil((d.getTime() - now.getTime()) / 86400000);
          const fmt = d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
          if (days < 0) return `${fmt} (EXPIRED ${Math.abs(days)} days ago)`;
          if (days === 0) return `${fmt} (Due TODAY)`;
          return `${fmt} (${days} days from today)`;
        })()
      : "Not specified";
    const dateContextBlock = `## DATE CONTEXT — CRITICAL
Today's Date: ${todayStr}
Grant Deadline: ${deadlineDateStr}${grant.projectDuration ? `\nProject Duration: ${grant.projectDuration as string}` : ""}

DATE RULES:
- All future dates and timelines you write MUST be calculated from today (${todayStr})
- Never reference any date in the past as if it is upcoming
- For project timelines (milestones, deliverables, reporting), calculate real calendar dates using today as Month 1
- If a deadline is given, work backwards from it to set realistic milestone dates
- Never invent a year — use the actual current year (${now.getFullYear()}) and near-future years only`;

    // ── MODE: brief ────────────────────────────────────────────────────────
    if (mode === "brief") {
      const examplesBlock = buildExamplesContext();
      const FOCUS_CATEGORY_LIST = [
        "Training & Capacity Building",
        "Technology & Innovation",
        "Research & Development",
        "Community Development",
        "Health & Wellbeing",
        "Environment & Sustainability",
        "Education & Youth",
        "Arts & Culture",
        "Housing & Infrastructure",
        "Economic Development",
        "Emergency Relief",
        "Diversity & Inclusion",
        "Other",
      ].join(" | ");

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
  "keywordsToUse": ["<funder keyword 1>", "<funder keyword 2>", "<funder keyword 3>"],
  "focusArea": {
    "primary": "<one of: ${FOCUS_CATEGORY_LIST}>",
    "tags": ["<specific sub-topic 1>", "<specific sub-topic 2>", "<specific sub-topic 3>"]
  }
}

focusArea rules:
- primary: pick exactly ONE category from the list that best describes what this grant funds
- tags: 2–4 short, specific sub-topics or activity types relevant to this grant (e.g. "digital literacy", "rural outreach", "STEM education")
- Base detection on the grant name, funder description, eligibility criteria, and crawled page content`;

      const userPrompt = `Analyse this grant opportunity and organisation profile, then produce the strategic writing brief.\n\n${dateContextBlock}\n\n${masterContext}${examplesBlock ? `\n\n${examplesBlock}` : ""}`;

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
    const { section, brief, tone, length, previousSections, customInstructions, regenNote, requirements } = parsed.data as z.infer<typeof sectionSchema>;

    // ── Contact Details: build directly from profile fields — no AI needed ──
    if (section === "Contact Details") {
      const p = profile as Record<string, unknown> | null;
      const contacts = p?.contacts as { name: string; role?: string; email?: string; phone?: string }[] | null;
      const lines: string[] = [];

      if (contacts && contacts.length > 0) {
        contacts.forEach((c, i) => {
          if (i === 0) lines.push("PRIMARY CONTACT");
          else lines.push(`ADDITIONAL CONTACT ${i + 1}`);
          lines.push(`Name: ${c.name}`);
          if (c.role)  lines.push(`Position: ${c.role}`);
          if (c.email) lines.push(`Email: ${c.email}`);
          if (c.phone) lines.push(`Phone: ${c.phone}`);
          lines.push("");
        });
      } else {
        if (p?.contactName)    lines.push(`Name: ${p.contactName}`);
        if (p?.contactRole)    lines.push(`Position: ${p.contactRole}`);
        if (p?.contactEmail)   lines.push(`Email: ${p.contactEmail}`);
        if (p?.contactPhone)   lines.push(`Phone: ${p.contactPhone}`);
        if (p?.contactAddress) lines.push(`Address: ${p.contactAddress}`);
        else if (p?.location)  lines.push(`Location: ${p.location}${p?.country ? `, ${p.country}` : ""}`);
      }

      const content = lines.filter(Boolean).join("\n").trim()
        || "Please complete your Grant Profile contact details to populate this section.";

      return NextResponse.json({ success: true, section, content, wordCount: content.split(/\s+/).filter(Boolean).length });
    }
    const wordTarget = WORD_TARGETS[length];
    const toneInstruction = tone === "first_person"
      ? 'Write in first person ("We are…", "Our organisation…", "We will…")'
      : 'Write in third person ("The organisation is…", "The team will…")';

    // Build criteria block from requirements if available
    const criteria = (requirements?.criteria as string[] | undefined) ?? (grant.aiRequirements as Record<string, unknown> | null)?.criteria as string[] | undefined ?? [];
    const mandatoryReqs = (requirements?.mandatoryRequirements as string[] | undefined) ?? (grant.aiRequirements as Record<string, unknown> | null)?.mandatoryRequirements as string[] | undefined ?? [];
    const evalRubric = (requirements?.evaluationRubric as string[] | undefined) ?? (grant.aiRequirements as Record<string, unknown> | null)?.evaluationRubric as string[] | undefined ?? [];

    const criteriaBlock = criteria.length > 0
      ? `\n\n## FUNDER EVALUATION CRITERIA (your writing MUST address each of these)\n${criteria.map((c: string) => `- ${c}`).join("\n")}${evalRubric.length > 0 ? `\n\nScoring Rubric:\n${evalRubric.map((r: string) => `- ${r}`).join("\n")}` : ""}${mandatoryReqs.length > 0 ? `\n\nMandatory Requirements (hard gates — must be addressed):\n${mandatoryReqs.map((r: string) => `- ${r}`).join("\n")}` : ""}`
      : "";

    const suggestedAsk = (brief.suggestedAsk as string | undefined)?.trim() || null;

    const briefBlock = `## STRATEGIC WRITING BRIEF${suggestedAsk ? `\n⚠ REQUESTED FUNDING AMOUNT (LOCKED): ${suggestedAsk} — every section MUST use this exact figure. Never state a different amount anywhere in the application.` : ""}
Funder Priorities: ${(brief.funderPriorities as string[] | undefined)?.join(", ") ?? "N/A"}
Key Themes: ${(brief.keyThemes as string[] | undefined)?.join(", ") ?? "N/A"}
Winning Angle: ${brief.winningAngle ?? "N/A"}
Tone Guidance: ${brief.toneGuidance ?? "N/A"}
Keywords to use: ${(brief.keywordsToUse as string[] | undefined)?.join(", ") ?? "N/A"}
Eligibility Strengths: ${(brief.eligibilityStrengths as string[] | undefined)?.join(", ") ?? "N/A"}
Eligibility Risks to address: ${(brief.eligibilityRisks as string[] | undefined)?.join(", ") ?? "N/A"}${criteriaBlock}`;

    const sectionExamplesBlock = buildExamplesContext(section);

    const focusAreaObj = brief.focusArea as { primary?: string; tags?: string[] } | undefined;
    const focusPrimary = focusAreaObj?.primary?.trim();
    const focusTags    = focusAreaObj?.tags?.filter(Boolean) ?? [];
    const emphasisRule = focusPrimary ? EMPHASIS_MAP[focusPrimary] : null;

    const focusEmphasisBlock = emphasisRule
      ? `\n\n## CONTENT EMPHASIS FOR THIS GRANT TYPE: ${focusPrimary}${focusTags.length > 0 ? ` (${focusTags.join(", ")})` : ""}
LEAD WITH: ${emphasisRule.lead}
SUPPRESS OR MINIMISE: ${emphasisRule.suppress}
USE THESE DOMAIN KEYWORDS: ${emphasisRule.keywords}
This is a ${focusPrimary!} grant — every paragraph should reinforce this framing. Do NOT default to generic program storytelling if the funder is looking for ${focusPrimary!.toLowerCase()} outcomes.`
      : "";

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
- NO REPETITION: every statistic, achievement, or example may appear in only ONE section. If it was used in a previous section, omit it here and choose a different supporting detail
- DATE ACCURACY (critical): all dates, years, and project timelines must be grounded in the DATE CONTEXT block in the user prompt — never use past dates as future ones, never guess a year
- NUMBERS INTEGRITY (critical): never invent specific figures — learner counts, beneficiary numbers, program reach, revenue, team size, grant history — unless the exact number is explicitly stated in the GUSI FACTS, vault, or profile. If a number is not documented, describe impact qualitatively (e.g. "across multiple cohorts", "serving regional communities") or state that data collection is underway. Invented statistics that contradict real records will disqualify an application${suggestedAsk ? `
- FUNDING CONSISTENCY (critical): The total funding request is ${suggestedAsk}. Every section must state this same figure. Never reference a different amount — assessors will reject applications with inconsistent numbers.${section === "Budget & Budget Narrative" ? ` For this Budget section, all line items MUST sum exactly to ${suggestedAsk}.` : ""}` : ""}${sectionExamplesBlock ? "\n- Study the REFERENCE EXAMPLES provided — match their quality, specificity, and professional tone. Do NOT copy them directly, but learn from their structure and approach." : ""}${customInstructions ? `\n\nPERMANENT SECTION INSTRUCTIONS (applied every time this section is generated — follow closely):\n${customInstructions}` : ""}${regenNote ? `\n\nONE-SHOT REGEN NOTE (for this regeneration only — override or extend the permanent instructions above as needed):\n${regenNote}` : ""}`;

    // Build previousSections context block
    let prevSectionsBlock = "";
    if (previousSections && Object.keys(previousSections).length > 0) {
      const entries = Object.entries(previousSections).map(([name, text]) => {
        const words = text.trim().split(/\s+/).length;
        const preview = text.slice(0, 2500).trim();
        return `### ${name} (${words} words)\n${preview}${text.length > 2500 ? "\u2026" : ""}`;
      });
      prevSectionsBlock = `\n\n## PREVIOUSLY WRITTEN SECTIONS\nCRITICAL — scan every section below before writing. Do NOT reuse any specific statistic, percentage, dollar figure, program name, achievement, or anecdote that already appears here. Each section must introduce only new, distinct information.\n${entries.join("\n\n")}`;
    }

    // Build budget context block for Budget & Budget Narrative section
    const budgetContextBlock = section === "Budget & Budget Narrative" 
      ? `\n\n${buildBudgetContext(focusPrimary, suggestedAsk ?? undefined)}`
      : "";

    const userPrompt = `Write the "${section}" section of this grant application.

SECTION INSTRUCTIONS:
${SECTION_INSTRUCTIONS[section]}

${dateContextBlock}

${briefBlock}${budgetContextBlock}

FULL CONTEXT:
${masterContext}

Write only the section content — no heading, no preamble, no "Here is the section:" intro. Just the prose.
IMPORTANT: Reference the organisation by its real name, mention specific programs, real team members, and real achievements from the GUSI FACTS block — never use placeholders like [Organisation Name].${sectionExamplesBlock ? `\n\n${sectionExamplesBlock}` : ""}${prevSectionsBlock}`;

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
    });

    const content = result.content.trim();
    const wordCount = content.split(/\s+/).filter(Boolean).length;

    return NextResponse.json({ success: true, section, content, wordCount });
  } catch (err) {
    return handleApiError(err, "Grant Write");
  }
}

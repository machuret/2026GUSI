/**
 * _shared/sectionPrompts.ts
 * Grant section writing constants shared across grant edge functions.
 *
 * Exports:
 *  - WORD_TARGETS          — word count limits per length setting
 *  - MAX_TOKEN_TARGETS     — OpenAI token limits per length setting
 *  - EMPHASIS_MAP          — per-focus-area lead/suppress/keyword rules
 *  - SECTION_INSTRUCTIONS  — per-section writing instructions for AI
 *  - FOCUS_CATEGORIES      — canonical list of focus area names (typed array)
 *  - FOCUS_CATEGORY_LIST   — pipe-delimited string for prompt injection
 *  - getSectionInstruction — type-safe lookup with unknown-section logging
 */

import { createLogger } from "./logger.ts";

const log = createLogger("sectionPrompts");

// ── Word / token targets ──────────────────────────────────────────────────────

/** Word count ceilings per length setting sent from the client. */
export const WORD_TARGETS: Record<string, number> = { concise: 150, standard: 300, detailed: 500 };

/** OpenAI max_tokens per length setting (approx 4 chars/token). */
export const MAX_TOKEN_TARGETS: Record<string, number> = { concise: 600, standard: 1200, detailed: 2000 };

// ── Focus area emphasis rules ─────────────────────────────────────────────────

export const EMPHASIS_MAP: Record<string, { lead: string; suppress: string; keywords: string }> = {
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

// ── Section writing instructions ──────────────────────────────────────────────

export const SECTION_INSTRUCTIONS: Record<string, string> = {
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

// ── Focus category list ───────────────────────────────────────────────────────

/** Canonical focus-area names as a typed tuple. Use for validation or iteration. */
export const FOCUS_CATEGORIES = [
  "Training & Capacity Building", "Technology & Innovation", "Research & Development",
  "Community Development", "Health & Wellbeing", "Environment & Sustainability",
  "Education & Youth", "Arts & Culture", "Housing & Infrastructure",
  "Economic Development", "Emergency Relief", "Diversity & Inclusion", "Other",
] as const;

/** Pipe-delimited string derived from FOCUS_CATEGORIES for prompt injection. */
export const FOCUS_CATEGORY_LIST: string = FOCUS_CATEGORIES.join(" | ");

// ── Type-safe section instruction lookup ──────────────────────────────────────

/**
 * Returns the writing instruction for a named grant section.
 * Logs a warning for unknown section names instead of silently returning undefined.
 *
 * @param section  The section name as received from the client.
 */
export function getSectionInstruction(section: string): string {
  const instruction = SECTION_INSTRUCTIONS[section];
  if (!instruction) {
    log.warn("Unknown section name — using generic instruction", { section });
    return "Write a professional, evidence-based section for this grant application.";
  }
  return instruction;
}

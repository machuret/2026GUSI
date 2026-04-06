/**
 * _shared/grantBuilders.ts
 * Context block builders for grant + org data shared across grant edge functions.
 */

// ── Grant context block ───────────────────────────────────────────────────────

export function buildGrantContext(grant: Record<string, unknown>): string {
  const lines = [
    `Grant Name: ${grant.name}`,
    grant.founder         ? `Funder / Organisation: ${grant.founder}` : null,
    grant.amount          ? `Funding Amount: ${grant.amount}` : null,
    grant.geographicScope ? `Geographic Scope: ${grant.geographicScope}` : null,
    grant.eligibility     ? `Eligibility: ${grant.eligibility}` : null,
    grant.howToApply      ? `How to Apply: ${grant.howToApply}` : null,
    grant.projectDuration ? `Project Duration: ${grant.projectDuration}` : null,
    grant.notes           ? `Notes: ${grant.notes}` : null,
    grant.deadlineDate    ? `Deadline: ${grant.deadlineDate}` : null,
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

// ── GUSI facts block ──────────────────────────────────────────────────────────

export function buildGusiFacts(
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

// ── Date context block ────────────────────────────────────────────────────────

export function buildDateContextBlock(grant: Record<string, unknown>): string {
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
  return `## DATE CONTEXT — CRITICAL\nToday's Date: ${todayStr}\nGrant Deadline: ${deadlineDateStr}${grant.projectDuration ? `\nProject Duration: ${grant.projectDuration}` : ""}\n\nDATE RULES:\n- All future dates MUST be calculated from today (${todayStr})\n- Never reference any date in the past as if it is upcoming\n- For timelines, calculate real calendar dates using today as Month 1\n- Never invent a year — use the actual current year (${now.getFullYear()}) and near-future years only`;
}

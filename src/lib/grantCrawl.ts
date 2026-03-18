import { isPrivateUrl } from "@/lib/urlValidation";
import { stripHtml } from "@/lib/htmlUtils";

/**
 * Crawl a grant URL and return plain text content.
 * Protected against SSRF via isPrivateUrl check.
 * Returns empty string on any failure.
 */
export async function crawlGrantUrl(url: string, maxChars = 8000): Promise<string> {
  if (!url || isPrivateUrl(url)) return "";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    return stripHtml(html).slice(0, maxChars);
  } catch {
    return "";
  }
}

/**
 * Build a standardised profile context block for AI prompts.
 * Includes orgType2 (secondary org type) when set.
 */
export function buildProfileContext(profile: Record<string, unknown>): string {
  const contacts = profile.contacts as { name: string; role?: string; email?: string; phone?: string }[] | null;
  const lines: (string | null)[] = [];
  if (contacts?.length) {
    lines.push(`Contacts / Founders:`);
    contacts.forEach((c, i) => {
      const parts = [c.name, c.role, c.email, c.phone].filter(Boolean).join(" | ");
      lines.push(`  ${i + 1}. ${parts}`);
    });
  } else {
    if (profile.contactName)    lines.push(`Contact Name: ${profile.contactName}`);
    if (profile.contactRole)    lines.push(`Contact Role: ${profile.contactRole}`);
    if (profile.contactEmail)   lines.push(`Contact Email: ${profile.contactEmail}`);
    if (profile.contactPhone)   lines.push(`Contact Phone: ${profile.contactPhone}`);
    if (profile.contactAddress) lines.push(`Contact Address: ${profile.contactAddress}`);
  }
  if (profile.orgType) lines.push(`Organisation Type: ${profile.orgType}${profile.orgType2 ? ` / ${profile.orgType2}` : ""}`);
  if (profile.sector) lines.push(`Sector: ${profile.sector}${profile.subSector ? ` / ${profile.subSector}` : ""}`);
  if (profile.stage) lines.push(`Stage: ${profile.stage}`);
  if (profile.teamSize) lines.push(`Team Size: ${profile.teamSize}`);
  if (profile.annualRevenue) lines.push(`Annual Revenue: ${profile.annualRevenue}`);
  if (profile.location) lines.push(`Location: ${profile.location}, ${profile.country ?? "United States"}`);
  if (profile.yearFounded) lines.push(`Year Founded: ${profile.yearFounded}`);
  if ((profile.focusAreas as string[] | null)?.length) lines.push(`Focus Areas: ${(profile.focusAreas as string[]).join(", ")}`);
  if (profile.targetFundingMin != null || profile.targetFundingMax != null) lines.push(`Target Funding: $${profile.targetFundingMin ?? 0} – $${profile.targetFundingMax ?? "Any"}`);
  if (profile.preferredDuration) lines.push(`Preferred Duration: ${profile.preferredDuration}`);
  if (profile.isRegisteredCharity) lines.push("Registered Charity: Yes");
  if (profile.hasEIN) lines.push("Has EIN: Yes");
  if (profile.indigenousOwned) lines.push("Indigenous-owned: Yes");
  if (profile.womanOwned) lines.push("Woman-owned: Yes");
  if (profile.regionalOrRural) lines.push("Regional/Rural: Yes");
  if (profile.missionStatement) lines.push(`\nMission Statement:\n${profile.missionStatement}`);
  if (profile.keyActivities) lines.push(`\nKey Activities:\n${profile.keyActivities}`);
  if (profile.uniqueStrengths) lines.push(`\nUnique Strengths:\n${profile.uniqueStrengths}`);
  if (profile.pastGrantsWon) lines.push(`\nPast Grants Won:\n${profile.pastGrantsWon}`);

  // Append extra documents (capability statements, initiative pages, etc.)
  const extraDocs = profile.extraDocs as { title: string; content: string }[] | null;
  if (extraDocs?.length) {
    for (const doc of extraDocs) {
      lines.push(`\n--- ${doc.title} ---\n${doc.content}`);
    }
  }

  return `## GRANT PROFILE\n${lines.join("\n")}`;
}

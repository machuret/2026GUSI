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
  const lines = [
    profile.contactName   ? `Contact Name: ${profile.contactName}` : null,
    profile.contactRole   ? `Contact Role: ${profile.contactRole}` : null,
    profile.contactEmail  ? `Contact Email: ${profile.contactEmail}` : null,
    profile.contactPhone  ? `Contact Phone: ${profile.contactPhone}` : null,
    profile.contactAddress ? `Contact Address: ${profile.contactAddress}` : null,
    profile.orgType
      ? `Organisation Type: ${profile.orgType}${profile.orgType2 ? ` / ${profile.orgType2}` : ""}`
      : null,
    profile.sector
      ? `Sector: ${profile.sector}${profile.subSector ? ` / ${profile.subSector}` : ""}`
      : null,
    profile.stage        ? `Stage: ${profile.stage}` : null,
    profile.teamSize     ? `Team Size: ${profile.teamSize}` : null,
    profile.annualRevenue ? `Annual Revenue: ${profile.annualRevenue}` : null,
    profile.location
      ? `Location: ${profile.location}, ${profile.country ?? "United States"}`
      : null,
    profile.yearFounded  ? `Year Founded: ${profile.yearFounded}` : null,
    (profile.focusAreas as string[] | null)?.length
      ? `Focus Areas: ${(profile.focusAreas as string[]).join(", ")}`
      : null,
    profile.targetFundingMin != null || profile.targetFundingMax != null
      ? `Target Funding: $${profile.targetFundingMin ?? 0} – $${profile.targetFundingMax ?? "Any"}`
      : null,
    profile.preferredDuration ? `Preferred Duration: ${profile.preferredDuration}` : null,
    profile.isRegisteredCharity ? "Registered Charity: Yes" : null,
    profile.hasEIN              ? "Has EIN: Yes" : null,
    profile.indigenousOwned     ? "Indigenous-owned: Yes" : null,
    profile.womanOwned          ? "Woman-owned: Yes" : null,
    profile.regionalOrRural     ? "Regional/Rural: Yes" : null,
    profile.missionStatement
      ? `\nMission Statement:\n${profile.missionStatement}`
      : null,
    profile.keyActivities
      ? `\nKey Activities:\n${profile.keyActivities}`
      : null,
    profile.uniqueStrengths
      ? `\nUnique Strengths:\n${profile.uniqueStrengths}`
      : null,
    profile.pastGrantsWon
      ? `\nPast Grants Won:\n${profile.pastGrantsWon}`
      : null,
  ].filter(Boolean);

  // Append extra documents (capability statements, initiative pages, etc.)
  const extraDocs = profile.extraDocs as { title: string; content: string }[] | null;
  if (extraDocs?.length) {
    for (const doc of extraDocs) {
      lines.push(`\n--- ${doc.title} ---\n${doc.content}`);
    }
  }

  return `## GRANT PROFILE\n${lines.join("\n")}`;
}

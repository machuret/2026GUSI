/**
 * _shared/profile.ts
 * Pure formatter for GrantProfile rows into AI prompt blocks.
 *
 * Exports:
 *  - buildProfileContext — formats a GrantProfile row as a ## GRANT PROFILE block
 */

/**
 * Builds a standardised `## GRANT PROFILE` prompt block from a GrantProfile row.
 * Returns an empty string if the profile has no displayable fields.
 *
 * @param profile  Raw GrantProfile row from the database.
 */
export function buildProfileContext(profile: Record<string, unknown>): string {
  const contacts = profile.contacts as
    | { name: string; role?: string; email?: string; phone?: string }[]
    | null;
  const lines: string[] = [];

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

  if (profile.orgType)
    lines.push(`Organisation Type: ${profile.orgType}${profile.orgType2 ? ` / ${profile.orgType2}` : ""}`);
  if (profile.sector)
    lines.push(`Sector: ${profile.sector}${profile.subSector ? ` / ${profile.subSector}` : ""}`);
  if (profile.stage)         lines.push(`Stage: ${profile.stage}`);
  if (profile.teamSize)      lines.push(`Team Size: ${profile.teamSize}`);
  if (profile.annualRevenue) lines.push(`Annual Revenue: ${profile.annualRevenue}`);
  if (profile.location)
    lines.push(`Location: ${profile.location}, ${profile.country ?? "United States"}`);
  if (profile.yearFounded)   lines.push(`Year Founded: ${profile.yearFounded}`);
  if ((profile.focusAreas as string[] | null)?.length)
    lines.push(`Focus Areas: ${(profile.focusAreas as string[]).join(", ")}`);
  if (profile.targetFundingMin != null || profile.targetFundingMax != null)
    lines.push(`Target Funding: $${profile.targetFundingMin ?? 0} – $${profile.targetFundingMax ?? "Any"}`);
  if (profile.preferredDuration)    lines.push(`Preferred Duration: ${profile.preferredDuration}`);
  if (profile.isRegisteredCharity)  lines.push("Registered Charity: Yes");
  if (profile.hasEIN)               lines.push("Has EIN: Yes");
  if (profile.indigenousOwned)      lines.push("Indigenous-owned: Yes");
  if (profile.womanOwned)           lines.push("Woman-owned: Yes");
  if (profile.regionalOrRural)      lines.push("Regional/Rural: Yes");
  if (profile.missionStatement)     lines.push(`\nMission Statement:\n${profile.missionStatement}`);
  if (profile.keyActivities)        lines.push(`\nKey Activities:\n${profile.keyActivities}`);
  if (profile.uniqueStrengths)      lines.push(`\nUnique Strengths:\n${profile.uniqueStrengths}`);
  if (profile.pastGrantsWon)        lines.push(`\nPast Grants Won:\n${profile.pastGrantsWon}`);

  const extraDocs = profile.extraDocs as { title: string; content: string }[] | null;
  if (extraDocs?.length) {
    for (const doc of extraDocs) {
      lines.push(`\n--- ${doc.title} ---\n${doc.content}`);
    }
  }

  return lines.length > 0 ? `## GRANT PROFILE\n${lines.join("\n")}` : "";
}

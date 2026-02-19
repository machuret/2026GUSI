import { HYPE_WORDS } from "./constants";

interface StyleProfile {
  tone: string;
  avgWordCount: number;
  vocabulary: string[];
  commonPhrases: string[];
  preferredFormats: string[];
  summary?: string;
}

interface CompanyInfo {
  bulkContent?: string;
  values?: string;
  corePhilosophy?: string;
  founders?: string;
  history?: string;
  achievements?: string;
}

interface ContentPost {
  platform: string;
  contentType: string;
  title?: string;
  body: string;
  style?: string;
  mustDo?: string;
  mustNot?: string;
  wordCount?: number;
  brandRules?: string;
}

interface Lesson {
  severity: string;
  contentType?: string;
  feedback: string;
}

interface PromptTemplate {
  systemPrompt: string;
}

interface BuildPromptOptions {
  companyName: string;
  companyIndustry?: string;
  categoryLabel: string;
  styleProfile: StyleProfile | null;
  recentPosts: ContentPost[];
  companyInfo: CompanyInfo | null;
  promptTemplate: PromptTemplate | null;
  lessons: Lesson[];
}

/**
 * Assembles the full system prompt for content generation.
 * Extracted from the generate route for testability and reuse.
 */
export function buildSystemPrompt({
  companyName,
  companyIndustry,
  categoryLabel,
  styleProfile,
  recentPosts,
  companyInfo,
  promptTemplate,
  lessons,
}: BuildPromptOptions): string {
  // 1. Writing DNA
  const dnaBlock = companyInfo?.bulkContent
    ? `\n\n═══ COMPANY WRITING DNA — FOLLOW THIS PRECISELY ═══\n${companyInfo.bulkContent}\n═══ END OF WRITING DNA ═══`
    : "";

  // 2. Company identity
  const identityParts: string[] = [];
  if (companyInfo?.values) identityParts.push(`Values: ${companyInfo.values}`);
  if (companyInfo?.corePhilosophy) identityParts.push(`Philosophy: ${companyInfo.corePhilosophy}`);
  if (companyInfo?.founders) identityParts.push(`Founders/Team: ${companyInfo.founders}`);
  if (companyInfo?.history) identityParts.push(`History: ${companyInfo.history}`);
  if (companyInfo?.achievements) identityParts.push(`Achievements: ${companyInfo.achievements}`);
  const identityBlock = identityParts.length > 0
    ? `\n\nCOMPANY IDENTITY:\n${identityParts.join("\n")}`
    : "";

  // 3. Style profile
  const styleBlock = styleProfile
    ? `\n\nANALYSED STYLE PROFILE (from ingested content):
- Tone: ${styleProfile.tone}
- Avg word count: ${styleProfile.avgWordCount}
- Signature vocabulary: ${styleProfile.vocabulary.join(", ")}
- Common phrases: ${styleProfile.commonPhrases.join(" | ")}
- Preferred formats: ${styleProfile.preferredFormats.join(", ")}
${styleProfile.summary ? `- Summary: ${styleProfile.summary}` : ""}`
    : "";

  // 4. Example posts
  const examplesBlock = recentPosts.length > 0
    ? "\n\nEXAMPLE POSTS FROM THIS COMPANY (match this style exactly):\n" +
      recentPosts
        .map(
          (p, i) =>
            `--- Example ${i + 1} (${p.platform}, ${p.contentType}) ---\n${p.title ? p.title + "\n" : ""}${p.body}`
        )
        .join("\n\n")
    : "";

  // 5. Category-specific rules (from ingested post matching this type)
  const typeRules = recentPosts.find((p) => p.contentType === categoryLabel.toLowerCase());
  const ruleParts: string[] = [];
  if (typeRules?.style) ruleParts.push(`- Style: ${typeRules.style}`);
  if (typeRules?.mustDo) ruleParts.push(`- Must include: ${typeRules.mustDo}`);
  if (typeRules?.mustNot) ruleParts.push(`- Must avoid: ${typeRules.mustNot}`);
  if (typeRules?.wordCount) ruleParts.push(`- Target word count: ${typeRules.wordCount}`);
  if (typeRules?.brandRules) ruleParts.push(`- Brand rules: ${typeRules.brandRules}`);
  const rulesBlock = ruleParts.length > 0
    ? `\n\nRULES FOR ${categoryLabel.toUpperCase()}:\n${ruleParts.join("\n")}`
    : "";

  // 6. Custom prompt template override
  const customBlock = promptTemplate
    ? `\n\nCUSTOM INSTRUCTIONS FOR ${categoryLabel.toUpperCase()}:\n${promptTemplate.systemPrompt}`
    : "";

  // 7. Lessons — high severity first
  const sortedLessons = [
    ...lessons.filter((l) => l.severity === "high"),
    ...lessons.filter((l) => l.severity !== "high"),
  ];
  const lessonsBlock = sortedLessons.length > 0
    ? `\n\nLESSONS FROM PAST REJECTIONS — APPLY ALL OF THESE STRICTLY (${sortedLessons.length} total):\n` +
      sortedLessons
        .map(
          (l, i) =>
            `${i + 1}. [${l.severity.toUpperCase()}]${l.contentType ? ` (${l.contentType})` : ""} ${l.feedback}`
        )
        .join("\n")
    : "";

  const industry = companyIndustry ? ` (${companyIndustry})` : "";

  return `You are the content writer for ${companyName}${industry}. You are writing a ${categoryLabel}.
${dnaBlock}${identityBlock}${styleBlock}${examplesBlock}${rulesBlock}${customBlock}${lessonsBlock}

OUTPUT RULES:
1. Follow the Writing DNA above as your primary instruction — it defines the voice, tone, structure, and vocabulary you must use.
2. Content type: ${categoryLabel}. Write content appropriate for this format.
3. Output ONLY the finished content — no meta-commentary, no "here is your content", no explanations.
4. Target length: ~${styleProfile?.avgWordCount ?? 200} words unless the format demands otherwise.
5. Apply every lesson from past rejections — these are mandatory corrections.
6. Never use: ${HYPE_WORDS}, or any hype adjectives.`;
}

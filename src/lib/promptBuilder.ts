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
  website?: string;
  linkedinUrl?: string;
  youtubeUrl?: string;
  facebookUrl?: string;
  hashtags?: string;
  products?: string;
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

export interface ContentBriefOptions {
  audience?: string;
  goal?: string;
  cta?: string;
  keywords?: string;
  tone?: number;   // 0=very formal, 2=balanced, 4=very casual
  length?: number; // 0=very short, 2=medium, 4=very long
  platform?: string;
}

interface VaultDoc {
  filename: string;
  content: string;
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
  vaultDocs?: VaultDoc[];
  brief?: ContentBriefOptions;
}

const TONE_INSTRUCTIONS = [
  "Use a very formal, professional tone. No contractions, no colloquialisms. Write like a senior executive.",
  "Use a formal, polished tone. Minimal contractions. Authoritative and clear.",
  "Use a balanced tone — professional but approachable. Natural language, occasional contractions.",
  "Use a casual, conversational tone. Contractions welcome. Write like you're talking to a friend.",
  "Use a very casual, relaxed tone. Informal language, personality, even humour where appropriate.",
];

const LENGTH_TARGETS: Record<string, number[]> = {
  social_media: [50, 80, 150, 250, 350],
  twitter:      [50, 80, 150, 250, 280],
  newsletter:   [200, 350, 500, 750, 1000],
  blog_post:    [300, 500, 800, 1200, 1800],
  cold_email:   [80, 120, 180, 250, 350],
  sales_page:   [200, 400, 700, 1000, 1500],
  default:      [100, 150, 250, 400, 600],
};

const PLATFORM_RULES: Record<string, string> = {
  linkedin:  "FORMAT FOR LINKEDIN: Start with a strong hook (first line must stop the scroll). Use short paragraphs (1-2 sentences max). Add line breaks between every paragraph. End with a question or CTA to drive comments. No hashtags in body — add 3-5 relevant hashtags at the very end.",
  instagram: "FORMAT FOR INSTAGRAM: Write a punchy first line (visible before 'more'). Use emojis naturally throughout. Keep it visual and personal. End with a CTA. Add 10-15 relevant hashtags on a new line at the end.",
  facebook:  "FORMAT FOR FACEBOOK: Conversational and community-focused. Can be longer than Instagram. Ask a question to drive engagement. Use 1-3 relevant hashtags only.",
  twitter:   "FORMAT FOR TWITTER/X: Maximum 280 characters for the main tweet. If writing a thread, number each tweet (1/, 2/, etc.). Be punchy and direct. No more than 2 hashtags.",
};

function getWordTarget(categoryKey: string, platform: string, lengthIndex: number): number {
  const key = platform && LENGTH_TARGETS[platform] ? platform : categoryKey;
  const targets = LENGTH_TARGETS[key] ?? LENGTH_TARGETS.default;
  return targets[Math.min(lengthIndex, 4)];
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
  vaultDocs,
  brief,
}: BuildPromptOptions): string {
  const toneIndex = brief?.tone ?? 2;
  const lengthIndex = brief?.length ?? 2;
  const platform = brief?.platform ?? "";

  // Derive category key from label for length lookup
  const categoryKey = categoryLabel.toLowerCase().replace(/\s+/g, "_");
  const wordTarget = getWordTarget(categoryKey, platform, lengthIndex);

  // 1. Writing DNA
  const dnaBlock = companyInfo?.bulkContent
    ? `\n\n═══ COMPANY WRITING DNA — FOLLOW THIS PRECISELY ═══\n${companyInfo.bulkContent}\n═══ END OF WRITING DNA ═══`
    : "";

  // 2. Company identity
  const identityParts: string[] = [];
  if (companyInfo?.website) identityParts.push(`Website: ${companyInfo.website}`);
  if (companyInfo?.values) identityParts.push(`Values: ${companyInfo.values}`);
  if (companyInfo?.corePhilosophy) identityParts.push(`Philosophy: ${companyInfo.corePhilosophy}`);
  if (companyInfo?.founders) identityParts.push(`Founders/Team: ${companyInfo.founders}`);
  if (companyInfo?.history) identityParts.push(`History: ${companyInfo.history}`);
  if (companyInfo?.achievements) identityParts.push(`Achievements: ${companyInfo.achievements}`);
  if (companyInfo?.products) identityParts.push(`Products/Services: ${companyInfo.products}`);
  const socialParts: string[] = [];
  if (companyInfo?.linkedinUrl) socialParts.push(`LinkedIn: ${companyInfo.linkedinUrl}`);
  if (companyInfo?.youtubeUrl) socialParts.push(`YouTube: ${companyInfo.youtubeUrl}`);
  if (companyInfo?.facebookUrl) socialParts.push(`Facebook: ${companyInfo.facebookUrl}`);
  if (companyInfo?.hashtags) socialParts.push(`Brand hashtags: ${companyInfo.hashtags}`);
  if (socialParts.length) identityParts.push(`Social presence: ${socialParts.join(" | ")}`);
  const identityBlock = identityParts.length > 0
    ? `\n\nCOMPANY IDENTITY:\n${identityParts.join("\n")}`
    : "";

  // 3. Style profile
  const styleBlock = styleProfile
    ? `\n\nANALYSED STYLE PROFILE (from ingested content):
- Tone: ${styleProfile.tone}
- Avg word count: ${styleProfile.avgWordCount}
- Signature vocabulary: ${Array.isArray(styleProfile.vocabulary) ? styleProfile.vocabulary.join(", ") : ""}
- Common phrases: ${Array.isArray(styleProfile.commonPhrases) ? styleProfile.commonPhrases.join(" | ") : ""}
- Preferred formats: ${Array.isArray(styleProfile.preferredFormats) ? styleProfile.preferredFormats.join(", ") : ""}
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

  // 5. Category-specific rules
  const typeRules = recentPosts.find((p) => p.contentType === categoryLabel.toLowerCase());
  const ruleParts: string[] = [];
  if (typeRules?.style) ruleParts.push(`- Style: ${typeRules.style}`);
  if (typeRules?.mustDo) ruleParts.push(`- Must include: ${typeRules.mustDo}`);
  if (typeRules?.mustNot) ruleParts.push(`- Must avoid: ${typeRules.mustNot}`);
  if (typeRules?.brandRules) ruleParts.push(`- Brand rules: ${typeRules.brandRules}`);
  const rulesBlock = ruleParts.length > 0
    ? `\n\nRULES FOR ${categoryLabel.toUpperCase()}:\n${ruleParts.join("\n")}`
    : "";

  // 6. Platform-specific formatting
  const platformBlock = platform && PLATFORM_RULES[platform]
    ? `\n\n${PLATFORM_RULES[platform]}`
    : "";

  // 7. Custom prompt template override
  const customBlock = promptTemplate
    ? `\n\nCUSTOM INSTRUCTIONS FOR ${categoryLabel.toUpperCase()}:\n${promptTemplate.systemPrompt}`
    : "";

  // 8. Lessons — high severity first
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

  // 9. Vault knowledge
  const vaultBlock = vaultDocs && vaultDocs.length > 0
    ? `\n\nKNOWLEDGE VAULT (research and reference material — use this to inform your content):\n` +
      vaultDocs
        .map((d) => `--- ${d.filename} ---\n${d.content.slice(0, 2000)}`)
        .join("\n\n")
    : "";

  // 10. Brief context block
  const briefParts: string[] = [];
  if (brief?.audience) briefParts.push(`- Target audience: ${brief.audience}`);
  if (brief?.goal) briefParts.push(`- Goal: ${brief.goal}`);
  if (brief?.cta) briefParts.push(`- Call to action: ${brief.cta}`);
  if (brief?.keywords) briefParts.push(`- Include these keywords/hashtags: ${brief.keywords}`);
  const briefBlock = briefParts.length > 0
    ? `\n\nCONTENT BRIEF:\n${briefParts.join("\n")}`
    : "";

  const industry = companyIndustry ? ` (${companyIndustry})` : "";

  return `You are the content writer for ${companyName}${industry}. You are writing a ${categoryLabel}.
${dnaBlock}${identityBlock}${styleBlock}${examplesBlock}${rulesBlock}${platformBlock}${customBlock}${vaultBlock}${lessonsBlock}${briefBlock}

OUTPUT RULES:
1. Follow the Writing DNA above as your primary instruction — it defines the voice, tone, structure, and vocabulary you must use.
2. Content type: ${categoryLabel}${platform ? ` for ${platform}` : ""}. Write content appropriate for this format.
3. Output ONLY the finished content — no meta-commentary, no "here is your content", no explanations.
4. Target length: ~${wordTarget} words.
5. ${TONE_INSTRUCTIONS[toneIndex]}
6. Apply every lesson from past rejections — these are mandatory corrections.
7. Never use: ${HYPE_WORDS}, or any hype adjectives.`;
}

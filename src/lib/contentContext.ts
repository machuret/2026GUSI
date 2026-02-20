import { db } from "./db";
import { buildSystemPrompt } from "./promptBuilder";
import type { ContentBriefOptions, BuildPromptOptions } from "./promptBuilder";
import { CATEGORIES } from "./content";
import { generationContextCache } from "./cache";
import { getFAQContext } from "./aiContext";

/**
 * Fetches all context needed to build a generation prompt for a given company + category.
 * Extracted to eliminate the identical 5-query block duplicated across generate, generate-ab,
 * and generate-bulk routes.
 */
type GenerationContext = Pick<BuildPromptOptions, "styleProfile" | "recentPosts" | "companyInfo" | "promptTemplate" | "lessons" | "vaultDocs" | "faqBlock">;

export async function loadGenerationContext(
  companyId: string,
  category: string
): Promise<GenerationContext> {
  const cacheKey = `gen-ctx:${companyId}:${category}`;
  const cached = generationContextCache.get(cacheKey) as GenerationContext | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (cached) return cached;

  const [styleRes, postsRes, infoRes, promptRes, lessonsRes, vaultRes, faqCtx] = await Promise.all([
    db.from("StyleProfile").select("*").eq("companyId", companyId).maybeSingle(),
    db.from("ContentPost").select("*").eq("companyId", companyId).order("createdAt", { ascending: false }).limit(5),
    db.from("CompanyInfo").select("*").eq("companyId", companyId).maybeSingle(),
    db.from("PromptTemplate").select("*").eq("companyId", companyId).eq("contentType", category).eq("active", true).limit(1),
    db.from("Lesson").select("*").eq("companyId", companyId).eq("active", true).or(`contentType.eq.${category},contentType.is.null`).order("createdAt", { ascending: false }).limit(30),
    db.from("Document").select("filename, content").eq("companyId", companyId).order("createdAt", { ascending: false }).limit(10),
    getFAQContext({ companyId }),
  ]);

  const ctx: GenerationContext = {
    styleProfile: styleRes.data ?? null,
    recentPosts: postsRes.data ?? [],
    companyInfo: infoRes.data ?? null,
    promptTemplate: promptRes.data?.[0] ?? null,
    lessons: lessonsRes.data ?? [],
    vaultDocs: vaultRes.data ?? [],
    faqBlock: faqCtx.block,
  };

  generationContextCache.set(cacheKey, ctx);
  return ctx;
}

/**
 * Loads context AND builds the system prompt in one call.
 * Use this in generate routes — replaces the 30-line boilerplate block.
 */
export async function buildGenerationPrompt(
  company: { name: string; industry?: string },
  companyId: string,
  category: string,
  brief?: ContentBriefOptions
): Promise<string> {
  const catLabel = CATEGORIES.find((c) => c.key === category)?.label ?? category;
  const ctx = await loadGenerationContext(companyId, category);

  return buildSystemPrompt({
    companyName: company.name,
    companyIndustry: company.industry,
    categoryLabel: catLabel,
    styleProfile: ctx.styleProfile,
    recentPosts: ctx.recentPosts,
    companyInfo: ctx.companyInfo,
    promptTemplate: ctx.promptTemplate,
    lessons: ctx.lessons,
    vaultDocs: ctx.vaultDocs,
    faqBlock: ctx.faqBlock,
    brief,
  });
}

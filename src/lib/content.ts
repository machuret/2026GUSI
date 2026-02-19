import { db } from "./db";

export interface ContentRecord {
  id: string;
  companyId: string;
  userId: string;
  prompt: string;
  output: string;
  status: string;
  feedback?: string | null;
  revisionOf?: string | null;
  revisionNumber: number;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface ContentWithMeta extends ContentRecord {
  category: string;
  categoryLabel: string;
  user?: { name: string; email: string } | null;
}

/**
 * The 9 content categories — each maps to its own Supabase table.
 * Table names use the exact Prisma-generated names (PascalCase).
 */
export const CATEGORIES = [
  { key: "newsletter",     label: "Newsletter",     table: "Newsletter" },
  { key: "offer",          label: "Offer",          table: "Offer" },
  { key: "webinar",        label: "Webinar",        table: "Webinar" },
  { key: "social_media",   label: "Social Media",   table: "SocialMedia" },
  { key: "announcement",   label: "Announcement",   table: "Announcement" },
  { key: "blog_post",      label: "Blog Post",      table: "BlogPost" },
  { key: "course_content", label: "Course Content", table: "CourseContent" },
  { key: "sales_page",     label: "Sales Page",     table: "SalesPage" },
  { key: "cold_email",     label: "Cold Email",     table: "ColdEmail" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

function getTable(category: string): string {
  const cat = CATEGORIES.find((c) => c.key === category);
  if (!cat) throw new Error(`Invalid content category: "${category}"`);
  return cat.table;
}

/**
 * Create a new content record in the correct category table.
 */
export async function createContent(category: string, data: Record<string, unknown>) {
  const table = getTable(category);
  const { data: record, error } = await db.from(table).insert(data).select().single();
  if (error) throw new Error(`createContent(${category}): ${error.message}`);
  return record as ContentRecord;
}

/**
 * Update a content record in the correct category table.
 */
export async function updateContent(category: string, id: string, data: Record<string, unknown>) {
  const table = getTable(category);
  const { data: record, error } = await db.from(table).update(data).eq("id", id).select().single();
  if (error) throw new Error(`updateContent(${category}): ${error.message}`);
  return record as ContentRecord;
}

export interface HistoryOptions {
  page?: number;
  limit?: number;
}

/**
 * Fetch history from ALL 9 tables for a company, merged & sorted by createdAt desc.
 * Supports pagination via page (1-indexed) and limit.
 */
export async function getAllHistory(
  companyId: string,
  { page = 1, limit = 50 }: HistoryOptions = {}
): Promise<{ items: ContentWithMeta[]; total: number }> {
  const results = await Promise.all(
    CATEGORIES.map(async (cat) => {
      const { data: items } = await db
        .from(cat.table)
        .select("*, user:User(name, email)")
        .eq("companyId", companyId)
        .order("createdAt", { ascending: false });

      return (items ?? []).map((item) => ({
        ...(item as ContentRecord),
        category: cat.key,
        categoryLabel: cat.label,
      }));
    })
  );

  const all = results.flat().sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const start = (page - 1) * limit;
  return { items: all.slice(start, start + limit), total: all.length };
}

/**
 * Find a content record across ALL tables by id.
 * Runs all 9 queries in parallel — much faster than sequential loop.
 */
export async function findContentById(id: string) {
  const results = await Promise.all(
    CATEGORIES.map(async (cat) => {
      const { data: record } = await db
        .from(cat.table)
        .select("*, company:Company(name, id)")
        .eq("id", id)
        .maybeSingle();
      return record ? { record: record as ContentRecord, category: cat.key, categoryLabel: cat.label } : null;
    })
  );
  return results.find((r) => r !== null) ?? null;
}

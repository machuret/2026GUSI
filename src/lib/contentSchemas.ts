import { z } from "zod";
import { CATEGORIES } from "./content";

export const categoryKeys = CATEGORIES.map((c) => c.key) as [string, ...string[]];

/**
 * Shared brief schema used by generate, generate-ab, and generate-bulk routes.
 */
export const briefSchema = z.object({
  audience: z.string().max(500).optional(),
  goal: z.string().max(500).optional(),
  cta: z.string().max(300).optional(),
  keywords: z.string().max(500).optional(),
  tone: z.number().min(0).max(4).optional(),
  length: z.number().min(0).max(4).optional(),
  platform: z.string().max(100).optional(),
});

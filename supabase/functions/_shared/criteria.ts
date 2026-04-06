/**
 * _shared/criteria.ts
 * Types and pure formatter for funder evaluation requirements.
 *
 * Exports:
 *  - AiRequirements    — shape of the aiRequirements JSON column
 *  - buildCriteriaBlock — formats an AiRequirements object as a prompt block
 */

/**
 * Shape of the `aiRequirements` JSON column extracted by grant-brief.
 * All fields are optional because requirements extraction may be partial.
 */
export interface AiRequirements {
  /** Funder evaluation criteria — each item should be addressed in the application. */
  criteria?: string[];
  /** Scoring rubric items — describes how the funder weighs responses. */
  evaluationRubric?: string[];
  /** Hard gate requirements — the application fails without these. */
  mandatoryRequirements?: string[];
  /** Per-section word or character limits specified by the funder. */
  wordLimits?: Record<string, number>;
}

/**
 * Converts an `AiRequirements` object into a `## FUNDER REQUIREMENTS` prompt block.
 * Returns an empty string when no requirements are present, so callers can safely
 * interpolate the result without extra null-checks.
 *
 * @param req  The requirements object, or null/undefined if not yet extracted.
 */
export function buildCriteriaBlock(req: AiRequirements | null | undefined): string {
  if (!req) return "";
  const parts: string[] = [];
  if (req.criteria?.length)
    parts.push(`Evaluation Criteria (ensure each is addressed):\n${req.criteria.map((c) => `- ${c}`).join("\n")}`);
  if (req.evaluationRubric?.length)
    parts.push(`Scoring Rubric:\n${req.evaluationRubric.map((r) => `- ${r}`).join("\n")}`);
  if (req.mandatoryRequirements?.length)
    parts.push(`Mandatory Requirements (hard gates — must be satisfied):\n${req.mandatoryRequirements.map((r) => `- ${r}`).join("\n")}`);
  return parts.length > 0
    ? `## FUNDER REQUIREMENTS (your writing MUST satisfy these)\n${parts.join("\n\n")}`
    : "";
}

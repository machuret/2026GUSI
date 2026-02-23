/**
 * Normalise a grant name for comparison: lowercase, strip common prefixes/suffixes,
 * collapse whitespace, remove punctuation.
 */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[''"""\-–—]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\b(the|a|an|grant|program|programme|fund|funding|scheme|initiative|award)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build a set of trigrams from a string.
 */
function trigrams(s: string): Set<string> {
  const t = new Set<string>();
  const padded = `  ${s} `;
  for (let i = 0; i < padded.length - 2; i++) {
    t.add(padded.slice(i, i + 3));
  }
  return t;
}

/**
 * Trigram similarity between two strings (0–1). 1 = identical after normalisation.
 */
function trigramSimilarity(a: string, b: string): number {
  const ta = trigrams(normalise(a));
  const tb = trigrams(normalise(b));
  let intersection = 0;
  ta.forEach((t) => { if (tb.has(t)) intersection++; });
  const union = ta.size + tb.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/**
 * Check if a candidate name fuzzy-matches any name in the existing set.
 * Returns the matched name if similarity >= threshold, or null.
 */
export function fuzzyMatchesExisting(
  candidate: string,
  existingNames: Set<string>,
  threshold = 0.55,
): string | null {
  const normCandidate = normalise(candidate);
  for (const existing of Array.from(existingNames)) {
    // Exact normalised match
    if (normalise(existing) === normCandidate) return existing;
    // Trigram similarity
    if (trigramSimilarity(candidate, existing) >= threshold) return existing;
  }
  return null;
}

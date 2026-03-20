export const runtime = 'nodejs';
export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callOpenAIJson } from "@/lib/openai";
import { requireEdgeAuth } from "@/lib/edgeAuth";
import { handleOptions } from "@/lib/cors";
import { getCompanyContext } from "@/lib/aiContext";
import { DEMO_COMPANY_ID } from "@/lib/constants";

const bodySchema = z.object({
  query: z.string().max(500).optional(),
  geographicScope: z.string().optional(),
  applicantCountry: z.string().optional(),
  orgType: z.string().optional(),
  fundingSize: z.string().optional(),
  deadlineUrgency: z.string().optional(),
  eligibilityType: z.string().optional(),
  grantType: z.string().optional(),
  companyDNA: z.string().max(5000).optional(),
  existingNames: z.array(z.string()).max(500).optional(),
}).refine(
  (d) => d.query || d.grantType || d.orgType || d.geographicScope,
  { message: "At least one search filter is required" }
);

/** Extract the registrable domain from a URL string, e.g. "globalultrasoundinstitute.com" */
function extractDomain(url: string): string | null {
  try {
    const { hostname } = new URL(url.startsWith("http") ? url : `https://${url}`);
    // Strip www. prefix
    return hostname.replace(/^www\./, "").toLowerCase();
  } catch { return null; }
}

export async function OPTIONS() { return handleOptions(); }

export async function POST(req: NextRequest) {
  try {
    const { error: authError } = await requireEdgeAuth(req);
    if (authError) return authError;

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { query, geographicScope, applicantCountry, orgType, fundingSize, deadlineUrgency, eligibilityType, grantType, companyDNA, existingNames } = parsed.data;

    // Load company website for domain blocklist
    const company = await getCompanyContext(DEMO_COMPANY_ID);
    const ownDomain = company.website ? extractDomain(company.website) : null;

    const systemPrompt = `You are a world-class grant research specialist with encyclopaedic knowledge of global, national, and regional funding programs. Your mission is to find the maximum number of real, currently active (or annually recurring) grant opportunities that precisely match the given filters.

Return ONLY valid JSON in this exact format:
{
  "results": [
    {
      "name": "<full official grant name>",
      "founder": "<granting organisation name>",
      "url": "<official application or info URL — must be a real, verifiable URL>",
      "deadlineDate": "<ISO date YYYY-MM-DD or null if ongoing/rolling>",
      "geographicScope": "<Global | United States | UK | Australia | Europe | Asia | Africa | Sub-Saharan Africa | Latin America | Middle East | Canada | New Zealand | or specific country>",
      "amount": "<funding amount or range, e.g. 'Up to $50,000' or null>",
      "eligibility": "<who can apply — org type, sector, location, stage, size>",
      "howToApply": "<brief application process — portal name, steps, timeline>",
      "projectDuration": "<allowed project duration or null>",
      "submissionEffort": "<Low | Medium | High>",
      "fitReason": "<1–2 sentences: exactly why this grant matches the filters and company profile>",
      "confidence": "<High | Medium | Low — your confidence this grant is real, active, and correctly described>"
    }
  ]
}

RULES:
- Return up to 20 grants. Push yourself to find as many real matches as possible — do not stop at 5 or 10.
- Include grants from government bodies, foundations, accelerators, corporate programs, and international organisations.
- Only return grants you have genuine knowledge of. Never fabricate a grant name or URL.
- If a URL is uncertain, omit it (set to null) rather than guess.
- Strictly respect ALL filters — wrong org type or geography = exclude.
- Prioritise currently open grants, then annually recurring ones.
- Rank by fit score if company DNA is provided.
- If existingNames are provided, DO NOT return any grant whose name closely matches one in that list.`;

    const filters: string[] = [];
    if (query)            filters.push(`Keywords/topic: ${query}`);
    if (grantType)        filters.push(`Grant type: ${grantType}`);
    if (geographicScope)  filters.push(`Grant geographic scope: ${geographicScope}`);
    if (applicantCountry) filters.push(`Applicant country (where our org is based): ${applicantCountry}`);
    if (orgType)          filters.push(`Organisation type: ${orgType}`);
    if (eligibilityType)  filters.push(`Eligibility: ${eligibilityType}`);
    if (fundingSize)      filters.push(`Funding size: ${fundingSize}`);
    if (deadlineUrgency)  filters.push(`Deadline: ${deadlineUrgency}`);

    const dnaSection = companyDNA
      ? `\nCOMPANY PROFILE (rank results by relevance to this):\n${companyDNA.slice(0, 2500)}`
      : "";

    const excludeSection = existingNames && existingNames.length > 0
      ? `\nEXCLUDE THESE (already in our database — do not return them):\n${existingNames.slice(0, 200).join(", ")}`
      : "";

    const userPrompt = `Find up to 20 real grant opportunities matching ALL of these filters:

${filters.join("\n")}${dnaSection}${excludeSection}

Be exhaustive — search your knowledge across government grants, foundations, corporate programs, EU funds, UN programs, bilateral aid, and private philanthropy. Return as many real matches as you can find (up to 20).`;

    let result: Record<string, unknown>;
    try {
      result = await callOpenAIJson({ systemPrompt, userPrompt, maxTokens: 4000, temperature: 0.2 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI failed";
      const isJsonErr = msg.toLowerCase().includes("json") || msg.toLowerCase().includes("token");
      return NextResponse.json({
        error: isJsonErr
          ? "AI returned a malformed response — please try again. If this keeps happening, reduce the number of filters."
          : msg,
      }, { status: 500 });
    }

    let rawResults = (result.results as Record<string, unknown>[]) ?? [];

    // ── Pass 1: Strip own company domain ──────────────────────────────────────
    if (ownDomain) {
      rawResults = rawResults.filter((r) => {
        const resultDomain = typeof r.url === "string" ? extractDomain(r.url) : null;
        const founderStr = typeof r.founder === "string" ? r.founder.toLowerCase() : "";
        const nameStr = typeof r.name === "string" ? r.name.toLowerCase() : "";
        // Block if URL is own domain, or if name/founder contains own company name
        if (resultDomain && resultDomain === ownDomain) return false;
        if (company.companyName) {
          const own = company.companyName.toLowerCase();
          if (nameStr.includes(own) || founderStr.includes(own)) return false;
        }
        return true;
      });
    }

    if (rawResults.length === 0) {
      return NextResponse.json({ success: true, results: [] });
    }

    // ── Pass 2: AI verification — confirm each result is a real grant ─────────
    const verifySystemPrompt = `You are a grant verification specialist. For each item in the list, determine whether it is a genuine external grant/funding opportunity that an organisation could apply for.

REJECT if:
- It is the applicant's own company, product, or website
- It is a consultancy, service provider, or training course — not a grant
- It is a news article, blog post, or directory listing — not a grant
- The URL or name clearly belongs to the applicant organisation itself
- It is too vague to be a real, identifiable grant program

KEEP if:
- It is a real, named grant program offered by a government, foundation, corporation, or philanthropic body
- There is genuine external funding involved that an eligible organisation could receive
- You have reasonable confidence it exists or has existed

Return ONLY valid JSON:
{"verified": [{"idx": <original index 0-based>, "keep": true|false, "reason": "<one short reason if false>"}]}`;

    const verifyUserPrompt = `Verify each of these grant results. Company domain to block: ${ownDomain ?? "none"}. Company name to block: ${company.companyName ?? "none"}.

${rawResults.map((r, i) => `[${i}] Name: ${r.name}\nFounder: ${r.founder ?? "unknown"}\nURL: ${r.url ?? "none"}`).join("\n\n")}`;

    let verified: Record<string, unknown>[] = rawResults; // default: keep all if verification fails
    try {
      const verifyResult = await callOpenAIJson<{ verified: { idx: number; keep: boolean }[] }>({
        systemPrompt: verifySystemPrompt,
        userPrompt: verifyUserPrompt,
        model: "gpt-4o-mini",
        maxTokens: 1000,
        temperature: 0,
      });

      if (Array.isArray(verifyResult.verified)) {
        const keepSet = new Set(
          verifyResult.verified.filter((v) => v.keep).map((v) => v.idx)
        );
        // If verification returned meaningful results, apply the filter
        if (keepSet.size > 0 || verifyResult.verified.length === rawResults.length) {
          verified = rawResults.filter((_, i) => keepSet.has(i));
        }
      }
    } catch {
      // Verification failed — return unfiltered results rather than nothing
      verified = rawResults;
    }

    return NextResponse.json({ success: true, results: verified });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { getVaultContext } from "@/lib/aiContext";
import { DEMO_COMPANY_ID } from "@/lib/constants";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

// Fields that AI can fill
const FILLABLE_FIELDS = [
  "missionStatement",
  "keyActivities",
  "uniqueStrengths",
  "pastGrantsWon",
  "sector",
  "subSector",
  "orgType",
  "orgType2",
  "yearFounded",
  "teamSize",
  "annualRevenue",
] as const;

export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const currentProfile = await req.json();

    // Find which fields are empty
    const emptyFields = FILLABLE_FIELDS.filter((f) => {
      const v = currentProfile[f];
      return !v || (typeof v === "string" && !v.trim());
    });

    if (emptyFields.length === 0) {
      return NextResponse.json({ profile: {}, filledCount: 0, message: "All fields already filled" });
    }

    // Get vault context for relevant docs
    const vault = await getVaultContext(DEMO_COMPANY_ID, "organisation profile mission activities strengths grants history team");

    if (!vault.block) {
      return NextResponse.json({ error: "No Vault documents found. Upload documents first." }, { status: 400 });
    }

    const systemPrompt = `You are helping fill out a grant profile for an organisation. Based on the provided knowledge vault documents, extract factual information to fill the empty profile fields listed below.

${vault.block}

RULES:
- Only return values you can confidently extract or infer from the documents
- For text fields (missionStatement, keyActivities, uniqueStrengths, pastGrantsWon), write clear, concise prose suitable for a grant application
- For select fields, pick the best match from the allowed values:
  - sector: one of "Health & Medical", "Education & Training", "Technology & Innovation", "Environment & Sustainability", "Arts & Culture", "Community Services", "Agriculture & Food", "Export & Trade", "Manufacturing", "Other"
  - orgType: one of "Non-profit / Charity", "Social Enterprise", "SME (Small-Medium Business)", "Startup", "University / Research Institute", "Government / Council", "Indigenous Organisation", "Other"
  - orgType2: secondary type if applicable, same options as orgType
  - teamSize: one of "Solo / 1 person", "2-5", "6-20", "21-50", "50+"
  - annualRevenue: one of "Pre-revenue", "Under $250k", "$250k–$500k", "$500k–$1M", "$1M–$5M", "$5M+"
- For yearFounded, return just the year as a string
- If you cannot determine a field's value from the documents, omit it from the response
- Return ONLY a JSON object with the field names as keys and the values as strings`;

    const userPrompt = `The following profile fields are empty and need to be filled:\n${emptyFields.map((f) => `- ${f}`).join("\n")}\n\nReturn a JSON object with only the fields you can fill.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[profile-autofill] OpenAI error:", err);
      throw new Error("OpenAI request failed");
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No response from AI");

    const filled = JSON.parse(content);

    // Only keep fields that were actually empty
    const result: Record<string, string> = {};
    let count = 0;
    for (const key of emptyFields) {
      if (filled[key] && typeof filled[key] === "string" && filled[key].trim()) {
        result[key] = filled[key].trim();
        count++;
      }
    }

    return NextResponse.json({ profile: result, filledCount: count });
  } catch (err) {
    return handleApiError(err, "Profile Autofill");
  }
}

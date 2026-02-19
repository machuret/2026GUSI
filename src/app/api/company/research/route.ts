export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { callOpenAIJson } from "@/lib/openai";

export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { url, content } = await req.json();
    if (!content) return NextResponse.json({ error: "content is required" }, { status: 400 });

    const result = await callOpenAIJson<{
      companyName: string;
      linkedinUrl: string;
      youtubeUrl: string;
      facebookUrl: string;
      hashtags: string;
      products: string;
      values: string;
      corePhilosophy: string;
      founders: string;
      history: string;
      achievements: string;
      bulkContent: string;
    }>({
      systemPrompt: `You are a company research specialist. Given webpage content, extract structured company information.
Return a JSON object with these exact keys (use empty string "" if not found):
- companyName: official company name
- linkedinUrl: LinkedIn company page URL (full URL or empty)
- youtubeUrl: YouTube channel URL (full URL or empty)
- facebookUrl: Facebook page URL (full URL or empty)
- hashtags: relevant hashtags for social media (space-separated, e.g. "#POCUS #Ultrasound #MedEd")
- products: list of main products, courses, programs or services (2-5 sentences)
- values: core values and mission (2-3 sentences)
- corePhilosophy: company philosophy and market positioning (2-4 sentences)
- founders: founder names, backgrounds, credentials (2-3 sentences)
- history: company history and key milestones (2-4 sentences)
- achievements: notable achievements, metrics, awards, global reach (2-3 sentences)
- bulkContent: comprehensive brand voice guide — tone, vocabulary, writing style, audience, guardrails (5-10 sentences)`,
      userPrompt: `Website URL: ${url}\n\nWebpage content:\n${content.slice(0, 8000)}`,
      maxTokens: 2000,
      temperature: 0.2,
      jsonMode: true,
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, "Company Research");
  }
}

// Supabase Edge Function: grant-research
// AI-powered grant research to auto-fill grant details from URL crawling

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("grant-research");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyAuth(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPrivateUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return (
      host === "localhost" ||
      host.startsWith("127.") ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.endsWith(".local")
    );
  } catch {
    return true;
  }
}

async function crawlUrl(url: string): Promise<string> {
  if (isPrivateUrl(url)) return "";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) return "";
    const html = await res.text();
    return stripHtml(html).slice(0, 6000);
  } catch {
    return "";
  }
}

async function callOpenAI(systemPrompt: string, userPrompt: string) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 800,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    promptTokens: data.usage.prompt_tokens,
    completionTokens: data.usage.completion_tokens,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Allow service-role key auth for internal/webhook calls
    const authHeader = req.headers.get("authorization") ?? "";
    const isServiceCall = SERVICE_ROLE_KEY && authHeader === `Bearer ${SERVICE_ROLE_KEY}`;

    if (!isServiceCall) {
      const user = await verifyAuth(req);
      if (!user) return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const { grantId, name, url, founder, existingData } = body;

    if (!grantId && !name && !url) {
      return json({ error: "grantId, name, or url required" }, 400);
    }

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    let grantName = name;
    let grantUrl = url;
    let grantFounder = founder;
    let grantData = existingData;

    // If grantId provided, fetch the grant from DB
    if (grantId) {
      const { data, error } = await db.from("Grant").select("*").eq("id", grantId).maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Grant not found" }, 404);
      
      grantName = grantName ?? data.name;
      grantUrl = grantUrl ?? data.url;
      grantFounder = grantFounder ?? data.founder;
      grantData = grantData ?? data;
    }

    // Crawl the grant URL for real page content
    let crawledContent = "";
    if (grantUrl) {
      crawledContent = await crawlUrl(grantUrl);
    }

    const systemPrompt = `You are a grant research assistant. Given a grant name, organisation, optional URL, and any crawled page content, research and fill in as many details as possible about this grant opportunity.

Return ONLY valid JSON in this exact format, no markdown, no explanation:
{
  "eligibility": "<who can apply — organisation type, sector, location, stage, size>",
  "howToApply": "<application process, steps, portal, documents required>",
  "amount": "<funding amount or range, e.g. Up to $50,000 or £10,000–£100,000>",
  "geographicScope": "<one of: Global | United States | UK | Australia | Europe | Asia | Africa | Sub-Saharan Africa | Latin America | Middle East | Canada | or specific country>",
  "projectDuration": "<allowed project duration, e.g. 6–24 months or Up to 3 years>",
  "submissionEffort": "<one of: Low | Medium | High — based on complexity of application>",
  "notes": "<any important notes, restrictions, or tips about this grant>"
}

RULES:
- Prioritise information from the crawled page content over your training data.
- If you cannot determine a field with reasonable confidence, return null for that field.
- Do not guess or fabricate specific numbers.`;

    const crawlBlock = crawledContent
      ? `\n\nCRAWLED PAGE CONTENT (from ${grantUrl}):\n${crawledContent}`
      : "";

    const userPrompt = `Research this grant and fill in the missing details:

Grant Name: ${grantName ?? "Unknown"}
Organisation/Founder: ${grantFounder ?? "Unknown"}
URL: ${grantUrl ?? "Not provided"}

Existing known data:
${JSON.stringify(grantData ?? {}, null, 2)}${crawlBlock}

Fill in as many fields as you can.`;

    const aiResult = await callOpenAI(systemPrompt, userPrompt);

    // Log AI usage
    await db.from("AiUsageLog").insert({
      model: "gpt-4o-mini",
      feature: "grants_research",
      promptTokens: aiResult.promptTokens,
      completionTokens: aiResult.completionTokens,
      createdAt: new Date().toISOString(),
    });

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(aiResult.content);
    } catch {
      return json({ error: "AI returned invalid JSON" }, 500);
    }

    // Whitelist only known grant fields
    const ALLOWED_KEYS = new Set([
      "eligibility", "howToApply", "amount", "geographicScope",
      "projectDuration", "submissionEffort", "notes",
    ]);
    
    const filled: Record<string, string> = {};
    for (const [k, v] of Object.entries(result)) {
      if (ALLOWED_KEYS.has(k) && v !== null && v !== undefined && v !== "") {
        filled[k] = v as string;
      }
    }

    // If grantId provided, persist filled fields to Grant record
    if (grantId && Object.keys(filled).length > 0) {
      await db.from("Grant").update({
        ...filled,
        aiResearched: true,
        updatedAt: new Date().toISOString(),
      }).eq("id", grantId);
    }

    // Include aiResearched in response so UI can update immediately
    const response = grantId ? { ...filled, aiResearched: true } : filled;
    
    log.info("Research complete", { 
      grantId: grantId?.slice(0, 8), 
      fieldsFound: Object.keys(filled).length 
    });
    
    return json({ success: true, filled: response });
  } catch (err) {
    log.error("Research failed", { error: String(err), stack: err instanceof Error ? err.stack : undefined });
    return json({ error: String(err) }, 500);
  }
});

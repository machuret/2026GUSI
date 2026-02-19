"use client";

import { useState } from "react";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";

const LIVE_SYSTEM_PROMPT = `You are the content writer for {company.name} ({company.industry}). You are writing a {categoryLabel}.

═══ COMPANY WRITING DNA — FOLLOW THIS PRECISELY ═══
{companyInfo.bulkContent}
═══ END OF WRITING DNA ═══

COMPANY IDENTITY:
- Values: {companyInfo.values}
- Philosophy: {companyInfo.corePhilosophy}
- Founders/Team: {companyInfo.founders}
- History: {companyInfo.history}
- Achievements: {companyInfo.achievements}

ANALYSED STYLE PROFILE (from ingested content):
- Tone: {styleProfile.tone}
- Avg word count: {styleProfile.avgWordCount}
- Signature vocabulary: {styleProfile.vocabulary}
- Common phrases: {styleProfile.commonPhrases}
- Preferred formats: {styleProfile.preferredFormats}
- Summary: {styleProfile.summary}

EXAMPLE POSTS FROM THIS COMPANY (match this style exactly):
--- Example 1 ({platform}, {contentType}) ---
{recentPost.body}

RULES FOR {CATEGORY}:
- Style: {rules.style}
- Must include: {rules.mustDo}
- Must avoid: {rules.mustNot}
- Target word count: {rules.wordCount}
- Brand rules: {rules.brandRules}

CUSTOM INSTRUCTIONS FOR {CATEGORY}:
{promptTemplate.systemPrompt}

LESSONS FROM PAST REJECTIONS — APPLY ALL OF THESE STRICTLY:
1. [HIGH] (newsletter) Tone does not match the brand voice
2. [HIGH] (blog_post) No clear call-to-action at the end
... (up to 30 most recent lessons)

OUTPUT RULES:
1. Follow the Writing DNA above as your primary instruction.
2. Content type: {categoryLabel}. Write content appropriate for this format.
3. Output ONLY the finished content — no meta-commentary, no explanations.
4. Target length: ~{styleProfile.avgWordCount} words unless the format demands otherwise.
5. Apply every lesson from past rejections — these are mandatory corrections.
6. Never use: game-changer, unlock, next-level, crushing it, skyrocketing, disrupt, or any hype adjectives.`;

const PROMPT_SECTIONS = [
  { id: "dna",      label: "Writing DNA",           color: "bg-purple-50 border-purple-200 text-purple-800",  desc: "Primary voice instruction — your ingested content bulk-pasted into Company Info" },
  { id: "identity", label: "Company Identity",       color: "bg-blue-50 border-blue-200 text-blue-800",        desc: "Values, philosophy, founders, history, achievements from Company Settings" },
  { id: "style",    label: "Style Profile",          color: "bg-green-50 border-green-200 text-green-800",     desc: "Auto-extracted from ingested posts: tone, vocabulary, avg word count, phrases" },
  { id: "examples", label: "Example Posts",          color: "bg-yellow-50 border-yellow-200 text-yellow-800",  desc: "Last 5 ingested posts shown as style examples — the more you ingest, the better" },
  { id: "rules",    label: "Category Rules",         color: "bg-orange-50 border-orange-200 text-orange-800",  desc: "Per-category style rules extracted from ingested posts for that type" },
  { id: "custom",   label: "Custom Prompt Override", color: "bg-brand-50 border-brand-200 text-brand-800",     desc: "Your custom prompt templates from this page — layered on top of everything else" },
  { id: "lessons",  label: "Lessons (Feedback)",     color: "bg-red-50 border-red-200 text-red-800",           desc: "Every rejection/regeneration feedback stored as a lesson — applied to every generation" },
  { id: "output",   label: "Output Rules",           color: "bg-gray-50 border-gray-200 text-gray-700",        desc: "Hard rules: no hype words, output only content, target word count" },
];

export function LivePromptViewer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900">Live System Prompt</p>
            <p className="text-xs text-gray-500">The exact prompt structure sent to GPT-4o on every generation</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Active</span>
          {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 pb-5">
          <div className="mt-4 mb-4">
            <p className="mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Prompt sections — what feeds each part</p>
            <div className="grid grid-cols-2 gap-2">
              {PROMPT_SECTIONS.map((s) => (
                <div key={s.id} className={`rounded-lg border px-3 py-2 ${s.color}`}>
                  <p className="text-xs font-semibold">{s.label}</p>
                  <p className="text-xs opacity-75 mt-0.5">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Raw prompt template (variables shown in {"{}"} )</p>
            <pre className="whitespace-pre-wrap rounded-lg bg-gray-900 p-4 text-xs leading-relaxed text-green-300 overflow-x-auto max-h-96 overflow-y-auto">
              {LIVE_SYSTEM_PROMPT}
            </pre>
          </div>
          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
            <strong>How to improve generation quality:</strong> The most impactful levers are (1) ingest more example posts, (2) fill in Company Info fully, (3) reject with specific feedback to build lessons, (4) add custom prompt overrides below for specific content types.
          </div>
        </div>
      )}
    </div>
  );
}

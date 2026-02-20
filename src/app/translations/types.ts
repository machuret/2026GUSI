export type TranslationStatus = "draft" | "approved" | "archived";

export interface Translation {
  id: string;
  title: string;
  originalText: string;
  translatedText: string;
  language: string;
  category: string;
  publishedAt: string;
  createdAt: string;
  status: TranslationStatus;
  feedback?: string | null;
}

export const LANGUAGES = [
  "Spanish", "French", "German", "Italian", "Portuguese", "Dutch",
  "Polish", "Russian", "Japanese", "Chinese (Simplified)", "Chinese (Traditional)",
  "Korean", "Arabic", "Hindi", "Turkish", "Swedish", "Norwegian", "Danish",
  "Finnish", "Greek", "Hebrew", "Thai", "Vietnamese", "Indonesian", "Malay",
];

export const CONTENT_CATEGORIES = [
  "Newsletter", "Blog Post", "Social Media", "Press Release",
  "Announcement", "Sales Page", "Cold Email", "Webinar", "Course Content", "General",
];

export const LANG_FLAGS: Record<string, string> = {
  Spanish: "🇪🇸",
  French: "🇫🇷",
  German: "🇩🇪",
  Italian: "🇮🇹",
  Portuguese: "🇵🇹",
  Dutch: "🇳🇱",
  Polish: "🇵🇱",
  Russian: "🇷🇺",
  Japanese: "🇯🇵",
  "Chinese (Simplified)": "🇨🇳",
  "Chinese (Traditional)": "🇹🇼",
  Korean: "🇰🇷",
  Arabic: "🇸🇦",
  Hindi: "🇮🇳",
  Turkish: "🇹🇷",
  Swedish: "🇸🇪",
  Norwegian: "🇳🇴",
  Danish: "🇩🇰",
  Finnish: "🇫🇮",
  Greek: "🇬🇷",
  Hebrew: "🇮🇱",
  Thai: "🇹🇭",
  Vietnamese: "🇻🇳",
  Indonesian: "🇮🇩",
  Malay: "🇲🇾",
  English: "🇬🇧",
};

export const LANG_COLORS: Record<string, string> = {
  Spanish: "bg-red-100 text-red-700",
  French: "bg-blue-100 text-blue-700",
  German: "bg-yellow-100 text-yellow-700",
  Italian: "bg-green-100 text-green-700",
  Portuguese: "bg-orange-100 text-orange-700",
  Japanese: "bg-pink-100 text-pink-700",
  Chinese: "bg-purple-100 text-purple-700",
  Arabic: "bg-teal-100 text-teal-700",
  Korean: "bg-indigo-100 text-indigo-700",
  Hindi: "bg-amber-100 text-amber-700",
};

export const STATUS_STYLES: Record<TranslationStatus, string> = {
  draft:    "bg-gray-100 text-gray-600 border-gray-300",
  approved: "bg-green-100 text-green-700 border-green-300",
  archived: "bg-amber-100 text-amber-700 border-amber-300",
};

export const DEFAULT_GLOBAL_RULES = `- Preserve the original tone and voice exactly
- Keep all proper nouns, brand names, and product names untranslated
- Maintain paragraph structure and formatting
- Use formal register unless the original is casual
- Do not add or remove content`;

export const LANG_DEFAULT_RULES: Record<string, string> = {
  Spanish: `- Use Latin American Spanish (not Castilian) unless specified otherwise\n- Use "usted" for formal content, "tú" for casual\n- Avoid literal translations of idioms — find natural Spanish equivalents`,
  French: `- Use standard French (not Canadian French) unless specified\n- Use "vous" for formal content\n- Avoid anglicisms where a natural French equivalent exists\n- Maintain formal punctuation rules (spaces before : ; ! ?)`,
  German: `- Use formal "Sie" for professional content\n- Compound nouns should follow German conventions\n- Maintain sentence structure — avoid overly literal translations`,
  Arabic: `- Write right-to-left — ensure formatting is preserved\n- Use Modern Standard Arabic (MSA) unless a dialect is specified\n- Maintain formal register for business content`,
  Japanese: `- Use polite form (丁寧語) for business content\n- Katakana for foreign brand names and technical terms\n- Avoid over-literal translations — prioritise natural Japanese flow`,
  Chinese: `- Use Simplified Chinese unless Traditional is specified\n- Maintain professional tone with appropriate formality\n- Dates: use Chinese date format (年月日)`,
};

export const RULES_KEY = "translation_rules_v2";
export const CUSTOM_CATEGORIES_KEY = "translation_custom_categories_v1";

export function loadAllRules(): Record<string, string> {
  try { const r = localStorage.getItem(RULES_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; }
}
export function saveAllRules(r: Record<string, string>) {
  localStorage.setItem(RULES_KEY, JSON.stringify(r));
}

export function loadCustomCategories(): string[] {
  try { const r = localStorage.getItem(CUSTOM_CATEGORIES_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
export function saveCustomCategories(cats: string[]) {
  localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(cats));
}

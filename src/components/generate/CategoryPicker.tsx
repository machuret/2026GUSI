"use client";

export const CATEGORIES = [
  { key: "newsletter",     label: "Newsletter",     icon: "📧", desc: "Email newsletters for subscribers",                   prompts: ["Weekly roundup of industry news and tips", "Product update announcement to subscribers", "Re-engagement campaign for inactive subscribers"] },
  { key: "offer",          label: "Offer",          icon: "🎯", desc: "Promotional offers, discounts, bundles",              prompts: ["Limited-time 20% discount on our main product", "Bundle deal combining our top 3 services", "Early-bird pricing for new product launch"] },
  { key: "webinar",        label: "Webinar",        icon: "🎥", desc: "Webinar descriptions, invites, follow-ups",           prompts: ["Invite email for upcoming live training session", "Follow-up email with replay link and key takeaways", "Registration page description for expert panel"] },
  { key: "social_media",   label: "Social Media",   icon: "📱", desc: "Posts for LinkedIn, Instagram, Twitter, Facebook",   prompts: ["LinkedIn post about a recent company milestone", "Instagram caption for a behind-the-scenes photo", "Twitter thread sharing 5 industry insights"] },
  { key: "announcement",   label: "Announcement",   icon: "📢", desc: "Company news, updates, launches",                    prompts: ["New product feature launch announcement", "Team expansion — welcoming new hires", "Partnership announcement with another brand"] },
  { key: "blog_post",      label: "Blog Post",      icon: "📝", desc: "Long-form blog articles",                            prompts: ["How-to guide for our core product use case", "Industry trends article for thought leadership", "Case study of a successful customer outcome"] },
  { key: "course_content", label: "Course Content", icon: "🎓", desc: "Lessons, modules, educational material",             prompts: ["Introduction module for an online course", "Step-by-step lesson on our core methodology", "Quiz questions to test module comprehension"] },
  { key: "sales_page",     label: "Sales Page",     icon: "💰", desc: "Landing pages, product pages, conversion copy",      prompts: ["Hero section and CTA for main product page", "Pricing page copy with feature comparison", "VSL script for a product demo video"] },
  { key: "cold_email",     label: "Cold Email",     icon: "✉️", desc: "Outreach emails, follow-ups, prospecting",           prompts: ["First touch outreach to a potential B2B client", "Follow-up email after no response (day 3)", "Break-up email after 3 follow-ups with no reply"] },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

interface Props {
  selected: string;
  onChange: (key: string) => void;
}

export function CategoryPicker({ selected, onChange }: Props) {
  const selectedCat = CATEGORIES.find((c) => c.key === selected);

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">1</span>
        <label className="text-sm font-semibold text-gray-700">Choose a content category</label>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => onChange(cat.key)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
              selected === cat.key
                ? "border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500"
                : "border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <span className="text-lg">{cat.icon}</span>
            <span className="font-medium">{cat.label}</span>
          </button>
        ))}
      </div>
      {selectedCat && (
        <p className="mt-2 text-xs text-gray-400">{selectedCat.desc}</p>
      )}
    </div>
  );
}

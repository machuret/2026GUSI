export interface VaultItem {
  id: string;
  filename: string;
  content: string;
  fileType: string;
  createdAt: string;
}

export const VAULT_CATEGORIES = [
  { value: "general",    label: "General" },
  { value: "brand",      label: "Brand & Voice" },
  { value: "competitor", label: "Competitor Research" },
  { value: "product",    label: "Product / Service" },
  { value: "industry",   label: "Industry / Market" },
  { value: "audience",   label: "Audience Insights" },
  { value: "seo",        label: "SEO / Keywords" },
  { value: "legal",      label: "Legal / Compliance" },
  { value: "training",   label: "AI Training Data" },
] as const;

export const CAT_COLORS: Record<string, string> = {
  general:    "bg-gray-100 text-gray-600",
  brand:      "bg-purple-100 text-purple-700",
  competitor: "bg-orange-100 text-orange-700",
  product:    "bg-blue-100 text-blue-700",
  industry:   "bg-teal-100 text-teal-700",
  audience:   "bg-pink-100 text-pink-700",
  seo:        "bg-yellow-100 text-yellow-700",
  legal:      "bg-red-100 text-red-700",
  training:   "bg-green-100 text-green-700",
};

export function getItemCategory(fileType: string) { return fileType.split(":")[1] ?? "general"; }
export function getItemType(fileType: string) { return fileType.split(":")[0]; }

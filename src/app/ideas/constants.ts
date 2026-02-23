import {
  Mail, Share2, BookOpen, Layers,
  GraduationCap, Bell, Trophy, FileText,
} from "lucide-react";
import type { ContentType, IdeaCategory } from "@/hooks/useIdeas";

export const CONTENT_TYPES: { key: ContentType; label: string; icon: React.ElementType; color: string }[] = [
  { key: "newsletter",   label: "Newsletter",   icon: Mail,     color: "bg-blue-100 text-blue-700 border-blue-200" },
  { key: "social_media", label: "Social Media",  icon: Share2,   color: "bg-pink-100 text-pink-700 border-pink-200" },
  { key: "blog_post",    label: "Blog Post",     icon: BookOpen, color: "bg-green-100 text-green-700 border-green-200" },
  { key: "carousel",     label: "Carousel",      icon: Layers,   color: "bg-orange-100 text-orange-700 border-orange-200" },
];

export const IDEA_CATEGORIES: { key: IdeaCategory; label: string; icon: React.ElementType; color: string }[] = [
  { key: "Education",         label: "Education",         icon: GraduationCap, color: "bg-violet-100 text-violet-700 border-violet-200" },
  { key: "Touching Base",     label: "Touching Base",     icon: Bell,          color: "bg-amber-100 text-amber-700 border-amber-200" },
  { key: "Company Win",       label: "Company Win",       icon: Trophy,        color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { key: "Company Blog Post", label: "Company Blog Post", icon: FileText,      color: "bg-sky-100 text-sky-700 border-sky-200" },
  { key: "Carousel Topic",    label: "Carousel Topic",    icon: Layers,        color: "bg-orange-100 text-orange-700 border-orange-200" },
];

export const CONTENT_TYPE_TO_CATEGORY: Record<ContentType, string> = {
  newsletter:   "newsletter",
  social_media: "social_media",
  blog_post:    "blog_post",
  carousel:     "carousel",
};

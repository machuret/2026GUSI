import {
  Mail, Share2, BookOpen, Layers,
  GraduationCap, Bell, Trophy, FileText, Microscope, Heart,
  Coffee, BookMarked, Stethoscope, Laugh, Flame, Briefcase, Pen, BarChart3,
} from "lucide-react";
import type { ContentType, IdeaCategory, IdeaStyle } from "@/hooks/useIdeas";

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
  { key: "Facts",             label: "Facts",             icon: Microscope,    color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  { key: "Motivational",      label: "Motivational",      icon: Heart,         color: "bg-rose-100 text-rose-700 border-rose-200" },
];

export const IDEA_STYLES: { key: IdeaStyle; label: string; icon: React.ElementType; color: string }[] = [
  { key: "relaxed",       label: "Relaxed",       icon: Coffee,      color: "bg-amber-100 text-amber-700 border-amber-200" },
  { key: "educational",   label: "Educational",   icon: BookMarked,  color: "bg-violet-100 text-violet-700 border-violet-200" },
  { key: "for_doctors",   label: "For Doctors",   icon: Stethoscope, color: "bg-blue-100 text-blue-700 border-blue-200" },
  { key: "funny",         label: "Funny",         icon: Laugh,       color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { key: "inspirational", label: "Inspirational", icon: Flame,       color: "bg-orange-100 text-orange-700 border-orange-200" },
  { key: "professional",  label: "Professional",  icon: Briefcase,   color: "bg-slate-100 text-slate-700 border-slate-200" },
  { key: "storytelling",  label: "Storytelling",  icon: Pen,         color: "bg-pink-100 text-pink-700 border-pink-200" },
  { key: "data_driven",   label: "Data-Driven",   icon: BarChart3,   color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
];

export const CONTENT_TYPE_TO_CATEGORY: Record<ContentType, string> = {
  newsletter:   "newsletter",
  social_media: "social_media",
  blog_post:    "blog_post",
  carousel:     "carousel",
};

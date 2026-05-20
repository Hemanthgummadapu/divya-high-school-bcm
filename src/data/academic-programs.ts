import type { LucideIcon } from "lucide-react";
import { BookOpen, FlaskConical, Target } from "lucide-react";

// TODO: build /academics/primary, /academics/middle, /academics/high pages and link properly
export type AcademicProgram = {
  title: string;
  description: string;
  icon: LucideIcon;
  iconWrapClass: string;
  bullets: readonly string[];
  href: string;
};

export const ACADEMIC_PROGRAMS: AcademicProgram[] = [
  {
    title: "Primary (LKG–V)",
    description:
      "Where curiosity begins. Activity-based learning, strong literacy in English and Telugu, and the early habits that shape lifelong learners.",
    icon: BookOpen,
    iconWrapClass: "bg-gradient-to-br from-blue-50 to-white text-blue-700",
    bullets: [
      "Bilingual literacy (English + Telugu)",
      "Activity & play-based methods",
      "Small class sizes for personal attention",
    ],
    href: "/contact",
  },
  {
    title: "Middle School (VI–VIII)",
    description:
      "The IIT Foundation years. Conceptual depth in Mathematics and Science, structured problem-solving, and the analytical thinking that prepares students for competitive exams ahead.",
    icon: FlaskConical,
    iconWrapClass: "bg-gradient-to-br from-emerald-50 to-white text-emerald-700",
    bullets: [
      "IIT Foundation Mathematics curriculum",
      "Concept-first Science teaching",
      "Weekly assessments & feedback",
    ],
    href: "/contact",
  },
  {
    title: "High School (IX–X)",
    description:
      "Board exam mastery. Rigorous preparation for the SSC board, with mentoring, doubt-clearing sessions, and a track record of toppers scoring 530+ out of 600.",
    icon: Target,
    iconWrapClass: "bg-gradient-to-br from-amber-50 to-white text-amber-700",
    bullets: [
      "SSC board exam focus",
      "1-on-1 mentoring with senior faculty",
      "Career & stream guidance for Class XI",
    ],
    href: "/contact",
  },
];

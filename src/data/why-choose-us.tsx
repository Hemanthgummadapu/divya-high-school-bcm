import { Building2, Heart, ShieldCheck, Users } from "lucide-react";

// TODO: confirm "10+ years" claim with school. Replace with actual avg if different.
// TODO: verify CCTV is actually installed. If not, replace stat with another safety claim.
export const WHY_CHOOSE = [
  {
    title: "Experienced Faculty",
    description:
      "Senior teachers who've guided students to top SSC scores year after year. Mentoring is personal, not transactional.",
    stat: "Average 10+ years teaching experience",
    iconWrapClass: "bg-blue-50 text-blue-600",
    icon: <Users className="w-7 h-7" aria-hidden="true" />,
  },
  {
    title: "Focused Learning Environment",
    description:
      "Spacious classrooms, dedicated science and computer labs, and a library that supports curiosity beyond the syllabus.",
    stat: "Small batches for personal attention",
    iconWrapClass: "bg-indigo-50 text-indigo-600",
    icon: <Building2 className="w-7 h-7" aria-hidden="true" />,
  },
  {
    title: "Safe & Secure Campus",
    description:
      "CCTV-monitored campus, trained staff, and clear safety protocols so parents have peace of mind every day.",
    stat: "Parent communication via dedicated WhatsApp groups",
    iconWrapClass: "bg-emerald-50 text-emerald-600",
    icon: <ShieldCheck className="w-7 h-7" aria-hidden="true" />,
  },
  {
    title: "Values & Discipline",
    description:
      "Character comes first. We teach discipline, respect, and responsibility along with academics. Many of our toppers say this helped them succeed.",
    stat: "Daily moral education + cultural activities",
    iconWrapClass: "bg-rose-50 text-rose-600",
    icon: <Heart className="w-7 h-7" aria-hidden="true" />,
  },
];

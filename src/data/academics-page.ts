/** Shared content for /academics and homepage program cards */

export const CLASS_LEVELS = [
  {
    title: "Primary (LKG–V)",
    description:
      "Activity-based learning with strong English and Telugu literacy. Small classes help teachers give personal attention in the early years.",
  },
  {
    title: "Middle School (VI–VIII)",
    description:
      "Concept-first teaching in Maths and Science. IIT Foundation starts here with regular tests and feedback for every student.",
  },
  {
    title: "High School (IX–X)",
    description:
      "Focused SSC board preparation, mentoring, and doubt-clearing. Our students regularly score 500+ out of 600.",
  },
] as const;

export const CURRICULUM_BY_LEVEL = [
  {
    level: "Primary (LKG–V)",
    subjects: ["Telugu", "Hindi", "English", "Mathematics", "Environmental Science", "General Knowledge", "Computer Basics"],
  },
  {
    level: "Middle School (VI–VIII)",
    subjects: [
      "Telugu",
      "Hindi",
      "English",
      "Mathematics",
      "Physical Science",
      "Biological Science",
      "Social Studies",
      "Computer Science",
    ],
  },
  {
    level: "High School (IX–X)",
    subjects: [
      "Telugu",
      "Hindi",
      "English",
      "Mathematics",
      "Physical Science",
      "Biological Science",
      "Social Studies",
    ],
  },
] as const;

export const TOPPER_STATS_2026 = [
  { label: "Class X pass rate", value: "100%" },
  { label: "Scored 500+ / 600", value: "75%+" },
  { label: "School top score", value: "555 / 600" },
] as const;

/** Class X toppers 2026 — from school achievement banner */
export const CLASS_X_TOPPERS_2026 = [
  { name: "D Siddhartha", marks: "555" },
  { name: "A V Lokesh", marks: "553" },
  { name: "SK Kubra", marks: "537" },
  { name: "G Gnanendra", marks: "531" },
  { name: "M. Vyshnavi", marks: "530" },
  { name: "K S Sahithi", marks: "527" },
  { name: "G Pallavi", marks: "513" },
  { name: "Y Deepak", marks: "509" },
  { name: "S. Laxmi Prasanna", marks: "501" },
] as const;

export const IIT_FOUNDATION_TEXT =
  "Our IIT Foundation program runs from Class VI onward. Students build strong Maths and Science fundamentals, logical reasoning, and problem-solving skills to prepare for competitive exams alongside the regular syllabus.";

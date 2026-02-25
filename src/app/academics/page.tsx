import Link from "next/link";
import FadeInSection from "@/components/FadeInSection";

const ACADEMIC_STRUCTURE = [
  {
    title: "Structured Curriculum",
    desc: "Aligned with state syllabus and academic standards.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    title: "Experienced Faculty",
    desc: "Dedicated and qualified teachers across all subjects.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    title: "IIT Foundation Program",
    desc: "Focused preparation in Mathematics and Science for competitive examinations.",
    icon: (
      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
    bullets: ["Advanced Mathematics", "Logical Reasoning", "Competitive Preparation"],
  },
];

const STATS = [
  { label: "20+ Years of Academic Excellence", icon: "📅" },
  { label: "30+ Qualified Teachers", icon: "👩‍🏫" },
  { label: "100% Concept-Based Learning", icon: "📚" },
  { label: "Strong Competitive Exam Foundation", icon: "🏆" },
];

const LEARNING_POINTS = [
  "Concept-based teaching",
  "Smart classroom support",
  "Regular tests and evaluations",
  "Individual attention",
  "Project-based learning",
];

const EXCELLENCE_ITEMS = [
  "Strong foundation from Primary level",
  "Continuous academic monitoring",
  "Balanced academics & co-curricular growth",
  "Focus on analytical thinking",
];

const sectionPadding = "py-20 md:py-24";
const cardBase = "rounded-2xl shadow-md border border-gray-100 transition-all duration-300 ease-out";

export default function Academics() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* 1. Hero */}
      <header
        className="py-20 md:py-24"
        style={{
          background: "linear-gradient(165deg, #f8fafc 0%, #f1f5f9 40%, #ffffff 100%)",
        }}
      >
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-heading mb-6 pb-5 border-b-2 border-accent-gold inline-block">
            Academics at Divya High School
          </h1>
          <p className="text-xl md:text-2xl text-accent-gold font-medium tracking-wide mt-8 mb-10">
            Building Strong Foundations for Lifelong Success
          </p>
          <p className="text-body text-lg leading-9 text-gray-700 mx-auto max-w-[680px]">
            At Divya High School, our academic framework is designed to nurture intellectual curiosity, critical thinking, and strong foundational knowledge. We combine structured curriculum, experienced faculty, and modern teaching practices to ensure academic excellence at every stage.
          </p>
        </div>
      </header>

      {/* Academic Statistics */}
      <FadeInSection>
        <section className={`bg-[#f8f9fa] ${sectionPadding}`}>
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl p-9 md:p-10 text-center transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.18)] shadow-lg border border-gray-100/80"
                  style={{
                    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                  }}
                >
                  <span className="text-5xl md:text-6xl mb-5 block" aria-hidden="true">{stat.icon}</span>
                  <p className="text-body text-gray-700 font-semibold text-sm md:text-base leading-snug">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* 2. Academic Structure */}
      <FadeInSection>
        <section className={`bg-white ${sectionPadding}`}>
          <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-heading mb-14 text-center">
              Academic Structure
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {ACADEMIC_STRUCTURE.map((item) => {
                const isIIT = item.title === "IIT Foundation Program";
                return (
                  <div
                    key={item.title}
                    className={`${cardBase} p-8 text-center hover:-translate-y-2 hover:shadow-xl ${
                      isIIT
                        ? "border-2 border-accent-gold hover:scale-[1.02] relative"
                        : "bg-white"
                    }`}
                    style={isIIT ? { background: "linear-gradient(180deg, #fdf8f3 0%, #faf5ef 100%)" } : undefined}
                  >
                    {isIIT && (
                      <span className="absolute top-3 right-3 px-1.5 py-0.5 rounded-md bg-accent-gold text-white text-[9px] font-semibold uppercase tracking-wider">
                        Featured Program
                      </span>
                    )}
                    <div className="w-14 h-14 rounded-2xl bg-accent-gold/10 text-accent-gold flex items-center justify-center mx-auto mb-5">
                      {item.icon}
                    </div>
                    <h3 className="font-heading text-xl font-semibold text-heading mb-3">
                      {item.title}
                    </h3>
                    <p className="text-body text-gray-600 text-sm leading-relaxed mb-4">
                      {item.desc}
                    </p>
                    {"bullets" in item && item.bullets && (
                      <ul className="text-left space-y-4 text-body text-gray-600 text-sm">
                        {(item.bullets as string[]).map((b) => (
                          <li key={b} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent-gold flex-shrink-0" aria-hidden="true" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* 3. Learning Approach — two columns */}
      <FadeInSection>
        <section className={`bg-[#f8f9fa] ${sectionPadding}`}>
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start">
              <div>
                <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-heading mb-5">
                  Learning Approach
                </h2>
                <p className="text-body text-lg leading-8 text-gray-700">
                  Our academic system emphasizes conceptual clarity, regular assessment, doubt-clearing sessions, and activity-based learning to ensure deep understanding.
                </p>
              </div>
              <div className={`bg-white ${cardBase} p-8 shadow-lg`}>
                <ul className="space-y-4">
                  {LEARNING_POINTS.map((point) => (
                    <li key={point} className="flex items-center gap-3 text-body text-gray-700">
                      <span className="w-2 h-2 rounded-full bg-accent-gold flex-shrink-0 mt-0.5" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* 4. Academic Excellence */}
      <FadeInSection>
        <section className={`bg-white ${sectionPadding}`}>
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-heading mb-10 text-center">
              Academic Excellence
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-stretch">
              {EXCELLENCE_ITEMS.map((item) => (
                <div
                  key={item}
                  className={`bg-white ${cardBase} p-5 flex items-center gap-4 min-h-[88px] hover:-translate-y-2 hover:shadow-xl hover:bg-gray-50/80 transition-all duration-300 ease-out`}
                >
                  <span className="w-10 h-10 min-w-[2.5rem] rounded-2xl bg-primary-blue/10 flex items-center justify-center text-primary-blue flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span className="text-body text-gray-700 font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* 5. Why Choose */}
      <FadeInSection>
        <section className={`bg-[#f8f9fa] ${sectionPadding}`}>
          <div className="container mx-auto px-4 max-w-4xl">
            <div
              className="rounded-3xl p-10 md:p-14 border border-accent-gold/30 shadow-md"
              style={{
                background: "linear-gradient(135deg, #fefcf9 0%, #fdf8f3 50%, #faf5ef 100%)",
              }}
            >
              <h2 className="font-heading text-2xl md:text-3xl font-bold text-heading mb-5">
                Why Choose Our Academics?
              </h2>
              <p className="text-body text-lg leading-8 text-gray-700">
                Our approach ensures students are not only prepared for examinations but also equipped with analytical thinking, problem-solving skills, and confidence for future challenges.
              </p>
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* 6. CTA */}
      <FadeInSection>
        <section
          className={`${sectionPadding} border-t border-gray-100`}
          style={{
            background: "linear-gradient(165deg, #f5f9ff 0%, #eef4ff 50%, #e8f0fe 100%)",
          }}
        >
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-heading mb-3">
              Ready to Join Divya High School?
            </h2>
            <p className="text-body text-lg text-gray-600 mb-10">
              Admissions Open for 2026–27
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5">
              <Link
                href="/admissions/apply-online"
                className="inline-flex items-center justify-center px-10 py-4 text-lg rounded-xl bg-primary-blue text-white font-bold font-heading shadow-lg hover:bg-[#1e40af] hover:shadow-xl hover:ring-4 hover:ring-primary-blue/25 hover:scale-[1.02] transition-all duration-500 ease-out w-full sm:w-auto order-1"
              >
                Apply for Admission
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-3.5 text-base rounded-xl border-2 border-primary-blue text-primary-blue font-semibold font-heading bg-white shadow-md hover:bg-primary-blue hover:text-white hover:shadow-lg transition-all duration-500 ease-out w-full sm:w-auto order-2"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </section>
      </FadeInSection>
    </div>
  );
}

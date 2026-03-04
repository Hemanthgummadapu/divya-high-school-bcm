import Link from "next/link";
import FadeInSection from "@/components/FadeInSection";

const WHY_JOIN = [
  {
    title: "Strong Academic Foundation",
    desc: "Structured curriculum and experienced faculty for excellence from primary to secondary level.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    title: "IIT & Competitive Exam Focus",
    desc: "IIT Foundation Program and focused preparation for competitive examinations.",
    icon: (
      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
  {
    title: "Holistic Development",
    desc: "Academics, sports, cultural activities, and character building for well-rounded growth.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
];

const HIGHLIGHTS = [
  { title: "Admissions Open", detail: "2026–27 academic year" },
  { title: "Classes Offered", detail: "LKG to Class 10" },
  { title: "Limited Seats", detail: "Early application recommended" },
  { title: "Selection", detail: "Entrance / Interaction based" },
];

const PROCESS_STEPS = [
  { step: 1, title: "Enquiry & Registration", desc: "Visit school or apply online" },
  { step: 2, title: "Submission", desc: "Submit application and documents" },
  { step: 3, title: "Interaction", desc: "Student & parent interaction" },
  { step: 4, title: "Confirmation", desc: "Fee payment & admission confirmation" },
];

const DOCUMENTS = [
  { label: "Birth certificate", icon: "doc" },
  { label: "Previous academic records (if applicable)", icon: "folder" },
  { label: "Passport-size photographs", icon: "image" },
  { label: "Transfer certificate (for Class 2 onwards)", icon: "cert" },
  { label: "Parent/Guardian ID proof", icon: "id" },
];

const sectionPadding = "py-24 md:py-28";
const cardBase = "rounded-2xl shadow-md border border-gray-100 transition-all duration-300 ease-out";

export default function Admissions() {
  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)",
      }}
    >
      {/* 1. Hero */}
      <header
        className="py-24 md:py-32"
        style={{
          background: "radial-gradient(ellipse 70% 50% at 50% 10%, rgba(245,158,11,0.08) 0%, transparent 55%), radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,255,255,0.96) 0%, transparent 50%), linear-gradient(165deg, #fafbfd 0%, #f4f6f9 40%, #eef2f7 75%, #ffffff 100%)",
        }}
      >
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-heading mb-6 inline-block">
            Admissions at Divya High School
          </h1>
          <div
            className="h-1 w-full max-w-[200px] mx-auto mb-8 rounded-full"
            style={{
              background: "linear-gradient(90deg, #d97706 0%, #F59E0B 50%, #fbbf24 100%)",
            }}
            aria-hidden="true"
          />
          <p className="text-xl md:text-2xl font-semibold tracking-wide mt-6 mb-10 text-amber-700 drop-shadow-sm">
            Begin Your Journey to Excellence
          </p>
          <p className="text-body text-lg leading-9 text-gray-700 mx-auto max-w-[680px]">
            We welcome applications for the academic year 2026–27. Our admissions process is designed to identify motivated learners and support families through a clear, transparent procedure from enquiry to confirmation.
          </p>
        </div>
      </header>

      {/* 2. Why Join Divya — 3 cards */}
      <FadeInSection>
        <section className={`bg-[#f8f9fa] ${sectionPadding}`}>
          <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-heading mb-14 text-center">
              Why Join Divya High School
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {WHY_JOIN.map((item) => (
                <div
                  key={item.title}
                  className={`bg-white ${cardBase} p-8 text-center shadow-lg hover:-translate-y-2 hover:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18)] transition-all duration-300 ease-out`}
                >
                  <div className="w-16 h-16 rounded-full bg-accent-gold/15 text-accent-gold flex items-center justify-center mx-auto mb-5 shadow-sm">
                    {item.icon}
                  </div>
                  <h3 className="font-heading text-xl font-bold text-heading mb-3">
                    {item.title}
                  </h3>
                  <p className="text-body text-gray-500 text-sm leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* 3. Admission Highlights — 4 info cards */}
      <FadeInSection>
        <section className={`bg-white ${sectionPadding}`}>
          <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-heading mb-14 text-center">
              Admission Highlights
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {HIGHLIGHTS.map((item) => (
                <div
                  key={item.title}
                  className="bg-white rounded-2xl border border-gray-100 p-6 text-center shadow-lg hover:-translate-y-2 hover:shadow-xl transition-all duration-300 ease-out"
                  style={{
                    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                  }}
                >
                  <h3 className="font-heading text-lg font-bold text-heading mb-2">
                    {item.title}
                  </h3>
                  <p className="text-body text-gray-500 text-sm">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* 4. Admission Process — 4 steps with connector */}
      <FadeInSection>
        <section className={`bg-[#f8f9fa] ${sectionPadding}`}>
          <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-heading mb-14 text-center">
              Admission Process
            </h2>
            <div className="relative">
              {/* Connector line — gradient, visible on desktop */}
              <div
                className="hidden lg:block absolute top-8 left-[12%] right-[12%] h-1 rounded-full opacity-90"
                style={{
                  background: "linear-gradient(90deg, rgba(30,58,138,0.12) 0%, rgba(30,58,138,0.35) 25%, rgba(37,99,235,0.5) 50%, rgba(30,58,138,0.35) 75%, rgba(30,58,138,0.12) 100%)",
                }}
                aria-hidden="true"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-4">
                {PROCESS_STEPS.map((item) => (
                  <div key={item.step} className="relative flex flex-col items-center text-center group">
                    <div
                      className="w-16 h-16 rounded-full text-white font-bold text-xl flex items-center justify-center flex-shrink-0 relative z-10 mb-4 shadow-lg transition-all duration-300 ease-out group-hover:scale-110 group-hover:shadow-xl"
                      style={{
                        background: "linear-gradient(145deg, #1e3a8a 0%, #2563eb 50%, #1e40af 100%)",
                      }}
                    >
                      {item.step}
                    </div>
                    <h3 className="font-heading font-bold text-heading mb-2">
                      {item.title}
                    </h3>
                    <p className="text-body text-gray-500 text-sm leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-center mt-8">
                <Link
                  href="/admissions/admission-process"
                  className="text-primary-blue font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-primary-blue/30 rounded"
                >
                  View full admission process →
                </Link>
              </p>
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* 5. Documents Required */}
      <FadeInSection>
        <section
          className={sectionPadding}
          style={{
            background: "linear-gradient(180deg, #faf8f6 0%, #f5f2ef 50%, #f0ebe6 100%)",
          }}
        >
          <div className="container mx-auto px-4">
            <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-heading mb-14 text-center">
              Documents Required
            </h2>
            <div
              className="rounded-3xl p-8 md:p-10 shadow-lg border border-accent-gold/10 max-w-2xl mx-auto"
              style={{
                background: "linear-gradient(180deg, #fefdfb 0%, #fdf9f5 50%, #faf6f1 100%)",
              }}
            >
              <ul className="space-y-4">
                {DOCUMENTS.map((doc) => (
                  <li key={doc.label} className="flex items-center gap-4 text-body text-gray-700">
                    <span className="w-11 h-11 rounded-full bg-accent-gold/15 flex items-center justify-center text-accent-gold flex-shrink-0 shadow-sm" aria-hidden="true">
                      {doc.icon === "doc" && (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      )}
                      {doc.icon === "folder" && (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                      )}
                      {doc.icon === "image" && (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      )}
                      {doc.icon === "cert" && (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                      )}
                      {doc.icon === "id" && (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V17m4-11v4m0 0v-4m0 0H6" /></svg>
                      )}
                    </span>
                    {doc.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* 6. CTA */}
      <FadeInSection>
        <section
          className={`${sectionPadding} border-t border-gray-100/80`}
          style={{
            background: "linear-gradient(165deg, #f2f7ff 0%, #eef4ff 40%, #e6effd 70%, #e0ebfc 100%)",
          }}
        >
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-heading mb-3">
              Ready to Join Divya High School?
            </h2>
            <p className="text-body text-lg text-gray-600 mb-10">
              Admissions Open for 2026–27
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5 flex-wrap">
              <Link
                href="/admissions/apply-online"
                className="inline-flex items-center justify-center px-10 py-4 text-lg rounded-xl bg-primary-blue text-white font-bold font-heading shadow-xl hover:bg-[#1e40af] hover:shadow-[0_20px_40px_-12px_rgba(30,58,138,0.4)] hover:ring-4 hover:ring-primary-blue/25 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-500 ease-out w-full sm:w-auto"
              >
                Apply for Admission
              </Link>
              <Link
                href="/admissions/fee-structure"
                className="inline-flex items-center justify-center px-8 py-3.5 text-base rounded-xl border-2 border-primary-blue text-primary-blue font-semibold font-heading bg-white shadow-md hover:bg-primary-blue hover:text-white hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5 transition-all duration-500 ease-out w-full sm:w-auto"
              >
                Fee Structure
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-3.5 text-base rounded-xl border-2 border-gray-300 text-gray-700 font-semibold font-heading bg-white shadow-md hover:bg-gray-100 hover:border-gray-400 hover:scale-[1.01] hover:-translate-y-0.5 transition-all duration-500 ease-out w-full sm:w-auto"
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

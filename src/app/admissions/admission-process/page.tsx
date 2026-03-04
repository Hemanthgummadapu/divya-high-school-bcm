import Link from "next/link";
import FadeInSection from "@/components/FadeInSection";

const TIMELINE_STEPS = [
  {
    step: 1,
    title: "Enquiry & Registration",
    desc: "Visit the school office or register online through our website. Our admissions team will guide you through the process and answer any queries. You may collect the application form or submit an online enquiry.",
  },
  {
    step: 2,
    title: "Application Submission",
    desc: "Submit the completed application form along with required documents (birth certificate, previous academic records if applicable, photographs, and parent/guardian ID proof). Ensure all details are accurate and complete.",
  },
  {
    step: 3,
    title: "Student Interaction / Assessment",
    desc: "Shortlisted candidates and parents are invited for an interaction. This helps us understand the student's readiness and allows families to learn more about our curriculum, facilities, and values. For certain classes, a simple assessment may be conducted.",
  },
  {
    step: 4,
    title: "Admission Confirmation",
    desc: "On selection, parents will receive an offer letter. Fee payment and submission of remaining documents complete the admission. Once confirmed, you will receive the final admission confirmation and joining details.",
  },
];

const ELIGIBILITY = [
  { text: "Admissions are open for LKG to Class 10.", icon: "classes" },
  { text: "Age eligibility as per state education norms for the applied class.", icon: "age" },
  { text: "Previous academic records may be required for Class 2 onwards.", icon: "records" },
  { text: "Transfer certificate from the previous school is mandatory for Class 2 and above.", icon: "cert" },
];

const GUIDELINES = [
  "Submit applications within the announced dates for the academic year.",
  "Ensure all documents are attested where required.",
  "Attend the interaction/assessment on the scheduled date.",
  "Fee payment should be completed as per the fee structure and deadlines.",
  "For any queries, contact the admissions office or visit the school.",
];

const sectionPadding = "py-28 md:py-32";
const cardShadow = "0 4px 20px rgba(0,0,0,0.06)";

function EligibilityIcon({ type }: { type: string }) {
  const iconClass = "w-5 h-5 flex-shrink-0 text-accent-gold";
  switch (type) {
    case "classes":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    case "age":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case "records":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case "cert":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      );
    default:
      return (
        <span className="w-2 h-2 rounded-full bg-accent-gold flex-shrink-0 mt-1.5" aria-hidden="true" />
      );
  }
}

export default function AdmissionProcess() {
  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)",
      }}
    >
      {/* Hero */}
      <header
        className="pt-28 md:pt-36 pb-32 md:pb-40"
        style={{
          background: "radial-gradient(ellipse 70% 50% at 50% 10%, rgba(245,158,11,0.08) 0%, transparent 55%), radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,255,255,0.96) 0%, transparent 50%), linear-gradient(165deg, #fafbfd 0%, #f4f6f9 40%, #eef2f7 75%, #ffffff 100%)",
        }}
      >
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-extrabold text-heading mb-4 inline-block">
            Admission Process
          </h1>
          <div
            className="h-1 w-full max-w-[200px] mx-auto mb-8 rounded-full"
            style={{
              background: "linear-gradient(90deg, #d97706 0%, #F59E0B 50%, #fbbf24 100%)",
            }}
            aria-hidden="true"
          />
          <p className="text-body text-lg md:text-xl leading-relaxed text-gray-700 max-w-2xl mx-auto">
            A clear, transparent path from enquiry to enrolment. We guide you through each step so you and your child feel informed and confident at every stage.
          </p>
        </div>
      </header>

      {/* Vertical Timeline */}
      <FadeInSection>
        <section className={`bg-white ${sectionPadding}`}>
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-extrabold text-heading mb-16 text-center">
              Step-by-Step Process
            </h2>
            <div className="relative">
              {/* Vertical line */}
              <div
                className="absolute left-8 sm:left-10 top-10 bottom-10 w-0.5 rounded-full hidden sm:block opacity-80"
                style={{
                  background: "linear-gradient(180deg, rgba(30,58,138,0.2) 0%, rgba(37,99,235,0.5) 50%, rgba(30,58,138,0.2) 100%)",
                }}
                aria-hidden="true"
              />
              <ul className="space-y-14 sm:space-y-[4.5rem]">
                {TIMELINE_STEPS.map((item) => {
                  const isConfirmation = item.step === 4;
                  return (
                    <li key={item.step} className="relative flex gap-6 sm:gap-8 items-start group">
                      <div
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full text-white font-bold text-xl sm:text-2xl flex items-center justify-center flex-shrink-0 relative z-10 transition-all duration-300 ease-out group-hover:scale-105"
                        style={{
                          background: "linear-gradient(145deg, #1e3a8a 0%, #2563eb 45%, #1e40af 100%)",
                          boxShadow: cardShadow,
                        }}
                      >
                        {item.step}
                      </div>
                      <div
                        className={`flex-1 min-w-0 pt-0.5 transition-all duration-300 ease-out group-hover:-translate-y-1.5 group-hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] rounded-3xl p-7 sm:p-8 border border-gray-100 ${
                          isConfirmation
                            ? "bg-emerald-50/90 border-l-4 border-l-emerald-500/80 border-emerald-100 border-t border-r border-b"
                            : "bg-gray-50/80"
                        }`}
                        style={{ boxShadow: cardShadow }}
                      >
                        <h3 className="font-heading text-xl font-extrabold text-heading mb-3">
                          {item.title}
                        </h3>
                        <p className="text-body text-gray-600 leading-relaxed text-[15px] sm:text-base">
                          {item.desc}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* Eligibility Criteria */}
      <FadeInSection>
        <section
          className={sectionPadding}
          style={{
            background: "linear-gradient(180deg, #faf8f6 0%, #f5f2ef 50%, #f0ebe6 100%)",
          }}
        >
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-extrabold text-heading mb-16 text-center">
              Eligibility Criteria
            </h2>
            <div className="rounded-3xl p-10 md:p-12 border border-gray-100 bg-white" style={{ boxShadow: cardShadow }}>
              <ul className="space-y-5 sm:space-y-6">
                {ELIGIBILITY.map((item) => (
                  <li key={item.text} className="flex items-start gap-4 text-body text-gray-700 leading-relaxed">
                    <span className="mt-0.5">
                      <EligibilityIcon type={item.icon} />
                    </span>
                    <span className="flex-1">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* Admission Guidelines */}
      <FadeInSection>
        <section className={`bg-white ${sectionPadding} border-t border-gray-200/80`}>
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-extrabold text-heading mb-16 text-center">
              Admission Guidelines
            </h2>
            <div className="rounded-3xl p-10 md:p-12 border border-gray-100 bg-[#fafbfc]" style={{ boxShadow: cardShadow }}>
              <ul className="space-y-5 sm:space-y-6">
                {GUIDELINES.map((point) => (
                  <li key={point} className="flex items-start gap-4 text-body text-gray-700 leading-relaxed">
                    <span className="w-2 h-2 rounded-full bg-primary-blue flex-shrink-0 mt-2" aria-hidden="true" />
                    <span className="flex-1">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* CTA */}
      <FadeInSection>
        <section
          className="py-28 md:py-32 pb-40 md:pb-48"
          style={{
            background: "linear-gradient(180deg, #e6ecf5 0%, #eef3fa 30%, #f4f7fc 60%, #fafbfd 85%, #ffffff 100%)",
          }}
        >
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl font-extrabold text-heading mb-5">
              Start Your Admission Journey
            </h2>
            <p className="text-body text-lg text-gray-700 mb-11 max-w-xl mx-auto leading-relaxed">
              Take the first step. Our team is here to support you through every stage of the process.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5 flex-wrap">
              <Link
                href="/admissions/apply-online"
                className="inline-flex items-center justify-center px-10 py-4 text-lg rounded-xl text-white font-bold font-heading transition-all duration-300 ease-out w-full sm:w-auto hover:scale-[1.03] active:scale-[0.98] hover:shadow-[0_12px_28px_-8px_rgba(30,58,138,0.35)]"
                style={{
                  background: "linear-gradient(145deg, #1e3a8a 0%, #2563eb 50%, #1e40af 100%)",
                  boxShadow: "0 4px 14px rgba(30,58,138,0.25)",
                }}
              >
                Apply Now
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-3.5 text-base rounded-xl border-[3px] border-primary-blue text-primary-blue font-semibold font-heading bg-white shadow-sm hover:bg-primary-blue/10 hover:shadow-md transition-all duration-300 ease-out w-full sm:w-auto"
              >
                Contact Admissions
              </Link>
            </div>
          </div>
        </section>
      </FadeInSection>
    </div>
  );
}

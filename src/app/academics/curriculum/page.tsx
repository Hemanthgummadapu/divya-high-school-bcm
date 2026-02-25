import Link from "next/link";
import FadeInSection from "@/components/FadeInSection";

const CLASSES_OFFERED = [
  { title: "Pre-Primary", desc: "LKG & UKG" },
  { title: "Primary", desc: "Classes I – V" },
  { title: "Upper Primary", desc: "Classes VI – VIII" },
  { title: "Secondary", desc: "Classes IX – X" },
];

const PRIMARY_SUBJECTS = [
  "Telugu",
  "Hindi",
  "English",
  "Mathematics",
  "Environmental Science",
  "General Knowledge",
  "Computer Basics",
];

const UPPER_PRIMARY_SUBJECTS = [
  "Telugu",
  "Hindi",
  "English",
  "Mathematics",
  "Physical Science",
  "Biological Science",
  "Social Studies",
  "Computer Science",
];

const TEACHING_METHODOLOGY = [
  "Activity-based learning",
  "Smart classroom support",
  "Regular assessments",
  "Doubt-clearing sessions",
  "Project-based learning",
];

const ASSESSMENT_PATTERN = [
  "Weekly Tests",
  "Monthly Exams",
  "Half-Yearly Exams",
  "Annual Examinations",
];

const iconClass = "w-6 h-6 md:w-7 md:h-7 flex-shrink-0 text-accent-gold";

const sectionPadding = "py-20";

export default function Curriculum() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header — white */}
      <header className="bg-white py-20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-heading mb-3 flex items-center justify-center gap-3 flex-wrap">
            <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Curriculum
          </h1>
          <p className="text-xl text-body text-gray-600">
            Structured Learning for Academic Excellence
          </p>
        </div>
      </header>

      {/* Introduction — white */}
      <section className={`bg-white ${sectionPadding}`}>
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-heading mb-5">
            Introduction
          </h2>
          <p className="text-body text-lg leading-8 text-gray-700">
            At Divya High School, our curriculum is designed to build strong academic foundations while encouraging creativity, discipline, and critical thinking. We follow a structured syllabus aligned with state educational standards and modern teaching methodologies.
          </p>
        </div>
      </section>

      {/* Classes Offered — light gray + scroll reveal + card hover */}
      <FadeInSection>
        <section className={`bg-[#f8f9fa] ${sectionPadding}`}>
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-heading mb-6 flex items-center gap-3">
              <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Classes Offered
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {CLASSES_OFFERED.map((item) => (
                <div
                  key={item.title}
                  className="bg-white rounded-xl p-6 shadow-md border border-gray-100 text-center transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-xl"
                >
                  <h3 className="font-heading text-lg font-semibold text-heading mb-2">
                    {item.title}
                  </h3>
                  <p className="text-body text-gray-600 text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* Subjects Offered — white + scroll reveal */}
      <FadeInSection>
        <section className={`bg-white ${sectionPadding}`}>
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-heading mb-6 flex items-center gap-3">
              <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Subjects Offered
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
                <h3 className="font-heading text-lg font-semibold text-heading mb-4">
                  Primary
                </h3>
                <ul className="space-y-2 text-body text-gray-700">
                  {PRIMARY_SUBJECTS.map((sub) => (
                    <li key={sub} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-gold flex-shrink-0" aria-hidden="true" />
                      {sub}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
                <h3 className="font-heading text-lg font-semibold text-heading mb-4">
                  Upper Primary & Secondary
                </h3>
                <ul className="space-y-2 text-body text-gray-700">
                  {UPPER_PRIMARY_SUBJECTS.map((sub) => (
                    <li key={sub} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-gold flex-shrink-0" aria-hidden="true" />
                      {sub}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* IIT Foundation — light gray + scroll reveal */}
      <FadeInSection>
        <section className={`bg-[#f8f9fa] ${sectionPadding}`}>
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="rounded-xl p-6 md:p-8 border-2 border-accent-gold bg-accent-gold/5 shadow-md">
              <h2 className="font-heading text-xl md:text-2xl lg:text-3xl font-bold text-heading mb-4 flex items-center gap-3">
                <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                IIT Foundation Program
              </h2>
              <p className="text-body text-lg leading-8 text-gray-700">
                Our <strong className="font-bold text-accent-gold">IIT Foundation Program</strong> strengthens core concepts in Mathematics and Science from middle school level, helping students develop analytical thinking and problem-solving skills for competitive examinations.
              </p>
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* Teaching Methodology — white + scroll reveal */}
      <FadeInSection>
        <section className={`bg-white ${sectionPadding}`}>
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-heading mb-3 flex items-center gap-3">
              <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Teaching Methodology
            </h2>
            <p className="text-body text-gray-600 mb-6 max-w-2xl">
              Our teaching approach focuses on conceptual clarity and active student engagement.
            </p>
            <div className="flex flex-wrap gap-3">
              {TEACHING_METHODOLOGY.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-2 bg-white rounded-lg px-4 py-3 shadow-md border border-gray-100 text-body text-gray-700 font-medium"
                >
                  <span className="w-2 h-2 rounded-full bg-primary-blue flex-shrink-0" aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* Assessment Pattern — light gray + scroll reveal + card hover */}
      <FadeInSection>
        <section className={`bg-[#f8f9fa] ${sectionPadding}`}>
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-heading mb-3 flex items-center gap-3">
              <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Assessment Pattern
            </h2>
            <p className="text-body text-gray-600 mb-6 max-w-2xl">
              Continuous evaluation ensures steady academic progress and academic excellence.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {ASSESSMENT_PATTERN.map((item) => (
                <div
                  key={item}
                  className="bg-white rounded-xl p-4 shadow-md border border-gray-100 flex items-center gap-3 transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-xl"
                >
                  <span className="w-8 h-8 rounded-lg bg-primary-blue/10 flex items-center justify-center text-primary-blue font-bold text-sm flex-shrink-0">
                    ✓
                  </span>
                  <span className="text-body text-gray-700 font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* CTA — light blue / gradient + scroll reveal + enhanced buttons */}
      <FadeInSection>
        <section
          className="py-20 border-t border-gray-100"
          style={{
            background: "linear-gradient(180deg, #f4f8ff 0%, #eef4ff 100%)",
          }}
        >
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-heading mb-8">
              Ready to Join Divya High School?
            </h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
              <Link
                href="/admissions/apply-online"
                className="inline-flex items-center justify-center px-10 py-4 text-lg rounded-lg bg-primary-blue text-white font-semibold font-heading shadow-md hover:bg-[#1e40af] hover:shadow-lg transition-all duration-300 ease-out w-full sm:w-auto"
              >
                Apply for Admission
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-10 py-4 text-lg rounded-lg border-2 border-primary-blue text-primary-blue font-semibold font-heading bg-white shadow-md hover:bg-primary-blue hover:text-white hover:shadow-lg transition-all duration-300 ease-out w-full sm:w-auto"
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

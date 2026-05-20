import Image from "next/image";
import Link from "next/link";
import {
  CLASS_LEVELS,
  CLASS_X_TOPPERS_2026,
  CURRICULUM_BY_LEVEL,
  IIT_FOUNDATION_TEXT,
  TOPPER_STATS_2026,
} from "@/data/academics-page";

export default function Academics() {
  return (
    <div className="min-h-screen bg-white pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Hero */}
        <header className="text-center mb-12">
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-slate-900 mb-3">
            Academics at Divya High School
          </h1>
          <p className="text-slate-600 text-lg max-w-xl mx-auto">
            Structured learning from LKG to Class X, with strong board results and IIT Foundation from Class VI.
          </p>
        </header>

        {/* Class levels */}
        <section className="mb-12" aria-labelledby="class-levels-heading">
          <h2 id="class-levels-heading" className="sr-only">
            Class levels
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {CLASS_LEVELS.map((level) => (
              <article key={level.title} className="rounded-lg border border-slate-200 p-4">
                <h3 className="font-heading font-bold text-slate-900 text-base mb-2">{level.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{level.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Curriculum */}
        <section className="mb-12" aria-labelledby="curriculum-heading">
          <h2 id="curriculum-heading" className="font-heading text-lg font-bold text-slate-900 mb-4">
            Curriculum highlights
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm text-slate-700">
            {CURRICULUM_BY_LEVEL.map((block) => (
              <div key={block.level}>
                <h3 className="font-semibold text-slate-900 mb-2">{block.level}</h3>
                <p>{block.subjects.join(", ")}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Results / Toppers */}
        <section id="results" className="mb-12 scroll-mt-24" aria-labelledby="results-heading">
          <h2 id="results-heading" className="font-heading text-lg font-bold text-slate-900 mb-4">
            Results &amp; toppers — Class X 2026
          </h2>
          <div className="flex flex-wrap gap-4 mb-6">
            {TOPPER_STATS_2026.map((stat) => (
              <div key={stat.label} className="rounded-lg bg-blue-50 px-4 py-3 min-w-[140px]">
                <div className="text-2xl font-bold text-blue-800">{stat.value}</div>
                <div className="text-xs text-slate-600 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {CLASS_X_TOPPERS_2026.map((student) => (
              <div
                key={student.name}
                className="rounded-md border border-slate-200 px-3 py-2 text-center"
              >
                <p className="text-sm font-semibold text-slate-900 leading-tight">{student.name}</p>
                <p className="text-xs text-blue-700 font-bold mt-1">{student.marks} / 600</p>
              </div>
            ))}
          </div>
          <div className="relative w-full max-w-md mx-auto aspect-[16/10] rounded-lg overflow-hidden border border-slate-200">
            <Image
              src="/images/toppers-2026.jpg"
              alt="Divya High School Class X toppers 2026"
              fill
              className="object-contain bg-slate-50"
              sizes="(max-width: 448px) 100vw, 448px"
            />
          </div>
        </section>

        {/* IIT Foundation */}
        <section className="mb-10" aria-labelledby="iit-heading">
          <div className="rounded-lg border-2 border-blue-200 bg-blue-50/80 px-5 py-4">
            <h2 id="iit-heading" className="font-heading font-bold text-blue-900 mb-2">
              IIT Foundation (Class VI onwards)
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed">{IIT_FOUNDATION_TEXT}</p>
          </div>
        </section>

        <p className="text-center text-sm text-slate-500">
          <Link href="/academics/faculty" className="text-blue-700 font-semibold hover:underline">
            Meet our faculty
          </Link>
          {" · "}
          <Link href="/contact" className="text-blue-700 font-semibold hover:underline">
            Contact us
          </Link>
        </p>
      </div>
    </div>
  );
}

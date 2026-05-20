"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { ACADEMIC_PROGRAMS } from "@/data/academic-programs";

export default function AcademicResourcesSection() {
  return (
    <section className="py-16 md:py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <div className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-2">
            ACADEMICS
          </div>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-slate-900 mb-3">
            Our Academic Programs
          </h2>
          <p className="text-base md:text-lg text-slate-600 mt-3 max-w-2xl mx-auto">
            From early foundations to board exam excellence — a structured journey for every student.
          </p>
        </div>

        {/* TODO: confirm exact pass rate and years of operation with the school. Established 2004 = 22 years. */}
        <div className="max-w-5xl mx-auto mb-16 p-8 md:p-10 bg-white rounded-3xl shadow-sm border border-slate-100">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center md:border-r md:border-slate-200 md:last:border-r-0">
              <div className="text-3xl md:text-4xl font-bold text-blue-700">100%</div>
              <div className="text-xs md:text-sm text-slate-600 mt-1 font-medium">Class X Pass Rate</div>
            </div>
            <div className="text-center md:border-r md:border-slate-200 md:last:border-r-0">
              <div className="text-3xl md:text-4xl font-bold text-blue-700">555</div>
              <div className="text-xs md:text-sm text-slate-600 mt-1 font-medium">2026 Top Scorer</div>
            </div>
            <div className="text-center md:border-r md:border-slate-200 md:last:border-r-0">
              <div className="text-3xl md:text-4xl font-bold text-blue-700">22+</div>
              <div className="text-xs md:text-sm text-slate-600 mt-1 font-medium">Years of Excellence</div>
            </div>
            <div className="text-center md:border-r md:border-slate-200 md:last:border-r-0">
              <div className="text-3xl md:text-4xl font-bold text-blue-700">75%+</div>
              <div className="text-xs md:text-sm text-slate-600 mt-1 font-medium">Score Above 500/600</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {ACADEMIC_PROGRAMS.map((program) => {
            const Icon = program.icon;
            return (
              <div
                key={program.title}
                className="group bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl border border-slate-100 transition-all duration-300"
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${program.iconWrapClass}`}>
                  <Icon className="w-7 h-7" aria-hidden="true" />
                </div>

                <h3 className="mt-6 text-xl font-bold text-slate-900 font-heading">
                  {program.title}
                </h3>
                <p className="mt-2 text-slate-600 leading-relaxed">
                  {program.description}
                </p>

                <ul className="mt-5 space-y-3">
                  {program.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-slate-700">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                      <span className="text-sm leading-relaxed">{b}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  <Link
                    href={program.href}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                  >
                    Learn more <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* <div className="text-center mt-12">
          <p className="text-slate-600 mb-4">
            Want to know more about our curriculum and teaching approach?
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-lg font-semibold transition"
          >
            Schedule a Campus Visit
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div> */}
      </div>
    </section>
  );
}

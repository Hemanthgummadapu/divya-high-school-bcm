import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  Eye,
  Heart,
  Shield,
  Star,
  Target,
} from "lucide-react";

const MISSION_PILLARS = [
  "Academic excellence & IIT Foundation",
  "Physical fitness & sports training",
  "Moral integrity & social responsibility",
] as const;

const VISION_OUTCOMES = [
  "Students who lead with confidence",
  "Graduates ready for higher education",
  "Citizens of character and integrity",
] as const;

const CORE_VALUES = [
  { icon: BookOpen, label: "Knowledge", color: "bg-blue-50 text-blue-600" },
  { icon: Shield, label: "Discipline", color: "bg-indigo-50 text-indigo-600" },
  { icon: Star, label: "Excellence", color: "bg-amber-50 text-amber-600" },
  { icon: Heart, label: "Character", color: "bg-rose-50 text-rose-600" },
] as const;

export default function MissionVision() {
  return (
    <div className="min-h-screen bg-white">
      {/* Section 1: Hero */}
      <section className="relative bg-gradient-to-br from-blue-800 via-blue-700 to-indigo-800 py-20 md:py-28 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
          aria-hidden
        />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-blue-200 text-sm font-semibold uppercase tracking-widest mb-4 block">
            Who We Are
          </span>
          <h1 className="font-heading text-4xl md:text-6xl font-bold text-white mb-6">
            Mission & Vision
          </h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto">
            The principles that guide every decision we make at Divya High School.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm text-blue-200">
            <Link href="/" className="hover:text-white transition">
              Home
            </Link>
            <span>/</span>
            <Link href="/about" className="hover:text-white transition">
              About
            </Link>
            <span>/</span>
            <span className="text-white font-medium">Mission & Vision</span>
          </div>
        </div>
      </section>

      {/* Section 2: Mission & Vision cards */}
      <section className="py-16 md:py-24 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Mission — original copy preserved */}
            <div className="bg-blue-700 rounded-3xl p-8 md:p-10 text-white">
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
                <Target className="w-7 h-7 text-white" aria-hidden />
              </div>
              <h2 className="font-heading text-2xl font-bold mb-4">Our Mission</h2>
              <p className="text-blue-100 leading-relaxed mb-6">
                Our mission is to empower every student with knowledge, confidence, and values that prepare them
                for future challenges. Through innovative teaching methods, experienced faculty, and structured
                sports training, we aim to promote academic excellence, physical fitness, moral integrity, and
                social responsibility.
              </p>
              <div className="space-y-3">
                {MISSION_PILLARS.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-blue-300 mt-0.5 shrink-0" aria-hidden />
                    <span className="text-sm text-blue-100">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Vision — original copy preserved */}
            <div className="bg-white rounded-3xl p-8 md:p-10 border border-slate-200 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-6">
                <Eye className="w-7 h-7 text-amber-500" aria-hidden />
              </div>
              <h2 className="font-heading text-2xl font-bold text-slate-900 mb-4">Our Vision</h2>
              <p className="text-slate-600 leading-relaxed mb-6">
                To be a leading educational institution that nurtures confident, responsible, and compassionate
                individuals who excel academically, thrive in sports, and contribute positively to society.
              </p>
              <div className="space-y-3">
                {VISION_OUTCOMES.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" aria-hidden />
                    <span className="text-sm text-slate-600">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Core values */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="text-sm font-semibold text-blue-600 uppercase tracking-wider">
              What We Stand For
            </span>
            <h2 className="font-heading text-2xl md:text-3xl font-bold text-slate-900 mt-2">
              Our Core Values
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {CORE_VALUES.map(({ icon: Icon, label, color }) => (
              <div key={label} className="text-center">
                <div
                  className={`w-16 h-16 rounded-2xl ${color} flex items-center justify-center mx-auto mb-3`}
                >
                  <Icon className="w-7 h-7" aria-hidden />
                </div>
                <p className="font-semibold text-slate-900">{label}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-slate-500 mt-8 italic">
            These values — Knowledge, Discipline, Excellence — are inscribed on our school crest.
          </p>
        </div>
      </section>

      {/*
      Section 4: CTA
      <section className="py-16 bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-heading text-3xl font-bold text-white mb-4">See Our Values in Action</h2>
          <p className="text-blue-100 mb-8">
            Visit our campus and meet the students and teachers who live these values every day.
          </p>
          <Link
            href="/contact"
            className="inline-block bg-white text-blue-700 font-bold px-8 py-3 rounded-lg hover:bg-blue-50 transition shadow-lg"
          >
            Schedule a Visit
          </Link>
        </div>
      </section>
      */}
    </div>
  );
}

import Link from "next/link";
import Image from "next/image";
import { Eye, Quote, Target } from "lucide-react";
import { WHY_CHOOSE } from "@/data/why-choose-us";
import { SCHOOL_BUILDING_IMAGE } from "@/lib/public-assets";

const LEADERSHIP = [
  {
    name: "Seshapu Venkata Kishore",
    familiarName: "Kishore Sir",
    role: "Principal",
    photo: "/principal.png",
    photoObjectPosition: "object-[center_25%]",
    bio: "Leads academics and day-to-day school life, with a focus on SSC results and the IIT Foundation program from Class VI onward.",
    quote:
      "Marks matter, but character matters more. At Divya High School we work on both so students can face exams and life with confidence.",
    cardClass: "from-blue-50 to-indigo-50 border-blue-100",
    roleClass: "text-blue-700",
    quoteClass: "text-blue-200",
  },
  {
    name: "Karri Venkata Ramana",
    familiarName: "Ramana Sir",
    role: "Correspondent",
    photo: "/correspondent.png",
    photoObjectPosition: "object-center",
    bio: "Guides the school's vision and growth, and works closely with parents and staff to keep standards high across campus.",
    quote:
      "Every child can grow with the right support. We watch each student closely and help them build discipline and self-belief.",
    cardClass: "from-emerald-50 to-teal-50 border-emerald-100",
    roleClass: "text-emerald-700",
    quoteClass: "text-emerald-200",
  },
] as const;

export default function About() {
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
          <span className="inline-block text-blue-200 text-sm font-semibold uppercase tracking-widest mb-4">
            Bhadrachalam, Telangana
          </span>
          <h1 className="font-heading text-4xl md:text-6xl font-bold text-white mb-6">
            About Divya High School
          </h1>
          <p className="text-lg md:text-xl text-blue-100 max-w-2xl mx-auto">
            More than twenty years of teaching with care, discipline, and strong results in Bhadrachalam.
          </p>
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-blue-200">
            <Link href="/" className="hover:text-white transition">
              Home
            </Link>
            <span>/</span>
            <span className="text-white font-medium">About</span>
          </div>
        </div>
      </section>

      {/* Section 2: Introduction */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="relative">
              <Image
                src={SCHOOL_BUILDING_IMAGE}
                alt="Divya High School campus"
                width={600}
                height={450}
                className="w-full h-auto rounded-2xl shadow-xl object-cover aspect-[4/3]"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="absolute -bottom-4 -right-4 bg-blue-700 text-white rounded-2xl px-6 py-4 shadow-xl">
                <div className="text-3xl font-bold">2004</div>
                <div className="text-xs text-blue-200 font-medium uppercase tracking-wider">Established</div>
              </div>
            </div>
            <div>
              <span className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Our Story</span>
              <h2 className="font-heading text-3xl md:text-4xl font-bold text-slate-900 mt-2 mb-6">
                22 Years of Excellence in Bhadrachalam
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                Divya High School started in 2004 with one goal: give every child a strong education and the values to
                match. Over the years we have become a trusted school in Bhadrachalam for families from LKG through Class
                X.
              </p>
              <p className="text-slate-600 leading-relaxed mb-8">
                We focus on strong academics, IIT Foundation training from Class VI, sports, and cultural activities. We
                want students to grow in every way.
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-xl">
                  <div className="text-2xl font-bold text-blue-700">100%</div>
                  <div className="text-xs text-slate-600 mt-1">Pass Rate</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-xl border-x border-blue-100">
                  <div className="text-2xl font-bold text-blue-700">22+</div>
                  <div className="text-xs text-slate-600 mt-1">Years</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-xl">
                  <div className="text-2xl font-bold text-blue-700">LKG–X</div>
                  <div className="text-xs text-slate-600 mt-1">Classes</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Vision & Mission */}
      <section className="py-16 md:py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="text-sm font-semibold text-blue-600 uppercase tracking-wider">What We Stand For</span>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-slate-900 mt-2">Vision & Mission</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="relative bg-white rounded-2xl p-8 md:p-10 border border-slate-200 shadow-md overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-500" aria-hidden />
              <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mb-6">
                <Eye className="w-7 h-7 text-blue-700" aria-hidden />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Our Vision</h3>
              <p className="text-slate-600 leading-relaxed text-base md:text-lg">
                We want students to grow up confident, responsible, and ready for college and life, with strong values
                and the drive to do their best.
              </p>
            </div>
            <div className="relative bg-white rounded-2xl p-8 md:p-10 border border-slate-200 shadow-md overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-600 to-teal-500" aria-hidden />
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mb-6">
                <Target className="w-7 h-7 text-emerald-700" aria-hidden />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Our Mission</h3>
              <p className="text-slate-600 leading-relaxed text-base md:text-lg">
                To give every student a strong academic base, good values, and the confidence to succeed in exams and in
                life.
              </p>
              <p className="mt-4 text-sm text-slate-500">
                <Link href="/about/mission-vision" className="text-blue-700 font-semibold hover:text-blue-800">
                  Read our core values →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Key strengths */}
      <section className="pt-16 md:pt-20 pb-8 md:pb-10 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-2">Why Choose Us</div>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-slate-900">Our Strengths</h2>
            <p className="mt-3 text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
              A few reasons families choose Divya High School
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10 items-stretch">
            {WHY_CHOOSE.map((item, i) => (
              <div
                key={i}
                className="h-full flex flex-col text-center px-4 p-6 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div
                  className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center shrink-0 ${item.iconWrapClass}`}
                >
                  {item.icon}
                </div>
                <h3 className="font-heading text-lg font-bold text-slate-900 mt-5 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-3 flex-1">{item.description}</p>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{item.stat}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 5: Leadership */}
      <section className="pt-8 md:pt-12 pb-16 md:pb-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3 block">
              Our Leadership
            </span>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Guided by Dedicated Educators
            </h2>
            <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
              Our principal and correspondent lead the school with experience and a personal interest in every student.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {LEADERSHIP.map((leader) => (
              <div
                key={leader.name}
                className={`bg-gradient-to-br ${leader.cardClass} rounded-3xl p-8 md:p-10 border hover:shadow-xl transition-all duration-300`}
              >
                <div className="flex items-start gap-5 mb-5">
                  <div className="relative w-24 h-24 rounded-xl overflow-hidden shrink-0 shadow-md ring-2 ring-white">
                    <Image
                      src={leader.photo}
                      alt={`${leader.name}, ${leader.role}`}
                      fill
                      className={`object-cover ${leader.photoObjectPosition}`}
                      sizes="96px"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-bold text-slate-900 leading-tight">{leader.name}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">({leader.familiarName})</p>
                    <p className={`text-sm font-semibold uppercase tracking-wide mt-2 ${leader.roleClass}`}>
                      {leader.role}
                    </p>
                    <p className="text-sm text-slate-600 mt-3 leading-relaxed">{leader.bio}</p>
                  </div>
                </div>
                <Quote className={`w-8 h-8 ${leader.quoteClass} mb-3`} aria-hidden />
                <p className="text-slate-700 leading-relaxed italic">&ldquo;{leader.quote}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

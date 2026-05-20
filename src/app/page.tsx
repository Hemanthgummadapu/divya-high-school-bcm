import Link from "next/link";
import Image from "next/image";
import HeroSlideshow from "@/components/HeroSlideshow";
import AdmissionBanner from "@/components/AdmissionBanner";
import AcademicResourcesSection from "@/components/AcademicResourcesSection";
import { SCHOOL_BUILDING_IMAGE } from "@/lib/public-assets";
import { HOME_GALLERY_PREVIEW } from "@/data/gallery";
import { WHY_CHOOSE } from "@/data/why-choose-us";
import {
  Award,
  ArrowRight,
  Calendar,
  GraduationCap,
  Maximize2,
  MessageCircle,
  Star,
} from "lucide-react";

/*
const HIGHLIGHTS = [
  {
    title: "Academic Excellence",
    description: "Rigorous curriculum and dedicated faculty to help every student achieve their full potential.",
    href: "/academics",
    iconWrapClass: "bg-blue-50 text-blue-600",
    icon: <GraduationCap className="w-7 h-7" aria-hidden="true" />,
  },
  {
    title: "Sports Academy",
    description: "State-of-the-art facilities and coaching for cricket, athletics, and more.",
    href: "/sports",
    iconWrapClass: "bg-emerald-50 text-emerald-600",
    icon: <Trophy className="w-7 h-7" aria-hidden="true" />,
  },
  {
    title: "Holistic Development",
    description: "Values, arts, and life skills alongside academics for well-rounded growth.",
    href: "/about",
    iconWrapClass: "bg-amber-50 text-amber-600",
    icon: <Heart className="w-7 h-7" aria-hidden="true" />,
  },
];
*/

// const FEATURE_CARDS = [
//   {
//     title: "Experienced Faculty",
//     description: "Qualified and caring teachers committed to student success and holistic development.",
//     icon: (
//       <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
//         <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.905 59.905 0 0 1 12 3.493a59.902 59.902 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-3.75 9.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m3-9.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m3.75 9.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443" />
//       </svg>
//     ),
//   },
//   {
//     title: "Digital Classrooms",
//     description: "Smart boards, digital tools, and modern tech for an engaging learning experience.",
//     icon: (
//       <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
//         <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
//       </svg>
//     ),
//   },
//   {
//     title: "Sports Activities",
//     description: "Cricket, athletics, and more—state-of-the-art facilities and dedicated coaching.",
//     icon: (
//       <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
//         <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
//       </svg>
//     ),
//   },
//   {
//     title: "Safe Campus",
//     description: "A secure, nurturing environment where every child feels protected and valued.",
//     icon: (
//       <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
//         <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
//       </svg>
//     ),
//   },
// ];

// TODO: Replace these placeholder testimonials with real parent reviews collected with consent.
// Verify parent names, student names, and class details with school administration before publishing.
const TESTIMONIALS = [
  {
    parentName: "Lakshmi Devi",
    subtitle: "Parent of Aarav, Class IX",
    review:
      "We moved to Bhadrachalam two years ago and were nervous about finding the right school. Aarav has improved so much — not just in marks but in confidence. The teachers actually know each child personally. That matters more than we realized.",
    stars: 5,
    avatarClass: "bg-gradient-to-br from-rose-400 to-pink-500",
  },
  {
    parentName: "Venkateswara Rao",
    subtitle: "Parent of Sahithi, Class VII",
    review:
      "What sets Divya High School apart is the discipline and values they instill alongside academics. My daughter has become more responsible and focused at home too. The regular updates from teachers keep us involved in her learning journey.",
    stars: 5,
    avatarClass: "bg-gradient-to-br from-emerald-400 to-teal-500",
  },
  {
    parentName: "Srinivas Reddy",
    subtitle: "Parent of Harshitha, Class X",
    review:
      "My daughter just completed her board exams and we are so proud of her preparation. The IIT Foundation classes from Class VI built such a strong base. The teachers stayed back many evenings to clear doubts before exams. That kind of dedication is rare to find.",
    stars: 5,
    avatarClass: "bg-gradient-to-br from-blue-400 to-indigo-500",
  },
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}

export default function Home() {
  return (
    <div>
      <AdmissionBanner />
      <HeroSlideshow />
      <AcademicResourcesSection />

      {/* Welcome to Divya High School */}
      <section className="py-16 md:py-20 bg-white overflow-x-clip">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="relative order-2 lg:order-1 min-w-0">
              <div
                className="absolute -bottom-6 -left-4 sm:-left-6 w-32 h-32 bg-blue-100 rounded-2xl pointer-events-none"
                aria-hidden="true"
              />
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-xl">
                <Image
                  src={SCHOOL_BUILDING_IMAGE}
                  alt="Divya High School - Campus"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            </div>
            <div className="order-1 lg:order-2 min-w-0 flex flex-col">
              <div className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-2">
                ABOUT US
              </div>
              <h2 className="font-heading text-3xl md:text-4xl font-bold text-slate-900 mb-6">
                Welcome to Divya High School
              </h2>
              <p className="text-base md:text-lg leading-relaxed text-slate-600 mb-6">
                Established in 2004, Divya High School has been dedicated to providing quality education and nurturing young minds with strong academic foundations and cultural values. We take pride in a consistent{" "}
                <strong className="font-bold text-slate-800">100% pass rate</strong>, with{" "}
                <strong className="font-bold text-slate-800">
                  over 75% of our students scoring above 500 out of 600
                </strong>{" "}
                every year. Beyond academic excellence, we build the foundation our students need for Intermediate, engineering entrance exams, and life beyond school.
              </p>
              {/* TODO: confirm exact pass rate stats with school administration before publishing. */}
              <div className="grid grid-cols-3 gap-4 my-6 p-5 bg-blue-50 rounded-2xl border border-blue-100 w-full">
                <div className="text-center min-w-0 px-0.5">
                  <div className="text-2xl md:text-3xl font-bold text-blue-700 tabular-nums">100%</div>
                  <div className="text-xs text-slate-600 mt-1 font-medium leading-tight">
                    Pass Rate
                  </div>
                </div>
                <div className="text-center min-w-0 px-0.5">
                  <div className="text-2xl md:text-3xl font-bold text-blue-700 tabular-nums">75%+</div>
                  <div className="text-xs text-slate-600 mt-1 font-medium leading-tight">
                    Score 500+/600
                  </div>
                </div>
                <div className="text-center min-w-0 px-0.5">
                  <div className="text-2xl md:text-3xl font-bold text-blue-700 tabular-nums">22+</div>
                  <div className="text-xs text-slate-600 mt-1 font-medium leading-tight">
                    Years of Excellence
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 mb-8 w-full">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-9 h-9 shrink-0 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-blue-600" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex flex-col gap-0.5">
                    <div className="text-xs uppercase tracking-wider text-slate-500">Established:</div>
                    <div className="text-sm font-semibold text-slate-900 leading-tight">2004</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-9 h-9 shrink-0 rounded-lg bg-blue-50 flex items-center justify-center">
                    <GraduationCap className="w-4 h-4 text-blue-600" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex flex-col gap-0.5">
                    <div className="text-xs uppercase tracking-wider text-slate-500">Classes:</div>
                    <div className="text-sm font-semibold text-slate-900 leading-tight">LKG to 10th</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-9 h-9 shrink-0 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Award className="w-4 h-4 text-blue-600" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex flex-col gap-0.5">
                    <div className="text-xs uppercase tracking-wider text-slate-500">FOCUS:</div>
                    <div className="text-sm font-semibold text-slate-900 leading-tight">
                      Higher studies focus
                    </div>
                  </div>
                </div>
              </div>
              <Link
                href="/about"
                className="self-start inline-flex w-auto items-center justify-center bg-blue-700 hover:bg-blue-800 text-white px-8 py-3 rounded-lg font-semibold transition"
              >
                Read More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/*
      Feature cards - 4 items (commented out)
      <section className="py-16 md:py-24 bg-card">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {FEATURE_CARDS.map((item, i) => (
              <div
                key={i}
                className="group bg-white rounded-2xl p-8 shadow-md border border-gray-100 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 ease-out"
              >
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 text-accent-gold bg-accent-gold/10 group-hover:scale-110 group-hover:bg-accent-gold/20 transition-transform duration-300">
                  {item.icon}
                </div>
                <h3 className="font-heading text-xl font-semibold text-heading mb-3">{item.title}</h3>
                <p className="text-body leading-relaxed text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      */}

      {/*
      Highlights - 3 cards
      <section className="py-16 md:py-24 bg-bg-page">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {HIGHLIGHTS.map((item, i) => (
              <div
                key={i}
                className="group bg-white rounded-2xl p-8 shadow-md border border-slate-100 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
              >
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 ${item.iconWrapClass}`}>
                  {item.icon}
                </div>
                <h3 className="font-heading text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                <p className="text-slate-600 leading-relaxed">{item.description}</p>
                <div className="mt-6">
                  <Link
                    href={item.href}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                  >
                    Learn more <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      */}

      {/* Why Choose Us — pt-0 avoids double gap after About Us (same bg-white) */}
      <section className="pt-0 pb-16 md:pb-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-2">
              OUR STRENGTHS
            </div>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-slate-900">
              Why Choose Us
            </h2>
            <p className="mt-3 text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
              What sets Divya High School apart
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10 items-stretch">
            {WHY_CHOOSE.map((item, i) => (
              <div
                key={i}
                className="h-full flex flex-col text-center px-4 p-6 rounded-2xl hover:bg-white transition-colors duration-200"
              >
                <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center shrink-0 ${item.iconWrapClass}`}>
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

      {/* Admissions CTA */}
      <section className="relative mt-0 py-16 md:py-20 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 overflow-hidden">
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.55) 1px, transparent 0)",
            backgroundSize: "18px 18px",
          }}
          aria-hidden="true"
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center px-2 sm:px-0">
            <div className="inline-flex items-center justify-center bg-white/10 backdrop-blur text-white text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full mb-5">
              ADMISSIONS 2026–27
            </div>
            <h2 className="font-heading text-3xl md:text-5xl font-bold text-white mb-4">Admissions Open for 2026–27</h2>
            <p className="text-lg text-blue-100 mb-10 max-w-xl mx-auto">Secure your child&apos;s future with quality education.</p>
            <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-4">
            <Link
              href="/admissions"
              className="w-full sm:w-auto inline-flex items-center justify-center bg-white text-blue-700 font-bold hover:bg-blue-50 px-8 py-3 rounded-lg shadow-lg transition-colors duration-300"
            >
              Apply Online
            </Link>
              <a
                href="https://wa.me/919100569269?text=Hello%2C%20I%20would%20like%20to%20enquire%20about%20admissions."
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-transparent border-2 border-white text-white font-bold hover:bg-white hover:text-blue-700 px-8 py-3 rounded-lg transition-colors duration-300"
              >
                <MessageCircle className="w-5 h-5" aria-hidden="true" />
                Enquire on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery – campus & classroom photos (3×2 grid) */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-2">
              MOMENTS
            </div>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-slate-900">
              Gallery
            </h2>
            <p className="mt-3 text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
              Glimpses of life at Divya High School
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {HOME_GALLERY_PREVIEW.map((item, i) => (
              <Link
                key={i}
                href="/gallery"
                className="group relative aspect-[4/3] rounded-xl overflow-hidden shadow-md"
              >
                <div className="absolute inset-0 overflow-hidden">
                  <Image
                    src={item.src}
                    alt={item.alt}
                    fill
                    className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0.15), rgba(0,0,0,0))",
                  }}
                  aria-hidden="true"
                />
                <div className="absolute inset-0 flex items-end justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-white px-3 py-1.5 text-sm font-semibold">
                    <Maximize2 className="w-4 h-4" aria-hidden="true" />
                    View
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/gallery"
              className="inline-flex items-center gap-2 border-2 border-blue-700 text-blue-700 hover:bg-blue-50 px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              View All Photos
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* What Parents Say */}
      <section className="py-16 md:py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-2">
              TESTIMONIALS
            </div>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-slate-900">
              What Parents Say
            </h2>
            <p className="mt-3 text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
              Real experiences from families who chose Divya High School
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={i}
                className="relative h-full flex flex-col rounded-2xl bg-white p-8 shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <span
                  className="absolute top-6 right-6 text-blue-100 text-5xl font-serif leading-none select-none"
                  aria-hidden="true"
                >
                  &ldquo;
                </span>

                <div className="flex items-center gap-4 mb-5">
                  <div
                    className={`w-12 h-12 rounded-full flex shrink-0 items-center justify-center text-white font-bold ${t.avatarClass}`}
                  >
                    {getInitials(t.parentName)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900">{t.parentName}</div>
                    <div className="text-xs text-slate-500">{t.subtitle}</div>
                  </div>
                </div>

                <div className="flex gap-1 mb-4" aria-hidden="true">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 text-base italic leading-relaxed mt-1 mb-2 flex-1">
                  {t.review}
                </p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-slate-500 mt-12 italic">
            Reviews shared with parent consent. Names and student details used with permission.
          </p>
        </div>
      </section>
    </div>
  );
}

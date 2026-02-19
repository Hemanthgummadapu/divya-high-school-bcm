import Link from "next/link";
import Image from "next/image";
import HeroSlideshow from "@/components/HeroSlideshow";
import AdmissionBanner from "@/components/AdmissionBanner";

const HIGHLIGHTS = [
  {
    title: "Academic Excellence",
    description: "Rigorous curriculum and dedicated faculty to help every student achieve their full potential.",
    icon: (
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
      </svg>
    ),
  },
  {
    title: "Sports Academy",
    description: "State-of-the-art facilities and coaching for cricket, athletics, and more.",
    icon: (
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Holistic Development",
    description: "Values, arts, and life skills alongside academics for well-rounded growth.",
    icon: (
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
];

const WHY_CHOOSE = [
  { title: "Experienced Faculty", description: "Qualified and caring teachers committed to student success.", icon: "M12 14l9-5-9-5-9 5 9 5z" },
  { title: "Modern Infrastructure", description: "Well-equipped classrooms, labs, and digital learning tools.", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { title: "Safe & Secure Campus", description: "A nurturing environment where every child feels protected.", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
  { title: "Value-Based Education", description: "Character building and ethics at the heart of learning.", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
];

const GALLERY_IMAGES = [
  "/slideshow-sports.png",
  "/slideshow-school.png",
  "/slideshow-assembly.png",
  "/slideshow-sports.png",
  "/slideshow-school.png",
  "/slideshow-assembly.png",
];

const TESTIMONIALS = [
  { name: "Parent of Class X Student", review: "Divya High School has provided an excellent balance of academics and values. My child has grown in confidence and character.", stars: 5 },
  { name: "Parent of Class V Student", review: "The teachers are dedicated and the campus is safe. We are happy with the holistic approach to education.", stars: 5 },
  { name: "Parent of Class VIII Student", review: "Quality education with a focus on discipline and future readiness. Proud to be part of this school family.", stars: 5 },
];

export default function Home() {
  return (
    <div>
      <AdmissionBanner />
      <HeroSlideshow />

      {/* Highlights - 3 cards */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HIGHLIGHTS.map((item, i) => (
              <div
                key={i}
                className="group bg-white rounded-2xl p-8 shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-gray-100 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 text-[#b8a068]" style={{ backgroundColor: "rgba(184, 160, 104, 0.12)" }}>
                  {item.icon}
                </div>
                <h3 className="font-heading text-xl font-semibold text-[var(--color-navy)] mb-3">{item.title}</h3>
                <p className="text-[var(--color-charcoal)] leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section className="py-16 md:py-24 bg-[#faf8f5]">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
              <Image src="/slideshow-school.png" alt="Divya High School" fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" />
            </div>
            <div>
              <h2 className="font-heading text-3xl md:text-4xl font-semibold text-[var(--color-navy)] mb-6">About Divya High School</h2>
              <p className="text-[var(--color-charcoal)] text-lg leading-relaxed mb-8">
                Divya High School is committed to excellence in education. We provide a nurturing environment where students develop academically, physically, and morally. Our experienced faculty and modern facilities support every child in achieving their potential and becoming responsible citizens of tomorrow.
              </p>
              <Link
                href="/about"
                className="btn-secondary"
              >
                Read More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="font-heading text-3xl md:text-4xl font-semibold text-[var(--color-navy)] text-center mb-12">Why Choose Us</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {WHY_CHOOSE.map((item, i) => (
              <div key={i} className="text-center p-6 rounded-xl hover:bg-[#faf8f5] transition-colors duration-300">
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center text-[#b8a068]" style={{ backgroundColor: "rgba(184, 160, 104, 0.12)" }}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                </div>
                <h3 className="font-heading text-lg font-semibold text-[var(--color-navy)] mb-2">{item.title}</h3>
                <p className="text-[var(--color-charcoal)] text-sm leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Admissions CTA */}
      <section className="py-16 md:py-20" style={{ backgroundColor: "rgba(184, 160, 104, 0.12)" }}>
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-heading text-3xl md:text-4xl font-semibold text-[var(--color-navy)] mb-4">Admissions Open for 2026–27</h2>
          <p className="text-[var(--color-charcoal)] text-lg mb-10 max-w-xl mx-auto">Secure your child&apos;s future with quality education.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/admissions/online-form" className="btn-primary">
              Apply Online
            </Link>
            <a
              href="https://wa.me/919100569269?text=Hello%2C%20I%20would%20like%20to%20enquire%20about%20admissions."
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              Enquire on WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* Gallery Preview */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="font-heading text-3xl md:text-4xl font-semibold text-[var(--color-navy)] text-center mb-12">Gallery</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {GALLERY_IMAGES.map((src, i) => (
              <Link key={i} href="/gallery" className="group relative aspect-[4/3] rounded-xl overflow-hidden">
                <Image src={src} alt="" fill className="object-cover transition-transform duration-300 group-hover:scale-105" sizes="(max-width: 768px) 50vw, 33vw" />
                <div className="absolute inset-0 bg-[#0d1b2a]/0 group-hover:bg-[#0d1b2a]/40 transition-colors duration-300" />
              </Link>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/gallery" className="btn-secondary">
              View Full Gallery
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 md:py-24 bg-[#faf8f5]">
        <div className="container mx-auto px-4">
          <h2 className="font-heading text-3xl md:text-4xl font-semibold text-[var(--color-navy)] text-center mb-12">What Parents Say</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-white rounded-2xl p-8 shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-gray-100">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <svg key={j} className="w-5 h-5 text-[#b8a068]" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-[var(--color-charcoal)] leading-relaxed mb-6">&ldquo;{t.review}&rdquo;</p>
                <p className="font-sans text-sm font-medium text-[var(--color-navy)]">{t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

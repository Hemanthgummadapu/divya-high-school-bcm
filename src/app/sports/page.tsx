import Image from "next/image";
import Link from "next/link";
import FadeInSection from "@/components/FadeInSection";

const SPORTS = [
  { name: "Cricket", description: "Build focus, coordination and team spirit on the field.", icon: "cricket" },
  { name: "Volleyball", description: "Develop agility, reflexes and collaborative play.", icon: "volleyball" },
  { name: "Badminton", description: "Improve speed, strategy and physical fitness.", icon: "badminton" },
  { name: "Kho Kho", description: "Traditional sport that builds stamina and quick thinking.", icon: "kho" },
  { name: "Kabaddi", description: "Strength, strategy and teamwork in an exciting format.", icon: "kabaddi" },
  { name: "Chess", description: "Strategic thinking and concentration for the mind.", icon: "chess" },
];

const ACHIEVEMENTS = [
  { title: "10+ Inter-School Wins", detail: "Regular participation and wins in district and zonal events.", icon: "trophy" },
  { title: "Annual Sports Day Celebration", detail: "School-wide events celebrating fitness and sportsmanship.", icon: "calendar" },
  { title: "Professional Coaching Support", detail: "Structured coaching for selected sports and skill development.", icon: "coach" },
];

const GALLERY_ITEMS = [
  { src: "/slideshow1.png", alt: "Sports at Divya High School", label: "Sports Day 2024" },
  { src: "/slideshow2.png", alt: "Campus and activities", label: "Kho Kho Practice" },
  { src: "/slideshow3.png", alt: "School events", label: "Kabaddi Tournament" },
];

const WHY_SPORTS = [
  { title: "Builds Leadership", description: "Students learn to lead and inspire their peers on and off the field.", icon: "leadership" },
  { title: "Encourages Discipline", description: "Regular practice and fair play instill lasting habits and values.", icon: "discipline" },
  { title: "Strengthens Team Spirit", description: "Working together toward a common goal builds camaraderie.", icon: "team" },
];

function SportIcon({ type }: { type: string }) {
  const cls = "w-10 h-10 text-primary-blue flex-shrink-0";
  switch (type) {
    case "cricket":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "volleyball":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "badminton":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case "kho":
    case "kabaddi":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      );
    case "chess":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      );
    default:
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
  }
}

function AchievementIcon({ type }: { type: string }) {
  const cls = "w-8 h-8 text-primary-blue flex-shrink-0 mx-auto";
  switch (type) {
    case "trophy":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      );
    case "calendar":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case "coach":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    default:
      return null;
  }
}

function WhySportsIcon({ type }: { type: string }) {
  const cls = "w-8 h-8 text-primary-blue flex-shrink-0";
  switch (type) {
    case "leadership":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z" />
        </svg>
      );
    case "discipline":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "team":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      );
    default:
      return null;
  }
}

function SportsProgramIcon() {
  return (
    <svg className="w-10 h-10 text-primary-blue mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

export default function Sports() {
  return (
    <div className="min-h-screen bg-white">
      <style dangerouslySetInnerHTML={{ __html: "@keyframes fadeInUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in-up { animation: fadeInUp 0.6s ease-out both; }" }} />
      {/* 1. Hero Section */}
      <FadeInSection>
        <header className="relative w-full min-h-[70vh] flex items-center justify-center overflow-hidden">
          <Image
            src="/slideshow1.png"
            alt="Sports at Divya High School"
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" aria-hidden />
          <div className="relative z-10 text-center px-4 animate-fade-in-up">
            <h1 className="text-5xl md:text-6xl font-extrabold font-heading text-white drop-shadow-lg mb-4">
              Sports & Physical Education
            </h1>
            <p className="text-lg md:text-xl text-white/95 font-medium max-w-2xl mx-auto mb-8">
              Building strength, teamwork and leadership through sports.
            </p>
            <Link
              href="#sports-we-offer"
              className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg shadow-lg transition duration-300 font-semibold"
            >
              Explore Our Sports
            </Link>
          </div>
        </header>
      </FadeInSection>

      {/* 2. Our Sports Program Section */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <SportsProgramIcon />
            <h2 className="font-heading text-2xl md:text-3xl font-bold text-heading pb-6 border-b border-gray-200">
              Our Sports Program
            </h2>
            <p className="text-center text-gray-600 leading-relaxed mt-8">
              Physical fitness, teamwork and discipline are at the heart of our sports program. We offer a range of activities so every student can stay active, build confidence and learn the value of fair play. Our aim is to nurture both body and mind through structured coaching and regular participation in school and inter-school events.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Sports We Offer Section */}
      <section id="sports-we-offer" className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-heading text-center mb-12">
            Sports We Offer
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {SPORTS.map((sport) => (
              <div
                key={sport.name}
                className="bg-white rounded-2xl p-8 shadow-md border border-gray-100 transition-all duration-300 ease-in-out hover:shadow-2xl hover:-translate-y-2"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-blue-50 p-3 rounded-full flex items-center justify-center">
                    <SportIcon type={sport.icon} />
                  </div>
                  <h3 className="font-heading font-semibold text-xl text-heading">
                    {sport.name}
                  </h3>
                </div>
                <p className="text-body text-gray-600 text-sm leading-relaxed">
                  {sport.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Sports Achievements Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-heading text-center mb-12">
            Sports Achievements
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {ACHIEVEMENTS.map((item) => (
              <div
                key={item.title}
                className="bg-white rounded-xl p-6 shadow-md border border-gray-100 text-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              >
                <div className="mb-4">
                  <AchievementIcon type={item.icon} />
                </div>
                <h3 className="font-heading font-semibold text-heading text-lg mb-2">
                  {item.title}
                </h3>
                <p className="text-body text-gray-600 text-sm leading-relaxed">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Sports Moments Gallery */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-heading text-center mb-12">
            Sports Moments
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {GALLERY_ITEMS.map((item, i) => (
              <div
                key={i}
                className="relative aspect-[4/3] rounded-xl overflow-hidden group"
              >
                <Image
                  src={item.src}
                  alt={item.alt}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                  sizes="(max-width: 640px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors duration-300 flex items-end justify-center pb-4">
                  <span className="text-white font-semibold text-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 drop-shadow-md">
                    {item.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Why Sports Matter Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-heading text-center mb-12">
            Why Sports Matter at Divya High School
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {WHY_SPORTS.map((item) => (
              <div key={item.title} className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center">
                <div className="flex justify-center mb-4">
                  <WhySportsIcon type={item.icon} />
                </div>
                <h3 className="font-heading font-semibold text-heading text-lg mb-2">
                  {item.title}
                </h3>
                <p className="text-body text-gray-600 text-sm leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Call To Action Section */}
      <section className="py-24 bg-gradient-to-r from-blue-50 to-indigo-50 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #94a3b8 1px, transparent 0)", backgroundSize: "24px 24px" }} aria-hidden />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <p className="text-xl md:text-2xl font-semibold text-heading mb-10">
            Encouraging every child to stay active and confident.
          </p>
          <Link
            href="/gallery"
            className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 text-base"
          >
            View Full Gallery
          </Link>
        </div>
      </section>
         </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import {
  SPORTS_MOMENTS,
  SPORTS_OFFERED,
  SPORTS_PT_DRILL_IMAGE,
} from "@/data/sports-page";

export default function Sports() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <header className="relative w-full min-h-[50vh] md:min-h-[55vh] flex items-center justify-center overflow-hidden">
        <Image
          src={SPORTS_PT_DRILL_IMAGE}
          alt="Students during PT drill at Divya High School"
          fill
          className="object-cover object-center"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-black/55" aria-hidden />
        <div className="relative z-10 text-center px-4 max-w-2xl mx-auto pt-20 pb-16">
          <h1 className="font-heading text-3xl md:text-5xl font-bold text-white drop-shadow-md mb-4">
            Sports &amp; Physical Education
          </h1>
          <p className="text-base md:text-lg text-white/95">
            Every student at Divya High School takes part in daily physical activity.
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        {/* Sports offered */}
        <section className="mb-12 md:mb-16" aria-labelledby="sports-offered-heading">
          <h2 id="sports-offered-heading" className="font-heading text-xl font-bold text-slate-900 mb-4">
            Sports &amp; activities
          </h2>
          <ul className="flex flex-wrap gap-2">
            {SPORTS_OFFERED.map((sport) => (
              <li
                key={sport}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800"
              >
                {sport}
              </li>
            ))}
          </ul>
        </section>

        {/* Sports moments */}
        <section className="mb-12 md:mb-16" aria-labelledby="sports-moments-heading">
          <h2 id="sports-moments-heading" className="font-heading text-xl font-bold text-slate-900 mb-4">
            Sports moments
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SPORTS_MOMENTS.map((photo) => (
              <div
                key={photo.src}
                className="relative aspect-[4/3] rounded-lg overflow-hidden bg-slate-100"
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Gallery CTA */}
        <section className="text-center py-8 border-t border-slate-100">
          <Link
            href="/gallery"
            className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
          >
            View Full Gallery
          </Link>
        </section>
      </div>
    </div>
  );
}

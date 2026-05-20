"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SCHOOL_BUILDING_IMAGE, SLIDESHOW2_IMAGE, STUDENTS_UNIFORM_IMAGE } from "@/lib/public-assets";

const DEFAULT_SLIDE_MS = 5500;
const FADE_DURATION = 800;

type AchievementSlide = {
  id: "toppers-2026";
  type: "achievement";
  backgroundImage: string;
  foregroundImage: string;
  alt: string;
  duration: number;
};

type PhotoSlide = {
  type?: "photo";
  src: string;
  alt: string;
  title: string;
  duration?: number;
};

type HeroSlide = AchievementSlide | PhotoSlide;

/** Slide 0 = achievement / toppers banner — must stay first for correct initial view. */
const HERO_SLIDES: HeroSlide[] = [
  {
    id: "toppers-2026",
    type: "achievement",
    backgroundImage: SCHOOL_BUILDING_IMAGE,
    foregroundImage: "/images/toppers-2026.jpg",
    alt: "Divya High School Class X Toppers 2026",
    duration: 7000,
  },
  { src: SCHOOL_BUILDING_IMAGE, alt: "Divya High School - School Building", title: "Our Campus" },
  {
    src: STUDENTS_UNIFORM_IMAGE,
    alt: "Divya High School students",
    title: "Campus & Student Life",
  },
  { src: SLIDESHOW2_IMAGE, alt: "Divya High School - Assembly", title: "Events & Assembly" },
];

const TOTAL_SLIDES = HERO_SLIDES.length;

function isAchievementSlide(slide: HeroSlide): slide is AchievementSlide {
  return slide.type === "achievement";
}

function isStudentsUniformSlide(slide: HeroSlide): boolean {
  return !isAchievementSlide(slide) && slide.src === STUDENTS_UNIFORM_IMAGE;
}

export default function HeroSlideshow() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const welcomeSlideIndex = useMemo(
    () => HERO_SLIDES.findIndex((s) => !isAchievementSlide(s) && s.src === SCHOOL_BUILDING_IMAGE),
    []
  );

  useEffect(() => {
    const durationMs = HERO_SLIDES[currentSlide]?.duration ?? DEFAULT_SLIDE_MS;
    const timer = window.setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % TOTAL_SLIDES);
    }, durationMs);
    return () => window.clearTimeout(timer);
  }, [currentSlide]);

  const goPrev = () => setCurrentSlide((prev) => (prev - 1 + TOTAL_SLIDES) % TOTAL_SLIDES);
  const goNext = () => setCurrentSlide((prev) => (prev + 1) % TOTAL_SLIDES);

  return (
    <section
      className="relative w-full h-[calc(100vh-104px)] overflow-hidden bg-slate-900 flex items-center justify-center"
      aria-label="Hero slideshow"
    >
      {/* Slides */}
      {HERO_SLIDES.map((slide, index) => {
        const isActive = currentSlide === index;
        return (
          <div
            key={index}
            className="absolute inset-0 z-0 transition-opacity ease-in-out"
            style={{
              opacity: isActive ? 1 : 0,
              transitionDuration: `${FADE_DURATION}ms`,
              pointerEvents: isActive ? "auto" : "none",
            }}
          >
            {isAchievementSlide(slide) ? (
              <div className="relative w-full h-full overflow-hidden">
                <div className={`absolute inset-0 ${isActive ? "animate-ken-burns" : ""}`}>
                  <Image
                    src={slide.backgroundImage}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="100vw"
                    priority={index === 0}
                    quality={90}
                  />
                </div>

                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70 z-10 pointer-events-none" aria-hidden />

                <div className="relative z-20 h-full flex items-center justify-center px-4 sm:px-6 lg:px-12 py-8">
                  <div className="w-full max-w-6xl">
                    <Image
                      src={slide.foregroundImage}
                      alt={slide.alt}
                      width={1600}
                      height={1000}
                      className="w-full h-auto rounded-2xl shadow-2xl ring-1 ring-white/10"
                      priority={index === 0}
                      sizes="(max-width: 1024px) 100vw, 1152px"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                {((): ReactNode => {
                  const photo = slide as PhotoSlide;
                  return isStudentsUniformSlide(slide) ? (
                  <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-slate-900">
                    <div className="relative h-full w-full min-h-0 min-w-0">
                      <Image
                        src={photo.src}
                        alt={photo.alt}
                        fill
                        className="object-contain object-center"
                        sizes="100vw"
                        quality={90}
                      />
                      <div
                        className="absolute inset-0 z-10 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none"
                        aria-hidden
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={`absolute inset-0 ${isActive ? "animate-hero-ken-burns" : ""}`}>
                      <Image
                        src={photo.src}
                        alt={photo.alt}
                        fill
                        className="object-cover object-center"
                        sizes="100vw"
                        priority={index === 0}
                        quality={90}
                      />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/70 z-10 pointer-events-none" aria-hidden />
                  </>
                );
                })()}

                {/* Centered hero content — keep existing welcome slide behavior */}
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center px-4 sm:px-6 pointer-events-none">
                  {index === welcomeSlideIndex && (
                    <div className="max-w-4xl mx-auto pointer-events-auto">
                      <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight font-heading text-white drop-shadow-2xl [text-shadow:_0_2px_8px_rgba(0,0,0,0.4)] mb-3 sm:mb-4 max-w-4xl mx-auto">
                        Welcome to Divya High School
                      </h1>
                      <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-200 font-medium drop-shadow-2xl [text-shadow:_0_2px_8px_rgba(0,0,0,0.35)] mb-6 sm:mb-8 max-w-2xl mx-auto">
                        Excellence in Education & Character Building
                      </p>
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5">
                        <Link
                          href="/admissions"
                          className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg px-8 py-3 text-base font-semibold font-heading text-white bg-[#1e3a8a] hover:bg-[#1e40af] shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-white/50"
                        >
                          Admissions Open
                        </Link>
                        <Link
                          href="/contact"
                          className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg px-8 py-3 text-base font-semibold font-heading text-white border-2 border-white hover:bg-white hover:text-[#1e3a8a] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-white/50"
                        >
                          Contact Us
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* Slide titles — bottom-8 from hero; pagination sits lower (bottom-4) */}
                {isActive && (
                  <div className="absolute inset-x-0 bottom-8 z-30 flex justify-center px-4 pointer-events-none">
                    <span className="text-white text-lg md:text-xl font-bold font-heading drop-shadow-2xl [text-shadow:_0_2px_10px_rgba(0,0,0,0.45)] text-center max-w-[95vw]">
                      {(slide as PhotoSlide).title}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      {/* Nav arrows */}
      <button
        type="button"
        onClick={goPrev}
        className="absolute left-6 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 hover:scale-110 transition-all flex items-center justify-center group focus:outline-none focus:ring-2 focus:ring-white/50"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-6 h-6 text-white" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={goNext}
        className="absolute right-6 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 hover:scale-110 transition-all flex items-center justify-center group focus:outline-none focus:ring-2 focus:ring-white/50"
        aria-label="Next slide"
      >
        <ChevronRight className="w-6 h-6 text-white" aria-hidden="true" />
      </button>

      {/* Dots — below captions (captions use bottom-8) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
        {HERO_SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setCurrentSlide(i)}
            className={`h-2.5 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent ${
              currentSlide === i ? "w-10 bg-white" : "w-2.5 bg-white/60 hover:bg-white/80"
            }`}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={currentSlide === i ? "true" : undefined}
          />
        ))}
      </div>
    </section>
  );
}

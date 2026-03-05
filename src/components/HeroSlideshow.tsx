"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

const SLIDE_DURATION = 5500;
const FADE_DURATION = 800;

const HERO_SLIDES = [
  { src: "/school-building.png", alt: "Divya High School - School Building", title: "Our Campus" },
  { src: "/slideshow1.png", alt: "Divya High School - Campus", title: "Campus & Student Life" },
  { src: "/slideshow2.png", alt: "Divya High School - Assembly", title: "Events & Assembly" },
];

const TOTAL_SLIDES = HERO_SLIDES.length;

export default function HeroSlideshow() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const currentSlideRef = useRef(0);
  currentSlideRef.current = currentSlide;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % TOTAL_SLIDES);
    }, SLIDE_DURATION);
    return () => clearInterval(timer);
  }, []);

  const goPrev = () => setCurrentSlide((prev) => (prev - 1 + TOTAL_SLIDES) % TOTAL_SLIDES);
  const goNext = () => setCurrentSlide((prev) => (prev + 1) % TOTAL_SLIDES);

  return (
    <section
      className="relative w-full h-[90vh] min-h-[420px] max-h-[900px] flex items-center justify-center overflow-hidden bg-slate-900"
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
            {/* Image with Ken Burns zoom — only animate when active */}
            <div className={`absolute inset-0 ${isActive ? "animate-hero-ken-burns" : ""}`}>
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                className="object-cover"
                sizes="100vw"
                priority={index === 0}
                quality={90}
              />
            </div>

            {/* Dark gradient overlay - do not block clicks */}
            <div
              className="absolute inset-0 z-[1] bg-gradient-to-r from-black/70 via-black/50 to-black/40 pointer-events-none"
              aria-hidden
            />

            {/* Centered hero content — only on first slide; ensure clickable */}
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-4 sm:px-6 pointer-events-none">
              {index === 0 && (
                <div className="max-w-3xl mx-auto pointer-events-auto">
                  <h1 className="text-4xl md:text-6xl font-extrabold font-heading text-white tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)] mb-3 sm:mb-4">
                    Welcome to Divya High School
                  </h1>
                  <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-200 font-medium drop-shadow-[0_1px_8px_rgba(0,0,0,0.4)] mb-6 sm:mb-8 max-w-2xl mx-auto">
                    Excellence in Education & Character Building
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5">
                    <Link
                      href="/admissions"
                      className="w-full sm:w-auto inline-flex items-center justify-center rounded-full px-7 py-3.5 sm:px-8 sm:py-4 text-base sm:text-lg font-semibold font-heading text-white bg-[#2563eb] hover:bg-[#1d4ed8] shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-white/50"
                    >
                      Admissions Open
                    </Link>
                    <Link
                      href="/contact"
                      className="w-full sm:w-auto inline-flex items-center justify-center rounded-full px-7 py-3.5 sm:px-8 sm:py-4 text-base sm:text-lg font-semibold font-heading text-white border-2 border-white/90 hover:bg-white/10 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-white/50"
                    >
                      Contact Us
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom caption - do not block nav dots/arrows */}
            <div
              className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-center pb-12 md:pb-14 pt-32 pointer-events-none"
              style={{
                background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)",
              }}
            >
              <span className="text-white text-lg md:text-xl font-bold font-heading drop-shadow-lg">
                {slide.title}
              </span>
            </div>
          </div>
        );
      })}

      {/* Nav arrows */}
      <button
        type="button"
        onClick={goPrev}
        className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:text-white transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-white/50"
        aria-label="Previous slide"
      >
        <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        type="button"
        onClick={goNext}
        className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:text-white transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-white/50"
        aria-label="Next slide"
      >
        <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Dots */}
      <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center gap-2">
        {HERO_SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setCurrentSlide(i)}
            className={`h-2 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent ${
              currentSlide === i ? "w-8 bg-white" : "w-2 bg-white/50 hover:bg-white/70"
            }`}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={currentSlide === i ? "true" : undefined}
          />
        ))}
      </div>
    </section>
  );
}

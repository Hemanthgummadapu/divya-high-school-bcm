"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

const SLIDE_DURATION = 5000;
const TOTAL_SLIDES = 5;

export default function HeroSlideshow() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const currentSlideRef = useRef(0);
  currentSlideRef.current = currentSlide;

  useEffect(() => {
    const timer = setInterval(() => {
      const next = (currentSlideRef.current + 1) % TOTAL_SLIDES;
      setCurrentSlide(next);
    }, SLIDE_DURATION);
    return () => clearInterval(timer);
  }, []);

  const goPrev = () => setCurrentSlide((prev) => (prev - 1 + TOTAL_SLIDES) % TOTAL_SLIDES);
  const goNext = () => setCurrentSlide((prev) => (prev + 1) % TOTAL_SLIDES);

  const arrowClass =
    "absolute top-1/2 -translate-y-1/2 z-20 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:text-[#d4af37] transition-colors duration-300";

  return (
    <section className="relative min-h-screen bg-gradient-to-br from-[#0d1b2a] via-[#1a365d] to-[#1e4976] text-white flex items-center overflow-hidden">
      {/* Left arrow */}
      <button
        type="button"
        onClick={goPrev}
        className={`${arrowClass} left-4 md:left-6`}
        aria-label="Previous slide"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Right arrow */}
      <button
        type="button"
        onClick={goNext}
        className={`${arrowClass} right-4 md:right-6`}
        aria-label="Next slide"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Slide 1: Logo */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-700 ease-in-out ${
          currentSlide === 0 ? "opacity-100 z-10" : "opacity-0 z-0"
        }`}
      >
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center mb-6">
            <Image
              src="/logo.png"
              alt="Divya High School - Work is Worship"
              width={220}
              height={220}
              className="rounded-full object-contain drop-shadow-lg"
            />
          </div>
          <p className="text-2xl font-semibold text-white/95 tracking-wide">
            Work is Worship
          </p>
        </div>
      </div>

      {/* Slide 2: School name + CTA */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-700 ease-in-out ${
          currentSlide === 1 ? "opacity-100 z-10" : "opacity-0 z-0"
        }`}
      >
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-4 text-white drop-shadow-sm">
            Divya High School BCM
          </h1>
          <p className="text-xl mb-8 text-white/95">Work is Worship</p>
          <div className="flex justify-center space-x-4">
            <Link
              href="/admissions"
              className="bg-white text-[#0d1b2a] px-6 py-3 rounded-lg font-semibold hover:bg-white/90 transition-colors duration-300"
            >
              Apply Now
            </Link>
            <Link
              href="/about"
              className="bg-transparent border-2 border-white text-white px-6 py-3 rounded-lg font-semibold hover:bg-white hover:text-[#0d1b2a] transition-colors duration-300"
            >
              Learn More
            </Link>
          </div>
        </div>
      </div>

      {/* Slide 3: Sports / group photo - link to Results */}
      <Link
        href="/academics/results"
        className={`absolute inset-0 block transition-opacity duration-700 ease-in-out ${
          currentSlide === 2 ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
        }`}
      >
        <div className="relative w-full h-full min-h-full">
          <Image
            src="/slideshow-sports.png"
            alt="Divya High School - Sports and achievements"
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[#0d1b2a]/40 flex items-end justify-center pb-8">
            <span className="text-white text-lg font-semibold drop-shadow-md">
              View Results & Achievements →
            </span>
          </div>
        </div>
      </Link>

      {/* Slide 4: School life / courtyard */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
          currentSlide === 3 ? "opacity-100 z-10" : "opacity-0 z-0"
        }`}
      >
        <div className="relative w-full h-full min-h-full">
          <Image
            src="/slideshow-school.png"
            alt="Divya High School - Campus and student life"
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[#0d1b2a]/30 flex items-end justify-center pb-8">
            <span className="text-white text-lg font-semibold drop-shadow-md">
              Campus & Student Life
            </span>
          </div>
        </div>
      </div>

      {/* Slide 5: Assembly / school event */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
          currentSlide === 4 ? "opacity-100 z-10" : "opacity-0 z-0"
        }`}
      >
        <div className="relative w-full h-full min-h-full">
          <Image
            src="/slideshow-assembly.png"
            alt="Divya High School - Assembly and school events"
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[#0d1b2a]/30 flex items-end justify-center pb-8">
            <span className="text-white text-lg font-semibold drop-shadow-md">
              Events & Assembly
            </span>
          </div>
        </div>
      </div>

      {/* Dots */}
      <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center gap-2">
        {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setCurrentSlide(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              currentSlide === i
                ? "w-8 bg-[#d4af37]"
                : "w-2 bg-white/50 hover:bg-white/70"
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

const SLIDE_DURATION = 5000;

const HERO_SLIDES = [
  { src: "/slideshow-school.png", alt: "Divya High School - Campus", overlay: "Campus & Student Life", href: undefined },
  { src: "/slideshow-assembly.png", alt: "Divya High School - Assembly and events", overlay: "Events & Assembly", href: undefined },
  { src: "/slideshow-sports.png", alt: "Divya High School - Sports and achievements", overlay: "View Results & Achievements →", href: "/academics/results" },
  { src: "/slideshow1.png", alt: "Divya High School", overlay: "Divya High School", href: undefined },
  { src: "/slideshow2.png", alt: "Divya High School", overlay: "Divya High School", href: undefined },
  { src: "/slideshow3.png", alt: "Divya High School", overlay: "Divya High School", href: undefined },
  { src: "/slideshow4.png", alt: "Divya High School", overlay: "Divya High School", href: undefined },
];

const TOTAL_SLIDES = HERO_SLIDES.length;

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
    "absolute top-1/2 -translate-y-1/2 z-20 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:text-accent-gold transition-colors duration-300";

  const darkOverlayStyle = {
    background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.5) 100%)",
  };
  const bottomGradientStyle = { background: "linear-gradient(to bottom, transparent, rgba(15,23,42,0.4))" };

  return (
    <section className="relative min-h-screen bg-primary-blue text-white flex items-center overflow-hidden">
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

      {/* Slides with smooth fade */}
      {HERO_SLIDES.map((slide, index) => {
        const isActive = currentSlide === index;
        const content = (
          <div className="relative w-full h-full min-h-full">
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              className="object-cover"
              sizes="100vw"
            />
            {/* Dark gradient overlay over image */}
            <div className="absolute inset-0" style={darkOverlayStyle} aria-hidden="true" />
            {/* Centered hero text - stacked and centered on all screens, extra emphasis on mobile */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 sm:px-6 z-10">
              <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-bold font-heading text-white drop-shadow-lg mb-2 sm:mb-3 md:mb-4 w-full">
                Welcome to Divya High School
              </h1>
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/95 font-medium drop-shadow-md max-w-2xl w-full">
                Excellence in Education & Character Building
              </p>
            </div>
            {/* Bottom caption strip */}
            <div
              className="absolute inset-x-0 bottom-0 flex items-end justify-center pb-10 md:pb-12 pt-24"
              style={bottomGradientStyle}
            >
              <span className="text-white text-lg md:text-xl font-bold font-heading drop-shadow-lg text-center px-4">
                {slide.overlay}
              </span>
            </div>
          </div>
        );

        const slideClass = `absolute inset-0 opacity-0 z-0 transition-opacity duration-700 ease-in-out ${
          isActive ? "!opacity-100 z-10" : ""
        }`;

        if (slide.href) {
          return (
            <Link
              key={index}
              href={slide.href}
              className={`${slideClass} block ${!isActive ? "pointer-events-none" : ""}`}
            >
              {content}
            </Link>
          );
        }

        return (
          <div key={index} className={slideClass}>
            {content}
          </div>
        );
      })}

      {/* Dots */}
      <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center gap-2">
        {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setCurrentSlide(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              currentSlide === i
                ? "w-8 bg-accent-gold"
                : "w-2 bg-white/50 hover:bg-white/70"
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}

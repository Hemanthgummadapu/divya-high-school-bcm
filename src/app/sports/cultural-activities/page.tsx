"use client";

import Image from "next/image";
import { useState, useEffect, useCallback, type ReactNode } from "react";
import FadeInSection from "@/components/FadeInSection";

const GALLERY_IMAGES = [
  { src: "/images/cultural/divya-annual-day-1.jpg", alt: "Annual Day celebration at Divya High School", caption: "Annual Day Dance Performance", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-2.jpg", alt: "Cultural performance at Annual Day", caption: "Cultural Dance by Students", category: "dance" as const },
  { src: "/images/cultural/divya-annual-day-3.jpg", alt: "Students at Annual Day event", caption: "Group Dance Celebration", category: "celebration" as const },
  { src: "/images/cultural/divya-annual-day-4.jpg", alt: "Annual Day stage performance", caption: "Stage Performance by Kids", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-5.jpg", alt: "Dance performance at Divya High School", caption: "Traditional Dance Event", category: "dance" as const },
  { src: "/images/cultural/divya-annual-day-6.jpg", alt: "Cultural program at Annual Day", caption: "Annual Day Celebration Moment", category: "celebration" as const },
  { src: "/images/cultural/divya-annual-day-7.jpg", alt: "Annual Day event at Divya High School", caption: "Student Cultural Show", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-8.jpg", alt: "Student performance at Annual Day", caption: "Folk Dance Performance", category: "dance" as const },
  { src: "/images/cultural/divya-annual-day-9.jpg", alt: "Cultural celebration at Annual Day", caption: "Annual Day Stage Show", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-10.jpg", alt: "Annual Day cultural program", caption: "Kids Dance Celebration", category: "dance" as const },
  { src: "/images/cultural/divya-annual-day-11.jpg", alt: "Dance and cultural activities", caption: "Cultural Program Highlights", category: "celebration" as const },
  { src: "/images/cultural/divya-annual-day-12.jpg", alt: "Annual Day at Divya High School", caption: "Group Performance at Annual Day", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-13.jpg", alt: "Student cultural performance", caption: "Traditional & Cultural Dances", category: "dance" as const },
  { src: "/images/cultural/divya-annual-day-14.jpg", alt: "Annual Day stage event", caption: "Student Talent on Stage", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-15.jpg", alt: "Annual Day celebration moment", caption: "Annual Day Festivities", category: "celebration" as const },
  { src: "/images/cultural/divya-annual-day-16.jpg", alt: "Cultural dance at Annual Day", caption: "Dance & Music Celebration", category: "dance" as const },
  { src: "/images/cultural/divya-annual-day-17.jpg", alt: "Annual Day program highlight", caption: "Cultural Event at Divya High School", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-18.jpg", alt: "Students at Annual Day celebration", caption: "Stage Show by Students", category: "celebration" as const },
  { src: "/images/cultural/divya-annual-day-19.jpg", alt: "Performance at Divya High School", caption: "Annual Day Moment", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-20.jpg", alt: "Annual Day cultural event", caption: "Youth Cultural Performance", category: "dance" as const },
  { src: "/images/cultural/divya-annual-day-21.jpg", alt: "Annual Day stage show", caption: "Celebration at Annual Day", category: "celebration" as const },
  { src: "/images/cultural/divya-annual-day-22.jpg", alt: "Annual Day celebration at school", caption: "Dance Performance by Students", category: "dance" as const },
  { src: "/images/cultural/divya-annual-day-23.jpg", alt: "Cultural activities at Annual Day", caption: "Annual Day Cultural Show", category: "celebration" as const },
];

type FilterValue = "all" | "annual-day" | "dance" | "celebration";

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "annual-day", label: "Annual Day" },
  { value: "dance", label: "Dance" },
  { value: "celebration", label: "Celebrations" },
];

function FadeInItem({ children, delayMs = 0 }: { children: ReactNode; delayMs?: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  return (
    <div
      className="transition-all duration-500 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
      }}
    >
      {children}
    </div>
  );
}

const SLIDE_INTERVAL_MS = 3000;

export default function CulturalActivities() {
  const [slideIndex, setSlideIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxFade, setLightboxFade] = useState<"in" | "out" | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterValue>("all");

  const filteredImages = activeFilter === "all"
    ? GALLERY_IMAGES
    : GALLERY_IMAGES.filter((img) => img.category === activeFilter);
  const filteredIndices = activeFilter === "all"
    ? GALLERY_IMAGES.map((_, i) => i)
    : GALLERY_IMAGES.map((img, i) => (img.category === activeFilter ? i : -1)).filter((i) => i >= 0);

  const goToSlide = useCallback((index: number) => {
    setSlideIndex((index + GALLERY_IMAGES.length) % GALLERY_IMAGES.length);
  }, []);

  const nextSlide = useCallback(() => {
    goToSlide(slideIndex + 1);
  }, [slideIndex, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide(slideIndex - 1);
  }, [slideIndex, goToSlide]);

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxFade(null);
  }, []);

  useEffect(() => {
    if (lightboxIndex !== null && lightboxFade === null) {
      const frame = requestAnimationFrame(() => setLightboxFade("in"));
      return () => cancelAnimationFrame(frame);
    }
  }, [lightboxIndex, lightboxFade]);

  const closeLightbox = useCallback(() => {
    setLightboxFade("out");
    const timer = setTimeout(() => {
      setLightboxIndex(null);
      setLightboxFade(null);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const lightboxPrev = useCallback(() => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex - 1 + GALLERY_IMAGES.length) % GALLERY_IMAGES.length);
  }, [lightboxIndex]);

  const lightboxNext = useCallback(() => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex + 1) % GALLERY_IMAGES.length);
  }, [lightboxIndex]);

  useEffect(() => {
    const timer = setInterval(nextSlide, SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [nextSlide]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") lightboxPrev();
      if (e.key === "ArrowRight") lightboxNext();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [lightboxIndex, closeLightbox, lightboxPrev, lightboxNext]);

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)",
      }}
    >
      {/* Page Title & Introduction */}
      <header
        className="pt-20 pb-12 md:pt-24 md:pb-16"
        style={{
          background: "linear-gradient(165deg, #fafbfd 0%, #f4f6f9 40%, #eef2f7 75%, #ffffff 100%)",
        }}
      >
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-heading mb-6">
            Cultural Activities
          </h1>
          <div
            className="h-1 w-full max-w-[200px] mx-auto mb-8 rounded-full"
            style={{
              background: "linear-gradient(90deg, #d97706 0%, #F59E0B 50%, #fbbf24 100%)",
            }}
            aria-hidden="true"
          />
          <p className="text-body text-lg leading-8 text-gray-700 max-w-3xl mx-auto">
            Cultural activities at Divya High School help students develop creativity, confidence,
            teamwork, and stage performance skills through events like Annual Day celebrations,
            dance performances, and cultural programs.
          </p>
        </div>
      </header>

      {/* Annual Day Slideshow - Full width */}
      <FadeInSection>
        <section className="px-4 py-10 md:py-14">
          <div className="container mx-auto max-w-6xl">
            <div className="relative w-full aspect-[16/9] md:aspect-[21/9] rounded-2xl overflow-hidden shadow-xl border border-gray-200 bg-gray-100">
              {GALLERY_IMAGES.map((img, i) => (
                <div
                  key={i}
                  className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                    i === slideIndex ? "opacity-100 z-10" : "opacity-0 z-0"
                  }`}
                  aria-hidden={i !== slideIndex}
                >
                  <Image
                    src={img.src}
                    alt={img.alt}
                    fill
                    className="object-cover"
                    sizes="100vw"
                    priority={i === 0}
                  />
                </div>
              ))}
              {/* Previous arrow */}
              <button
                type="button"
                onClick={prevSlide}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/90 hover:bg-white shadow-lg flex items-center justify-center text-gray-800 transition-colors"
                aria-label="Previous slide"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              {/* Next arrow */}
              <button
                type="button"
                onClick={nextSlide}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/90 hover:bg-white shadow-lg flex items-center justify-center text-gray-800 transition-colors"
                aria-label="Next slide"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {/* Slide indicators */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-2">
                {GALLERY_IMAGES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goToSlide(i)}
                    className={`w-2.5 h-2.5 rounded-full transition-colors ${
                      i === slideIndex ? "bg-white scale-110" : "bg-white/60 hover:bg-white/80"
                    }`}
                    aria-label={`Go to slide ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* Cultural Activities Photo Gallery */}
      <FadeInSection>
        <section className="py-16 md:py-20 bg-white">
          <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-heading mb-4 text-center">
              Annual Day Highlights ({activeFilter === "all" ? GALLERY_IMAGES.length : filteredImages.length} Photos)
            </h2>
            <p className="text-body text-gray-600 text-center max-w-2xl mx-auto mb-8">
              Memorable moments from Divya High School&apos;s Annual Day celebrations, showcasing student performances, cultural dances, and joyful participation.
            </p>
            {/* Filter buttons - centered above gallery */}
            <div className="flex flex-wrap justify-center gap-3 mb-12 sm:mb-14">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setActiveFilter(f.value)}
                  className={`rounded-[20px] py-2 px-[18px] text-sm transition-colors duration-200 ${
                    activeFilter === f.value
                      ? "bg-[#2563eb] text-white font-semibold"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 md:gap-10">
              {filteredImages.map((img, i) => {
                const originalIndex = filteredIndices[i];
                return (
                  <FadeInItem key={originalIndex} delayMs={100 + i * 40}>
                    <button
                      type="button"
                      onClick={() => openLightbox(originalIndex)}
                      className="group relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300 ease-out hover:shadow-[0_16px_48px_rgba(0,0,0,0.12)] focus:outline-none focus:ring-2 focus:ring-accent-gold focus:ring-offset-2 focus:ring-offset-white border border-gray-100/80"
                    >
                      <Image
                        src={img.src}
                        alt={img.alt}
                        fill
                        className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                      {/* Dark gradient overlay - visible on hover */}
                      <span
                        className="absolute inset-0 z-10 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100 pointer-events-none"
                        style={{
                          background: "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.75) 100%)",
                        }}
                        aria-hidden="true"
                      />
                      {/* Caption centered on image - visible on hover */}
                      <span className="absolute inset-0 z-20 flex items-center justify-center px-4 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100 pointer-events-none">
                        <span className="text-center text-white font-semibold text-sm sm:text-base drop-shadow-lg">
                          {img.caption}
                        </span>
                      </span>
                    </button>
                  </FadeInItem>
                );
              })}
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-5 sm:p-6 md:p-10 transition-opacity duration-500 ease-out ${
            lightboxFade === "in" ? "opacity-100" : "opacity-0"
          }`}
          style={{ backgroundColor: "rgba(0, 0, 0, 0.92)" }}
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Image lightbox"
        >
          {/* Close (X) button - top right, larger with hover */}
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute top-5 right-5 sm:top-6 sm:right-6 z-20 w-14 h-14 sm:w-[4.25rem] sm:h-[4.25rem] rounded-full bg-white/10 hover:bg-white/30 flex items-center justify-center text-white transition-all duration-200 hover:scale-105"
            aria-label="Close lightbox"
          >
            <svg className="w-9 h-9 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Left arrow - circular with hover background */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); lightboxPrev(); }}
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/10 hover:bg-white/30 flex items-center justify-center text-white transition-all duration-200 hover:scale-105"
            aria-label="Previous image"
          >
            <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Right arrow - circular with hover background */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); lightboxNext(); }}
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/10 hover:bg-white/30 flex items-center justify-center text-white transition-all duration-200 hover:scale-105"
            aria-label="Next image"
          >
            <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Centered image - larger, balanced padding; caption below with spacing */}
          <div
            className="relative w-full max-w-5xl flex flex-col items-center justify-center max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full flex-shrink-0 rounded-xl overflow-hidden shadow-2xl bg-black/20 max-h-[82vh]">
              <Image
                src={GALLERY_IMAGES[lightboxIndex].src}
                alt={GALLERY_IMAGES[lightboxIndex].alt}
                width={1200}
                height={800}
                className="w-full h-auto max-h-[82vh] object-contain"
              />
            </div>
            <p className="mt-5 sm:mt-6 text-white text-center text-base sm:text-lg font-medium max-w-xl px-3">
              {GALLERY_IMAGES[lightboxIndex].caption}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

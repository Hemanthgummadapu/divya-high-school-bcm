"use client";

import Image from "next/image";
import { useState, useEffect, useCallback, type ReactNode } from "react";

// Homepage slideshow images in their correct categories + cultural/annual day images
const GALLERY_IMAGES = [
  // Campus – school building and courtyard (from homepage slideshow)
  { src: "/school-building.png", alt: "Divya High School - School Building", caption: "School Building & Courtyard", category: "campus" as const },
  { src: "/slideshow1.png", alt: "Divya High School - Campus", caption: "Campus & Student Life", category: "campus" as const },
  // Sports – playground and running track (from homepage slideshow)
  { src: "/slideshow2.png", alt: "Divya High School - Sports", caption: "Playground & Sports", category: "sports" as const },
  // Events – (slideshow3/slideshow4 removed; add event images here when available)
  // Cultural
  { src: "/images/cultural/divya-annual-day-2.jpg", alt: "Cultural performance", caption: "Cultural Dance by Students", category: "cultural" as const },
  { src: "/images/cultural/divya-annual-day-8.jpg", alt: "Cultural program", caption: "Folk Dance Performance", category: "cultural" as const },
  { src: "/images/cultural/divya-annual-day-11.jpg", alt: "Cultural event", caption: "Cultural Program Highlights", category: "cultural" as const },
  { src: "/images/cultural/divya-annual-day-19.jpg", alt: "Cultural activity", caption: "Annual Day Moment", category: "cultural" as const },
  { src: "/images/cultural/divya-annual-day-23.jpg", alt: "Annual Day cultural show", caption: "Annual Day Cultural Show", category: "cultural" as const },
  // Annual Day
  { src: "/images/cultural/divya-annual-day-1.jpg", alt: "Annual Day at Divya High School", caption: "Annual Day Dance Performance", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-4.jpg", alt: "Annual Day stage", caption: "Stage Performance by Kids", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-7.jpg", alt: "Annual Day event", caption: "Student Cultural Show", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-9.jpg", alt: "Annual Day stage show", caption: "Annual Day Stage Show", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-12.jpg", alt: "Annual Day", caption: "Group Performance at Annual Day", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-14.jpg", alt: "Stage performance", caption: "Student Talent on Stage", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-17.jpg", alt: "Annual Day highlight", caption: "Cultural Event at School", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-24.jpg", alt: "Annual Day at Divya High School", caption: "Annual Day Celebration", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-25.jpg", alt: "Annual Day at Divya High School", caption: "Students Performing on Stage", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-26.jpg", alt: "Annual Day at Divya High School", caption: "Cultural Dance Performance", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-27.jpg", alt: "Annual Day at Divya High School", caption: "Kids Showcasing Talent", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-28.jpg", alt: "Annual Day at Divya High School", caption: "School Cultural Event", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-29.jpg", alt: "Annual Day at Divya High School", caption: "Student Talent Showcase", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-30.jpg", alt: "Annual Day at Divya High School", caption: "Annual Day Dance Performance", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-31.jpg", alt: "Annual Day at Divya High School", caption: "Stage Performance by Students", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-32.jpg", alt: "Annual Day at Divya High School", caption: "Young Artists Performing", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-33.jpg", alt: "Annual Day at Divya High School", caption: "Cultural Fest at School", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-34.jpg", alt: "Annual Day at Divya High School", caption: "Group Dance at Annual Day", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-35.jpg", alt: "Annual Day at Divya High School", caption: "Annual Day Stage Show", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-36.jpg", alt: "Annual Day at Divya High School", caption: "Student Performance Highlights", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-37.jpg", alt: "Annual Day at Divya High School", caption: "Celebration at Divya High School", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-38.jpg", alt: "Annual Day at Divya High School", caption: "Dance and Music at Annual Day", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-39.jpg", alt: "Annual Day at Divya High School", caption: "Folk Dance by Students", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-40.jpg", alt: "Annual Day at Divya High School", caption: "Annual Day Festivities", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-41.jpg", alt: "Annual Day at Divya High School", caption: "Students on Stage", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-42.jpg", alt: "Annual Day at Divya High School", caption: "Cultural Program at School", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-43.jpg", alt: "Annual Day at Divya High School", caption: "Talent Show at Annual Day", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-44.jpg", alt: "Annual Day at Divya High School", caption: "Annual Day Celebration", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-45.jpg", alt: "Annual Day at Divya High School", caption: "Students Performing on Stage", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-46.jpg", alt: "Annual Day at Divya High School", caption: "Cultural Dance Performance", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-47.jpg", alt: "Annual Day at Divya High School", caption: "Kids Showcasing Talent", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-48.jpg", alt: "Annual Day at Divya High School", caption: "School Cultural Event", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-49.jpg", alt: "Annual Day at Divya High School", caption: "Student Talent Showcase", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-50.jpg", alt: "Annual Day at Divya High School", caption: "Annual Day Dance Performance", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-51.jpg", alt: "Annual Day at Divya High School", caption: "Stage Performance by Students", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-52.jpg", alt: "Annual Day at Divya High School", caption: "Young Artists Performing", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-53.jpg", alt: "Annual Day at Divya High School", caption: "Cultural Fest at School", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-54.jpg", alt: "Annual Day at Divya High School", caption: "Group Dance at Annual Day", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-55.jpg", alt: "Annual Day at Divya High School", caption: "Annual Day Stage Show", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-56.jpg", alt: "Annual Day at Divya High School", caption: "Student Performance Highlights", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-57.jpg", alt: "Annual Day at Divya High School", caption: "Celebration at Divya High School", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-58.jpg", alt: "Annual Day at Divya High School", caption: "Dance and Music at Annual Day", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-59.jpg", alt: "Annual Day at Divya High School", caption: "Folk Dance by Students", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-60.jpg", alt: "Annual Day at Divya High School", caption: "Annual Day Festivities", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-61.jpg", alt: "Annual Day at Divya High School", caption: "Students on Stage", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-62.jpg", alt: "Annual Day at Divya High School", caption: "Cultural Program at School", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-63.jpg", alt: "Annual Day at Divya High School", caption: "Talent Show at Annual Day", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-64.jpg", alt: "Annual Day at Divya High School", caption: "Annual Day Celebration", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-65.jpg", alt: "Annual Day at Divya High School", caption: "Students Performing on Stage", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-66.jpg", alt: "Annual Day at Divya High School", caption: "Cultural Dance Performance", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-67.jpg", alt: "Annual Day at Divya High School", caption: "Kids Showcasing Talent", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-68.jpg", alt: "Annual Day at Divya High School", caption: "School Cultural Event", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-69.jpg", alt: "Annual Day at Divya High School", caption: "Student Talent Showcase", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-70.jpg", alt: "Annual Day at Divya High School", caption: "Annual Day Dance Performance", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-71.jpg", alt: "Annual Day at Divya High School", caption: "Stage Performance by Students", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-72.jpg", alt: "Annual Day at Divya High School", caption: "Young Artists Performing", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-73.jpg", alt: "Annual Day at Divya High School", caption: "Cultural Fest at School", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-74.jpg", alt: "Annual Day at Divya High School", caption: "Group Dance at Annual Day", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-75.jpg", alt: "Annual Day at Divya High School", caption: "Annual Day Stage Show", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-76.jpg", alt: "Annual Day at Divya High School", caption: "Student Performance Highlights", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-77.jpg", alt: "Annual Day at Divya High School", caption: "Celebration at Divya High School", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-78.jpg", alt: "Annual Day at Divya High School", caption: "Dance and Music at Annual Day", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-79.jpg", alt: "Annual Day at Divya High School", caption: "Folk Dance by Students", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-80.jpg", alt: "Annual Day at Divya High School", caption: "Annual Day Festivities", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-81.jpg", alt: "Annual Day at Divya High School", caption: "Students on Stage", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-82.jpg", alt: "Annual Day at Divya High School", caption: "Cultural Program at School", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-83.jpg", alt: "Annual Day at Divya High School", caption: "Talent Show at Annual Day", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-84.jpg", alt: "Annual Day at Divya High School", caption: "Annual Day Celebration", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-85.jpg", alt: "Annual Day at Divya High School", caption: "Students Performing on Stage", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-86.jpg", alt: "Annual Day at Divya High School", caption: "Cultural Dance Performance", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-87.jpg", alt: "Annual Day at Divya High School", caption: "Kids Showcasing Talent", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-88.jpg", alt: "Annual Day at Divya High School", caption: "School Cultural Event", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-89.jpg", alt: "Annual Day at Divya High School", caption: "Student Talent Showcase", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-90.jpg", alt: "Annual Day at Divya High School", caption: "Annual Day Dance Performance", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-91.jpg", alt: "Annual Day at Divya High School", caption: "Stage Performance by Students", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-92.jpg", alt: "Annual Day at Divya High School", caption: "Young Artists Performing", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-93.jpg", alt: "Annual Day at Divya High School", caption: "Cultural Fest at School", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-94.jpg", alt: "Annual Day at Divya High School", caption: "Group Dance at Annual Day", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-95.jpg", alt: "Annual Day at Divya High School", caption: "Annual Day Stage Show", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-96.jpg", alt: "Annual Day at Divya High School", caption: "Student Performance Highlights", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-97.jpg", alt: "Annual Day at Divya High School", caption: "Celebration at Divya High School", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-98.jpg", alt: "Annual Day at Divya High School", caption: "Dance and Music at Annual Day", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-99.jpg", alt: "Annual Day at Divya High School", caption: "Folk Dance by Students", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-100.jpg", alt: "Annual Day at Divya High School", caption: "Annual Day Festivities", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-101.jpg", alt: "Annual Day at Divya High School", caption: "Students on Stage", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-102.jpg", alt: "Annual Day at Divya High School", caption: "Cultural Program at School", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-103.jpg", alt: "Annual Day at Divya High School", caption: "Talent Show at Annual Day", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-104.jpg", alt: "Annual Day at Divya High School", caption: "Annual Day Celebration", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-105.jpg", alt: "Annual Day at Divya High School", caption: "Students Performing on Stage", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-106.jpg", alt: "Annual Day at Divya High School", caption: "Cultural Dance Performance", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-107.jpg", alt: "Annual Day at Divya High School", caption: "Kids Showcasing Talent", category: "annual-day" as const },
  { src: "/images/cultural/divya-annual-day-108.jpg", alt: "Annual Day at Divya High School", caption: "School Cultural Event", category: "annual-day" as const },
];

type FilterValue = "all" | "annual-day" | "cultural" | "sports" | "events" | "campus";

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "campus", label: "Campus" },
  { value: "sports", label: "Sports" },
  { value: "events", label: "Events" },
  { value: "cultural", label: "Cultural" },
  { value: "annual-day", label: "Annual Day" },
];

const INITIAL_PAGE_SIZE = 12;
const LOAD_MORE_SIZE = 12;

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

export default function Gallery() {
  const [activeFilter, setActiveFilter] = useState<FilterValue>("all");
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxFade, setLightboxFade] = useState<"in" | "out" | null>(null);

  const filteredImages = activeFilter === "all"
    ? GALLERY_IMAGES
    : GALLERY_IMAGES.filter((img) => img.category === activeFilter);
  const filteredIndices = activeFilter === "all"
    ? GALLERY_IMAGES.map((_, i) => i)
    : GALLERY_IMAGES.map((img, i) => (img.category === activeFilter ? i : -1)).filter((i) => i >= 0);

  // Show only the first visibleCount items for performance (Load More)
  const visibleImages = filteredImages.slice(0, visibleCount);
  const visibleIndices = filteredIndices.slice(0, visibleCount);
  const hasMore = visibleCount < filteredImages.length;

  // Reset to first page when filter changes
  useEffect(() => {
    setVisibleCount(INITIAL_PAGE_SIZE);
  }, [activeFilter]);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + LOAD_MORE_SIZE, filteredImages.length));
  }, [filteredImages.length]);

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
      className="min-h-screen bg-slate-50"
      style={{
        background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)",
      }}
    >
      {/* Page header */}
      <header
        className="pt-20 pb-12 md:pt-24 md:pb-16"
        style={{
          background: "linear-gradient(165deg, #fafbfd 0%, #f4f6f9 40%, #eef2f7 75%, #ffffff 100%)",
        }}
      >
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-heading mb-6">
            School Gallery
          </h1>
          <div
            className="h-1 w-full max-w-[200px] mx-auto mb-6 rounded-full"
            style={{
              background: "linear-gradient(90deg, #d97706 0%, #F59E0B 50%, #fbbf24 100%)",
            }}
            aria-hidden="true"
          />
          <p className="text-body text-gray-600 text-lg max-w-2xl mx-auto">
            Moments from Annual Day, cultural programs, sports, events, and campus life at Divya High School.
          </p>
        </div>
      </header>

      {/* Gallery section */}
      <section className="py-12 md:py-16 bg-white">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Filter buttons */}
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

          {/* Photo count */}
          <p className="text-center text-gray-500 text-sm mb-8">
            {hasMore
              ? `Showing ${visibleImages.length} of ${filteredImages.length} photo${filteredImages.length !== 1 ? "s" : ""}`
              : `${filteredImages.length} photo${filteredImages.length !== 1 ? "s" : ""}`}
          </p>

          {/* Responsive grid – only render visible items for performance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 md:gap-10">
            {visibleImages.map((img, i) => {
              const originalIndex = visibleIndices[i];
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
                      loading="lazy"
                      className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                    <span
                      className="absolute inset-0 z-10 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100 pointer-events-none bg-black/40"
                      aria-hidden="true"
                    />
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

          {/* Load More – only show when there are more items in current filter */}
          {hasMore && (
            <div className="mt-12 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                className="rounded-full px-8 py-3.5 text-base font-semibold font-heading text-white bg-[#2563eb] hover:bg-[#1d4ed8] shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2"
              >
                Load More
              </button>
            </div>
          )}
        </div>
      </section>

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

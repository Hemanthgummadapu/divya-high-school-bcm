"use client";

import Image from "next/image";
import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import {
  GALLERY_FILTERS,
  getGalleryDisplayList,
  type GalleryFilter,
  type GalleryImage,
} from "@/data/gallery";

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
  const [activeFilter, setActiveFilter] = useState<GalleryFilter>("all");
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxFade, setLightboxFade] = useState<"in" | "out" | null>(null);

  const displayImages = useMemo(
    () => getGalleryDisplayList(activeFilter),
    [activeFilter]
  );

  const visibleImages = displayImages.slice(0, visibleCount);
  const hasMore = visibleCount < displayImages.length;

  useEffect(() => {
    setVisibleCount(INITIAL_PAGE_SIZE);
  }, [activeFilter]);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + LOAD_MORE_SIZE, displayImages.length));
  }, [displayImages.length]);

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
    setLightboxIndex((lightboxIndex - 1 + displayImages.length) % displayImages.length);
  }, [lightboxIndex, displayImages.length]);

  const lightboxNext = useCallback(() => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex + 1) % displayImages.length);
  }, [lightboxIndex, displayImages.length]);

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

  const lightboxImage: GalleryImage | undefined =
    lightboxIndex !== null ? displayImages[lightboxIndex] : undefined;

  return (
    <div
      className="min-h-screen bg-slate-50"
      style={{
        background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)",
      }}
    >
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
            Campus life, academics, sports, Annual Day, and cultural programs at Divya High School.
          </p>
        </div>
      </header>

      <section className="py-12 md:py-16 bg-white">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-12 sm:mb-14">
            {GALLERY_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setActiveFilter(f.value)}
                className={`rounded-full py-2 px-4 sm:px-5 text-sm transition-colors duration-200 ${
                  activeFilter === f.value
                    ? "bg-blue-700 text-white font-semibold shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <p className="text-center text-gray-500 text-sm mb-8">
            {hasMore
              ? `Showing ${visibleImages.length} of ${displayImages.length} photo${displayImages.length !== 1 ? "s" : ""}`
              : `${displayImages.length} photo${displayImages.length !== 1 ? "s" : ""}`}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 md:gap-10">
            {visibleImages.map((img, i) => (
              <FadeInItem key={img.id} delayMs={100 + i * 40}>
                <button
                  type="button"
                  onClick={() => openLightbox(i)}
                  className="group relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300 ease-out hover:shadow-[0_16px_48px_rgba(0,0,0,0.12)] focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 focus:ring-offset-white border border-gray-100/80"
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
            ))}
          </div>

          {hasMore && (
            <div className="mt-12 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                className="rounded-full px-8 py-3.5 text-base font-semibold font-heading text-white bg-blue-700 hover:bg-blue-800 shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2"
              >
                Load More
              </button>
            </div>
          )}
        </div>
      </section>

      {lightboxIndex !== null && lightboxImage && (
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
            onClick={(e) => {
              e.stopPropagation();
              lightboxPrev();
            }}
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/10 hover:bg-white/30 flex items-center justify-center text-white transition-all duration-200 hover:scale-105"
            aria-label="Previous image"
          >
            <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              lightboxNext();
            }}
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
                src={lightboxImage.src}
                alt={lightboxImage.alt}
                width={1200}
                height={800}
                className="w-full h-auto max-h-[82vh] object-contain"
              />
            </div>
            <p className="mt-5 sm:mt-6 text-white text-center text-base sm:text-lg font-medium max-w-xl px-3">
              {lightboxImage.caption}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

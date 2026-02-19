"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const STORAGE_KEY = "admissionBannerClosed";
const DELAY_MS = 3000;

const WHATSAPP_URL =
  "https://wa.me/919100569269?text=Hello%2C%20I%20would%20like%20to%20enquire%20about%20admissions%20for%202026-27";

export default function AdmissionBanner() {
  const [isVisible, setIsVisible] = useState(false);

  const handleClose = () => {
    setIsVisible(false);
    sessionStorage.setItem(STORAGE_KEY, "true");
  };

  useEffect(() => {
    const closed = sessionStorage.getItem(STORAGE_KEY);
    if (!closed) {
      const timer = setTimeout(() => setIsVisible(true), DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!isVisible) return null;

  return (
    <aside
      role="complementary"
      aria-label="Admissions announcement"
      className="fixed z-[100] md:right-0 md:top-1/2 md:-translate-y-1/2 md:w-[320px] md:max-w-[calc(100vw-2rem)] bottom-0 left-0 right-0 md:left-auto admission-banner-in"
    >
      <div className="relative bg-white rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none shadow-[0_4px_20px_rgba(0,0,0,0.06)] md:shadow-[-4px_0_20px_rgba(0,0,0,0.06)] p-6 md:p-8 border border-gray-100/80 md:border-r-0 md:border-y md:border-l">
        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#0d1b2a] hover:bg-gray-100 transition-colors duration-300"
          aria-label="Close banner"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="pr-10">
          <h2 className="font-heading text-xl md:text-2xl font-semibold text-[#0d1b2a] mb-3">
            Admissions Open 2026–27
          </h2>
          <p className="font-sans text-gray-600 text-sm md:text-base mb-7">
            Limited seats available. Apply now.
          </p>

          <div className="flex flex-col gap-3">
            <Link
              href="/admissions/online-form"
              className="btn-primary w-full text-center"
            >
              Apply Now
            </Link>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary w-full text-center"
            >
              WhatsApp Enquiry
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
}

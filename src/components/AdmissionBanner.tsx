"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const STORAGE_KEY = "admissionBannerClosed";
const DELAY_MS = 3000;
const APPLY_ROUTE = "/admissions/apply-online";

const WHATSAPP_URL =
  "https://wa.me/919100569269?text=Hello%20I%20want%20admission%20details";

export default function AdmissionBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const router = useRouter();

  const handleClose = () => {
    setIsVisible(false);
    sessionStorage.setItem(STORAGE_KEY, "true");
  };

  const handleApplyNow = () => {
    handleClose();
    router.push(APPLY_ROUTE);
    setTimeout(() => window.scrollTo(0, 0), 0);
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
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[99] bg-black/20 backdrop-blur-[2px]"
        aria-hidden="true"
      />
      <aside
        role="complementary"
        aria-label="Admissions announcement"
        className="fixed z-[100] left-0 right-0 bottom-0 md:left-auto md:right-6 md:top-1/2 md:bottom-auto md:w-auto md:translate-x-0 md:-translate-y-1/2"
      >
        <div className="admission-popup-slide relative w-full md:max-w-[320px] md:ml-auto bg-white border-2 border-school-navy shadow-[0_4px_16px_rgba(0,0,0,0.12)] overflow-hidden rounded-t-2xl md:rounded-xl max-h-[85vh] md:max-h-none flex flex-col">
          {/* Bottom sheet handle - mobile only */}
          <div className="flex justify-center pt-2 pb-0 md:hidden" aria-hidden="true">
            <span className="w-10 h-1 rounded-full bg-gray-300" />
          </div>
          {/* Close button - corner */}
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors duration-200"
            aria-label="Close banner"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* School logo on top */}
          <div className="flex justify-center pt-5 pb-2">
            <Image
              src="/images/school-logo.png"
              alt="Divya High School"
              width={56}
              height={56}
              className="rounded-full object-contain flex-shrink-0"
            />
          </div>

          <div className="px-6 pb-6 pt-1 flex-1 min-h-0 overflow-y-auto">
            <h2 className="font-heading text-xl font-bold text-school-navy mb-1.5 text-center">
              Admissions Open 2026-27
            </h2>
            <p className="text-sm text-gray-600 mb-4 text-center">
              Limited seats available. Apply now.
            </p>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleApplyNow}
                className="admission-apply-btn w-full text-center text-white font-semibold rounded-lg py-3 px-4 bg-school-navy hover:bg-[#152a5c] transition-all duration-200"
              >
                Apply Now
              </button>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center bg-[#25D366] text-white font-medium rounded-lg py-3 px-4 hover:bg-[#20bd5a] transition-colors duration-200"
              >
                WhatsApp Enquiry
              </a>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

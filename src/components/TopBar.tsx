"use client";

import Link from "next/link";
import { FaYoutube, FaInstagram, FaWhatsapp } from "react-icons/fa";

const iconSize = "w-3.5 h-3.5 flex-shrink-0";
const socialIconWrap =
  "follow-icon w-7 h-7 text-sm flex items-center justify-center rounded-full cursor-pointer flex-shrink-0 text-white transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.25)]";

export default function TopBar() {
  return (
    <div
      className="w-full min-h-[38px] flex items-center text-white font-medium tracking-[0.3px]"
      style={{
        background: "#0f172a",
        boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
      }}
    >
      <div className="container mx-auto px-4 py-2 flex flex-wrap items-center justify-center sm:justify-between gap-3 sm:gap-[12px] text-[14px]">
        {/* Follow us + social icons */}
        <div className="flex items-center gap-[12px] flex-shrink-0">
          <span className="whitespace-nowrap">Follow us:</span>
          <div className="follow-icons flex items-center gap-2">
            <Link
              href="https://www.youtube.com/@divyahighschoolbhadrachalam"
              target="_blank"
              rel="noopener noreferrer"
              className={`${socialIconWrap} bg-[#FF0000]`}
              aria-label="YouTube"
            >
              <FaYoutube className={iconSize} aria-hidden />
            </Link>
            <Link
              href="https://www.instagram.com/divyahighschool?igsh=bW93dHdtcWhrcHZj"
              target="_blank"
              rel="noopener noreferrer"
              className={`${socialIconWrap} bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]`}
              aria-label="Instagram"
            >
              <FaInstagram className={iconSize} aria-hidden />
            </Link>
            <Link
              href="https://wa.me/919100569269?text=Hello%20I%20want%20admission%20details"
              target="_blank"
              rel="noopener noreferrer"
              className={`${socialIconWrap} bg-[#25D366]`}
              aria-label="WhatsApp"
            >
              <FaWhatsapp className={iconSize} aria-hidden />
            </Link>
          </div>
        </div>

        {/* Email + Phone */}
        <div className="flex items-center gap-[12px] flex-shrink-0 min-w-0">
          <a
            href="mailto:info@divyahighschool.co.in"
            className="flex items-center gap-1.5 hover:opacity-90 transition-opacity whitespace-nowrap min-w-0 text-white"
          >
            <svg className={iconSize} flex-shrink-0 viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <span className="truncate">info@divyahighschool.co.in</span>
          </a>
          <a
            href="tel:9100569269"
            className="flex items-center gap-1.5 hover:opacity-90 transition-opacity whitespace-nowrap flex-shrink-0 text-white"
          >
            <svg className={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <span>+91 9100569269</span>
          </a>
        </div>
      </div>
    </div>
  );
}

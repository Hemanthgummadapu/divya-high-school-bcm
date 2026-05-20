"use client";

import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { FaInstagram, FaWhatsapp, FaYoutube } from "react-icons/fa";

const iconSize = "w-3.5 h-3.5 flex-shrink-0";

export default function TopBar() {
  return (
    <div className="bg-slate-900 text-white border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-10 flex items-center justify-between text-xs">
        {/* Desktop */}
        <div className="hidden md:flex items-center justify-between w-full gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-slate-300 whitespace-nowrap">Follow us:</span>
            <div className="flex items-center gap-2">
              <Link
                href="https://www.youtube.com/@divyahighschoolbhadrachalam"
                target="_blank"
                rel="noopener noreferrer"
                className="w-7 h-7 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/15 transition-colors"
                aria-label="YouTube"
              >
                <FaYoutube className={iconSize} aria-hidden />
              </Link>
              <Link
                href="https://www.instagram.com/divyahighschool?igsh=bW93dHdtcWhrcHZj"
                target="_blank"
                rel="noopener noreferrer"
                className="w-7 h-7 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/15 transition-colors"
                aria-label="Instagram"
              >
                <FaInstagram className={iconSize} aria-hidden />
              </Link>
              <Link
                href="https://wa.me/919100569269?text=Hello%20I%20want%20admission%20details"
                target="_blank"
                rel="noopener noreferrer"
                className="w-7 h-7 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/15 transition-colors"
                aria-label="WhatsApp"
              >
                <FaWhatsapp className={iconSize} aria-hidden />
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4 min-w-0">
            <a
              href="mailto:info@divyahighschool.co.in"
              className="flex items-center gap-1.5 hover:text-blue-300 transition-colors min-w-0"
            >
              <Mail className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              <span className="truncate">info@divyahighschool.co.in</span>
            </a>
            <a
              href="tel:+919100569269"
              className="flex items-center gap-1.5 hover:text-blue-300 transition-colors whitespace-nowrap flex-shrink-0"
            >
              <Phone className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              <span>+91 9100569269</span>
            </a>
          </div>
        </div>

        {/* Mobile: icons only (no labels) */}
        <div className="md:hidden flex items-center justify-between w-full gap-3">
          <div className="flex items-center gap-2">
            <Link
              href="https://www.youtube.com/@divyahighschoolbhadrachalam"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/15 transition-colors"
              aria-label="YouTube"
            >
              <FaYoutube className={iconSize} aria-hidden />
            </Link>
            <Link
              href="https://www.instagram.com/divyahighschool?igsh=bW93dHdtcWhrcHZj"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/15 transition-colors"
              aria-label="Instagram"
            >
              <FaInstagram className={iconSize} aria-hidden />
            </Link>
            <Link
              href="https://wa.me/919100569269?text=Hello%20I%20want%20admission%20details"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/15 transition-colors"
              aria-label="WhatsApp"
            >
              <FaWhatsapp className={iconSize} aria-hidden />
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="mailto:info@divyahighschool.co.in"
              className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/10 hover:bg-white/15 transition-colors"
              aria-label="Email"
            >
              <Mail className="w-4 h-4" aria-hidden="true" />
            </a>
            <a
              href="tel:+919100569269"
              className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/10 hover:bg-white/15 transition-colors"
              aria-label="Phone"
            >
              <Phone className="w-4 h-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

export default function Navbar() {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const handleDropdownToggle = (menu: string) => {
    setOpenDropdown(openDropdown === menu ? null : menu);
  };

  return (
    <nav className="relative bg-[#0d1b2a] shadow-[0_4px_14px_0_rgba(0,0,0,0.15)] sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link href="/" className="flex items-center gap-3 text-2xl font-bold text-white transition-colors duration-300 hover:text-[#d4af37]">
            <Image
              src="/logo.png"
              alt="Divya High School"
              width={44}
              height={44}
              className="flex-shrink-0 rounded-full object-contain"
            />
            Divya High School BCM
          </Link>
          <div className="flex items-center gap-4 md:gap-8 flex-wrap justify-end">
            <div className="flex flex-wrap items-center gap-4 md:gap-6">
            <Link
              href="/"
                className="text-white hover:text-[#d4af37] transition-colors duration-300"
            >
              Home
            </Link>
              
              {/* About Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => handleDropdownToggle("about")}
                  className="text-white hover:text-[#d4af37] transition-colors duration-300 flex items-center gap-1"
                  aria-expanded={openDropdown === "about"}
                  aria-haspopup="true"
                  aria-label="About menu"
            >
              About
                  <svg 
                    className={`w-4 h-4 transition-transform ${openDropdown === "about" ? "rotate-180" : ""}`}
                    fill="currentColor" 
                    viewBox="0 0 20 20" 
                    aria-hidden="true"
                  >
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
                {openDropdown === "about" && (
                  <div className="absolute left-0 top-full pt-1 z-50">
                    <div className="bg-[#0d1b2a] border border-white/10 rounded-md shadow-lg py-1 min-w-[200px]">
                      <Link
                        href="/about/principals-note"
                        className="block px-4 py-2.5 text-white hover:text-[#d4af37] hover:bg-white/5 transition-colors duration-300 text-sm"
                        onClick={() => setOpenDropdown(null)}
                      >
                        Principal&apos;s Note
            </Link>
            <Link
                        href="/about/mission-vision"
                        className="block px-4 py-2.5 text-white hover:text-[#d4af37] hover:bg-white/5 transition-colors duration-300 text-sm"
                        onClick={() => setOpenDropdown(null)}
                      >
                        Mission & Vision
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Admissions Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => handleDropdownToggle("admissions")}
                  className="text-white hover:text-[#d4af37] transition-colors duration-300 flex items-center gap-1"
                  aria-expanded={openDropdown === "admissions"}
                  aria-haspopup="true"
                  aria-label="Admissions menu"
            >
              Admissions
                  <svg 
                    className={`w-4 h-4 transition-transform ${openDropdown === "admissions" ? "rotate-180" : ""}`}
                    fill="currentColor" 
                    viewBox="0 0 20 20" 
                    aria-hidden="true"
                  >
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
                {openDropdown === "admissions" && (
                  <div className="absolute left-0 top-full pt-1 z-50">
                    <div className="bg-[#0d1b2a] border border-white/10 rounded-md shadow-lg py-1 min-w-[200px]">
                      <Link
                        href="/admissions"
                        className="block px-4 py-2.5 text-white hover:text-[#d4af37] hover:bg-white/5 transition-colors duration-300 text-sm"
                        onClick={() => setOpenDropdown(null)}
                      >
                        Overview
                      </Link>
                      <Link
                        href="/admissions/admission-process"
                        className="block px-4 py-2.5 text-white hover:text-[#d4af37] hover:bg-white/5 transition-colors duration-300 text-sm"
                        onClick={() => setOpenDropdown(null)}
                      >
                        Admission Process
                      </Link>
                      <Link
                        href="/admissions/fee-structure"
                        className="block px-4 py-2.5 text-white hover:text-[#d4af37] hover:bg-white/5 transition-colors duration-300 text-sm"
                        onClick={() => setOpenDropdown(null)}
                      >
                        Fee Structure
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Academics Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => handleDropdownToggle("academics")}
                  className="text-white hover:text-[#d4af37] transition-colors duration-300 flex items-center gap-1"
                  aria-expanded={openDropdown === "academics"}
                  aria-haspopup="true"
                  aria-label="Academics menu"
                >
                  Academics
                  <svg 
                    className={`w-4 h-4 transition-transform ${openDropdown === "academics" ? "rotate-180" : ""}`}
                    fill="currentColor" 
                    viewBox="0 0 20 20" 
                    aria-hidden="true"
                  >
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
                {openDropdown === "academics" && (
                  <div className="absolute left-0 top-full pt-1 z-50">
                    <div className="bg-[#0d1b2a] border border-white/10 rounded-md shadow-lg py-1 min-w-[200px]">
                      <Link
                        href="/academics"
                        className="block px-4 py-2.5 text-white hover:text-[#d4af37] hover:bg-white/5 transition-colors duration-300 text-sm"
                        onClick={() => setOpenDropdown(null)}
                      >
                        Overview
                      </Link>
                      <Link
                        href="/academics/curriculum"
                        className="block px-4 py-2.5 text-white hover:text-[#d4af37] hover:bg-white/5 transition-colors duration-300 text-sm"
                        onClick={() => setOpenDropdown(null)}
                      >
                        Curriculum
                      </Link>
                      <Link
                        href="/academics/faculty"
                        className="block px-4 py-2.5 text-white hover:text-[#d4af37] hover:bg-white/5 transition-colors duration-300 text-sm"
                        onClick={() => setOpenDropdown(null)}
                      >
                        Faculty
                      </Link>
                      <Link
                        href="/academics/question-papers"
                        className="block px-4 py-2.5 text-white hover:text-[#d4af37] hover:bg-white/5 transition-colors duration-300 text-sm"
                        onClick={() => setOpenDropdown(null)}
                      >
                        Question Papers
                      </Link>
                      <Link
                        href="/academics/results"
                        className="block px-4 py-2.5 text-white hover:text-[#d4af37] hover:bg-white/5 transition-colors duration-300 text-sm"
                        onClick={() => setOpenDropdown(null)}
                      >
                        Results
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <Link
                href="/sports"
                className="text-white hover:text-[#d4af37] transition-colors duration-300"
              >
                Sports
            </Link>
            <Link
              href="/gallery"
                className="text-white hover:text-[#d4af37] transition-colors duration-300"
            >
              Gallery
            </Link>
            <Link
              href="/contact"
                className="text-white hover:text-[#d4af37] transition-colors duration-300"
            >
              Contact
            </Link>
            </div>
            <div className="flex items-center gap-2 border-l border-white/20 pl-4 md:pl-6">
              <Link
                href="#"
                className="text-xs md:text-sm px-2.5 md:px-3 py-1.5 rounded-md border border-[#d4af37] text-white hover:bg-[#d4af37] hover:text-[#0d1b2a] transition-colors duration-300 whitespace-nowrap"
              >
                Student
              </Link>
              <Link
                href="#"
                className="text-xs md:text-sm px-2.5 md:px-3 py-1.5 rounded-md border border-[#d4af37] text-white hover:bg-[#d4af37] hover:text-[#0d1b2a] transition-colors duration-300 whitespace-nowrap"
              >
                Staff
              </Link>
              <Link
                href="#"
                className="text-xs md:text-sm px-2.5 md:px-3 py-1.5 rounded-md border border-[#d4af37] text-white hover:bg-[#d4af37] hover:text-[#0d1b2a] transition-colors duration-300 whitespace-nowrap"
              >
                Admin
              </Link>
            </div>
            <div className="flex items-center gap-3 border-l border-white/20 pl-4 md:pl-6">
              <span className="text-sm font-medium text-white">Follow us</span>
              <Link
                href="https://www.youtube.com/@divyahighschoolbhadrachalam"
                target="_blank"
                rel="noopener noreferrer"
                className="block opacity-90 hover:opacity-100 transition-opacity duration-300"
                aria-label="YouTube"
              >
                <svg className="w-7 h-7" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#FF0000" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
                  <path fill="#FFFFFF" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </Link>
              <Link
                href="https://www.instagram.com/divyahighschool?igsh=bW93dHdtcWhrcHZj"
                target="_blank"
                rel="noopener noreferrer"
                className="block opacity-90 hover:opacity-100 transition-opacity duration-300"
                aria-label="Instagram"
              >
                <svg className="w-7 h-7" viewBox="0 0 24 24" aria-hidden="true">
                  <defs>
                    <linearGradient id="insta-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f9ed32" />
                      <stop offset="25%" stopColor="#f58529" />
                      <stop offset="50%" stopColor="#dd2a7b" />
                      <stop offset="75%" stopColor="#8134af" />
                      <stop offset="100%" stopColor="#515bd4" />
                    </linearGradient>
                  </defs>
                  <path fill="url(#insta-gradient)" fillRule="evenodd" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
      {/* Close dropdown when clicking outside */}
      {openDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpenDropdown(null)}
        />
      )}
    </nav>
  );
}

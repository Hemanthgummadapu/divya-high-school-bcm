"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const ABOUT_LINKS = [
  { href: "/about", label: "Overview" },
  { href: "/about/vision", label: "Vision & Mission" },
  { href: "/academics/faculty", label: "Faculty" },
];

const ADMISSIONS_LINKS = [
  { href: "/admissions", label: "Overview" },
  { href: "/admissions/admission-process", label: "Admission Process" },
  { href: "/admissions/fee-structure", label: "Fee Structure" },
  { href: "/admissions/apply-online", label: "Apply Online" },
];

const ACADEMICS_LINKS = [
  { href: "/academics", label: "Overview" },
  { href: "/academics/curriculum", label: "Curriculum" },
  { href: "/academics/results", label: "Results" },
];

const SPORTS_LINKS = [
  { href: "/sports", label: "Sports" },
  { href: "/sports/cultural-activities", label: "Cultural Activities" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileDropdown, setMobileDropdown] = useState<string | null>(null);

  useEffect(() => {
    setMobileMenuOpen(false);
    setOpenDropdown(null);
    setMobileDropdown(null);
  }, [pathname]);

  const handleDropdownToggle = (menu: string) => {
    setOpenDropdown(openDropdown === menu ? null : menu);
  };

  const toggleMobileDropdown = (menu: string) => {
    setMobileDropdown(mobileDropdown === menu ? null : menu);
  };

  const navLinkClass = (href: string) => {
    const isActive = pathname === href;
    const activeUnderline = "after:absolute after:left-0 after:bottom-0 after:h-0.5 after:bg-[#60a5fa] after:rounded-full after:transition-[width] after:duration-500 after:ease-out after:origin-left";
    return `font-heading transition-colors duration-200 relative inline-block py-2 ${activeUnderline} ${
      isActive
        ? "text-[#60a5fa] after:w-full"
        : "text-white hover:text-[#60a5fa] after:w-0 hover:after:w-full"
    }`;
  };

  return (
    <nav className="sticky top-0 z-50 relative bg-navbar-gradient h-14 md:h-16 shadow-navbar">
      <div className="container mx-auto px-3 md:px-4 h-full">
        <div className="flex justify-between items-center h-full gap-2">
          <Link href="/" className="flex items-center gap-2.5 font-heading text-lg md:text-xl font-bold transition-colors duration-200 whitespace-nowrap">
            <Image
              src="/images/school-logo.png"
              alt="Divya High School"
              width={36}
              height={36}
              className="flex-shrink-0 rounded-full object-contain"
            />
            <span className="school-name">Divya High School</span>
          </Link>

          {/* Desktop nav - hidden on mobile */}
          <div className="hidden md:flex items-center gap-3 md:gap-6 flex-wrap justify-end">
            <div className="flex flex-wrap items-center gap-3 md:gap-5">
              <Link href="/" className={navLinkClass("/")}>
                Home
              </Link>
              
              {/* About Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => handleDropdownToggle("about")}
                  className="text-white hover:text-[#60a5fa] transition-colors duration-200 flex items-center gap-1 font-heading"
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
                    <div className="bg-primary-blue border border-white/10 rounded-md shadow-lg py-1 min-w-[200px]">
                      {ABOUT_LINKS.map(({ href, label }) => (
                        <Link
                          key={href}
                          href={href}
                          className="block px-4 py-2.5 text-white hover:text-[#60a5fa] hover:bg-white/5 transition-colors duration-300 text-sm"
                          onClick={() => setOpenDropdown(null)}
                        >
                          {label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Admissions Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => handleDropdownToggle("admissions")}
                  className="text-white hover:text-[#60a5fa] transition-colors duration-200 flex items-center gap-1 font-heading"
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
                    <div className="bg-primary-blue border border-white/10 rounded-md shadow-lg py-1 min-w-[200px]">
                      <Link
                        href="/admissions"
                        className="block px-4 py-2.5 text-white hover:text-[#60a5fa] hover:bg-white/5 transition-colors duration-300 text-sm"
                        onClick={() => setOpenDropdown(null)}
                      >
                        Overview
                      </Link>
                      <Link
                        href="/admissions/admission-process"
                        className="block px-4 py-2.5 text-white hover:text-[#60a5fa] hover:bg-white/5 transition-colors duration-300 text-sm"
                        onClick={() => setOpenDropdown(null)}
                      >
                        Admission Process
                      </Link>
                      <Link
                        href="/admissions/fee-structure"
                        className="block px-4 py-2.5 text-white hover:text-[#60a5fa] hover:bg-white/5 transition-colors duration-300 text-sm"
                        onClick={() => setOpenDropdown(null)}
                      >
                        Fee Structure
                      </Link>
                      <Link
                        href="/admissions/apply-online"
                        className="block px-4 py-2.5 text-white hover:text-[#60a5fa] hover:bg-white/5 transition-colors duration-300 text-sm"
                        onClick={() => setOpenDropdown(null)}
                      >
                        Apply Online
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
                  className="text-white hover:text-[#60a5fa] transition-colors duration-200 flex items-center gap-1 font-heading"
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
                    <div className="bg-primary-blue border border-white/10 rounded-md shadow-lg py-1 min-w-[200px]">
                      <Link
                        href="/academics"
                        className="block px-4 py-2.5 text-white hover:text-[#60a5fa] hover:bg-white/5 transition-colors duration-300 text-sm"
                        onClick={() => setOpenDropdown(null)}
                      >
                        Overview
                      </Link>
                      <Link
                        href="/academics/curriculum"
                        className="block px-4 py-2.5 text-white hover:text-[#60a5fa] hover:bg-white/5 transition-colors duration-300 text-sm"
                        onClick={() => setOpenDropdown(null)}
                      >
                        Curriculum
                      </Link>
                      <Link
                        href="/academics/results"
                        className="block px-4 py-2.5 text-white hover:text-[#60a5fa] hover:bg-white/5 transition-colors duration-300 text-sm"
                        onClick={() => setOpenDropdown(null)}
                      >
                        Results
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Sports Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => handleDropdownToggle("sports")}
                  className="text-white hover:text-[#60a5fa] transition-colors duration-200 flex items-center gap-1 font-heading"
                  aria-expanded={openDropdown === "sports"}
                  aria-haspopup="true"
                  aria-label="Sports menu"
                >
                  Sports
                  <svg
                    className={`w-4 h-4 transition-transform ${openDropdown === "sports" ? "rotate-180" : ""}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
                {openDropdown === "sports" && (
                  <div className="absolute left-0 top-full pt-1 z-50">
                    <div className="bg-primary-blue border border-white/10 rounded-md shadow-lg py-1 min-w-[200px]">
                      <Link
                        href="/sports"
                        className="block px-4 py-2.5 text-white hover:text-[#60a5fa] hover:bg-white/5 transition-colors duration-300 text-sm"
                        onClick={() => setOpenDropdown(null)}
                      >
                        Sports
                      </Link>
                      <Link
                        href="/sports/cultural-activities"
                        className="block px-4 py-2.5 text-white hover:text-[#60a5fa] hover:bg-white/5 transition-colors duration-300 text-sm"
                        onClick={() => setOpenDropdown(null)}
                      >
                        Cultural Activities
                      </Link>
                    </div>
                  </div>
                )}
              </div>
              <Link href="/gallery" className={navLinkClass("/gallery")}>
                Gallery
              </Link>
              <Link href="/contact" className={navLinkClass("/contact")}>
                Contact
              </Link>
            </div>
            <div className="flex items-center gap-1 rounded-xl bg-white/10 border border-white/20 px-2 py-1.5 md:px-2.5 md:py-2">
              <Link
                href="/student-portal"
                className="text-xs md:text-sm px-2 md:px-2.5 py-1 rounded-lg border border-accent-gold/80 text-white hover:bg-accent-gold hover:text-white font-medium transition-all duration-200 whitespace-nowrap"
              >
                Student
              </Link>
              <Link
                href="/staff-portal"
                className="text-xs md:text-sm px-2 md:px-2.5 py-1 rounded-lg border border-accent-gold/80 text-white hover:bg-accent-gold hover:text-white font-medium transition-all duration-200 whitespace-nowrap"
              >
                Staff
              </Link>
              <Link
                href="/admin-portal"
                className="text-xs md:text-sm px-2 md:px-2.5 py-1 rounded-lg border border-accent-gold/80 text-white hover:bg-accent-gold hover:text-white font-medium transition-all duration-200 whitespace-nowrap"
              >
                Admin
              </Link>
            </div>
          </div>

          {/* Hamburger - visible only on mobile */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg text-white hover:bg-white/10 transition-colors"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile menu panel */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-50 w-full max-w-[300px] bg-navbar-gradient shadow-xl md:hidden transform transition-transform duration-300 ease-out ${
          mobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        <div className="flex flex-col h-full pt-14 pb-6 overflow-y-auto">
          <div className="px-4 space-y-1">
            <Link href="/" className={`block py-3 px-3 rounded-lg font-heading ${pathname === "/" ? "text-[#60a5fa] bg-white/10" : "text-white hover:bg-white/10"}`} onClick={() => setMobileMenuOpen(false)}>
              Home
            </Link>

            {/* About accordion */}
            <div>
              <button type="button" onClick={() => toggleMobileDropdown("about")} className="w-full flex items-center justify-between py-3 px-3 rounded-lg text-white hover:bg-white/10 font-heading">
                About
                <svg className={`w-4 h-4 transition-transform ${mobileDropdown === "about" ? "rotate-180" : ""}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>
              {mobileDropdown === "about" && (
                <div className="pl-4 pb-2 space-y-0.5">
                  {ABOUT_LINKS.map(({ href, label }) => (
                    <Link key={href} href={href} className="block py-2.5 px-3 rounded-lg text-white/90 hover:bg-white/10 text-sm" onClick={() => setMobileMenuOpen(false)}>{label}</Link>
                  ))}
                </div>
              )}
            </div>

            {/* Admissions accordion */}
            <div>
              <button type="button" onClick={() => toggleMobileDropdown("admissions")} className="w-full flex items-center justify-between py-3 px-3 rounded-lg text-white hover:bg-white/10 font-heading">
                Admissions
                <svg className={`w-4 h-4 transition-transform ${mobileDropdown === "admissions" ? "rotate-180" : ""}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>
              {mobileDropdown === "admissions" && (
                <div className="pl-4 pb-2 space-y-0.5">
                  {ADMISSIONS_LINKS.map(({ href, label }) => (
                    <Link key={href} href={href} className="block py-2.5 px-3 rounded-lg text-white/90 hover:bg-white/10 text-sm" onClick={() => setMobileMenuOpen(false)}>{label}</Link>
                  ))}
                </div>
              )}
            </div>

            {/* Academics accordion */}
            <div>
              <button type="button" onClick={() => toggleMobileDropdown("academics")} className="w-full flex items-center justify-between py-3 px-3 rounded-lg text-white hover:bg-white/10 font-heading">
                Academics
                <svg className={`w-4 h-4 transition-transform ${mobileDropdown === "academics" ? "rotate-180" : ""}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>
              {mobileDropdown === "academics" && (
                <div className="pl-4 pb-2 space-y-0.5">
                  {ACADEMICS_LINKS.map(({ href, label }) => (
                    <Link key={href} href={href} className="block py-2.5 px-3 rounded-lg text-white/90 hover:bg-white/10 text-sm" onClick={() => setMobileMenuOpen(false)}>{label}</Link>
                  ))}
                </div>
              )}
            </div>

            {/* Sports accordion */}
            <div>
              <button type="button" onClick={() => toggleMobileDropdown("sports")} className="w-full flex items-center justify-between py-3 px-3 rounded-lg text-white hover:bg-white/10 font-heading">
                Sports
                <svg className={`w-4 h-4 transition-transform ${mobileDropdown === "sports" ? "rotate-180" : ""}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>
              {mobileDropdown === "sports" && (
                <div className="pl-4 pb-2 space-y-0.5">
                  {SPORTS_LINKS.map(({ href, label }) => (
                    <Link key={href} href={href} className="block py-2.5 px-3 rounded-lg text-white/90 hover:bg-white/10 text-sm" onClick={() => setMobileMenuOpen(false)}>{label}</Link>
                  ))}
                </div>
              )}
            </div>
            <Link href="/gallery" className={`block py-3 px-3 rounded-lg font-heading ${pathname === "/gallery" ? "text-[#60a5fa] bg-white/10" : "text-white hover:bg-white/10"}`} onClick={() => setMobileMenuOpen(false)}>Gallery</Link>
            <Link href="/contact" className={`block py-3 px-3 rounded-lg font-heading ${pathname === "/contact" ? "text-[#60a5fa] bg-white/10" : "text-white hover:bg-white/10"}`} onClick={() => setMobileMenuOpen(false)}>Contact</Link>

            <div className="pt-4 border-t border-white/20 mt-4 flex flex-wrap gap-2">
              <Link href="/student-portal" className="flex-1 min-w-[80px] text-center py-2.5 rounded-lg border border-accent-gold/80 text-white hover:bg-accent-gold font-medium text-sm transition-colors" onClick={() => setMobileMenuOpen(false)}>Student</Link>
              <Link href="/staff-portal" className="flex-1 min-w-[80px] text-center py-2.5 rounded-lg border border-accent-gold/80 text-white hover:bg-accent-gold font-medium text-sm transition-colors" onClick={() => setMobileMenuOpen(false)}>Staff</Link>
              <Link href="/admin-portal" className="flex-1 min-w-[80px] text-center py-2.5 rounded-lg border border-accent-gold/80 text-white hover:bg-accent-gold font-medium text-sm transition-colors" onClick={() => setMobileMenuOpen(false)}>Admin</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Close dropdown when clicking outside (desktop) */}
      {openDropdown && (
        <div
          className="fixed inset-0 z-40 hidden md:block"
          onClick={() => setOpenDropdown(null)}
          aria-hidden="true"
        />
      )}
    </nav>
  );
}

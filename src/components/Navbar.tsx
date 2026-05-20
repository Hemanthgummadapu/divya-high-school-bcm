"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Lock, Menu, X } from "lucide-react";

const ABOUT_LINKS = [
  { href: "/about", label: "Overview" },
  { href: "/about/vision", label: "Vision & Mission" },
  { href: "/academics/faculty", label: "Faculty" },
];

/** Preserves portal routes in markup; visible UI is coming-soon only */
function LoginDropdownPanel({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="relative bg-primary-blue border border-white/10 rounded-md shadow-lg min-w-[200px] overflow-hidden">
      <div className="invisible pointer-events-none select-none" aria-hidden="true">
        <Link
          href="/student-portal"
          className="block px-4 py-2.5 text-white hover:text-[#bfdbfe] hover:bg-white/5 transition-colors duration-300 text-sm"
          onClick={onNavigate}
          tabIndex={-1}
        >
          Student
        </Link>
        <Link
          href="/staff-portal"
          className="block px-4 py-2.5 text-white hover:text-[#bfdbfe] hover:bg-white/5 transition-colors duration-300 text-sm"
          onClick={onNavigate}
          tabIndex={-1}
        >
          Staff
        </Link>
        <Link
          href="/admin-portal"
          className="block px-4 py-2.5 text-white hover:text-[#bfdbfe] hover:bg-white/5 transition-colors duration-300 text-sm"
          onClick={onNavigate}
          tabIndex={-1}
        >
          Admin
        </Link>
      </div>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center px-4 py-5 text-center bg-primary-blue pointer-events-none"
        role="status"
        aria-live="polite"
      >
        <Lock className="w-5 h-5 text-[#bfdbfe] mb-2" aria-hidden="true" />
        <p className="text-sm font-semibold text-white font-heading">Coming Soon</p>
        <p className="text-xs text-white/70 mt-1 leading-snug">Student &amp; staff portal launching soon.</p>
      </div>
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileDropdown, setMobileDropdown] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
    setOpenDropdown(null);
    setMobileDropdown(null);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleDropdownToggle = (menu: string) => {
    setOpenDropdown(openDropdown === menu ? null : menu);
  };

  const toggleMobileDropdown = (menu: string) => {
    setMobileDropdown(mobileDropdown === menu ? null : menu);
  };

  const navLinkClass = (href: string) => {
    const isActive = pathname === href;
    const activeUnderline =
      "after:absolute after:left-0 after:bottom-0 after:h-0.5 after:bg-[#bfdbfe] after:rounded-full after:transition-[width] after:duration-500 after:ease-out after:origin-left";
    return `font-heading transition-colors duration-200 relative inline-block py-2 ${activeUnderline} ${
      isActive
        ? "text-[#bfdbfe] after:w-full"
        : "text-white hover:text-[#bfdbfe] after:w-0 hover:after:w-full"
    }`;
  };

  const mobileLinkClass = (href: string, matchPrefix = false) => {
    const isActive =
      pathname === href || (matchPrefix && href !== "/" && pathname.startsWith(href));
    return `block py-3 px-3 rounded-lg font-heading ${
      isActive ? "text-[#bfdbfe] bg-white/10" : "text-white hover:bg-white/10"
    }`;
  };

  return (
    <>
      <div className={`bg-[#1e3a8a] ${scrolled ? "shadow-md" : "shadow-sm"} transition-shadow duration-300`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
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

          <div className="hidden md:flex flex-1 items-center justify-center px-4">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              <Link href="/" className={navLinkClass("/")}>
                Home
              </Link>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => handleDropdownToggle("about")}
                  className="text-white hover:text-[#bfdbfe] transition-colors duration-200 flex items-center gap-1 font-heading"
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
                          className="block px-4 py-2.5 text-white hover:text-[#bfdbfe] hover:bg-white/5 transition-colors duration-300 text-sm"
                          onClick={() => setOpenDropdown(null)}
                        >
                          {label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Link href="/admissions" className={navLinkClass("/admissions")}>
                Admissions
              </Link>
              <Link href="/academics" className={navLinkClass("/academics")}>
                Academics
              </Link>
              <Link href="/sports" className={navLinkClass("/sports")}>
                Sports
              </Link>
              <Link href="/gallery" className={navLinkClass("/gallery")}>
                Gallery
              </Link>
              <Link href="/contact" className={navLinkClass("/contact")}>
                Contact
              </Link>
            </div>
          </div>

          <div className="hidden md:block relative flex-shrink-0">
            <button
              type="button"
              onClick={() => handleDropdownToggle("login")}
              className="bg-[#1e3a8a] hover:bg-[#1e40af] text-white rounded-lg px-4 py-2 text-sm font-semibold font-heading transition-colors inline-flex items-center gap-2"
              aria-expanded={openDropdown === "login"}
              aria-haspopup="true"
            >
              Login
              <svg
                className={`w-4 h-4 transition-transform ${openDropdown === "login" ? "rotate-180" : ""}`}
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>
            {openDropdown === "login" && (
              <div className="absolute right-0 top-full pt-1 z-[60]">
                <LoginDropdownPanel onNavigate={() => setOpenDropdown(null)} />
              </div>
            )}
          </div>

          <div className="md:hidden flex items-center justify-end">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="w-11 h-11 flex items-center justify-center rounded-lg text-white hover:bg-white/10 transition-colors"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          className="fixed left-0 right-0 bottom-0 top-[104px] z-40 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed top-[104px] right-0 bottom-0 z-50 w-full max-w-[300px] bg-[#0B2A59] shadow-xl md:hidden transform transition-transform duration-300 ease-out ${
          mobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        <div className="flex flex-col h-full pt-14 pb-6 overflow-y-auto">
          <div className="px-4 space-y-1">
            <Link href="/" className={mobileLinkClass("/")} onClick={() => setMobileMenuOpen(false)}>
              Home
            </Link>

            <div>
              <button
                type="button"
                onClick={() => toggleMobileDropdown("about")}
                className="w-full flex items-center justify-between py-3 px-3 rounded-lg text-white hover:bg-white/10 font-heading"
              >
                About
                <svg className={`w-4 h-4 transition-transform ${mobileDropdown === "about" ? "rotate-180" : ""}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>
              {mobileDropdown === "about" && (
                <div className="pl-4 pb-2 space-y-0.5">
                  {ABOUT_LINKS.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      className="block py-2.5 px-3 rounded-lg text-white/90 hover:bg-white/10 text-sm"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link href="/admissions" className={mobileLinkClass("/admissions")} onClick={() => setMobileMenuOpen(false)}>
              Admissions
            </Link>
            <Link href="/academics" className={mobileLinkClass("/academics", true)} onClick={() => setMobileMenuOpen(false)}>
              Academics
            </Link>
            <Link href="/sports" className={mobileLinkClass("/sports")} onClick={() => setMobileMenuOpen(false)}>
              Sports
            </Link>
            <Link href="/gallery" className={mobileLinkClass("/gallery")} onClick={() => setMobileMenuOpen(false)}>
              Gallery
            </Link>
            <Link href="/contact" className={mobileLinkClass("/contact")} onClick={() => setMobileMenuOpen(false)}>
              Contact
            </Link>

            <div className="pt-4 border-t border-white/20 mt-4">
              <button
                type="button"
                onClick={() => toggleMobileDropdown("login")}
                className="w-full flex items-center justify-between py-3 px-3 rounded-lg text-white hover:bg-white/10 font-heading"
                aria-expanded={mobileDropdown === "login"}
              >
                Login
                <svg className={`w-4 h-4 transition-transform ${mobileDropdown === "login" ? "rotate-180" : ""}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>
              {mobileDropdown === "login" && (
                <div className="pl-4 pb-2 pt-1">
                  <LoginDropdownPanel onNavigate={() => setMobileMenuOpen(false)} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {openDropdown && (
        <div className="fixed inset-0 z-40 hidden md:block" onClick={() => setOpenDropdown(null)} aria-hidden="true" />
      )}
    </>
  );
}

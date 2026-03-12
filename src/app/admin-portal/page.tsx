"use client";

import Link from "next/link";
import PortalLogoutButton from "@/components/PortalLogoutButton";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";

const NAV_ITEMS = [
  { id: "users", title: "User Management", description: "Manage students, staff, and admin accounts.", href: "#", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { id: "fees", title: "Fee Management", description: "Fee collection and fee structure.", href: "#", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { id: "reports", title: "Reports", description: "View and export school reports.", href: "#", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { id: "settings", title: "Settings", description: "School and system settings.", href: "#", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
  { id: "announcements", title: "Announcements", description: "Create and manage announcements.", href: "#", icon: "M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3.364a1.622 1.622 0 00.6-1.196V1a1 1 0 00-1-1H1a1 1 0 00-1 1v3.364a1.622 1.622 0 00.6 1.196C8.378 5.234 11.9 6.5 16 6.5" },
  { id: "attendance", title: "Attendance Overview", description: "School-wide attendance summary.", href: "#", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { id: "question-papers", title: "Previous Question Papers", description: "Upload and manage previous question papers.", href: "/academics/question-papers", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
];

export default function AdminPortal() {
  const { data: session } = useSession();
  const [activeId, setActiveId] = useState<string>("users");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);

  const sidebarNarrow = sidebarCollapsed && !sidebarHovered;

  const userEmail = session?.user?.email ?? "admin@divyahighschool.co.in";
  const userName = session?.user?.name ?? "Administrator";
  const today = useMemo(
    () => new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "short", day: "numeric" }),
    [],
  );

  const activeItem = NAV_ITEMS.find((item) => item.id === activeId) ?? NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-page">
      <div className="flex min-h-screen">
        {/* Sidebar - collapsible, same gradient; hover to expand when collapsed */}
        <aside
          className={`flex-shrink-0 bg-navbar-gradient text-white flex flex-col border-r border-white/10 shadow-navbar-sidebar transition-[width] duration-300 ease-in-out overflow-hidden ${
            sidebarNarrow ? "w-20" : "w-72"
          }`}
          onMouseEnter={() => sidebarCollapsed && setSidebarHovered(true)}
          onMouseLeave={() => setSidebarHovered(false)}
        >
          <div
            className={`flex items-center border-b border-white/10 flex-shrink-0 transition-all duration-300 ${
              sidebarNarrow ? "justify-center px-2 pt-6 pb-4" : "px-5 pt-6 pb-4 gap-3"
            }`}
          >
            <div className="relative h-10 w-10 rounded-full overflow-hidden border border-white/30 bg-white flex-shrink-0">
              <Image
                src="/images/school-logo.png"
                alt="Divya High School BCM"
                fill
                sizes="40px"
                className="object-contain p-1"
              />
            </div>
            <div
              className={`flex flex-col min-w-0 transition-all duration-300 ${
                sidebarNarrow ? "w-0 overflow-hidden opacity-0" : "opacity-100"
              }`}
            >
              <span className="text-sm font-semibold text-white tracking-wide whitespace-nowrap">
                Divya High School BCM
              </span>
              <span className="text-xs text-white/70 whitespace-nowrap">Admin Dashboard</span>
            </div>
          </div>

          <div
            className={`border-b border-white/15 transition-all duration-300 ${
              sidebarNarrow ? "h-0 overflow-hidden opacity-0 py-0 border-0" : "px-5 py-4"
            }`}
          >
            <p className="text-xs uppercase tracking-wide text-white/60 mb-1">
              Signed in as
            </p>
            <p className="text-sm text-white truncate">{userEmail}</p>
          </div>

          <div
            className={`border-t border-white/20 transition-opacity duration-300 ${
              sidebarNarrow ? "opacity-0 h-0 overflow-hidden border-0" : "mx-4"
            }`}
            aria-hidden="true"
          />

          <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-4">
            {NAV_ITEMS.map((item) => {
              const isActive = item.id === activeId;
              const isExternal = item.href && item.href !== "#";
              const content = (
                <div
                  className={`group flex items-center rounded-lg px-3 py-4 text-sm cursor-pointer transition-all duration-200 ${
                    sidebarNarrow ? "justify-center px-2" : "gap-3"
                  } ${
                    isActive
                      ? "border-l-4 border-nav-highlight bg-nav-highlight/40 text-white shadow-[0_0_0_1px_rgba(96,165,250,0.3),inset_0_0_20px_rgba(96,165,250,0.08)]"
                      : "border-l-4 border-transparent text-white hover:bg-blue-600/20 hover:text-white"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border transition-all duration-200 ${
                      isActive
                        ? "border-white/40 bg-white/20"
                        : "border-white/20 bg-white/5 group-hover:border-blue-400/50 group-hover:bg-blue-600/20"
                    }`}
                  >
                    <svg
                      className="w-5 h-5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={item.icon}
                      />
                    </svg>
                  </span>
                  <div
                    className={`flex min-w-0 flex-1 flex-col justify-center gap-0.5 transition-all duration-300 ${
                      sidebarNarrow ? "w-0 min-w-0 overflow-hidden opacity-0" : "opacity-100"
                    }`}
                  >
                    <span className="font-medium leading-tight whitespace-nowrap">{item.title}</span>
                    <span className="text-xs leading-tight text-white/70 line-clamp-1 whitespace-nowrap">
                      {item.description}
                    </span>
                  </div>
                </div>
              );

              if (isExternal) {
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setActiveId(item.id)}
                  >
                    {content}
                  </Link>
                );
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveId(item.id)}
                  className="w-full text-left"
                >
                  {content}
                </button>
              );
            })}
          </nav>

          <div
            className={`mt-auto border-t border-white/10 transition-all duration-300 ${
              sidebarNarrow ? "px-2 py-4 flex justify-center [&_span]:hidden [&_button]:p-2 [&_button]:rounded-lg [&_button]:border-white/20 [&_button]:bg-white/10 [&_button]:text-white [&_button]:shadow-none [&_button:hover]:bg-white/20" : "px-5 py-4"
            }`}
          >
            <PortalLogoutButton />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 bg-slate-50">
          <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8 py-8 md:py-10">
            {/* Dashboard header - toggle + subtle divider below */}
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-12 pb-8 border-b border-slate-200">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed((c) => !c)}
                  className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-md hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
                  aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  {sidebarCollapsed ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                  )}
                </button>
                <div>
                  <h1 className="text-4xl font-bold text-heading tracking-tight leading-tight">
                    Welcome back,{" "}
                    <span className="text-accent-gold-dark">{userName}</span>
                  </h1>
                  <p className="text-sm text-gray-500 mt-2">
                    {today} • Admin Portal Overview
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-card rounded-xl border border-slate-200 px-5 py-3.5 shadow-lg transition-shadow duration-300 ease-out">
                <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-navbar-gradient text-accent-gold text-xs font-semibold">
                  ADM
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] uppercase tracking-wider text-muted font-medium">
                    Role
                  </span>
                  <span className="text-sm font-semibold text-heading">
                    Administrator
                  </span>
                </div>
              </div>
            </header>

            {/* Summary stats - white cards, rounded-xl, stronger shadow, hover lift */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-8 mb-12 pt-6">
              <div className="group rounded-xl bg-white border border-slate-200 shadow-lg p-6 md:p-7 flex flex-col gap-3 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-slate-300/80">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-blue/10 text-primary-blue ring-8 ring-primary-blue/5 transition-transform duration-300 ease-out group-hover:scale-105">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </span>
                <span className="text-[10px] font-normal text-slate-500 uppercase tracking-wider">
                  Total Students
                </span>
                <span className="text-3xl md:text-4xl font-bold text-slate-900">
                  1,250
                </span>
                <span className="text-xs text-emerald-600 font-medium">
                  +3.2% vs last term
                </span>
              </div>
              <div className="group rounded-xl bg-white border border-slate-200 shadow-lg p-6 md:p-7 flex flex-col gap-3 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-slate-300/80">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-blue/10 text-primary-blue ring-8 ring-primary-blue/5 transition-transform duration-300 ease-out group-hover:scale-105">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </span>
                <span className="text-[10px] font-normal text-slate-500 uppercase tracking-wider">
                  Total Staff
                </span>
                <span className="text-3xl md:text-4xl font-bold text-slate-900">
                  85
                </span>
                <span className="text-xs text-emerald-600 font-medium">
                  Fully staffed
                </span>
              </div>
              <div className="group rounded-xl bg-white border border-slate-200 shadow-lg p-6 md:p-7 flex flex-col gap-3 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-slate-300/80">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-blue/10 text-primary-blue ring-8 ring-primary-blue/5 transition-transform duration-300 ease-out group-hover:scale-105">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                <span className="text-[10px] font-normal text-slate-500 uppercase tracking-wider">
                  Fees Collected
                </span>
                <span className="text-3xl md:text-4xl font-bold text-slate-900">
                  ₹ 48.5L
                </span>
                <span className="text-xs text-body font-medium">
                  Current academic year
                </span>
              </div>
            </section>

            {/* Active section panel - dashboard module card (same hover lift) */}
            <section className="rounded-xl bg-white border border-slate-200 shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-slate-300/80">
              <div className="border-b border-slate-100 bg-slate-50/50 px-6 md:px-8 py-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary-blue/10 text-primary-blue border border-primary-blue/20">
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d={activeItem.icon}
                        />
                      </svg>
                    </span>
                    <div>
                      <h2 className="text-xl font-semibold text-heading">
                        {activeItem.title}
                      </h2>
                      <p className="text-sm text-body mt-1 font-medium">
                        {activeItem.description}
                      </p>
                    </div>
                  </div>
                  {activeItem.href && activeItem.href !== "#" && (
                    <Link
                      href={activeItem.href}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary-blue/30 bg-primary-blue/5 px-4 py-2 text-sm font-medium text-primary-blue hover:bg-primary-blue/10 transition-all duration-300 ease-out"
                    >
                      Open module
                      <span aria-hidden="true">↗</span>
                    </Link>
                  )}
                </div>
              </div>

              <div className="rounded-b-xl border-t border-slate-100 bg-card px-6 md:px-8 py-6">
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-5 py-6 text-sm text-body">
                  Detailed controls for{" "}
                  <span className="font-semibold text-heading">
                    {activeItem.title}
                  </span>{" "}
                  will appear here as the portal features are implemented. For
                  now, use the sidebar navigation to explore the available
                  sections like{" "}
                  <span className="font-medium text-heading">
                    Previous Question Papers
                  </span>{" "}
                  and{" "}
                  <span className="font-medium text-heading">
                    Attendance Overview
                  </span>
                  .
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}


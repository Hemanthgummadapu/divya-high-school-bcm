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

  const userEmail = session?.user?.email ?? "admin@divyahighschool.co.in";
  const userName = session?.user?.name ?? "Administrator";
  const today = useMemo(
    () => new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "short", day: "numeric" }),
    [],
  );

  const activeItem = NAV_ITEMS.find((item) => item.id === activeId) ?? NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-72 bg-[#0f172a] text-slate-100 flex flex-col border-r border-slate-800">
          <div className="px-5 pt-6 pb-4 border-b border-slate-800 flex items-center gap-3">
            <div className="relative h-10 w-10 rounded-full overflow-hidden border border-[#f59e0b]/80 bg-white flex-shrink-0">
              <Image
                src="/images/school-logo.png"
                alt="Divya High School BCM"
                fill
                sizes="40px"
                className="object-contain p-1"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white tracking-wide">
                Divya High School BCM
              </span>
              <span className="text-xs text-slate-400">Admin Dashboard</span>
            </div>
          </div>

          <div className="px-5 py-4 border-b border-slate-800">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
              Signed in as
            </p>
            <p className="text-sm text-slate-100 truncate">{userEmail}</p>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = item.id === activeId;
              const isExternal = item.href && item.href !== "#";
              const content = (
                <div
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer transition ${
                    isActive
                      ? "bg-[#020617] text-[#f59e0b] shadow-inner"
                      : "text-slate-200 hover:bg-slate-800/80 hover:text-white"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-md border ${
                      isActive
                        ? "border-[#f59e0b]/80 bg-[#020617]"
                        : "border-slate-700 bg-slate-900/60 group-hover:border-[#f59e0b]/70"
                    }`}
                  >
                    <svg
                      className="w-5 h-5"
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
                  <div className="flex flex-col">
                    <span className="font-medium">{item.title}</span>
                    <span className="text-xs text-slate-400 line-clamp-1">
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

          <div className="mt-auto px-5 py-4 border-t border-slate-800">
            <PortalLogoutButton />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 bg-slate-50">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                  Welcome back,{" "}
                  <span className="text-[#b45309]">{userName}</span>
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  {today} • Admin Portal Overview
                </p>
              </div>
              <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-4 py-2 shadow-sm">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0f172a] text-[#f59e0b] text-xs font-semibold">
                  ADM
                </span>
                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-wide text-slate-400">
                    Role
                  </span>
                  <span className="text-sm font-medium text-slate-800">
                    Administrator
                  </span>
                </div>
              </div>
            </header>

            {/* Summary stats */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-4 flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Total Students
                </span>
                <span className="text-2xl font-semibold text-slate-900">
                  1,250
                </span>
                <span className="text-xs text-emerald-600">
                  +3.2% vs last term
                </span>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-4 flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Total Staff
                </span>
                <span className="text-2xl font-semibold text-slate-900">
                  85
                </span>
                <span className="text-xs text-emerald-600">
                  Fully staffed
                </span>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-4 flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Fees Collected
                </span>
                <span className="text-2xl font-semibold text-slate-900">
                  ₹ 48.5L
                </span>
                <span className="text-xs text-slate-500">
                  Current academic year
                </span>
              </div>
            </section>

            {/* Active section panel */}
            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#0f172a] text-[#f59e0b]">
                      <svg
                        className="w-5 h-5"
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
                    {activeItem.title}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {activeItem.description}
                  </p>
                </div>
                {activeItem.href && activeItem.href !== "#" && (
                  <Link
                    href={activeItem.href}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Open module
                    <span aria-hidden="true">↗</span>
                  </Link>
                )}
              </div>

              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-sm text-slate-500">
                Detailed controls for{" "}
                <span className="font-semibold text-slate-800">
                  {activeItem.title}
                </span>{" "}
                will appear here as the portal features are implemented. For
                now, use the sidebar navigation to explore the available
                sections like{" "}
                <span className="font-medium text-slate-700">
                  Previous Question Papers
                </span>{" "}
                and{" "}
                <span className="font-medium text-slate-700">
                  Attendance Overview
                </span>
                .
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}


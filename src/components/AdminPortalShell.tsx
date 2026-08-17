"use client";

import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState, type ReactNode } from "react";
import PortalLogoutButton from "@/components/PortalLogoutButton";
import {
  ADMIN_PORTAL_MODULES,
  COMING_SOON_LABEL,
  QUESTION_BANK_HREF,
} from "@/lib/admin-portal-nav.mjs";

function NavIcon({ path }: { path: string }) {
  return (
    <svg
      className="h-5 w-5 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={path}
      />
    </svg>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Admin modules" className="flex-1 overflow-y-auto px-3 py-3">
      <ul className="space-y-1">
        {ADMIN_PORTAL_MODULES.map((item) => {
          if (item.available) {
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current="page"
                  className="group flex min-h-11 items-center gap-3 rounded-lg bg-[#020617] px-3 py-2.5 text-sm text-[#f59e0b] shadow-inner outline-none ring-[#f59e0b] focus-visible:ring-2"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-md border border-[#f59e0b]/80 bg-[#020617]">
                    <NavIcon path={item.icon} />
                  </span>
                  <span className="flex min-w-0 flex-col text-left">
                    <span className="font-medium">{item.title}</span>
                    <span className="truncate text-xs text-amber-200/80">
                      {item.description}
                    </span>
                  </span>
                </Link>
              </li>
            );
          }

          return (
            <li key={item.id}>
              <span
                aria-disabled="true"
                className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 bg-slate-900/60">
                  <NavIcon path={item.icon} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col text-left">
                  <span className="flex flex-wrap items-center gap-2 font-medium text-slate-300">
                    {item.title}
                    <span className="inline-flex items-center rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-200">
                      {COMING_SOON_LABEL}
                    </span>
                  </span>
                  <span className="truncate text-xs text-slate-500">
                    {item.description}
                  </span>
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default function AdminPortalShell({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const userEmail = session?.user?.email ?? null;
  const userName = session?.user?.name ?? null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100">
      <div className="flex min-h-screen">
        {menuOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
        ) : null}

        <aside
          id="admin-sidebar"
          className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[calc(100vw-2rem)] flex-col border-r border-slate-800 bg-[#0f172a] text-slate-100 transition-transform lg:static lg:translate-x-0 ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center gap-3 border-b border-slate-800 px-5 pb-4 pt-6">
            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full border border-[#f59e0b]/80 bg-white">
              <Image
                src="/images/school-logo.png"
                alt="Divya High School BCM"
                fill
                sizes="40px"
                className="object-contain p-1"
              />
            </div>
            <div className="min-w-0 flex flex-col">
              <span className="truncate text-sm font-semibold tracking-wide text-white">
                Divya High School BCM
              </span>
              <span className="text-xs text-slate-400">Admin Portal</span>
            </div>
          </div>

          <div className="border-b border-slate-800 px-5 py-4">
            <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
              Signed in as
            </p>
            <p className="truncate text-sm text-slate-100">
              {userEmail || userName || "Authorized administrator"}
            </p>
          </div>

          <SidebarNav onNavigate={() => setMenuOpen(false)} />

          <div className="mt-auto border-t border-slate-800 px-5 py-4">
            <PortalLogoutButton />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-800 outline-none ring-[#0f172a] focus-visible:ring-2"
              aria-expanded={menuOpen}
              aria-controls="admin-sidebar"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="sr-only">Open admin menu</span>
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <Link
              href={QUESTION_BANK_HREF}
              className="inline-flex min-h-11 items-center rounded-lg bg-[#0f172a] px-3 text-sm font-medium text-white outline-none ring-[#f59e0b] focus-visible:ring-2"
            >
              Open Question Bank
            </Link>
          </header>
          <main className="min-w-0 flex-1 bg-slate-50">{children}</main>
        </div>
      </div>
    </div>
  );
}

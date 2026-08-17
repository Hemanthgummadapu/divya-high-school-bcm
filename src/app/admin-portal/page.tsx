import Link from "next/link";
import { QUESTION_BANK_HREF } from "@/lib/admin-portal-nav.mjs";

export default function AdminPortal() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
        Admin Portal
      </h1>
      <p className="mt-3 text-base font-medium text-[#b45309]">
        Question Bank is available
      </p>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
        Administrators can upload source papers, review extracted questions,
        build papers, save drafts and templates, and generate final PDFs.
      </p>
      <div className="mt-8">
        <Link
          href={QUESTION_BANK_HREF}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#0f172a] px-5 text-sm font-semibold text-white outline-none ring-[#f59e0b] ring-offset-2 hover:bg-[#1e293b] focus-visible:ring-2"
        >
          Open Question Bank
        </Link>
      </div>
      <p className="mt-8 text-sm font-medium text-slate-700">
        More school administration tools are coming soon.
      </p>
    </div>
  );
}

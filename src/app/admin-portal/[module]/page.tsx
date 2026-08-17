import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  COMING_SOON_LABEL,
  QUESTION_BANK_HREF,
  getAdminModuleById,
} from "@/lib/admin-portal-nav.mjs";

export default function AdminComingSoonPage({
  params,
}: {
  params: { module: string };
}) {
  const item = getAdminModuleById(params.module);
  if (!item) notFound();
  if (item.available) redirect(item.href);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
        {COMING_SOON_LABEL}
      </p>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">{item.title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
        This module is not available yet. It does not collect data, show
        statistics, or perform any school administration action.
      </p>
      <p className="mt-4 text-sm font-medium text-slate-700">
        More school administration tools are coming soon.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/admin-portal"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 outline-none ring-[#0f172a] ring-offset-2 hover:bg-slate-50 focus-visible:ring-2"
        >
          Back to Admin Portal
        </Link>
        <Link
          href={QUESTION_BANK_HREF}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#0f172a] px-5 text-sm font-semibold text-white outline-none ring-[#f59e0b] ring-offset-2 hover:bg-[#1e293b] focus-visible:ring-2"
        >
          Open Question Bank
        </Link>
      </div>
    </div>
  );
}

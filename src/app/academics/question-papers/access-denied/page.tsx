import Link from "next/link";

export default function QuestionPaperAccessDeniedPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-24">
      <section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Access denied</h1>
        <p className="mt-3 text-slate-600">
          Your signed-in account is not authorized to use the question-paper
          system. Contact the school administrator if you need access.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white hover:bg-blue-800"
        >
          Return to website
        </Link>
      </section>
    </main>
  );
}

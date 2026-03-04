import Link from "next/link";

const FEATURES = [
  { title: "My Classes", description: "View and manage your teaching schedule.", href: "#", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { title: "Attendance", description: "Mark and view student attendance.", href: "#", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { title: "Marks & Grades", description: "Enter and manage student marks.", href: "#", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { title: "Assignments", description: "Create and review assignments.", href: "#", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { title: "Timetable", description: "View teaching timetable.", href: "#", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { title: "Profile", description: "Update your staff profile.", href: "#", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
];

export default function StaffPortal() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="relative bg-white border-b border-gray-100 pt-20 pb-12 md:pt-24 md:pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="absolute right-4 top-20 md:right-6 md:top-24">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </Link>
          </div>
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="font-heading text-4xl md:text-5xl font-bold text-heading mb-3">
              Staff Portal
            </h1>
            <div className="h-1 w-full max-w-[180px] mx-auto rounded-full bg-accent-gold/80 mb-6" aria-hidden="true" />
            <p className="text-body text-gray-600 text-lg mb-2">
              Manage classes, attendance, marks, and teaching resources.
            </p>
            <p className="text-body text-gray-500 text-base">
              Welcome, Teacher. Manage classes, attendance, marks, and teaching resources.
            </p>
          </div>
        </div>
      </header>

      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {FEATURES.map((f) => (
              <Link
                key={f.title}
                href={f.href}
                className="group flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-xl hover:border-primary-blue/20 hover:-translate-y-0.5 transition-all duration-300"
              >
                <span className="w-12 h-12 rounded-xl bg-primary-blue/10 text-primary-blue flex items-center justify-center mb-4 group-hover:bg-primary-blue group-hover:text-white transition-colors duration-300">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={f.icon} />
                  </svg>
                </span>
                <h2 className="font-heading text-lg font-bold text-heading mb-2">{f.title}</h2>
                <p className="text-body text-gray-600 text-sm leading-relaxed">{f.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

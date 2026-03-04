import Link from "next/link";

const FEATURES = [
  { title: "User Management", description: "Manage students, staff, and admin accounts.", href: "#", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { title: "Reports", description: "View and export school reports.", href: "#", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { title: "Attendance Overview", description: "School-wide attendance summary.", href: "#", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { title: "Fee Management", description: "Fee collection and fee structure.", href: "#", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { title: "Settings", description: "School and system settings.", href: "#", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
  { title: "Announcements", description: "Create and manage announcements.", href: "#", icon: "M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3.364a1.622 1.622 0 00.6-1.196V1a1 1 0 00-1-1H1a1 1 0 00-1 1v3.364a1.622 1.622 0 00.6 1.196C8.378 5.234 11.9 6.5 16 6.5" },
];

export default function AdminPortal() {
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
              Admin Portal
            </h1>
            <div className="h-1 w-full max-w-[180px] mx-auto rounded-full bg-accent-gold/80 mb-6" aria-hidden="true" />
            <p className="text-body text-gray-600 text-lg mb-2">
              Manage users, reports, fees, and school settings.
            </p>
            <p className="text-body text-gray-500 text-base">
              Welcome, Administrator. Manage users, reports, fees, announcements, and school settings.
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

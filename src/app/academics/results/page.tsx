import Link from "next/link";

export default function Results() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-100 pt-20 pb-12 md:pt-24 md:pb-16">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-heading mb-3">
            Results
          </h1>
          <div className="h-1 w-full max-w-[180px] mx-auto rounded-full bg-accent-gold/80 mb-6" aria-hidden="true" />
          <p className="text-body text-gray-600 text-lg max-w-2xl mx-auto">
            View exam results and report cards. Results will be published here once declared.
          </p>
        </div>
      </header>

      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="font-heading text-xl font-semibold text-heading">Academic Results</h2>
              <p className="text-sm text-gray-500 mt-1">Select academic year and class to view results.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-body">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80">
                    <th className="px-6 py-4 font-semibold text-heading">Exam</th>
                    <th className="px-6 py-4 font-semibold text-heading">Class</th>
                    <th className="px-6 py-4 font-semibold text-heading">Date</th>
                    <th className="px-6 py-4 font-semibold text-heading">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-6 py-4">—</td>
                    <td className="px-6 py-4">—</td>
                    <td className="px-6 py-4">—</td>
                    <td className="px-6 py-4 text-gray-500">Results will be updated here</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 text-center text-sm text-gray-500">
              For any queries, please contact the school office or visit the <Link href="/contact" className="text-primary-blue hover:underline">Contact</Link> page.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

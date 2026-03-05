import Link from "next/link";

export default function FeeStructure() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-100 pt-20 pb-12 md:pt-24 md:pb-16">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-heading mb-3">
            Fee Structure
          </h1>
          <div className="h-1 w-full max-w-[180px] mx-auto rounded-full bg-accent-gold/80 mb-6" aria-hidden="true" />
          <p className="text-body text-gray-600 text-lg max-w-2xl mx-auto">
            Fee details for the academic year. For the latest structure and payment options, please contact the school.
          </p>
        </div>
      </header>

      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="font-heading text-xl font-semibold text-heading">Fee Structure Overview</h2>
              <p className="text-sm text-gray-500 mt-1">Applicable for the current academic year (subject to revision).</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-body">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80">
                    <th className="px-6 py-4 font-semibold text-heading">Class / Category</th>
                    <th className="px-6 py-4 font-semibold text-heading">Tuition Fee</th>
                    <th className="px-6 py-4 font-semibold text-heading">Other Charges</th>
                    <th className="px-6 py-4 font-semibold text-heading">Total (per annum)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-6 py-4">—</td>
                    <td className="px-6 py-4">—</td>
                    <td className="px-6 py-4">—</td>
                    <td className="px-6 py-4 text-gray-500">Fee details will be updated here</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 text-center text-sm text-gray-500">
              For detailed fee structure and payment options, please visit the school office or <Link href="/contact" className="text-primary-blue hover:underline">contact us</Link>.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

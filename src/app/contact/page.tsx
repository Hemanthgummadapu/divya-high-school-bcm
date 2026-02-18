export default function Contact() {
  return (
    <div className="min-h-screen bg-[#f0f4f8] py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-center text-[#0d1b2a] mb-4">
            Contact Us
          </h1>
          <div className="w-24 h-px bg-[#d4af37] mx-auto mb-14" aria-hidden="true" />
          <div className="bg-white rounded-2xl shadow-[0_4px_28px_rgba(13,27,42,0.06)] p-8 md:p-12">
            <div className="space-y-10">
              <a
                href="mailto:info@divyahighschool.co.in"
                className="flex items-center gap-5 py-5 border-b border-gray-100 last:border-0 group transition-colors duration-300"
              >
                <span className="flex-shrink-0 w-11 h-11 rounded-full bg-[#d4af37]/15 flex items-center justify-center text-[#d4af37] transition-colors duration-300 group-hover:bg-[#d4af37]/25">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-500 mb-1">Email</p>
                  <p className="text-[#0d1b2a] font-semibold text-base group-hover:text-[#d4af37] transition-colors duration-300">
                    info@divyahighschool.co.in
                  </p>
                </div>
              </a>
              <a
                href="tel:9100569269"
                className="flex items-center gap-5 py-5 border-b border-gray-100 last:border-0 group transition-colors duration-300"
              >
                <span className="flex-shrink-0 w-11 h-11 rounded-full bg-[#d4af37]/15 flex items-center justify-center text-[#d4af37] transition-colors duration-300 group-hover:bg-[#d4af37]/25">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-500 mb-1">Phone</p>
                  <p className="text-[#0d1b2a] font-semibold text-base group-hover:text-[#d4af37] transition-colors duration-300">
                    9100569269
                  </p>
                </div>
              </a>
              <a
                href="tel:9100569339"
                className="flex items-center gap-5 py-5 border-b border-gray-100 last:border-0 group transition-colors duration-300"
              >
                <span className="flex-shrink-0 w-11 h-11 rounded-full bg-[#d4af37]/15 flex items-center justify-center text-[#d4af37] transition-colors duration-300 group-hover:bg-[#d4af37]/25">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-500 mb-1">Phone</p>
                  <p className="text-[#0d1b2a] font-semibold text-base group-hover:text-[#d4af37] transition-colors duration-300">
                    9100569339
                  </p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

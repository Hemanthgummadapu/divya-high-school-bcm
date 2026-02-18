export default function MissionVision() {
  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <div className="container mx-auto px-4 py-20 animate-fade-in">
        <header className="text-center mb-16">
          <h1 className="text-5xl font-bold text-[#0d1b2a] mb-4">
            Mission & Vision
          </h1>
          <div className="w-24 h-0.5 bg-[#d4af37] mx-auto" aria-hidden="true" />
        </header>
        <div className="max-w-3xl mx-auto space-y-12">
          <section className="bg-white rounded-xl shadow-[0_4px_20px_rgba(13,27,42,0.08)] p-10">
            <h2 className="text-2xl font-semibold text-[#0d1b2a] mb-6 flex items-center gap-3">
              <span className="flex-shrink-0" aria-hidden="true">
                <svg className="w-5 h-5 text-[#d4af37]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
              </span>
              Mission
            </h2>
            <p className="text-gray-700 leading-relaxed tracking-wide text-[15px]">
              Our mission is to empower every student with knowledge, confidence, and values that prepare them for future challenges. Through innovative teaching methods, experienced faculty, and structured sports training, we aim to promote academic excellence, physical fitness, moral integrity, and social responsibility.
            </p>
          </section>
          <section className="bg-white rounded-xl shadow-[0_4px_20px_rgba(13,27,42,0.08)] p-10">
            <h2 className="text-2xl font-semibold text-[#0d1b2a] mb-6 flex items-center gap-3">
              <span className="flex-shrink-0" aria-hidden="true">
                <svg className="w-5 h-5 text-[#d4af37]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </span>
              Vision
            </h2>
            <p className="text-gray-700 leading-relaxed tracking-wide text-[15px]">
              To be a leading educational institution that nurtures confident, responsible, and compassionate individuals who excel academically, thrive in sports, and contribute positively to society.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

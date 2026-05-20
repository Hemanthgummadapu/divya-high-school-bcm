const WHATSAPP_APPLY_URL =
  "https://wa.me/919100569269?text=Hello%2C%20I%20would%20like%20to%20apply%20for%20admission%20for%202026-27.";
const WHATSAPP_ENQUIRE_URL =
  "https://wa.me/919100569269?text=Hello%2C%20I%20would%20like%20to%20enquire%20about%20admissions.";

const INFO_PILLS = [
  { label: "Classes", value: "LKG to Class X" },
  { label: "Seats", value: "Limited" },
  { label: "Selection", value: "Interaction based" },
  { label: "Year", value: "2026–27" },
];

const PROCESS_STEPS = [
  { title: "Enquiry", desc: "Visit the school or message us" },
  { title: "Documents", desc: "Submit required certificates" },
  { title: "Interaction", desc: "Short meeting with student and parents" },
  { title: "Confirmation", desc: "Pay fees and confirm the seat" },
];

const DOCUMENTS = [
  "Birth certificate",
  "Previous academic records (if applicable)",
  "Passport-size photographs",
  "Transfer certificate (for Class 2 onwards)",
  "Parent/Guardian ID proof",
];

export default function Admissions() {
  return (
    <div className="min-h-screen bg-white pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h1 className="font-heading text-3xl md:text-4xl font-bold text-slate-900 text-center mb-10">
          Admissions Open for 2026–27
        </h1>

        {/* Info pills */}
        <ul className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-12">
          {INFO_PILLS.map((pill) => (
            <li
              key={pill.label}
              className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-center"
            >
              <span className="font-semibold text-slate-800">{pill.label}:</span>{" "}
              <span className="text-slate-600">{pill.value}</span>
            </li>
          ))}
        </ul>

        {/* Process timeline */}
        <section className="mb-12" aria-labelledby="admissions-process-heading">
          <h2 id="admissions-process-heading" className="sr-only">
            Admission process
          </h2>
          <ol className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-2">
            {PROCESS_STEPS.map((step, i) => (
              <li key={step.title} className="relative text-center px-1">
                {i > 0 && (
                  <span
                    className="hidden sm:block absolute top-3 -left-1/2 w-full h-px bg-slate-200"
                    aria-hidden
                  />
                )}
                <div className="relative z-[1] w-6 h-6 mx-auto mb-2 rounded-full bg-blue-700 text-white text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </div>
                <p className="font-semibold text-slate-900 text-sm">{step.title}</p>
                <p className="text-xs text-slate-500 mt-1 leading-snug">{step.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Documents */}
        <section className="mb-12" aria-labelledby="documents-heading">
          <h2 id="documents-heading" className="font-heading text-lg font-bold text-slate-900 mb-3">
            Documents needed
          </h2>
          <ul className="list-disc list-inside space-y-1 text-slate-600 text-sm leading-relaxed">
            {DOCUMENTS.map((doc) => (
              <li key={doc}>{doc}</li>
            ))}
          </ul>
        </section>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
          <a
            href={WHATSAPP_APPLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-8 py-3 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold transition-colors text-center"
          >
            Apply Online
          </a>
          <a
            href={WHATSAPP_ENQUIRE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-8 py-3 rounded-lg border-2 border-blue-700 text-blue-700 hover:bg-blue-50 font-semibold transition-colors text-center"
          >
            Enquire on WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

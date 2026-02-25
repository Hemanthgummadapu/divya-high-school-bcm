const FACULTY_SUBJECTS = [
  "Telugu",
  "Hindi",
  "English",
  "Maths",
  "Physics",
  "Biology",
  "Social",
];

export default function Faculty() {
  return (
    <div className="container mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold text-center mb-4 font-heading text-heading">Faculty</h1>
      <p className="text-center text-body text-gray-600 max-w-2xl mx-auto mb-12">
        This is the faculty page. Content will be added here.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {FACULTY_SUBJECTS.map((subject) => (
          <div
            key={subject}
            className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col items-center text-center p-6"
          >
            {/* Placeholder image - gray avatar box */}
            <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center mb-4 flex-shrink-0">
              <svg
                className="w-12 h-12 text-gray-400"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
            <h2 className="font-heading text-xl font-semibold text-heading mb-2">{subject}</h2>
            <p className="text-body text-gray-600 text-sm leading-relaxed">
              Faculty details will be updated soon
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Faculty – Divya High School BCM",
  description: "Meet our dedicated faculty at Divya High School BCM.",
};

export default function FacultyPage() {
  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <div className="container mx-auto px-4 py-20 animate-fade-in">
        <header className="text-center mb-16">
          <h1 className="text-5xl font-bold text-school-navy mb-4">
            Faculty
          </h1>
          <div className="w-24 h-0.5 bg-school-gold mx-auto" aria-hidden="true" />
          <p className="text-gray-600 mt-4 max-w-2xl mx-auto">
            Our experienced and dedicated teaching staff at Divya High School BCM.
          </p>
        </header>
        <div className="max-w-3xl mx-auto">
          <section className="bg-white rounded-xl shadow-[0_4px_20px_rgba(11,46,89,0.08)] p-10">
            <p className="text-gray-700 leading-relaxed">
              Faculty details and profiles can be added here.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

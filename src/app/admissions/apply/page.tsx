import type { Metadata } from "next";
import AdmissionForm from "./AdmissionForm";

export const metadata: Metadata = {
  title: "Admission Form – Divya High School BCM",
  description: "Apply for admission to Divya High School BCM. Fill the online application form.",
};

export default function ApplyPage() {
  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="container mx-auto px-4 py-10 md:py-16">
        <h1 className="text-3xl md:text-4xl font-bold text-center mb-2 text-heading">
          Admission Form
        </h1>
        <p className="text-center text-gray-600 mb-8 md:mb-12 max-w-xl mx-auto">
          Divya High School BCM – Work is Worship
        </p>
        <AdmissionForm />
      </div>
    </div>
  );
}

"use client";

import { useState, FormEvent } from "react";

const CLASS_OPTIONS = ["Nursery", "LKG", "UKG", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
const GENDER_OPTIONS = ["Male", "Female", "Other"];

const PHONE_REGEX = /^\d{10}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdmissionForm() {
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const newErrors: Record<string, string> = {};

    // Required: Student Full Name
    if (!(data.get("studentName") as string)?.trim()) {
      newErrors.studentName = "Student name is required.";
    }
    // Required: Date of Birth
    if (!(data.get("dob") as string)?.trim()) {
      newErrors.dob = "Date of birth is required.";
    }
    // Required: Gender
    if (!(data.get("gender") as string)) {
      newErrors.gender = "Please select gender.";
    }
    // Required: Applying Class
    if (!(data.get("applyingClass") as string)) {
      newErrors.applyingClass = "Please select class.";
    }
    // Required: Father Name
    if (!(data.get("fatherName") as string)?.trim()) {
      newErrors.fatherName = "Father name is required.";
    }
    // Required: Mother Name
    if (!(data.get("motherName") as string)?.trim()) {
      newErrors.motherName = "Mother name is required.";
    }
    // Required: Parent Phone (10 digits)
    const phone = (data.get("parentPhone") as string)?.replace(/\s/g, "") ?? "";
    if (!phone) {
      newErrors.parentPhone = "Parent phone number is required.";
    } else if (!PHONE_REGEX.test(phone)) {
      newErrors.parentPhone = "Phone must be 10 digits.";
    }
    // Alternate phone if provided
    const altPhone = (data.get("alternatePhone") as string)?.replace(/\s/g, "") ?? "";
    if (altPhone && !PHONE_REGEX.test(altPhone)) {
      newErrors.alternatePhone = "Alternate phone must be 10 digits.";
    }
    // Required: Email (valid format)
    const email = (data.get("email") as string)?.trim() ?? "";
    if (!email) {
      newErrors.email = "Email is required.";
    } else if (!EMAIL_REGEX.test(email)) {
      newErrors.email = "Please enter a valid email address.";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto p-8 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-primary-blue/10 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent-gold/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-heading" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-heading mb-2">Application submitted successfully.</h2>
        <p className="text-gray-600">Our team will contact you soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-8">
      {/* Student Details */}
      <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-primary-blue/10 overflow-hidden">
        <div className="px-6 py-4 bg-primary-blue text-white">
          <h2 className="text-lg font-semibold">Student Details</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="studentName" className="block text-sm font-medium text-heading mb-1">Student Full Name <span className="text-red-500">*</span></label>
            <input type="text" id="studentName" name="studentName" required className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold outline-none transition" placeholder="Enter full name" />
            {errors.studentName && <p className="mt-1 text-sm text-red-500">{errors.studentName}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="dob" className="block text-sm font-medium text-heading mb-1">Date of Birth <span className="text-red-500">*</span></label>
              <input type="date" id="dob" name="dob" required className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold outline-none transition" />
              {errors.dob && <p className="mt-1 text-sm text-red-500">{errors.dob}</p>}
            </div>
            <div>
              <label htmlFor="gender" className="block text-sm font-medium text-heading mb-1">Gender <span className="text-red-500">*</span></label>
              <select id="gender" name="gender" required className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold outline-none transition bg-white">
                <option value="">Select</option>
                {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              {errors.gender && <p className="mt-1 text-sm text-red-500">{errors.gender}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="applyingClass" className="block text-sm font-medium text-heading mb-1">Applying Class <span className="text-red-500">*</span></label>
              <select id="applyingClass" name="applyingClass" required className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold outline-none transition bg-white">
                <option value="">Select</option>
                {CLASS_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.applyingClass && <p className="mt-1 text-sm text-red-500">{errors.applyingClass}</p>}
            </div>
            <div>
              <label htmlFor="previousSchool" className="block text-sm font-medium text-heading mb-1">Previous School</label>
              <input type="text" id="previousSchool" name="previousSchool" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold outline-none transition" placeholder="Name of previous school" />
            </div>
          </div>
          <div>
            <label htmlFor="aadhaar" className="block text-sm font-medium text-heading mb-1">Aadhaar Number</label>
            <input type="text" id="aadhaar" name="aadhaar" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold outline-none transition" placeholder="12-digit Aadhaar" maxLength={12} />
          </div>
        </div>
      </div>

      {/* Parent Details */}
      <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-primary-blue/10 overflow-hidden">
        <div className="px-6 py-4 bg-primary-blue text-white">
          <h2 className="text-lg font-semibold">Parent Details</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="fatherName" className="block text-sm font-medium text-heading mb-1">Father Name <span className="text-red-500">*</span></label>
              <input type="text" id="fatherName" name="fatherName" required className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold outline-none transition" placeholder="Father&apos;s full name" />
              {errors.fatherName && <p className="mt-1 text-sm text-red-500">{errors.fatherName}</p>}
            </div>
            <div>
              <label htmlFor="motherName" className="block text-sm font-medium text-heading mb-1">Mother Name <span className="text-red-500">*</span></label>
              <input type="text" id="motherName" name="motherName" required className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold outline-none transition" placeholder="Mother&apos;s full name" />
              {errors.motherName && <p className="mt-1 text-sm text-red-500">{errors.motherName}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="parentPhone" className="block text-sm font-medium text-heading mb-1">Parent Phone Number <span className="text-red-500">*</span></label>
              <input type="tel" id="parentPhone" name="parentPhone" required className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold outline-none transition" placeholder="10-digit number" maxLength={10} />
              {errors.parentPhone && <p className="mt-1 text-sm text-red-500">{errors.parentPhone}</p>}
            </div>
            <div>
              <label htmlFor="alternatePhone" className="block text-sm font-medium text-heading mb-1">Alternate Phone</label>
              <input type="tel" id="alternatePhone" name="alternatePhone" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold outline-none transition" placeholder="10-digit number" maxLength={10} />
              {errors.alternatePhone && <p className="mt-1 text-sm text-red-500">{errors.alternatePhone}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-heading mb-1">Email Address <span className="text-red-500">*</span></label>
              <input type="email" id="email" name="email" required className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold outline-none transition" placeholder="email@example.com" />
              {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
            </div>
            <div>
              <label htmlFor="occupation" className="block text-sm font-medium text-heading mb-1">Occupation</label>
              <input type="text" id="occupation" name="occupation" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold outline-none transition" placeholder="Parent occupation" />
            </div>
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-primary-blue/10 overflow-hidden">
        <div className="px-6 py-4 bg-primary-blue text-white">
          <h2 className="text-lg font-semibold">Address</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-heading mb-1">Address Line</label>
            <textarea id="address" name="address" rows={3} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold outline-none transition resize-y" placeholder="Street, area, landmark" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-heading mb-1">City</label>
              <input type="text" id="city" name="city" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold outline-none transition" placeholder="City" />
            </div>
            <div>
              <label htmlFor="state" className="block text-sm font-medium text-heading mb-1">State</label>
              <input type="text" id="state" name="state" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold outline-none transition" placeholder="State" />
            </div>
            <div>
              <label htmlFor="pincode" className="block text-sm font-medium text-heading mb-1">Pincode</label>
              <input type="number" id="pincode" name="pincode" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold outline-none transition" placeholder="Pincode" min={100000} max={999999} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center pb-8">
        <button
          type="submit"
          className="px-8 py-3.5 rounded-lg bg-accent-gold text-heading font-semibold hover:bg-accent-gold-dark focus:ring-2 focus:ring-accent-gold/50 focus:ring-offset-2 transition-colors duration-300"
        >
          Submit Application
        </button>
      </div>
    </form>
  );
}

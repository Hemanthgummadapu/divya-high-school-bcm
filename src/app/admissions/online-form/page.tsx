"use client";

import { useState, FormEvent } from "react";

interface FormErrors {
  fullName?: string;
  dateOfBirth?: string;
  gender?: string;
  classApplyingFor?: string;
  fathersName?: string;
  mobileNumber?: string;
  email?: string;
}

const CLASSES = ["LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const GENDERS = ["Male", "Female", "Other"];

const inputBase =
  "w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-school-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-school-gold/40 focus:border-school-gold transition-all duration-200";
const inputError = "border-red-500 focus:ring-red-500/30 focus:border-red-500";
const labelClass = "block text-sm font-medium text-school-navy mb-2";

export default function OnlineAdmissionForm() {
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const fullName = (formData.get("fullName") as string)?.trim();
    const dateOfBirth = formData.get("dateOfBirth") as string;
    const gender = formData.get("gender") as string;
    const classApplyingFor = formData.get("classApplyingFor") as string;
    const fathersName = (formData.get("fathersName") as string)?.trim();
    const mobileNumber = (formData.get("mobileNumber") as string)?.trim();
    const email = (formData.get("email") as string)?.trim();

    const newErrors: FormErrors = {};

    if (!fullName) newErrors.fullName = "Full Name is required";
    if (!dateOfBirth) newErrors.dateOfBirth = "Date of Birth is required";
    if (!gender) newErrors.gender = "Please select Gender";
    if (!classApplyingFor) newErrors.classApplyingFor = "Please select Class";
    if (!fathersName) newErrors.fathersName = "Father's Name is required";
    if (!mobileNumber) newErrors.mobileNumber = "Mobile Number is required";
    else if (!/^\d{10}$/.test(mobileNumber)) newErrors.mobileNumber = "Enter a valid 10-digit mobile number";
    if (!email) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Enter a valid email address";

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] py-20 md:py-28 flex items-center">
        <div className="container mx-auto px-4">
          <div className="max-w-xl mx-auto">
            <div className="bg-white rounded-2xl shadow-[0_4px_28px_rgba(11,46,89,0.06)] p-8 md:p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-[#F4B400]/20 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-[#F4B400]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-school-navy mb-4">
                Application Submitted Successfully
              </h2>
              <p className="text-gray-600">
                Your application has been submitted successfully. Our team will contact you soon.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] py-12 md:py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-center text-school-navy mb-4">
            Online Admission Form
          </h1>
          <div className="w-24 h-px bg-school-gold mx-auto mb-10" aria-hidden="true" />

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-[0_4px_28px_rgba(11,46,89,0.06)] p-6 md:p-10">
            {/* Student Details */}
            <div className="form-section-header">
              <h2>Student Details</h2>
            </div>
            <div className="space-y-6 mb-10">
              <div>
                <label htmlFor="fullName" className={labelClass}>
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  className={`${inputBase} ${errors.fullName ? inputError : ""}`}
                  placeholder="Enter student&apos;s full name"
                />
                {errors.fullName && <p className="mt-1.5 text-sm text-red-500">{errors.fullName}</p>}
              </div>

              <div>
                <label htmlFor="dateOfBirth" className={labelClass}>
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <input
                  id="dateOfBirth"
                  name="dateOfBirth"
                  type="date"
                  className={`${inputBase} ${errors.dateOfBirth ? inputError : ""}`}
                />
                {errors.dateOfBirth && <p className="mt-1.5 text-sm text-red-500">{errors.dateOfBirth}</p>}
              </div>

              <div>
                <label htmlFor="gender" className={labelClass}>
                  Gender <span className="text-red-500">*</span>
                </label>
                <select
                  id="gender"
                  name="gender"
                  className={`${inputBase} ${errors.gender ? inputError : ""}`}
                >
                  <option value="">Select Gender</option>
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                {errors.gender && <p className="mt-1.5 text-sm text-red-500">{errors.gender}</p>}
              </div>

              <div>
                <label htmlFor="classApplyingFor" className={labelClass}>
                  Class Applying For <span className="text-red-500">*</span>
                </label>
                <select
                  id="classApplyingFor"
                  name="classApplyingFor"
                  className={`${inputBase} ${errors.classApplyingFor ? inputError : ""}`}
                >
                  <option value="">Select Class</option>
                  {CLASSES.map((c) => (
                    <option key={c} value={c}>Class {c}</option>
                  ))}
                </select>
                {errors.classApplyingFor && <p className="mt-1.5 text-sm text-red-500">{errors.classApplyingFor}</p>}
              </div>
            </div>

            {/* Parent Details */}
            <div className="form-section-header">
              <h2>Parent Details</h2>
            </div>
            <div className="space-y-6 mb-10">
              <div>
                <label htmlFor="fathersName" className={labelClass}>
                  Father&apos;s Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="fathersName"
                  name="fathersName"
                  type="text"
                  className={`${inputBase} ${errors.fathersName ? inputError : ""}`}
                  placeholder="Enter father&apos;s name"
                />
                {errors.fathersName && <p className="mt-1.5 text-sm text-red-500">{errors.fathersName}</p>}
              </div>

              <div>
                <label htmlFor="mothersName" className={labelClass}>
                  Mother&apos;s Name
                </label>
                <input
                  id="mothersName"
                  name="mothersName"
                  type="text"
                  className={inputBase}
                  placeholder="Enter mother&apos;s name"
                />
              </div>

              <div>
                <label htmlFor="mobileNumber" className={labelClass}>
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  id="mobileNumber"
                  name="mobileNumber"
                  type="tel"
                  className={`${inputBase} ${errors.mobileNumber ? inputError : ""}`}
                  placeholder="10-digit mobile number"
                  maxLength={10}
                />
                {errors.mobileNumber && <p className="mt-1.5 text-sm text-red-500">{errors.mobileNumber}</p>}
              </div>

              <div>
                <label htmlFor="email" className={labelClass}>
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className={`${inputBase} ${errors.email ? inputError : ""}`}
                  placeholder="your@email.com"
                />
                {errors.email && <p className="mt-1.5 text-sm text-red-500">{errors.email}</p>}
              </div>
            </div>

            {/* Address Details */}
            <div className="form-section-header">
              <h2>Address Details</h2>
            </div>
            <div className="space-y-6 mb-10">
              <div>
                <label htmlFor="address" className={labelClass}>
                  Address
                </label>
                <textarea
                  id="address"
                  name="address"
                  rows={4}
                  className={inputBase}
                  placeholder="Enter complete address"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label htmlFor="city" className={labelClass}>
                    City
                  </label>
                  <input
                    id="city"
                    name="city"
                    type="text"
                    className={inputBase}
                    placeholder="City"
                  />
                </div>
                <div>
                  <label htmlFor="state" className={labelClass}>
                    State
                  </label>
                  <input
                    id="state"
                    name="state"
                    type="text"
                    className={inputBase}
                    placeholder="State"
                  />
                </div>
                <div>
                  <label htmlFor="pincode" className={labelClass}>
                    Pincode
                  </label>
                  <input
                    id="pincode"
                    name="pincode"
                    type="text"
                    className={inputBase}
                    placeholder="Pincode"
                    maxLength={6}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-6 rounded-lg bg-school-gold text-school-navy font-semibold transition-all duration-300 hover:bg-school-gold-dark hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-school-gold/40 focus:ring-offset-2"
            >
              Submit Application
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

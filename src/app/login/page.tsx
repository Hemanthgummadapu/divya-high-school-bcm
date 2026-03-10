"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const hasAccessDenied = error === "AccessDenied";

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-[#020617]/60 border border-[#1f2937] rounded-2xl shadow-2xl p-8 space-y-8">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative h-16 w-16 rounded-full overflow-hidden border border-[#facc15]/60 bg-white">
            <Image
              src="/images/school-logo.png"
              alt="Divya High School BCM"
              fill
              sizes="64px"
              className="object-contain p-1"
            />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold text-white tracking-wide">
              Divya High School BCM
            </h1>
            <p className="text-sm text-slate-300">
              Secure portal access for Admin, Staff & Students
            </p>
          </div>
        </div>

        {hasAccessDenied && (
          <div className="rounded-md bg-red-900/40 border border-red-500/60 px-3 py-2 text-sm text-red-100">
            This Google account is not authorized for any school portal. Please
            use an approved email address.
          </div>
        )}

        <button
          type="button"
          onClick={() =>
            signIn("google", {
              callbackUrl: "/admin-portal",
            })
          }
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[#facc15] text-[#020617] font-medium py-2.5 px-4 shadow-lg hover:bg-[#eab308] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#facc15] focus:ring-offset-[#020617] transition"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 533.5 544.3"
            aria-hidden="true"
          >
            <path
              fill="#4285F4"
              d="M533.5 278.4c0-17.4-1.6-34.1-4.6-50.4H272.1v95.4h146.9c-6.3 34.1-25.3 63.1-54.3 82.4v68h87.7c51.4-47.4 81.1-117.4 81.1-195.4z"
            />
            <path
              fill="#34A853"
              d="M272.1 544.3c73.5 0 135.1-24.3 180.1-66.1l-87.7-68c-24.4 16.4-55.8 26-92.4 26-71 0-131.2-47.9-152.8-112.2H29.1v70.5c44.3 88 135.3 149.8 243 149.8z"
            />
            <path
              fill="#FBBC04"
              d="M119.3 323.9c-10.5-31.4-10.5-65.4 0-96.8V156.6H29.1c-39.6 78.9-39.6 172.3 0 251.2l90.2-70z"
            />
            <path
              fill="#EA4335"
              d="M272.1 107.7c38.9-.6 76.2 14.1 104.5 41.4l77.7-77.7C407.2 24.6 343.4-1.1 272.1 0 164.4 0 73.4 61.8 29.1 150l90.2 70c21.5-64.3 81.8-112.3 152.8-112.3z"
            />
          </svg>
          <span>Sign in with Google</span>
        </button>

        <p className="text-xs text-slate-400 text-center">
          By signing in, you agree to abide by Divya High School{" "}
          <span className="text-[#facc15]">usage policies</span>. Access is
          restricted to authorized school accounts only.
        </p>
      </div>
    </div>
  );
}


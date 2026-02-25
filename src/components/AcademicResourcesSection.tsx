"use client";

import Image from "next/image";
import Link from "next/link";

const BOOKS = [
  { src: "/class6.png", alt: "IIT Foundation Mathematics Class VI", label: "Class VI", description: "Build strong fundamentals in number systems, algebra, and geometry for higher classes." },
  { src: "/class7.png", alt: "IIT Foundation Mathematics Class VII", label: "Class VII", description: "Develop problem-solving skills and conceptual clarity in mathematics and reasoning." },
  { src: "/class8.png", alt: "IIT Foundation Mathematics Class VIII", label: "Class VIII", description: "Prepare for competitive foundations with structured topics and practice-oriented content." },
];

export default function AcademicResourcesSection() {
  return (
    <section
      className="py-20"
      style={{
        background: "linear-gradient(180deg, #f0f4f8 0%, #e8eef4 35%, #ffffff 100%)",
      }}
    >
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="text-center mb-12 md:mb-14">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-slate-900 mb-2">
            Our Academic Excellence
          </h2>
          <p className="text-body text-gray-500 text-base md:text-lg mb-4">
            IIT Foundation Mathematics Series
          </p>
          <div
            className="mx-auto w-20 h-1 rounded-full bg-primary-blue"
            aria-hidden
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {BOOKS.map((book) => (
            <div
              key={book.label}
              className="group bg-white rounded-2xl overflow-hidden shadow-md border border-gray-100 transition-all duration-300 hover:scale-105 hover:shadow-xl"
            >
              <div className="relative w-full aspect-[3/4] max-w-[240px] mx-auto mt-6 rounded-lg overflow-hidden bg-gray-50">
                <Image
                  src={book.src}
                  alt={book.alt}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 240px"
                />
              </div>
              <div className="p-5 md:p-6 text-center">
                <p className="font-heading font-semibold text-slate-800 text-lg mb-2">
                  {book.label}
                </p>
                <p className="text-body text-gray-600 text-sm leading-relaxed mb-4">
                  {book.description}
                </p>
                <Link
                  href="/academics"
                  className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-primary-blue border border-primary-blue hover:bg-primary-blue hover:text-white transition-colors duration-300"
                >
                  Learn More
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

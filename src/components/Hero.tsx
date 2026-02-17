import Link from "next/link";

export default function Hero() {
  return (
    <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-20">
      <div className="container mx-auto px-4 text-center">
        <h1 className="text-5xl font-bold mb-4">Divya High School BCM</h1>
        <p className="text-xl mb-8">Excellence in Education</p>
        <div className="flex justify-center space-x-4">
          <Link
            href="/admissions"
            className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition"
          >
            Apply Now
          </Link>
          <Link
            href="/about"
            className="bg-transparent border-2 border-white text-white px-6 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition"
          >
            Learn More
          </Link>
        </div>
      </div>
    </section>
  );
}


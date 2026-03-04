import Link from "next/link";

export default function Hero() {
  return (
    <section className="bg-gradient-to-br from-school-navy-dark via-school-navy to-[#0d3a6e] text-white py-20">
      <div className="container mx-auto px-4 text-center">
        <h1 className="text-5xl font-bold mb-4 text-white drop-shadow-sm">
          Divya High School BCM
        </h1>
        <p className="text-xl mb-8 text-white/95">Work is Worship</p>
        <div className="flex justify-center space-x-4">
          <Link
            href="/admissions"
            className="bg-school-gold text-school-navy px-6 py-3 rounded-lg font-semibold hover:bg-school-gold-dark transition-colors duration-300"
          >
            Apply Now
          </Link>
          <Link
            href="/about"
            className="bg-transparent border-2 border-white text-white px-6 py-3 rounded-lg font-semibold hover:bg-school-gold hover:text-school-navy transition-colors duration-300"
          >
            Learn More
          </Link>
        </div>
      </div>
    </section>
  );
}

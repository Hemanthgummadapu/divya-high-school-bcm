import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="bg-white shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link href="/" className="text-2xl font-bold text-gray-800">
            Divya High School BCM
          </Link>
          <div className="flex space-x-6">
            <Link
              href="/"
              className="text-gray-600 hover:text-gray-900 transition"
            >
              Home
            </Link>
            <Link
              href="/about"
              className="text-gray-600 hover:text-gray-900 transition"
            >
              About
            </Link>
            <Link
              href="/admissions"
              className="text-gray-600 hover:text-gray-900 transition"
            >
              Admissions
            </Link>
            <Link
              href="/gallery"
              className="text-gray-600 hover:text-gray-900 transition"
            >
              Gallery
            </Link>
            <Link
              href="/contact"
              className="text-gray-600 hover:text-gray-900 transition"
            >
              Contact
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}


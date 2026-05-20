import Link from "next/link";
import Image from "next/image";
import { Clock, GraduationCap, User } from "lucide-react";

type FacultyMember = {
  id: number;
  subject: string;
  /** Optional — use for photo alt when names are published */
  name?: string;
  qualification: string;
  experience: string;
  classes: string;
  speciality: string;
  /** e.g. '/images/faculty/telugu-teacher.jpg' — null shows placeholder */
  photo: string | null;
};

// TODO: Add teacher names (optional `name` field) when approved for display / photo alt
// TODO: Add teacher photos to /public/images/faculty/ folder
// TODO: Confirm qualifications and years of experience with school admin
// TODO: Add Social Studies and Computer Science teachers
const facultyMembers: FacultyMember[] = [
  {
    id: 1,
    subject: "Telugu",
    qualification: "M.A., B.Ed",
    experience: "10+ years",
    classes: "Class I – X",
    speciality: "Telugu literature, grammar, and board exam preparation",
    photo: null,
  },
  {
    id: 2,
    subject: "Hindi",
    qualification: "M.A. Hindi, B.Ed",
    experience: "8+ years",
    classes: "Class III – X",
    speciality: "Hindi communication skills and literature",
    photo: null,
  },
  {
    id: 3,
    subject: "English",
    qualification: "M.A. English, B.Ed",
    experience: "12+ years",
    classes: "Class I – X",
    speciality: "English communication, grammar, and writing skills",
    photo: null,
  },
  {
    id: 4,
    subject: "Mathematics",
    qualification: "M.Sc. Maths, B.Ed",
    experience: "10+ years",
    classes: "Class VI – X (IIT Foundation)",
    speciality: "IIT Foundation Mathematics, problem-solving, and board exam mastery",
    photo: null,
  },
  {
    id: 5,
    subject: "Physics & Science",
    qualification: "M.Sc. Physics, B.Ed",
    experience: "9+ years",
    classes: "Class VI – X",
    speciality: "Conceptual Science teaching and lab-based learning",
    photo: null,
  },
  {
    id: 6,
    subject: "Biology",
    qualification: "M.Sc. Biology, B.Ed",
    experience: "7+ years",
    classes: "Class VI – X",
    speciality: "Life sciences, health education, and board exam preparation",
    photo: null,
  },
];

export default function Faculty() {
  return (
    <div className="min-h-screen bg-white">
      {/* Section 1: Hero */}
      <section className="relative bg-gradient-to-br from-blue-800 via-blue-700 to-indigo-800 py-20 md:py-28 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
          aria-hidden
        />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-blue-200 text-sm font-semibold uppercase tracking-widest mb-4 block">
            Academics
          </span>
          <h1 className="font-heading text-4xl md:text-6xl font-bold text-white mb-6">
            Our Faculty
          </h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto">
            Experienced educators who don&apos;t just teach subjects — they understand students, from kindergarten
            through Class X.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm text-blue-200">
            <Link href="/" className="hover:text-white transition">
              Home
            </Link>
            <span>/</span>
            <Link href="/academics" className="hover:text-white transition">
              Academics
            </Link>
            <span>/</span>
            <span className="text-white font-medium">Faculty</span>
          </div>
        </div>
      </section>

      {/* Section 2: Intro stats */}
      <section className="py-12 bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 gap-3 sm:gap-6 max-w-3xl mx-auto">
            <div className="text-center p-4 sm:p-6 bg-blue-50 rounded-2xl">
              <div className="text-2xl sm:text-3xl font-bold text-blue-700">10+</div>
              <div className="text-xs sm:text-sm text-slate-600 mt-1 leading-snug">Avg. Years Experience</div>
            </div>
            <div className="text-center p-4 sm:p-6 bg-blue-50 rounded-2xl border-x border-blue-100">
              <div className="text-2xl sm:text-3xl font-bold text-blue-700">LKG–X</div>
              <div className="text-xs sm:text-sm text-slate-600 mt-1 leading-snug">All Classes Covered</div>
            </div>
            <div className="text-center p-4 sm:p-6 bg-blue-50 rounded-2xl">
              <div className="text-2xl sm:text-3xl font-bold text-blue-700">B.Ed+</div>
              <div className="text-xs sm:text-sm text-slate-600 mt-1 leading-snug">Qualified Teachers</div>
            </div>
          </div>
          <p className="text-center text-slate-600 mt-8 max-w-3xl mx-auto leading-relaxed">
            Every teacher at Divya High School brings not just subject expertise, but a deep understanding of student
            psychology — from the curiosity of young children to the exam pressures of Class IX and X students.
          </p>
        </div>
      </section>

      {/* Section 3: Faculty grid */}
      <section className="py-16 md:py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {facultyMembers.map((member) => (
              <div
                key={member.id}
                className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <div className="relative h-56 bg-gradient-to-br from-slate-100 to-blue-50 flex items-center justify-center">
                  {member.photo ? (
                    <Image
                      src={member.photo}
                      alt={member.name ?? `${member.subject} faculty`}
                      fill
                      className="object-cover object-top"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-3 z-0">
                      <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="w-10 h-10 text-blue-400" aria-hidden />
                      </div>
                      <span className="text-xs text-slate-400 italic">Photo coming soon</span>
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <h3 className="font-heading text-lg font-bold text-slate-900 mb-1">{member.subject}</h3>
                  <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-4">
                    {member.qualification}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden />
                      {member.experience}
                    </span>
                    <span className="flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 shrink-0" aria-hidden />
                      {member.classes}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
                    {member.speciality}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

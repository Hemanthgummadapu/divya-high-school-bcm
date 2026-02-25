import FadeInSection from "@/components/FadeInSection";

const STRENGTHS = [
  "Established in 2004",
  "Classes from LKG to 10th",
  "IIT Foundation Program",
  "Focus on Academics, Sports & Cultural Activities",
  "Experienced and Dedicated Faculty",
  "Safe and Supportive Learning Environment",
];

function SectionDivider() {
  return (
    <div className="w-full flex justify-center py-0" aria-hidden="true">
      <div className="h-px w-full max-w-4xl mx-4 bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
    </div>
  );
}

export default function About() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero: gradient, 80px top padding, accent underline, letter-spacing on subtitle */}
      <div
        className="relative bg-white border-b border-gray-100 overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #fafbfc 0%, #ffffff 40%, #ffffff 100%)",
        }}
      >
        <div className="container mx-auto px-4 pt-20 pb-12 md:pt-24 md:pb-16 max-w-4xl text-center relative">
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-heading mb-3 pb-4 border-b-2 border-accent-gold inline-block">
            Divya High School
          </h1>
          <p className="text-xl md:text-2xl font-medium text-accent-gold tracking-wide mt-4">
            Established in 2004
          </p>
        </div>
      </div>

      <SectionDivider />

      {/* Section 1: Introduction — reduced width, center, more line-height and spacing */}
      <FadeInSection>
        <section className="bg-white py-[60px]">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="max-w-[800px] mx-auto text-center">
              <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-heading mb-8">
                Introduction
              </h2>
              <p className="text-body text-lg leading-8 text-gray-700">
                Divya High School, established in 2004, has been dedicated to providing quality education and nurturing young minds with strong academic foundations and moral values. For over two decades, we have focused on excellence in academics along with character development and discipline.
              </p>
            </div>
          </div>
        </section>
      </FadeInSection>

      <SectionDivider />

      {/* Section 2: Academic Excellence & IIT Foundation */}
      <FadeInSection>
        <section className="bg-[#f8f9fa] py-[60px]">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-heading mb-6">
              Academic Excellence & IIT Foundation
            </h2>
            <p className="text-body text-lg leading-8 text-gray-700 max-w-3xl">
              At Divya High School, we offer a strong <strong className="font-bold text-accent-gold">IIT Foundation Program</strong> that prepares students from an early stage for competitive examinations. The program strengthens core concepts in Mathematics, Science, and Logical Reasoning, helping students build analytical thinking and problem-solving skills essential for future success.
            </p>
          </div>
        </section>
      </FadeInSection>

      <SectionDivider />

      {/* Section 3: Holistic Development */}
      <FadeInSection>
        <section className="bg-white py-[60px]">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-heading mb-6">
              Holistic Development
            </h2>
            <p className="text-body text-lg leading-8 text-gray-700 max-w-3xl">
              We believe education goes beyond textbooks. Along with academics, we actively encourage participation in sports, cultural activities, assemblies, competitions, and extracurricular programs to ensure the overall development of every student.
            </p>
          </div>
        </section>
      </FadeInSection>

      <SectionDivider />

      {/* Section 4: Our Strengths — cards with smooth hover */}
      <FadeInSection>
        <section className="bg-white py-[60px]">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-heading mb-8">
              Our Strengths
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {STRENGTHS.map((item) => (
                <div
                  key={item}
                  className="bg-white rounded-xl p-6 shadow-md border border-gray-100 hover:shadow-xl hover:border-accent-gold/20 hover:-translate-y-1 transition-all duration-300 ease-out flex items-center gap-4"
                >
                  <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent-gold/10 flex items-center justify-center text-accent-gold font-bold text-sm" aria-hidden="true">
                    ✓
                  </span>
                  <span className="text-body text-gray-700 font-medium">
                    {item === "IIT Foundation Program" ? (
                      <strong className="font-bold text-accent-gold">{item}</strong>
                    ) : (
                      item
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </FadeInSection>

      <SectionDivider />

      {/* Section 5: Vision */}
      <FadeInSection>
        <section className="bg-[#f8f9fa] py-[60px]">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-heading mb-6">
              Vision
            </h2>
            <p className="text-body text-lg leading-8 text-gray-700 max-w-3xl">
              Our vision is to nurture confident, responsible, and knowledgeable individuals equipped with strong values and a competitive spirit to excel in higher education and life.
            </p>
          </div>
        </section>
      </FadeInSection>
    </div>
  );
}

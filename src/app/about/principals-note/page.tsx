import Image from "next/image";

export default function PrincipalsNote() {
  const hasPrincipalPhoto = true;

  return (
    <div className="min-h-screen bg-[#f5f7fa] py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-[0_4px_28px_rgba(13,27,42,0.06)] overflow-hidden p-8 md:p-12 lg:p-14">
            {/* Two-column layout: stack on mobile, side-by-side on md+ */}
            <div className="flex flex-col md:flex-row gap-10 md:gap-14 items-center md:items-stretch">
              {/* Left: Principal's photo */}
              <div className="md:w-2/5 flex-shrink-0 flex justify-center md:block">
                <div className="relative w-full max-w-xs aspect-[3/4] rounded-xl overflow-hidden shadow-[0_16px_48px_rgba(13,27,42,0.12)] bg-gray-100 border border-[#d4af37]/30">
                  {hasPrincipalPhoto ? (
                    <Image
                      src="/principal.png"
                      alt="Seshapu Venkata Kishore, Principal, Divya High School BCM"
                      fill
                      className="object-cover object-[center_25%]"
                      sizes="(max-width: 768px) 100vw, 40vw"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm text-center px-4">
                      Principal&apos;s Photo
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Message */}
              <div className="md:w-3/5 flex flex-col justify-center">
                <header className="mb-10">
                  <h1 className="text-3xl md:text-4xl font-bold text-[#08111a] tracking-tight">
                    Principal&apos;s Message
                  </h1>
                  <div className="w-24 h-px bg-[#d4af37] mt-5" aria-hidden="true" />
                </header>
                <div className="text-gray-700 leading-[1.75] tracking-wide space-y-6 text-[15px] md:text-[17px]">
                  <p>
                    At Divya High School, we believe that education is not just about academic
                    excellence, but about shaping character, discipline, and leadership. Our goal
                    is to create a safe and inspiring environment where every child discovers
                    their potential and grows with confidence.
                  </p>
                  <p>
                    With dedicated teachers, strong academic foundations, and a vibrant sports
                    academy, we strive to nurture well-rounded individuals prepared for future
                    challenges. Together, let us build a brighter future for our students.
                  </p>
                </div>
                <div className="mt-12 pt-8 border-t border-gray-100">
                  <p className="font-bold text-[#08111a] text-xl md:text-2xl tracking-tight">
                    Seshapu Venkata Kishore
                  </p>
                  <p className="text-gray-400 text-sm mt-2 font-normal">
                    Principal, Divya High School BCM
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

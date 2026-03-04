import Link from "next/link";
import { FaYoutube, FaInstagram, FaWhatsapp, FaMapMarkerAlt } from "react-icons/fa";

const SCHOOL_ADDRESS_URL =
  "https://www.google.com/maps/search/?api=1&query=MWC3+24V+Bhadrachalam+Bhagavandas+Colony+Purushottapatnam+Andhra+Pradesh+507111";

const GOOGLE_MAPS_EMBED_SRC =
  "https://www.google.com/maps?q=MWC3+24V+Bhadrachalam+Bhagavandas+Colony+Purushottapatnam+Andhra+Pradesh+507111&t=&z=15&ie=UTF8&iwloc=&output=embed";

const FOOTER_SOCIAL_LINKS = [
  { href: "https://www.youtube.com/@divyahighschoolbhadrachalam", label: "YouTube", Icon: FaYoutube },
  { href: "https://www.instagram.com/divyahighschool?igsh=bW93dHdtcWhrcHZj", label: "Instagram", Icon: FaInstagram },
  { href: "https://wa.me/919100569269?text=Hello%20I%20want%20admission%20details", label: "WhatsApp", Icon: FaWhatsapp },
];

const QUICK_LINKS = [
  { href: "/about", label: "About" },
  { href: "/admissions", label: "Admissions" },
  { href: "/gallery", label: "Gallery" },
  { href: "/contact", label: "Contact" },
];

const ContactIcon = ({ children }: { children: React.ReactNode }) => (
  <span className="footer-contact-icon" aria-hidden="true">{children}</span>
);

export default function Footer() {
  return (
    <>
      <footer className="footer-theme text-white mt-auto">
        <div className="container mx-auto px-4 pt-14 pb-10 md:pt-16 md:pb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8 lg:gap-12 text-center md:text-left">
            {/* Column 1: School info */}
            <div>
              <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                <span className="footer-contact-icon text-2xl" aria-hidden="true">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.905 59.905 0 0 1 12 3.493a59.902 59.902 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-3.75 9.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m3-9.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m3.75 9.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443" />
                  </svg>
                </span>
                <h3 className="footer-heading mb-0">Divya High School</h3>
              </div>
              <p className="footer-desc max-w-sm mx-auto md:mx-0">
                Excellence in Education Nurturing young minds for a brighter future.
              </p>
              <div className="flex items-center justify-center md:justify-start gap-2 mt-5">
                {FOOTER_SOCIAL_LINKS.map(({ href, label, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-social-icon"
                    aria-label={label}
                  >
                    <Icon className="text-base" />
                  </a>
                ))}
              </div>
            </div>

            {/* Column 2: Quick Links */}
            <div>
              <h4 className="footer-heading flex items-center justify-center md:justify-start gap-2">
                <span className="footer-contact-icon" aria-hidden="true">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4 4 0 0 1 1.242 7.244l-4 4a4 4 0 0 1-5.657-5.656l1.127-1.127m0-2.828 1.127-1.127a4 4 0 1 1 5.656 5.657l-4 4a4 4 0 0 1-5.657-5.657l.027-.027" />
                  </svg>
                </span>
                Quick Links
              </h4>
              <ul className="space-y-2">
                {QUICK_LINKS.map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="footer-quick-link">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Contact with icons */}
            <div>
              <h4 className="footer-heading flex items-center justify-center md:justify-start gap-2">
                <span className="footer-contact-icon" aria-hidden="true">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                  </svg>
                </span>
                Contact
              </h4>
              <ul className="footer-contact-list">
                <li>
                  <a href="mailto:info@divyahighschool.co.in" className="footer-contact-row">
                    <ContactIcon>
                      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </ContactIcon>
                    info@divyahighschool.co.in
                  </a>
                </li>
                <li>
                  <a href="tel:9100569269" className="footer-contact-row">
                    <ContactIcon>
                      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </ContactIcon>
                    9100569269
                  </a>
                </li>
                <li>
                  <a href="tel:9100569339" className="footer-contact-row">
                    <ContactIcon>
                      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </ContactIcon>
                    9100569339
                  </a>
                </li>
                <li>
                  <a href={SCHOOL_ADDRESS_URL} target="_blank" rel="noopener noreferrer" className="footer-contact-row">
                    <ContactIcon>
                      <FaMapMarkerAlt className="w-[18px] h-[18px]" />
                    </ContactIcon>
                    <span className="whitespace-pre-line text-left">
                      Divya High School
                      {"\n"}
                      Bhagavandas Colony,
                      {"\n"}
                      Bhadrachalam, Telangana 507111
                    </span>
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="footer-divider" />
          <p className="footer-copyright">
            &copy; {new Date().getFullYear()} <span className="footer-copyright-school">Divya High School</span>. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Google Maps embed below footer */}
      <div className="w-full h-[280px] md:h-[320px] lg:h-[360px] bg-gray-200">
        <iframe
          title="Divya High School location"
          src={GOOGLE_MAPS_EMBED_SRC}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="w-full h-full block"
        />
      </div>
    </>
  );
}

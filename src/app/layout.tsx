import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "@/styles/globals.css";
import { AuthProvider } from "./providers";
import LayoutSwitcher from "./LayoutSwitcher";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inter",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Divya High School BCM",
  description: "Divya High School BCM - Excellence in Education",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
      <body className="font-sans bg-[#F8FAFC] text-[#334155] antialiased">
        <AuthProvider>
          <LayoutSwitcher>{children}</LayoutSwitcher>
        </AuthProvider>
      </body>
    </html>
  );
}


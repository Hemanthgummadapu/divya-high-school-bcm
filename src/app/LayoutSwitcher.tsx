"use client";

import { usePathname } from "next/navigation";
import TopBar from "@/components/TopBar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

function isAdminRoute(pathname: string | null): boolean {
  return pathname?.startsWith("/admin-portal") ?? false;
}

export default function LayoutSwitcher({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const admin = isAdminRoute(pathname);

  if (admin) {
    return <>{children}</>;
  }

  return (
    <>
      <header className="sticky top-0 z-50">
        <TopBar />
        <Navbar />
      </header>
      <main className="min-h-screen">{children}</main>
      <Footer />
    </>
  );
}

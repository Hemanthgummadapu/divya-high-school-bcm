import AdminPortalShell from "@/components/AdminPortalShell";

export default function AdminPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminPortalShell>{children}</AdminPortalShell>;
}

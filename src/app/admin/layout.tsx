import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { NativePushRegister } from "@/components/admin/NativePushRegister";

export const metadata = { title: "Admin Panel | MA Removals" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/auth/login?callbackUrl=/admin");
  }
  return (
    <AdminShell adminName={session.user.name ?? "Admin"}>
      <NativePushRegister />
      {children}
    </AdminShell>
  );
}

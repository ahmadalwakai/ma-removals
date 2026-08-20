import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DriverTopBar } from "@/components/driver/DriverTopBar";
import { DriverBottomNav } from "@/components/driver/DriverBottomNav";
import { NativePushRegister } from "@/components/driver/NativePushRegister";

export const metadata = { title: "Driver Portal | MA Removals" };

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/driver-login");
  }

  if (session.user.role !== "DRIVER" && session.user.role !== "ADMIN") {
    redirect("/driver-login?error=role");
  }

  const driverName = session.user.name ?? "Driver";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0F172A",
      fontFamily: "var(--font-body)",
    }}>
      <DriverTopBar driverName={driverName} />

      {/* Native (Android shell) FCM token registration — no-op on web. */}
      <NativePushRegister />

      {/* Scrollable content area — padded for bottom nav */}
      <main style={{
        paddingBottom: "calc(64px + env(safe-area-inset-bottom))",
        minHeight: "calc(100vh - 58px)",
      }}>
        {children}
      </main>

      <DriverBottomNav />
    </div>
  );
}

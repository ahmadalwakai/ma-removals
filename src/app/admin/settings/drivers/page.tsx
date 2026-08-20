import Link from "next/link";
import { DriversClient } from "@/components/admin/drivers/DriversClient";
import { db } from "@/lib/db";
import { colors } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export default async function AdminSettingsDriversPage() {
  const drivers = await db.driverProfile.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: true },
  });

  const serialised = drivers.map((driver) => ({
    id: driver.id,
    userId: driver.userId,
    name: driver.user.name ?? "-",
    email: driver.user.email ?? "-",
    phone: driver.user.phone ?? "-",
    vehicleType: driver.vehicleType,
    licensePlate: driver.licensePlate,
    isActive: driver.isActive,
    rating: driver.rating,
    jobsCompleted: driver.jobsCompleted,
    createdAt: driver.createdAt.toISOString(),
  }));

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link href="/admin/settings" style={{ color: colors.muted, fontSize: 13, textDecoration: "none" }}>
          Back to settings
        </Link>
        <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 800, color: colors.ink, margin: "10px 0 6px" }}>
          Driver Accounts
        </h2>
        <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>
          Add drivers with a name, phone, email, and password. Drivers sign in using the email and password set here.
        </p>
      </div>

      <DriversClient drivers={serialised} />
    </div>
  );
}

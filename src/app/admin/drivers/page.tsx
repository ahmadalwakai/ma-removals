import { db } from "@/lib/db";
import { DriversClient } from "@/components/admin/drivers/DriversClient";

export const dynamic = "force-dynamic";

export default async function AdminDriversPage() {
  const drivers = await db.driverProfile.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: true },
  });

  const serialised = drivers.map((d) => ({
    id: d.id,
    userId: d.userId,
    name: d.user.name ?? "—",
    email: d.user.email ?? "—",
    phone: d.user.phone ?? "—",
    vehicleType: d.vehicleType,
    licensePlate: d.licensePlate,
    isActive: d.isActive,
    rating: d.rating,
    jobsCompleted: d.jobsCompleted,
    createdAt: d.createdAt.toISOString(),
  }));

  return <DriversClient drivers={serialised} />;
}

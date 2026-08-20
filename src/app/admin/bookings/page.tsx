import { db } from "@/lib/db";
import { BookingsTable } from "@/components/admin/bookings/BookingsTable";

export const dynamic = "force-dynamic";

export default async function AdminBookingsPage() {
  const bookings = await db.booking.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true, email: true, phone: true } },
      driver: { select: { user: { select: { name: true } } } },
    },
  });

  const drivers = await db.driverProfile.findMany({
    where: { isActive: true },
    include: { user: { select: { id: true, name: true } } },
  });

  const serialised = bookings.map((b) => ({
    ...b,
    scheduledDate: b.scheduledDate.toISOString(),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }));

  const serialisedDrivers = drivers.map((d) => ({
    id: d.id,
    name: d.user.name ?? "Driver",
  }));

  return <BookingsTable bookings={serialised} drivers={serialisedDrivers} />;
}

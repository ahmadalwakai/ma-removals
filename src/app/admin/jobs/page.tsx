import { db } from "@/lib/db";
import { JobBoardClient } from "@/components/admin/jobs/JobBoardClient";

export const dynamic = "force-dynamic";

export default async function AdminJobsPage() {
  // Bookings that are CONFIRMED or IN_PROGRESS = available/active jobs
  const jobs = await db.booking.findMany({
    where: { status: { in: ["CONFIRMED", "IN_PROGRESS"] } },
    orderBy: { scheduledDate: "asc" },
    include: {
      customer: { select: { name: true, phone: true } },
      driver: { include: { user: { select: { name: true } } } },
    },
  });

  const drivers = await db.driverProfile.findMany({
    where: { isActive: true },
    include: { user: { select: { id: true, name: true } } },
  });

  const serialised = jobs.map((j) => ({
    id: j.id,
    reference: j.reference,
    serviceName: j.serviceName,
    pickupAddress: j.pickupAddress,
    dropoffAddress: j.dropoffAddress,
    scheduledDate: j.scheduledDate.toISOString(),
    scheduledTime: j.scheduledTime,
    status: j.status,
    customer: { name: j.customer.name ?? "—", phone: j.customer.phone ?? "—" },
    driver: j.driver ? { name: j.driver.user.name ?? "Driver" } : null,
  }));

  const driverOptions = drivers.map((d) => ({ id: d.id, name: d.user.name ?? "Driver" }));

  return <JobBoardClient jobs={serialised} drivers={driverOptions} />;
}

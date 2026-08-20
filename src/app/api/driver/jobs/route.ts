import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireDriver, forbidden } from "@/lib/driver-auth";

/**
 * GET /api/driver/jobs
 * Returns all bookings that have a PENDING job offer for this driver,
 * plus unassigned confirmed bookings the admin has opened to all drivers.
 */
export async function GET() {
  const driver = await requireDriver();
  if (!driver) return forbidden();

  // Jobs with an explicit pending offer for this driver
  const offeredJobs = await db.jobOffer.findMany({
    where: { driverId: driver.id, status: "PENDING" },
    include: {
      booking: true,
    },
    orderBy: { offeredAt: "asc" },
  });

  return NextResponse.json({
    jobs: offeredJobs.map((o) => ({
      offerId: o.id,
      expiresAt: o.expiresAt,
      booking: o.booking,
    })),
  });
}

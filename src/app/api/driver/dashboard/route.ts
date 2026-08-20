import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireDriver, forbidden } from "@/lib/driver-auth";

/**
 * GET /api/driver/dashboard
 * Returns: today's jobs, upcoming jobs, stats summary for the driver's dashboard.
 */
export async function GET() {
  const driver = await requireDriver();
  if (!driver) return forbidden();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd   = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const weekEnd    = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [todaysJobs, upcomingJobs, pendingOffers, totalCompleted, earningsThisMonth] = await Promise.all([
    // Today's assigned bookings
    db.booking.findMany({
      where: {
        driverId: driver.id,
        scheduledDate: { gte: todayStart, lt: todayEnd },
        status: { in: ["CONFIRMED", "IN_PROGRESS"] },
      },
      orderBy: { scheduledTime: "asc" },
    }),

    // Next 7 days upcoming (excluding today)
    db.booking.findMany({
      where: {
        driverId: driver.id,
        scheduledDate: { gte: todayEnd, lt: weekEnd },
        status: { in: ["CONFIRMED", "IN_PROGRESS"] },
      },
      orderBy: { scheduledDate: "asc" },
      take: 5,
    }),

    // Pending job offers (unresponded)
    db.jobOffer.count({
      where: { driverId: driver.id, status: "PENDING" },
    }),

    // Total completed jobs
    db.booking.count({
      where: { driverId: driver.id, status: "COMPLETED" },
    }),

    // Earnings this calendar month
    db.booking.aggregate({
      where: {
        driverId: driver.id,
        status: "COMPLETED",
        scheduledDate: {
          gte: new Date(now.getFullYear(), now.getMonth(), 1),
          lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        },
      },
      _sum: { quotedPrice: true },
    }),
  ]);

  return NextResponse.json({
    driver: {
      name: driver.user.name,
      vehicleType: driver.vehicleType,
      licensePlate: driver.licensePlate,
      rating: driver.rating,
      jobsCompleted: driver.jobsCompleted,
    },
    stats: {
      todayCount: todaysJobs.length,
      pendingOffers,
      totalCompleted,
      earningsThisMonth: earningsThisMonth._sum.quotedPrice ?? 0,
    },
    todaysJobs,
    upcomingJobs,
  });
}

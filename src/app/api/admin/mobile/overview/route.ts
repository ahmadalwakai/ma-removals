import { NextResponse } from "next/server";

import { requireAdminMobile } from "@/lib/admin-mobile-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await requireAdminMobile(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [
    totalBookings,
    thisMonthBookings,
    lastMonthBookings,
    revenueThisMonth,
    revenueLastMonth,
    activeDrivers,
    activeJobs,
    statusCounts,
    bookings,
    drivers,
    notifications,
    unreadNotifications,
  ] = await Promise.all([
    db.booking.count(),
    db.booking.count({ where: { createdAt: { gte: startOfMonth } } }),
    db.booking.count({
      where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
    }),
    db.booking.aggregate({
      where: { isPaid: true, createdAt: { gte: startOfMonth } },
      _sum: { totalPaid: true },
    }),
    db.booking.aggregate({
      where: {
        isPaid: true,
        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
      _sum: { totalPaid: true },
    }),
    db.driverProfile.count({ where: { isActive: true } }),
    db.booking.count({ where: { status: { in: ["CONFIRMED", "IN_PROGRESS"] } } }),
    db.booking.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    db.booking.findMany({
      take: 80,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true, email: true, phone: true } },
        driver: { select: { id: true, user: { select: { name: true } } } },
      },
    }),
    db.driverProfile.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, email: true, phone: true } } },
    }),
    db.adminNotification.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    db.adminNotification.count({ where: { isRead: false } }),
  ]);

  return NextResponse.json({
    user,
    generatedAt: now.toISOString(),
    kpis: {
      totalBookings,
      thisMonthBookings,
      lastMonthBookings,
      revenueThisMonth: revenueThisMonth._sum.totalPaid ?? 0,
      revenueLastMonth: revenueLastMonth._sum.totalPaid ?? 0,
      activeDrivers,
      activeJobs,
      byStatus: Object.fromEntries(
        statusCounts.map((item) => [item.status, item._count.status]),
      ),
    },
    bookings: bookings.map((booking) => ({
      id: booking.id,
      reference: booking.reference,
      customer: booking.customer,
      serviceName: booking.serviceName,
      pickupAddress: booking.pickupAddress,
      pickupPostcode: booking.pickupPostcode,
      pickupLat: booking.pickupLat,
      pickupLng: booking.pickupLng,
      dropoffAddress: booking.dropoffAddress,
      dropoffPostcode: booking.dropoffPostcode,
      dropoffLat: booking.dropoffLat,
      dropoffLng: booking.dropoffLng,
      scheduledDate: booking.scheduledDate.toISOString(),
      scheduledTime: booking.scheduledTime,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      totalPaid: booking.totalPaid,
      quotedPrice: booking.quotedPrice,
      driver: booking.driver
        ? {
            id: booking.driver.id,
            name: booking.driver.user.name ?? "Driver",
          }
        : null,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
    })),
    drivers: drivers.map((driver) => ({
      id: driver.id,
      userId: driver.userId,
      name: driver.user.name ?? "Driver",
      email: driver.user.email ?? "",
      phone: driver.user.phone ?? "",
      vehicleType: driver.vehicleType,
      licensePlate: driver.licensePlate,
      isActive: driver.isActive,
      rating: driver.rating,
      jobsCompleted: driver.jobsCompleted,
      createdAt: driver.createdAt.toISOString(),
    })),
    notifications: {
      unreadCount: unreadNotifications,
      items: notifications.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        body: item.body,
        href: item.href,
        isRead: item.isRead,
        metadata: item.metadata,
        createdAt: item.createdAt.toISOString(),
      })),
    },
  });
}

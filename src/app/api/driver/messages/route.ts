import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireDriver, forbidden } from "@/lib/driver-auth";

/**
 * GET /api/driver/messages?bookingId=xxx — get thread for a booking
 * POST /api/driver/messages — send a message
 */
export async function GET(req: NextRequest) {
  const driver = await requireDriver();
  if (!driver) return forbidden();

  const bookingId = req.nextUrl.searchParams.get("bookingId");
  if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

  // Verify booking belongs to this driver
  const booking = await db.booking.findFirst({
    where: { id: bookingId, driverId: driver.id },
    select: { id: true },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = await db.driverMessage.findMany({
    where: { bookingId },
    orderBy: { createdAt: "asc" },
  });

  // Mark admin messages as read
  await db.driverMessage.updateMany({
    where: { bookingId, fromDriver: false, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const driver = await requireDriver();
  if (!driver) return forbidden();

  const body = await req.json() as { bookingId: string; body: string };
  if (!body.body?.trim()) return NextResponse.json({ error: "body required" }, { status: 400 });

  const booking = await db.booking.findFirst({
    where: { id: body.bookingId, driverId: driver.id },
    select: { id: true },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const message = await db.driverMessage.create({
    data: {
      bookingId: body.bookingId,
      driverId: driver.id,
      fromDriver: true,
      body: body.body.trim(),
    },
  });

  return NextResponse.json({ message });
}

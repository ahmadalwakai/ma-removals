import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireDriver, forbidden } from "@/lib/driver-auth";
import { triggerEvent } from "@/lib/pusher-server";

/**
 * POST /api/booking/[id]/location
 * Driver shares their current GPS location for an IN_PROGRESS booking.
 * Broadcasts via Pusher — intentionally does NOT write a DB row for every ping
 * to keep the table clean. Only writes a TrackingEvent every 5 min.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const driver = await requireDriver();
  if (!driver) return forbidden();

  const { id } = await params;
  const body = (await req.json()) as { lat: number; lng: number; eta?: number };

  if (typeof body.lat !== "number" || typeof body.lng !== "number") {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  const booking = await db.booking.findFirst({
    where: { id, driverId: driver.id, status: "IN_PROGRESS" },
    select: { id: true },
  });

  if (!booking) {
    return NextResponse.json({ error: "Active booking not found" }, { status: 404 });
  }

  // Broadcast real-time location to the booking channel
  triggerEvent(`booking-${booking.id}`, "driver-location", {
    lat: body.lat,
    lng: body.lng,
    eta: body.eta ?? null,
    timestamp: new Date().toISOString(),
  });

  // Throttled DB write: only record a location event if none in last 5 minutes
  const recent = await db.trackingEvent.findFirst({
    where: {
      bookingId: booking.id,
      type: "driver_location",
      timestamp: { gte: new Date(Date.now() - 5 * 60 * 1000) },
    },
    select: { id: true },
  });

  if (!recent) {
    await db.trackingEvent.create({
      data: {
        bookingId: booking.id,
        type: "driver_location",
        title: body.eta ? `Driver is ${body.eta} min away` : "Driver location updated",
        metadata: JSON.stringify({ lat: body.lat, lng: body.lng, eta: body.eta ?? null }),
        isPublic: true,
      },
    });
  }

  return NextResponse.json({ ok: true });
}

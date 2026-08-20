import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireDriver, forbidden } from "@/lib/driver-auth";
import { createTrackingEvent } from "@/lib/tracking-utils";

export const dynamic = "force-dynamic";

/**
 * POST /api/driver/my-jobs/event
 * Body: { bookingId, type: "accepted" | "en_route" | "arrived" }
 *
 * Records a driver progress milestone for an active job as a public
 * TrackingEvent (reusing the shared tracking pipeline so the customer and
 * admin timelines update in real time via Pusher). These milestones do NOT
 * change the BookingStatus enum — "completed" uses the status route instead.
 *
 * Idempotent per (booking, type): a duplicate milestone of the same type is
 * ignored so a double tap never produces two events.
 */

const schema = z.object({
  bookingId: z.string().min(1),
  type: z.enum(["accepted", "en_route", "arrived"]),
});

const EVENT_META: Record<
  "accepted" | "en_route" | "arrived",
  { trackingType: string; title: string; description: string }
> = {
  accepted: {
    trackingType: "driver_accepted",
    title: "Driver accepted the job",
    description: "Your driver has accepted the job and will be on the way soon.",
  },
  en_route: {
    trackingType: "driver_en_route",
    title: "Your driver is on the way",
    description: "The driver is heading to your pickup location.",
  },
  arrived: {
    trackingType: "arrived_pickup",
    title: "Your driver has arrived",
    description: "The driver has arrived at the pickup location.",
  },
};

export async function POST(req: NextRequest) {
  const driver = await requireDriver();
  if (!driver) return forbidden();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { bookingId, type } = parsed.data;

  const booking = await db.booking.findFirst({
    where: { id: bookingId, driverId: driver.id },
    select: { id: true, status: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.status !== "IN_PROGRESS" && booking.status !== "CONFIRMED") {
    return NextResponse.json({ error: "Job is not active" }, { status: 409 });
  }

  const meta = EVENT_META[type];

  // Dedupe: skip if the same milestone already exists for this booking.
  const existing = await db.trackingEvent.findFirst({
    where: { bookingId, type: meta.trackingType },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await createTrackingEvent({
    bookingId,
    type: meta.trackingType,
    title: meta.title,
    description: meta.description,
    isPublic: true,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}

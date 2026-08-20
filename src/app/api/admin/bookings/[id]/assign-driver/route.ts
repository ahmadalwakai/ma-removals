import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendDriverPush } from "@/lib/fcm";
import { addDriverToConversation } from "@/lib/chat-utils";
import { createTrackingEvent, recordStatusChange } from "@/lib/tracking-utils";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await req.json()) as { driverId?: string };

  if (!body.driverId) return NextResponse.json({ error: "driverId required" }, { status: 400 });

  const driver = await db.driverProfile.findUnique({
    where: { id: body.driverId },
    include: { user: { select: { name: true } } },
  });
  if (!driver) return NextResponse.json({ error: "Driver not found" }, { status: 404 });

  const booking = await db.booking.findUnique({
    where: { id },
    select: {
      driverId: true,
      status: true,
      reference: true,
      pickupAddress: true,
      dropoffAddress: true,
      scheduledDate: true,
      scheduledTime: true,
    },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // Duplicate-dispatch guard: if this booking is already active and assigned to
  // the same driver, do not re-assign or fire a second push.
  if (booking.driverId === body.driverId && booking.status === "IN_PROGRESS") {
    return NextResponse.json({ ok: true, alreadyDispatched: true });
  }

  await db.booking.update({
    where: { id },
    data: {
      driverId: body.driverId,
      status: "IN_PROGRESS",
    },
  });

  // Make sure the driver can message the customer in this booking's thread.
  await addDriverToConversation(id, driver.userId).catch(() => {});

  // Record the assignment so the customer & admin tracking timeline updates.
  await recordStatusChange({
    bookingId: id,
    fromStatus: booking.status,
    toStatus: "IN_PROGRESS",
    changedByRole: "ADMIN",
  }).catch(() => {});
  await createTrackingEvent({
    bookingId: id,
    type: "driver_assigned",
    title: `Driver assigned — ${driver.user?.name?.split(" ")[0] ?? "Your driver"} will handle your move`,
    description: "A driver has been assigned to your move and will be in touch.",
    isPublic: true,
  }).catch(() => {});

  // Pop the job on the driver's Android app (full-screen lock-screen alert).
  const route = `${booking.pickupAddress} → ${booking.dropoffAddress}`;
  await sendDriverPush(body.driverId, {
    title: `مهمة جديدة — ${booking.reference}`,
    body: route,
    deeplink: "/driver/my-jobs",
    type: "job_assigned",
    ref: booking.reference,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}


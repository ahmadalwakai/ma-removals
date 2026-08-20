import { type NextRequest, NextResponse } from "next/server";

import { requireAdminMobile } from "@/lib/admin-mobile-auth";
import { addDriverToConversation } from "@/lib/chat-utils";
import { db } from "@/lib/db";
import { sendDriverPush } from "@/lib/fcm";
import { createTrackingEvent, recordStatusChange } from "@/lib/tracking-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatMoney(value?: number | null): string | null {
  return typeof value === "number" && Number.isFinite(value)
    ? `£${value.toFixed(2)}`
    : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdminMobile(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as { driverId?: string };

  if (!body.driverId) {
    return NextResponse.json({ error: "driverId required" }, { status: 400 });
  }

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
      quotedPrice: true,
      finalPrice: true,
    },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

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

  await addDriverToConversation(id, driver.userId).catch(() => {});
  await recordStatusChange({
    bookingId: id,
    fromStatus: booking.status,
    toStatus: "IN_PROGRESS",
    changedBy: user.id,
    changedByRole: "ADMIN",
  }).catch(() => {});
  await createTrackingEvent({
    bookingId: id,
    type: "driver_assigned",
    title: `Driver assigned - ${driver.user?.name?.split(" ")[0] ?? "Your driver"} will handle your move`,
    description: "A driver has been assigned to your move and will be in touch.",
    isPublic: true,
  }).catch(() => {});

  const price = formatMoney(booking.finalPrice ?? booking.quotedPrice);
  const route = `${booking.pickupAddress} -> ${booking.dropoffAddress}`;
  await sendDriverPush(body.driverId, {
    title: `New job - ${booking.reference}`,
    body: price ? `${price} - ${route}` : route,
    deeplink: "/driver/my-jobs",
    type: "job_assigned",
    ref: booking.reference,
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    driver: {
      id: driver.id,
      name: driver.user.name ?? "Driver",
    },
    status: "IN_PROGRESS",
  });
}

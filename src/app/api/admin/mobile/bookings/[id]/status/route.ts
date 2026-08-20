import { type NextRequest, NextResponse } from "next/server";

import { requireAdminMobile } from "@/lib/admin-mobile-auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email-sender";
import { bookingCancelledHtml } from "@/lib/emails/templates";
import {
  createTrackingEvent,
  recordStatusChange,
  STATUS_EVENT_TITLES,
} from "@/lib/tracking-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
] as const;

type BookingStatusValue = (typeof VALID_STATUSES)[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdminMobile(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as { status?: string; note?: string };

  if (!body.status || !VALID_STATUSES.includes(body.status as BookingStatusValue)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const status = body.status as BookingStatusValue;
  const booking = await db.booking.findUnique({
    where: { id },
    include: { customer: { select: { email: true, name: true } } },
  });

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.status === status) {
    return NextResponse.json({ error: "Status unchanged" }, { status: 400 });
  }

  await db.booking.update({
    where: { id },
    data: { status },
  });

  await recordStatusChange({
    bookingId: id,
    fromStatus: booking.status,
    toStatus: status,
    changedBy: user.id,
    changedByRole: "ADMIN",
    note: body.note,
  });

  await createTrackingEvent({
    bookingId: id,
    type: "status_change",
    title:
      STATUS_EVENT_TITLES[status] ??
      `Status updated to ${status.replace(/_/g, " ").toLowerCase()}`,
    description: body.note,
    isPublic: true,
  });

  if (status === "CANCELLED" && booking.customer.email) {
    await sendEmail({
      to: booking.customer.email,
      subject: `Booking Cancelled - ${booking.reference}`,
      html: bookingCancelledHtml({
        customerName: booking.customer.name ?? "there",
        reference: booking.reference,
        serviceName: booking.serviceName ?? "Removal Service",
        scheduledDate: booking.scheduledDate.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        refundNote: body.note ?? "Please contact us if you have any questions.",
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, status });
}

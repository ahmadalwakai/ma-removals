import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createTrackingEvent, recordStatusChange, STATUS_EVENT_TITLES } from "@/lib/tracking-utils";
import { sendEmail } from "@/lib/email-sender";
import { bookingCancelledHtml } from "@/lib/emails/templates";

const VALID_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
] as const;

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

/**
 * GET /api/admin/bookings/[id]/status
 * Returns status history + tracking events for the admin status panel.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      statusHistory: { orderBy: { timestamp: "desc" }, take: 30 },
      trackingEvents: { orderBy: { timestamp: "desc" }, take: 50 },
    },
  });

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    currentStatus: booking.status,
    history: booking.statusHistory.map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      changedByRole: h.changedByRole,
      note: h.note,
      timestamp: h.timestamp.toISOString(),
    })),
    events: booking.trackingEvents.map((e) => ({
      id: e.id,
      type: e.type,
      title: e.title,
      description: e.description,
      isPublic: e.isPublic,
      timestamp: e.timestamp.toISOString(),
    })),
  });
}

/**
 * PATCH /api/admin/bookings/[id]/status
 * Admin changes booking status. Creates history record + tracking event + optional email.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await req.json()) as { status?: string; note?: string };

  if (!body.status || !VALID_STATUSES.includes(body.status as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const booking = await db.booking.findUnique({
    where: { id },
    include: { customer: { select: { email: true, name: true } } },
  });

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.status === body.status) {
    return NextResponse.json({ error: "Status unchanged" }, { status: 400 });
  }

  await db.booking.update({
    where: { id },
    data: {
      status: body.status as (typeof VALID_STATUSES)[number],
    },
  });

  await recordStatusChange({
    bookingId: id,
    fromStatus: booking.status,
    toStatus: body.status,
    changedBy: session.user.id,
    changedByRole: "ADMIN",
    note: body.note,
  });

  const eventTitle =
    STATUS_EVENT_TITLES[body.status] ??
    `Status updated to ${body.status.replace(/_/g, " ").toLowerCase()}`;

  await createTrackingEvent({
    bookingId: id,
    type: "status_change",
    title: eventTitle,
    description: body.note,
    isPublic: true,
  });

  // Send cancellation email to customer
  if (body.status === "CANCELLED" && booking.customer.email) {
    await sendEmail({
      to: booking.customer.email,
      subject: `Booking Cancelled — ${booking.reference}`,
      html: bookingCancelledHtml({
        customerName: booking.customer.name ?? "there",
        reference: booking.reference,
        serviceName: booking.serviceName ?? "Removal Service",
        scheduledDate: booking.scheduledDate
          ? new Date(booking.scheduledDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
          : "",
        refundNote: body.note ?? "Please contact us if you have any questions.",
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

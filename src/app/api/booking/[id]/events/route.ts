import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createTrackingEvent } from "@/lib/tracking-utils";

/**
 * GET /api/booking/[id]/events?email=xxx
 * Returns public tracking events (or all events for admin/driver).
 * Auth: session (admin/driver/customer) OR email query param matching booking customer.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.toLowerCase().trim();

  const session = await auth();

  const booking = await db.booking.findFirst({
    where: { OR: [{ id }, { reference: id }] },
    include: {
      customer: { select: { email: true } },
      trackingEvents: { orderBy: { timestamp: "asc" } },
      statusHistory: { orderBy: { timestamp: "asc" } },
    },
  });

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = session?.user?.role === "ADMIN";
  const isDriver = session?.user?.role === "DRIVER";
  const isCustomer = session?.user?.id === booking.customerId;
  const emailMatch = email && booking.customer.email?.toLowerCase() === email;

  if (!isAdmin && !isDriver && !isCustomer && !emailMatch) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const events =
    isAdmin || isDriver
      ? booking.trackingEvents
      : booking.trackingEvents.filter((e) => e.isPublic);

  return NextResponse.json({
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      title: e.title,
      description: e.description,
      isPublic: e.isPublic,
      timestamp: e.timestamp.toISOString(),
    })),
    statusHistory: (isAdmin || isDriver)
      ? booking.statusHistory.map((h) => ({
          id: h.id,
          fromStatus: h.fromStatus,
          toStatus: h.toStatus,
          changedByRole: h.changedByRole,
          note: h.note,
          timestamp: h.timestamp.toISOString(),
        }))
      : [],
  });
}

/**
 * POST /api/booking/[id]/events
 * Admin or Driver can manually add a tracking event.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.role || !["ADMIN", "DRIVER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    type?: string;
    title: string;
    description?: string;
    isPublic?: boolean;
  };

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const booking = await db.booking.findFirst({
    where: { OR: [{ id }, { reference: id }] },
    select: { id: true },
  });

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const event = await createTrackingEvent({
    bookingId: booking.id,
    type: body.type ?? "note_added",
    title: body.title.trim(),
    description: body.description?.trim(),
    isPublic: body.isPublic ?? true,
  });

  return NextResponse.json({
    event: {
      id: event.id,
      type: event.type,
      title: event.title,
      description: event.description,
      isPublic: event.isPublic,
      timestamp: event.timestamp.toISOString(),
    },
  });
}

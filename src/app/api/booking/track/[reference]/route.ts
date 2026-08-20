import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  const { reference } = await params;
  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.toLowerCase().trim();

  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const booking = await db.booking.findFirst({
    where: { reference },
    include: {
      customer: { select: { email: true, name: true } },
      driver: { include: { user: { select: { name: true } } } },
      reviews: { select: { id: true } },
      conversations: {
        select: { id: true },
        take: 1,
      },
      trackingEvents: {
        where: { isPublic: true },
        orderBy: { timestamp: "asc" },
      },
    },
  });

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (booking.customer.email?.toLowerCase() !== email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    booking: {
      id: booking.id,
      reference: booking.reference,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      serviceName: booking.serviceName,
      serviceVariant: booking.serviceVariant,
      scheduledDate: booking.scheduledDate.toISOString(),
      scheduledTime: booking.scheduledTime,
      pickupAddress: booking.pickupAddress,
      dropoffAddress: booking.dropoffAddress,
      distanceMiles: booking.distanceMiles,
      helpersCount: booking.helpersCount,
      needsPacking: booking.needsPacking,
      needsAssembly: booking.needsAssembly,
      totalPaid: booking.totalPaid,
      driverName: booking.driver?.user?.name
        ? booking.driver.user.name.split(" ")[0]
        : null,
      hasReview: booking.reviews.length > 0,
      conversationId: booking.conversations[0]?.id ?? null,
      customerName: booking.customer.name,
    },
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

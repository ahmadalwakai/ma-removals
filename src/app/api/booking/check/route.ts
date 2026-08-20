import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.toLowerCase().trim();

  if (!email) return NextResponse.json({ hasActiveBooking: false });

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) return NextResponse.json({ hasActiveBooking: false });

  const booking = await db.booking.findFirst({
    where: {
      customerId: user.id,
      status: { in: ["CONFIRMED", "IN_PROGRESS"] },
    },
    select: {
      reference: true,
      serviceName: true,
      scheduledDate: true,
      scheduledTime: true,
      status: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!booking) return NextResponse.json({ hasActiveBooking: false });

  return NextResponse.json({
    hasActiveBooking: true,
    booking: {
      reference: booking.reference,
      service: booking.serviceName,
      date: booking.scheduledDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
      }),
      time: booking.scheduledTime,
      status: booking.status,
    },
  });
}

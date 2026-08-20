import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyNewBooking } from "@/lib/notifications";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    reference: string;
    email: string;
    rating: number;
    comment?: string;
  };

  if (!body.reference || !body.email || !body.rating) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const rating = Math.min(5, Math.max(1, Math.round(body.rating)));

  const booking = await db.booking.findFirst({
    where: { reference: body.reference },
    include: { customer: { select: { email: true, name: true } } },
  });

  if (!booking)
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  if (booking.customer.email?.toLowerCase() !== body.email.toLowerCase().trim())
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (booking.status !== "COMPLETED")
    return NextResponse.json(
      { error: "Can only review completed bookings" },
      { status: 400 }
    );

  // Check for existing review
  const existing = await db.review.findUnique({
    where: { bookingId: booking.id },
  });
  if (existing)
    return NextResponse.json({ error: "Review already submitted" }, { status: 409 });

  const review = await db.review.create({
    data: {
      bookingId: booking.id,
      rating,
      comment: body.comment?.slice(0, 2000) ?? null,
      authorName: booking.customer.name,
      authorEmail: booking.customer.email,
      isApproved: false,
    },
  });

  // Notify admin
  await db.adminNotification.create({
    data: {
      type: "review",
      title: "New Review Received",
      body: `${booking.customer.name ?? "A customer"} left a ${rating}★ review for ${booking.reference}`,
      href: `/admin/content`,
      metadata: { reference: body.reference, rating },
    },
  }).catch(() => {});

  return NextResponse.json({ review: { id: review.id } });
}

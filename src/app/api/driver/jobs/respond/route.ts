import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireDriver, forbidden } from "@/lib/driver-auth";
import { addDriverToConversation } from "@/lib/chat-utils";
import { createTrackingEvent, recordStatusChange } from "@/lib/tracking-utils";
import { sendEmail } from "@/lib/email-sender";
import { driverAssignedHtml } from "@/lib/emails/templates";

/**
 * POST /api/driver/jobs/respond
 * Body: { offerId, action: "accept" | "reject", note? }
 */
export async function POST(req: NextRequest) {
  const driver = await requireDriver();
  if (!driver) return forbidden();

  const body = await req.json() as { offerId: string; action: "accept" | "reject"; note?: string };

  if (!["accept", "reject"].includes(body.action)) {
    return NextResponse.json({ error: "action must be accept or reject" }, { status: 400 });
  }

  const offer = await db.jobOffer.findUnique({
    where: { id: body.offerId },
    include: { booking: true },
  });

  if (!offer || offer.driverId !== driver.id) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  if (offer.status !== "PENDING") {
    return NextResponse.json({ error: "Offer already responded to" }, { status: 409 });
  }

  if (body.action === "accept") {
    // Accept: mark offer, assign driver to booking
    await db.$transaction([
      db.jobOffer.update({
        where: { id: offer.id },
        data: { status: "ACCEPTED", respondedAt: new Date(), note: body.note ?? null },
      }),
      db.booking.update({
        where: { id: offer.bookingId },
        data: { driverId: driver.id, status: "CONFIRMED" },
      }),
      // Reject all other pending offers for same booking
      db.jobOffer.updateMany({
        where: { bookingId: offer.bookingId, id: { not: offer.id }, status: "PENDING" },
        data: { status: "REJECTED", respondedAt: new Date() },
      }),
    ]);

    // Add driver to the booking's conversation
    await addDriverToConversation(offer.bookingId, driver.userId).catch(() => {});

    // Create tracking event: driver assigned
    await recordStatusChange({
      bookingId: offer.bookingId,
      fromStatus: offer.booking.status,
      toStatus: "CONFIRMED",
      changedByRole: "DRIVER",
    }).catch(() => {});
    await createTrackingEvent({
      bookingId: offer.bookingId,
      type: "driver_assigned",
      title: `Driver assigned — ${driver.user?.name?.split(" ")[0] ?? "Your driver"} will handle your move`,
      description: "Your driver has accepted the job and will be in touch before your move date.",
      isPublic: true,
    }).catch(() => {});

    // Send "driver assigned" email to customer
    const customer = await db.user.findUnique({
      where: { id: offer.booking.customerId },
      select: { email: true, name: true },
    });
    if (customer?.email) {
      const schedDate = offer.booking.scheduledDate.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      await sendEmail({
        to: customer.email,
        subject: `Your Driver is Confirmed! — ${offer.booking.reference}`,
        html: driverAssignedHtml({
          customerName: customer.name ?? "there",
          reference: offer.booking.reference,
          driverFirstName: driver.user?.name?.split(" ")[0] ?? "Your driver",
          scheduledDate: schedDate,
          scheduledTime: offer.booking.scheduledTime,
        }),
      }).catch(() => {});
    }
  } else {
    await db.jobOffer.update({
      where: { id: offer.id },
      data: { status: "REJECTED", respondedAt: new Date(), note: body.note ?? null },
    });
  }

  return NextResponse.json({ ok: true });
}

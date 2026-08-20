import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireDriver, forbidden } from "@/lib/driver-auth";
import { createTrackingEvent, recordStatusChange } from "@/lib/tracking-utils";
import { sendEmail } from "@/lib/email-sender";
import { jobCompletedHtml } from "@/lib/emails/templates";

/**
 * PATCH /api/driver/my-jobs/status
 * Body: { bookingId, status: "IN_PROGRESS" | "COMPLETED" }
 * Driver can only move: CONFIRMED → IN_PROGRESS → COMPLETED
 */
export async function PATCH(req: NextRequest) {
  const driver = await requireDriver();
  if (!driver) return forbidden();

  const body = await req.json() as { bookingId: string; status: string };
  const allowed = ["IN_PROGRESS", "COMPLETED"];

  if (!allowed.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status transition" }, { status: 400 });
  }

  const booking = await db.booking.findUnique({
    where: { id: body.bookingId },
    select: { id: true, driverId: true, status: true, reference: true, serviceName: true, customerId: true },
  });

  if (!booking || booking.driverId !== driver.id) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // Guard valid transitions
  const validTransitions: Record<string, string> = {
    CONFIRMED: "IN_PROGRESS",
    IN_PROGRESS: "COMPLETED",
  };

  if (validTransitions[booking.status] !== body.status) {
    return NextResponse.json({ error: `Cannot move from ${booking.status} to ${body.status}` }, { status: 409 });
  }

  await db.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: booking.id },
      data: { status: body.status as "IN_PROGRESS" | "COMPLETED" },
    });

    // If completed, bump jobsCompleted on driver profile
    if (body.status === "COMPLETED") {
      await tx.driverProfile.update({
        where: { id: driver.id },
        data: { jobsCompleted: { increment: 1 } },
      });
    }
  });

  // Record status change + create tracking event
  await recordStatusChange({
    bookingId: booking.id,
    fromStatus: booking.status,
    toStatus: body.status,
    changedByRole: "DRIVER",
  }).catch(() => {});

  if (body.status === "IN_PROGRESS") {
    await createTrackingEvent({
      bookingId: booking.id,
      type: "driver_en_route",
      title: "Your driver is on the way",
      description: "The driver has started the job and is heading to your pickup location.",
      isPublic: true,
    }).catch(() => {});
  } else if (body.status === "COMPLETED") {
    await createTrackingEvent({
      bookingId: booking.id,
      type: "completed",
      title: "Move completed! 🎉",
      description: "Your move has been completed. We hope everything went smoothly!",
      isPublic: true,
    }).catch(() => {});
  }

  // Send completion email to customer
  if (body.status === "COMPLETED") {
    const customer = await db.user.findUnique({
      where: { id: booking.customerId },
      select: { email: true, name: true },
    });
    if (customer?.email) {
      await sendEmail({
        to: customer.email,
        subject: `Your Move is Complete! — ${booking.reference}`,
        html: jobCompletedHtml({
          customerName: customer.name ?? "there",
          reference: booking.reference,
          serviceName: booking.serviceName,
        }),
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}

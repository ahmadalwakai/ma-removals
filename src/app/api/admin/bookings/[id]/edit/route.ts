import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Stripe from "stripe";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

interface EditBookingBody {
  // Service
  serviceSlug?: string;
  serviceName?: string;
  serviceVariant?: string | null;
  // Addresses
  pickupAddress?: string;
  pickupPostcode?: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupFloor?: number;
  pickupHasLift?: boolean;
  dropoffAddress?: string;
  dropoffPostcode?: string;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  dropoffFloor?: number;
  dropoffHasLift?: boolean;
  distanceMiles?: number;
  // Schedule
  scheduledDate?: string;
  scheduledTime?: string;
  // Options
  helpersCount?: number;
  needsPacking?: boolean;
  needsAssembly?: boolean;
  // Notes
  notes?: string | null;
  // Customer info
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string | null;
  // Price decision
  priceAction?: "keep" | "update" | "custom";
  customPrice?: number;
  newPrice?: number;
}

/**
 * PATCH /api/admin/bookings/[id]/edit
 * Updates booking fields. If priceAction = "update", issues a Stripe refund
 * (if newPrice < totalPaid) or records the new price. If "custom", uses customPrice.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminSession = await requireAdmin();
  if (!adminSession) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const booking = await db.booking.findUnique({
    where: { id },
    include: { customer: true },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as EditBookingBody;

  // Build the Prisma update data
  type BookingUpdateData = {
    serviceSlug?: string;
    serviceName?: string;
    serviceVariant?: string | null;
    pickupAddress?: string;
    pickupPostcode?: string;
    pickupLat?: number | null;
    pickupLng?: number | null;
    pickupFloor?: number;
    pickupHasLift?: boolean;
    dropoffAddress?: string;
    dropoffPostcode?: string;
    dropoffLat?: number | null;
    dropoffLng?: number | null;
    dropoffFloor?: number;
    dropoffHasLift?: boolean;
    distanceMiles?: number;
    scheduledDate?: Date;
    scheduledTime?: string;
    helpersCount?: number;
    needsPacking?: boolean;
    needsAssembly?: boolean;
    notes?: string | null;
    quotedPrice?: number;
    basePrice?: number;
    finalPrice?: number | null;
    paymentStatus?: "UNPAID" | "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED";
    status?: "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "REFUNDED";
  };

  const data: BookingUpdateData = {};

  if (body.serviceSlug !== undefined) data.serviceSlug = body.serviceSlug;
  if (body.serviceName !== undefined) data.serviceName = body.serviceName;
  if ("serviceVariant" in body) data.serviceVariant = body.serviceVariant;
  if (body.pickupAddress !== undefined) data.pickupAddress = body.pickupAddress;
  if (body.pickupPostcode !== undefined) data.pickupPostcode = body.pickupPostcode;
  if ("pickupLat" in body) data.pickupLat = body.pickupLat;
  if ("pickupLng" in body) data.pickupLng = body.pickupLng;
  if (body.pickupFloor !== undefined) data.pickupFloor = body.pickupFloor;
  if (body.pickupHasLift !== undefined) data.pickupHasLift = body.pickupHasLift;
  if (body.dropoffAddress !== undefined) data.dropoffAddress = body.dropoffAddress;
  if (body.dropoffPostcode !== undefined) data.dropoffPostcode = body.dropoffPostcode;
  if ("dropoffLat" in body) data.dropoffLat = body.dropoffLat;
  if ("dropoffLng" in body) data.dropoffLng = body.dropoffLng;
  if (body.dropoffFloor !== undefined) data.dropoffFloor = body.dropoffFloor;
  if (body.dropoffHasLift !== undefined) data.dropoffHasLift = body.dropoffHasLift;
  if (body.distanceMiles !== undefined) data.distanceMiles = body.distanceMiles;
  if (body.scheduledDate !== undefined) data.scheduledDate = new Date(body.scheduledDate);
  if (body.scheduledTime !== undefined) data.scheduledTime = body.scheduledTime;
  if (body.helpersCount !== undefined) data.helpersCount = body.helpersCount;
  if (body.needsPacking !== undefined) data.needsPacking = body.needsPacking;
  if (body.needsAssembly !== undefined) data.needsAssembly = body.needsAssembly;
  if ("notes" in body) data.notes = body.notes;

  // Handle price update
  let refundAmount: number | null = null;
  if (body.priceAction === "update" && body.newPrice !== undefined) {
    const finalPrice = body.newPrice;
    data.quotedPrice = finalPrice;
    data.finalPrice = finalPrice;
    if (finalPrice < booking.totalPaid) {
      refundAmount = booking.totalPaid - finalPrice;
    }
  } else if (body.priceAction === "custom" && body.customPrice !== undefined) {
    data.quotedPrice = body.customPrice;
    data.finalPrice = body.customPrice;
    if (body.customPrice < booking.totalPaid) {
      refundAmount = booking.totalPaid - body.customPrice;
    }
  }

  // Update booking
  await db.booking.update({ where: { id }, data });

  // Update customer info if provided
  if (body.customerName !== undefined || body.customerEmail !== undefined || body.customerPhone !== undefined) {
    const customerData: { name?: string; email?: string; phone?: string | null } = {};
    if (body.customerName !== undefined) customerData.name = body.customerName;
    if (body.customerEmail !== undefined) customerData.email = body.customerEmail;
    if ("customerPhone" in body) customerData.phone = body.customerPhone;
    await db.user.update({ where: { id: booking.customerId }, data: customerData });
  }

  // Issue partial refund via Stripe if applicable
  if (refundAmount !== null && refundAmount > 0 && booking.stripePaymentId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(booking.stripePaymentId);
      const chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id;
      if (chargeId) {
        const amountPence = Math.round(refundAmount * 100);
        await stripe.refunds.create({ charge: chargeId, amount: amountPence });
        const newTotalPaid = booking.totalPaid - refundAmount;
        const newPaymentStatus = newTotalPaid <= 0 ? "REFUNDED" : "PARTIALLY_REFUNDED";
        await db.booking.update({
          where: { id },
          data: {
            totalPaid: Math.max(0, newTotalPaid),
            paymentStatus: newPaymentStatus,
          },
        });
      }
    } catch (stripeErr) {
      console.error("Stripe refund error during booking edit:", stripeErr);
      // Don't fail the whole edit — booking is already updated
      return NextResponse.json({ ok: true, refundIssued: false, refundError: "Stripe refund failed — please issue manually." });
    }
  }

  return NextResponse.json({ ok: true, refundIssued: refundAmount !== null && refundAmount > 0 });
}

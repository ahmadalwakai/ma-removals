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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await req.json()) as { amount?: number };

  const booking = await db.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (!booking.stripePaymentId) return NextResponse.json({ error: "No Stripe payment ID" }, { status: 400 });
  if (booking.status === "REFUNDED") return NextResponse.json({ error: "Already refunded" }, { status: 400 });

  const amountPence = Math.round((body.amount ?? 0) * 100);
  if (amountPence <= 0) return NextResponse.json({ error: "No refund applicable" }, { status: 400 });

  // Retrieve the PaymentIntent to get the charge ID
  const pi = await stripe.paymentIntents.retrieve(booking.stripePaymentId);
  const chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id;
  if (!chargeId) return NextResponse.json({ error: "No charge found" }, { status: 400 });

  const refund = await stripe.refunds.create({ charge: chargeId, amount: amountPence });

  // Update booking status
  const newStatus = amountPence >= Math.round(booking.totalPaid * 100) ? "REFUNDED" : "PENDING";
  await db.booking.update({
    where: { id },
    data: {
      status: newStatus as "REFUNDED" | "PENDING",
      paymentStatus: amountPence >= Math.round(booking.totalPaid * 100) ? "REFUNDED" : "PARTIALLY_REFUNDED",
    },
  });

  return NextResponse.json({ ok: true, refundId: refund.id });
}

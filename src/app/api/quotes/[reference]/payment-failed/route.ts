import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { releaseQuotePromotionReservations } from "@/lib/pricing/promotion-redemptions";
import { quotePaymentFailureSchema } from "@/lib/quotes/schemas";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const { reference } = await params;
    const parsed = quotePaymentFailureSchema.safeParse({
      ...(await req.json()),
      quoteReference: reference,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payment failure event" }, { status: 400 });
    }

    const quote = await db.quote.findUnique({
      where: { reference: parsed.data.quoteReference },
      select: { id: true, reference: true },
    });
    if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

    const released = await releaseQuotePromotionReservations({
      quoteId: quote.id,
      reason: "payment_failed",
      paymentIntentId: parsed.data.paymentIntentId ?? null,
    });

    await db.quoteEvent.create({
      data: {
        quoteId: quote.id,
        reference: quote.reference,
        type: "payment_failed",
        metadata: {
          paymentIntentId: parsed.data.paymentIntentId ?? null,
          message: parsed.data.message ?? null,
          releasedPromotions: released.releasedCount,
        } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ ok: true, releasedPromotions: released.releasedCount });
  } catch (error) {
    console.error("Quote payment failure event failed:", error);
    return NextResponse.json({ error: "Unable to record payment failure" }, { status: 500 });
  }
}

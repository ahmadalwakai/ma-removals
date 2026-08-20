import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  releaseQuotePromotionReservations,
  reserveQuotePromotionReservations,
} from "@/lib/pricing/promotion-redemptions";
import { createQuotePaymentIntentSchema } from "@/lib/quotes/schemas";
import { verifyQuoteForCheckout } from "@/lib/quotes/service";
import { db } from "@/lib/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

export async function POST(req: NextRequest) {
  try {
    const parsed = createQuotePaymentIntentSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid quote payment request" }, { status: 400 });
    }

    const verification = await verifyQuoteForCheckout(parsed.data.quoteReference);
    if (!verification.ok) {
      if (verification.code === "BENCHMARK_EXPIRED" || verification.code === "STALE_QUOTE") {
        await releaseQuotePromotionReservations({
          quoteReference: parsed.data.quoteReference,
          reason: `checkout_blocked_${verification.code.toLowerCase()}`,
        });
      }
      return NextResponse.json(
        { error: verification.code, reasons: verification.reasons },
        { status: verification.status },
      );
    }

    const quote = verification.quote;
    if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

    await reserveQuotePromotionReservations({
      quoteId: quote.id,
      reason: "payment_intent_started",
    });

    if (quote.stripePaymentId) {
      const existingIntent = await stripe.paymentIntents.retrieve(quote.stripePaymentId);
      if (existingIntent.client_secret && existingIntent.amount === verification.finalTotalPence) {
        return NextResponse.json({
          clientSecret: existingIntent.client_secret,
          quoteReference: quote.reference,
        });
      }
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: verification.finalTotalPence,
      currency: "gbp",
      automatic_payment_methods: { enabled: true },
      metadata: {
        quoteReference: quote.reference,
        quoteId: quote.id,
        pricingVersionId: quote.pricingVersionId ?? "",
        promotionCampaignId: quote.promotionCampaignId ?? "",
        promotionCodeId: quote.promotionCodeId ?? "",
      },
      description: `MA Removals quote ${quote.reference}`,
      statement_descriptor_suffix: "MA REMOVALS",
    }, {
      idempotencyKey: `quote:${quote.reference}:${parsed.data.idempotencyKey}`,
    });

    await db.quote.update({
      where: { id: quote.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: quote.acceptedAt ?? new Date(),
        stripePaymentId: paymentIntent.id,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      quoteReference: quote.reference,
    });
  } catch (err) {
    console.error("Stripe create-payment-intent error:", err);
    return NextResponse.json({ error: "Payment setup failed" }, { status: 500 });
  }
}

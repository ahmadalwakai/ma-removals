import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import {
  releaseQuotePromotionReservations,
  reserveQuotePromotionReservations,
} from "@/lib/pricing/promotion-redemptions";
import { createQuotePaymentIntentSchema } from "@/lib/quotes/schemas";
import { verifyQuoteForCheckout } from "@/lib/quotes/service";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createQuotePaymentIntentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid Stripe checkout request" }, { status: 400 });
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
    if (quote.expiresAt.getTime() <= Date.now()) {
      await db.quote.update({ where: { id: quote.id }, data: { status: "EXPIRED" } });
      await releaseQuotePromotionReservations({
        quoteId: quote.id,
        reason: "quote_expired_on_checkout_session",
      });
      return NextResponse.json({ error: "Quote has expired" }, { status: 410 });
    }

    await reserveQuotePromotionReservations({
      quoteId: quote.id,
      reason: "stripe_checkout_started",
    });

    if (quote.status === "FIXED") {
      await db.quote.update({
        where: { id: quote.id },
        data: { status: "ACCEPTED", acceptedAt: quote.acceptedAt ?? new Date() },
      });
    }

    const origin = req.nextUrl.origin;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: quote.customerEmail ?? undefined,
      success_url: `${origin}/api/booking/checkout-session/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/book?payment=cancelled&quote=${encodeURIComponent(quote.reference)}`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: verification.finalTotalPence,
            product_data: {
              name: `MA Removals booking ${quote.reference}`,
              description: "Home removal booking deposit/payment",
            },
          },
        },
      ],
      metadata: {
        quoteReference: quote.reference,
        quoteId: quote.id,
      },
      payment_intent_data: {
        description: `MA Removals quote ${quote.reference}`,
        statement_descriptor_suffix: "MA REMOVALS",
        metadata: {
          quoteReference: quote.reference,
          quoteId: quote.id,
          pricingVersionId: quote.pricingVersionId ?? "",
          promotionCampaignId: quote.promotionCampaignId ?? "",
          promotionCodeId: quote.promotionCodeId ?? "",
        },
      },
    }, {
      idempotencyKey: `checkout:${quote.reference}:${parsed.data.idempotencyKey}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout session failed:", error);
    return NextResponse.json({ error: "Unable to start Stripe checkout" }, { status: 500 });
  }
}

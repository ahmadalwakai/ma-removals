import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import {
  CHECKOUT_PAYMENT_METHOD_TYPES,
  checkoutAttemptIdempotencyKey,
  checkoutSessionExpiryForQuote,
  jsonValue,
  stripeKeyMode,
  stripeMetadataForQuote,
  type QuoteForStripeReconciliation,
} from "@/lib/booking/payment-fulfillment";
import { createQuoteCheckoutSessionSchema } from "@/lib/quotes/schemas";
import { verifyQuoteForCheckout } from "@/lib/quotes/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

async function checkoutSessionState(quote: QuoteForStripeReconciliation & { finalTotalPence: number }) {
  const events = await db.quoteEvent.findMany({
    where: {
      quoteId: quote.id,
      reference: quote.reference,
      type: "stripe_checkout_session_created",
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  let previousCheckoutSessionId: string | null = null;
  for (const event of events) {
    const metadata = asRecord(event.metadata);
    const checkoutSessionId = asString(metadata.checkoutSessionId);
    if (!checkoutSessionId) continue;
    previousCheckoutSessionId ??= checkoutSessionId;

    const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    const sessionQuoteReference = session.metadata?.quoteReference;
    const sessionHash = session.metadata?.serverInputHash;
    const amountMatches = session.amount_total === quote.finalTotalPence;
    const currencyMatches = (session.currency ?? "").toLowerCase() === "gbp";
    const metadataMatches = sessionQuoteReference === quote.reference && sessionHash === quote.serverInputHash;
    const sessionExpiresAt = typeof session.expires_at === "number" ? session.expires_at * 1000 : null;
    const expiryMatches =
      sessionExpiresAt !== null &&
      sessionExpiresAt <= quote.expiresAt.getTime() &&
      sessionExpiresAt > Date.now();
    if (session.status === "open" && session.url && amountMatches && currencyMatches && metadataMatches && expiryMatches) {
      return { reusableUrl: session.url, previousCheckoutSessionId };
    }
  }

  return { reusableUrl: null, previousCheckoutSessionId };
}

export async function POST(req: NextRequest) {
  try {
    const keyMode = stripeKeyMode(process.env.STRIPE_SECRET_KEY);
    if (!keyMode) {
      console.error("Stripe secret key mode is not configured");
      return NextResponse.json({ error: "Stripe checkout unavailable" }, { status: 500 });
    }

    const parsed = createQuoteCheckoutSessionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid Stripe checkout request" }, { status: 400 });
    }

    const quote = await db.quote.findUnique({
      where: { reference: parsed.data.quoteReference },
      select: {
        id: true,
        reference: true,
        status: true,
        expiresAt: true,
        acceptedAt: true,
        finalTotalPence: true,
        customerEmail: true,
        serverInputHash: true,
        competitorSnapshot: true,
        booking: { select: { reference: true } },
      },
    });
    if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    if (quote.booking || quote.status === "CONSUMED") {
      return NextResponse.json({ error: "Quote has already been booked" }, { status: 409 });
    }
    if (quote.expiresAt.getTime() <= Date.now()) {
      await db.quote.update({ where: { id: quote.id }, data: { status: "EXPIRED" } });
      return NextResponse.json({ error: "Quote has expired" }, { status: 410 });
    }
    if (!Number.isSafeInteger(quote.finalTotalPence) || quote.finalTotalPence == null || quote.finalTotalPence <= 0) {
      return NextResponse.json({ error: "Quote amount is unavailable" }, { status: 422 });
    }
    if (quote.status === "MANUAL_REVIEW") {
      return NextResponse.json({ error: "This quote requires team review before payment" }, { status: 422 });
    }

    const now = new Date();
    const sessionExpiry = checkoutSessionExpiryForQuote({ quoteExpiresAt: quote.expiresAt, now });
    if (!sessionExpiry.ok) {
      return NextResponse.json(
        {
          error: "Quote is too close to expiry. Please refresh your quote.",
          code: sessionExpiry.code,
          recoverable: true,
        },
        { status: 409 },
      );
    }

    const existingCheckout = await checkoutSessionState({ ...quote, finalTotalPence: quote.finalTotalPence });
    if (quote.status === "ACCEPTED") {
      if (existingCheckout.reusableUrl) return NextResponse.json({ url: existingCheckout.reusableUrl });
    } else if (quote.status !== "FIXED") {
      return NextResponse.json({ error: "Quote is not payable" }, { status: 422 });
    } else {
      const accepted = await db.quote.updateMany({
        where: {
          id: quote.id,
          status: "FIXED",
          expiresAt: { gt: now },
          finalTotalPence: quote.finalTotalPence,
        },
        data: { status: "ACCEPTED", acceptedAt: quote.acceptedAt ?? now },
      });
      if (accepted.count !== 1) {
        const latest = await db.quote.findUnique({
          where: { id: quote.id },
          select: {
            status: true,
            expiresAt: true,
            finalTotalPence: true,
            booking: { select: { reference: true } },
          },
        });
        const stillPayable =
          latest?.status === "ACCEPTED" &&
          !latest.booking &&
          latest.expiresAt.getTime() > now.getTime() &&
          latest.finalTotalPence === quote.finalTotalPence;
        if (!stillPayable) {
          return NextResponse.json({ error: "Quote changed before checkout" }, { status: 409 });
        }
      }
    }

    const verification = await verifyQuoteForCheckout(quote.reference);
    if (!verification.ok) {
      return NextResponse.json(
        { error: verification.code, reasons: verification.reasons },
        { status: verification.status },
      );
    }

    const quoteForMetadata: QuoteForStripeReconciliation = {
      id: quote.id,
      reference: quote.reference,
      status: "ACCEPTED",
      expiresAt: quote.expiresAt,
      finalTotalPence: verification.finalTotalPence,
      serverInputHash: quote.serverInputHash,
      competitorSnapshot: quote.competitorSnapshot,
    };
    const quoteMetadata = stripeMetadataForQuote(quoteForMetadata);
    const metadata: Record<string, string> = {
      ...quoteMetadata,
      createdAt: now.toISOString(),
      expiresAt: sessionExpiry.expiresAt.toISOString(),
      livemode: keyMode === "live" ? "true" : "false",
    };
    const stripeIdempotencyKey = checkoutAttemptIdempotencyKey({
      quoteReference: quote.reference,
      serverInputHash: quote.serverInputHash,
      previousCheckoutSessionId: existingCheckout.previousCheckoutSessionId,
    });
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: [...CHECKOUT_PAYMENT_METHOD_TYPES],
      client_reference_id: quote.reference,
      customer_email: quote.customerEmail ?? undefined,
      expires_at: sessionExpiry.expiresAtUnix,
      success_url: `${req.nextUrl.origin}/api/booking/checkout-session/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.nextUrl.origin}/book?payment=cancelled&quote=${encodeURIComponent(quote.reference)}`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: verification.finalTotalPence,
            product_data: {
              name: `MA Removals booking ${quote.reference}`,
              description: "Fixed removal quote",
            },
          },
        },
      ],
      metadata,
      payment_intent_data: {
        description: `MA Removals quote ${quote.reference}`,
        statement_descriptor_suffix: "MA REMOVALS",
        metadata,
      },
    }, {
      idempotencyKey: stripeIdempotencyKey,
    });

    await db.quoteEvent.create({
      data: {
        quoteId: quote.id,
        reference: quote.reference,
        type: "stripe_checkout_session_created",
        metadata: jsonValue({
          checkoutSessionId: session.id,
          quoteReference: quote.reference,
          serverInputHash: quote.serverInputHash,
          totalPence: verification.finalTotalPence,
          amountTotal: verification.finalTotalPence,
          currency: "gbp",
          createdAt: now.toISOString(),
          expiresAt: sessionExpiry.expiresAt.toISOString(),
          livemode: session.livemode,
          checkoutAttemptKey: stripeIdempotencyKey,
          previousCheckoutSessionId: existingCheckout.previousCheckoutSessionId,
          pricingAlgorithmVersion: quoteMetadata.pricingAlgorithmVersion,
        }),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout session failed:", error);
    return NextResponse.json({ error: "Unable to start Stripe checkout" }, { status: 500 });
  }
}

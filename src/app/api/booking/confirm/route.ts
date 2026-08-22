import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  fulfillPaidCheckoutSession,
  recordCheckoutSessionFailure,
  stripeEventModeMatchesKey,
  stripeKeyMode,
} from "@/lib/booking/payment-fulfillment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

const AUTHORITATIVE_CHECKOUT_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

function checkoutSessionFromEvent(event: Stripe.Event): Stripe.Checkout.Session | null {
  const object = event.data.object;
  return object && typeof object === "object" && "object" in object && object.object === "checkout.session"
    ? object as Stripe.Checkout.Session
    : null;
}

async function retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  });
}

async function updatePaymentIntentBookingMetadata(params: {
  paymentIntentId: string;
  quoteReference: string;
  bookingRef: string;
}) {
  await stripe.paymentIntents.update(params.paymentIntentId, {
    metadata: {
      quoteReference: params.quoteReference,
      bookingReference: params.bookingRef,
    },
  });
}

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKeyMode(secretKey)) {
    console.error("Stripe secret key mode is not configured");
    return NextResponse.json({ error: "Webhook unavailable" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Stripe webhook signature required" },
      { status: 400 },
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("Stripe webhook secret is not configured");
    return NextResponse.json({ error: "Webhook unavailable" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    console.error("Stripe webhook signature verification failed");
    return NextResponse.json({ error: "Invalid Stripe webhook signature" }, { status: 400 });
  }

  const modeCheck = stripeEventModeMatchesKey({
    eventLivemode: event.livemode,
    secretKey,
  });
  if (!modeCheck.ok) {
    console.error("Stripe webhook mode mismatch:", modeCheck.code);
    return NextResponse.json({ error: "Stripe webhook mode mismatch" }, { status: 400 });
  }

  if (!AUTHORITATIVE_CHECKOUT_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const eventSession = checkoutSessionFromEvent(event);
  if (!eventSession?.id) {
    return NextResponse.json({ error: "Invalid checkout session event" }, { status: 400 });
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await retrieveCheckoutSession(eventSession.id);
  } catch (error) {
    console.error("Unable to retrieve Stripe Checkout Session:", error);
    return NextResponse.json({ error: "Unable to retrieve Checkout Session" }, { status: 500 });
  }

  if (event.type === "checkout.session.async_payment_failed" || event.type === "checkout.session.expired") {
    await recordCheckoutSessionFailure({
      quoteReference: session.metadata?.quoteReference,
      checkoutSessionId: session.id,
      paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
      stripeStatus: session.payment_status,
      reason: event.type,
    });
    return NextResponse.json({
      received: true,
      payment: event.type === "checkout.session.expired" ? "expired" : "failed",
    });
  }

  if (session.payment_status !== "paid") {
    await recordCheckoutSessionFailure({
      quoteReference: session.metadata?.quoteReference,
      checkoutSessionId: session.id,
      paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
      stripeStatus: session.payment_status,
      reason: "checkout_session_not_paid",
    });
    return NextResponse.json({
      received: true,
      payment: "pending",
      checkoutSessionId: session.id,
    });
  }

  const result = await fulfillPaidCheckoutSession({ session });
  if (!result.ok) {
    console.error("Stripe payment reconciliation rejected:", {
      code: result.code,
      reasons: result.reasons,
    });
    return NextResponse.json({
      received: true,
      payment: result.status,
      code: result.code,
      reasons: result.reasons,
    });
  }

  try {
    await updatePaymentIntentBookingMetadata({
      paymentIntentId: result.paymentIntentId,
      quoteReference: result.quoteReference,
      bookingRef: result.bookingRef,
    });
  } catch {
    console.error("Unable to attach booking metadata to PaymentIntent");
    return NextResponse.json({
      received: true,
      payment: result.status,
      bookingRef: result.bookingRef,
      quoteRef: result.quoteReference,
      metadataUpdate: "failed",
    });
  }

  return NextResponse.json({
    received: true,
    payment: result.status,
    bookingRef: result.bookingRef,
    quoteRef: result.quoteReference,
  });
}

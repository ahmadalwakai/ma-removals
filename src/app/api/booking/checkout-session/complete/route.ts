import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.redirect(new URL("/book?payment=missing_session", req.url));
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });
    const quoteReference = session.metadata?.quoteReference;
    const paymentIntent = session.payment_intent;
    const paymentIntentId = typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id;
    const email = session.customer_details?.email ?? session.customer_email ?? "";

    if (!quoteReference || !paymentIntentId) {
      return NextResponse.redirect(new URL("/book?payment=invalid_session", req.url));
    }
    if (session.payment_status !== "paid") {
      return NextResponse.redirect(new URL(`/book?payment=not_paid&quote=${encodeURIComponent(quoteReference)}`, req.url));
    }

    const response = await fetch(new URL("/api/booking/confirm", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteReference,
        paymentIntentId,
        idempotencyKey: `checkout:${session.id.slice(-48)}`,
      }),
    });
    const data = await response.json().catch(() => null) as { bookingRef?: string; error?: string } | null;
    if (!response.ok || !data?.bookingRef) {
      return NextResponse.redirect(new URL(`/book?payment=confirmation_failed&quote=${encodeURIComponent(quoteReference)}`, req.url));
    }

    void email;
    const thankYouUrl = new URL("/thank-you-ma-removals-quote", req.url);
    thankYouUrl.searchParams.set("reference", data.bookingRef);
    return NextResponse.redirect(thankYouUrl);
  } catch (error) {
    console.error("Stripe checkout completion failed:", error);
    return NextResponse.redirect(new URL("/book?payment=error", req.url));
  }
}

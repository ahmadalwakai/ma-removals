import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.redirect(new URL("/book?payment=missing_session", req.url));
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const quoteReference = session.metadata?.quoteReference;
    if (!quoteReference) {
      return NextResponse.redirect(new URL("/book?payment=invalid_session", req.url));
    }

    const quote = await db.quote.findUnique({
      where: { reference: quoteReference },
      select: {
        status: true,
        booking: { select: { reference: true } },
      },
    });

    if (quote?.booking) {
      const thankYouUrl = new URL("/thank-you-ma-removals-quote", req.url);
      thankYouUrl.searchParams.set("reference", quote.booking.reference);
      return NextResponse.redirect(thankYouUrl);
    }

    const bookUrl = new URL("/book", req.url);
    bookUrl.searchParams.set("quote", quoteReference);
    if (session.payment_status === "paid") {
      bookUrl.searchParams.set("payment", "processing");
    } else if (session.status === "expired") {
      bookUrl.searchParams.set("payment", "expired");
    } else if (session.payment_status === "unpaid") {
      bookUrl.searchParams.set("payment", "not_paid");
    } else {
      bookUrl.searchParams.set("payment", "processing");
    }
    return NextResponse.redirect(bookUrl);
  } catch (error) {
    console.error("Stripe checkout completion lookup failed:", error);
    return NextResponse.redirect(new URL("/book?payment=error", req.url));
  }
}

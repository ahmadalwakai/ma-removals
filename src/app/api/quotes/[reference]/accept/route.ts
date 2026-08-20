import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { releaseQuotePromotionReservations } from "@/lib/pricing/promotion-redemptions";
import { acceptQuoteRequestSchema } from "@/lib/quotes/schemas";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const { reference } = await params;
    const body = await req.json();
    const parsed = acceptQuoteRequestSchema.safeParse({ ...body, quoteReference: reference });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid quote acceptance request" }, { status: 400 });
    }

    const quote = await db.quote.findUnique({ where: { reference: parsed.data.quoteReference } });
    if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    if (quote.status === "CONSUMED") return NextResponse.json({ error: "Quote has already been booked" }, { status: 409 });
    if (quote.status === "ACCEPTED") return NextResponse.json({ ok: true, reference: quote.reference });
    if (quote.status !== "FIXED") {
      return NextResponse.json({ error: "This quote requires manual review before booking" }, { status: 422 });
    }
    if (quote.finalTotalPence == null || quote.finalTotalPence <= 0) {
      return NextResponse.json({ error: "Quote amount is unavailable" }, { status: 422 });
    }
    if (quote.expiresAt.getTime() <= Date.now()) {
      await db.quote.update({
        where: { id: quote.id },
        data: { status: "EXPIRED" },
      });
      await releaseQuotePromotionReservations({
        quoteId: quote.id,
        reason: "quote_expired_on_accept",
      });
      return NextResponse.json({ error: "Quote has expired" }, { status: 410 });
    }

    await db.quote.update({
      where: { id: quote.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });

    return NextResponse.json({ ok: true, reference: quote.reference });
  } catch (error) {
    console.error("Quote acceptance failed:", error);
    return NextResponse.json({ error: "Unable to accept quote" }, { status: 500 });
  }
}

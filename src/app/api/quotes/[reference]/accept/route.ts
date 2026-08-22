import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
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
    if (quote.status === "MANUAL_REVIEW") {
      return NextResponse.json({ error: "This quote requires team review before booking" }, { status: 422 });
    }
    if (quote.expiresAt.getTime() <= Date.now()) {
      await db.quote.update({
        where: { id: quote.id },
        data: { status: "EXPIRED" },
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

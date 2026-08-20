import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { quoteEventSchema } from "@/lib/quotes/schemas";

export async function POST(req: NextRequest) {
  try {
    const parsed = quoteEventSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid quote event" }, { status: 400 });
    }

    const quote = parsed.data.reference
      ? await db.quote.findUnique({ where: { reference: parsed.data.reference }, select: { id: true } })
      : null;

    await db.quoteEvent.create({
      data: {
        quoteId: quote?.id ?? null,
        reference: parsed.data.reference ?? null,
        type: parsed.data.type,
        step: parsed.data.step ?? null,
        metadata: parsed.data.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Quote event failed:", error);
    return NextResponse.json({ error: "Unable to record quote event" }, { status: 500 });
  }
}

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const reviewSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    finalTotalPence: z.number().int().positive(),
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("reject"),
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("contact"),
    reason: z.string().trim().min(3).max(500),
  }),
]);

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const quote = await db.quote.findUnique({ where: { id } });
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  const parsed = reviewSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review action" }, { status: 400 });
  }

  if (parsed.data.action === "approve") {
    const before = quote;
    const updated = await db.quote.update({
      where: { id },
      data: {
        status: "FIXED",
        finalTotalPence: parsed.data.finalTotalPence,
        customerBreakdown: [
          {
            key: "manual_reviewed_quote",
            label: "Reviewed fixed quote",
            amountPence: parsed.data.finalTotalPence,
          },
        ],
        internalBreakdown: {
          original: quote.internalBreakdown,
          manualOverride: {
            finalTotalPence: parsed.data.finalTotalPence,
            reason: parsed.data.reason,
            actorId: session.user.id,
            at: new Date().toISOString(),
          },
        },
        manualReviewReasons: [],
      },
    });

    await db.pricingAuditLog.create({
      data: {
        actorId: session.user.id,
        action: "manual_quote_approve",
        entityType: "Quote",
        entityId: quote.id,
        before,
        after: updated,
        reason: parsed.data.reason,
      },
    });

    return NextResponse.json({ quote: updated });
  }

  if (parsed.data.action === "reject") {
    const updated = await db.quote.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectedAt: new Date(),
      },
    });
    await db.pricingAuditLog.create({
      data: {
        actorId: session.user.id,
        action: "manual_quote_reject",
        entityType: "Quote",
        entityId: quote.id,
        before: quote,
        after: updated,
        reason: parsed.data.reason,
      },
    });
    return NextResponse.json({ quote: updated });
  }

  await db.pricingAuditLog.create({
    data: {
      actorId: session.user.id,
      action: "manual_quote_contact_customer",
      entityType: "Quote",
      entityId: quote.id,
      reason: parsed.data.reason,
    },
  });
  return NextResponse.json({ ok: true });
}

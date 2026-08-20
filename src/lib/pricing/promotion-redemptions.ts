import { Prisma } from "@prisma/client";
import crypto from "node:crypto";
import { db } from "@/lib/db";

interface StoredAppliedPromotion {
  source: "campaign" | "code";
  id: string;
  code?: string | null;
  customerLabel: string;
  discountPence: number;
}

function hashIdentity(value: string | undefined | null): string | null {
  if (!value) return null;
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function storedAppliedPromotions(snapshot: unknown): StoredAppliedPromotion[] {
  if (!snapshot || typeof snapshot !== "object") return [];
  const applied = (snapshot as { applied?: unknown }).applied;
  if (!Array.isArray(applied)) return [];
  return applied.filter((entry): entry is StoredAppliedPromotion => {
    if (!entry || typeof entry !== "object") return false;
    const record = entry as Partial<StoredAppliedPromotion>;
    return (
      (record.source === "campaign" || record.source === "code") &&
      typeof record.id === "string" &&
      typeof record.customerLabel === "string" &&
      typeof record.discountPence === "number" &&
      record.discountPence > 0
    );
  });
}

export async function expirePromotionReservations(now = new Date()): Promise<number> {
  const result = await db.promotionRedemption.updateMany({
    where: {
      status: "RESERVED",
      expiresAt: { lte: now },
    },
    data: {
      status: "EXPIRED",
      releasedAt: now,
    },
  });

  return result.count;
}

export async function reserveQuotePromotionReservations(params: {
  quoteId: string;
  reason: string;
}): Promise<number> {
  const quote = await db.quote.findUnique({
    where: { id: params.quoteId },
    select: {
      id: true,
      reference: true,
      customerEmail: true,
      customerPhone: true,
      expiresAt: true,
      promotionSnapshot: true,
    },
  });
  if (!quote || quote.expiresAt.getTime() <= Date.now()) return 0;

  const applied = storedAppliedPromotions(quote.promotionSnapshot);
  if (applied.length === 0) return 0;

  const now = new Date();
  await db.$transaction(async (tx) => {
    for (const promotion of applied) {
      await tx.promotionRedemption.upsert({
        where: { idempotencyKey: `quote:${quote.reference}:${promotion.source}:${promotion.id}` },
        update: {
          status: "RESERVED",
          releasedAt: null,
          expiresAt: quote.expiresAt,
          discountPence: promotion.discountPence,
          metadata: {
            customerLabel: promotion.customerLabel,
            source: promotion.source,
            code: promotion.code ?? null,
            reservationReason: params.reason,
            reservedAt: now.toISOString(),
          } as Prisma.InputJsonValue,
        },
        create: {
          quoteId: quote.id,
          campaignId: promotion.source === "campaign" ? promotion.id : null,
          codeId: promotion.source === "code" ? promotion.id : null,
          idempotencyKey: `quote:${quote.reference}:${promotion.source}:${promotion.id}`,
          customerEmailHash: hashIdentity(quote.customerEmail),
          customerPhoneHash: hashIdentity(quote.customerPhone),
          discountPence: promotion.discountPence,
          status: "RESERVED",
          expiresAt: quote.expiresAt,
          metadata: {
            customerLabel: promotion.customerLabel,
            source: promotion.source,
            code: promotion.code ?? null,
            reservationReason: params.reason,
            reservedAt: now.toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
    }

    await tx.quoteEvent.create({
      data: {
        quoteId: quote.id,
        reference: quote.reference,
        type: "promotion_reservation_reserved",
        metadata: {
          reason: params.reason,
          reservedCount: applied.length,
        } as Prisma.InputJsonValue,
      },
    });
  });

  return applied.length;
}

export async function releaseQuotePromotionReservations(params: {
  quoteId?: string;
  quoteReference?: string;
  reason: string;
  paymentIntentId?: string | null;
}): Promise<{ quoteId: string | null; quoteReference: string | null; releasedCount: number }> {
  const quote = params.quoteId
    ? await db.quote.findUnique({ where: { id: params.quoteId }, select: { id: true, reference: true } })
    : params.quoteReference
      ? await db.quote.findUnique({ where: { reference: params.quoteReference }, select: { id: true, reference: true } })
      : null;

  if (!quote) {
    return {
      quoteId: null,
      quoteReference: params.quoteReference ?? null,
      releasedCount: 0,
    };
  }

  const now = new Date();
  const released = await db.promotionRedemption.updateMany({
    where: {
      quoteId: quote.id,
      status: "RESERVED",
    },
    data: {
      status: "RELEASED",
      releasedAt: now,
      metadata: {
        releaseReason: params.reason,
        paymentIntentId: params.paymentIntentId ?? null,
        releasedAt: now.toISOString(),
      } as Prisma.InputJsonValue,
    },
  });

  if (released.count > 0) {
    await db.quoteEvent.create({
      data: {
        quoteId: quote.id,
        reference: quote.reference,
        type: "promotion_reservation_released",
        metadata: {
          reason: params.reason,
          paymentIntentId: params.paymentIntentId ?? null,
          releasedCount: released.count,
        } as Prisma.InputJsonValue,
      },
    });
  }

  return {
    quoteId: quote.id,
    quoteReference: quote.reference,
    releasedCount: released.count,
  };
}

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email-sender";
import { expirePromotionReservations } from "@/lib/pricing/promotion-redemptions";
import { gbpFormatter } from "@/lib/quotes/schemas";

interface RecoveryOptions {
  send: boolean;
  limit: number;
}

function recoveryHtml(params: {
  customerName: string;
  quoteReference: string;
  totalPence: number;
  expiresAt: Date;
}) {
  const price = gbpFormatter.format(params.totalPence / 100);
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0F172A;">
      <h1 style="font-size:22px;margin:0 0 12px;">Your fixed removals quote is ready</h1>
      <p>Hi ${params.customerName},</p>
      <p>Your quote <strong>${params.quoteReference}</strong> is still available at <strong>${price}</strong>.</p>
      <p>Your price is held until ${params.expiresAt.toLocaleString("en-GB")}.</p>
      <p>You can return to your quote and complete the secure booking when you are ready.</p>
      <p style="font-size:13px;color:#64748B;">You are receiving this because you requested a quote and opted in to follow-up messages.</p>
    </div>
  `;
}

export async function runQuoteRecovery(options: RecoveryOptions) {
  const expiredReservations = await expirePromotionReservations();
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const quotes = await db.quote.findMany({
    where: {
      status: { in: ["FIXED", "ACCEPTED"] },
      finalTotalPence: { not: null },
      customerEmail: { not: null },
      marketingConsent: true,
      expiresAt: { gt: new Date() },
      booking: null,
      OR: [
        { recoveryEvents: { none: {} } },
        { recoveryEvents: { every: { createdAt: { lt: since } } } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: options.limit,
  });

  const results: Array<{ reference: string; status: "eligible" | "sent" | "skipped" }> = [];
  for (const quote of quotes) {
    if (!quote.customerEmail || quote.finalTotalPence == null) {
      results.push({ reference: quote.reference, status: "skipped" });
      continue;
    }

    const event = await db.quoteRecoveryEvent.create({
      data: {
        quoteId: quote.id,
        campaignName: "quote_recovery",
        channel: "email",
        status: options.send ? "sending" : "eligible",
        offerPence: null,
        offerExpiresAt: quote.expiresAt,
        metadata: {
          quoteReference: quote.reference,
          finalTotalPence: quote.finalTotalPence,
        } as Prisma.InputJsonValue,
      },
    });

    if (!options.send) {
      results.push({ reference: quote.reference, status: "eligible" });
      continue;
    }

    await sendEmail({
      to: quote.customerEmail,
      subject: `Your MA Removals quote ${quote.reference}`,
      html: recoveryHtml({
        customerName: quote.customerName ?? "there",
        quoteReference: quote.reference,
        totalPence: quote.finalTotalPence,
        expiresAt: quote.expiresAt,
      }),
    });

    await db.quoteRecoveryEvent.update({
      where: { id: event.id },
      data: { status: "sent", sentAt: new Date() },
    });
    await db.quote.update({
      where: { id: quote.id },
      data: { recoveryStatus: "sent" },
    });
    results.push({ reference: quote.reference, status: "sent" });
  }

  return { count: results.length, expiredReservations, results };
}

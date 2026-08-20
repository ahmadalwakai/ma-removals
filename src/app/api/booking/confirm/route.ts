import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { notifyNewBooking } from "@/lib/notifications";
import { createBookingConversation } from "@/lib/chat-utils";
import { releaseQuotePromotionReservations } from "@/lib/pricing/promotion-redemptions";
import { createTrackingEvent, recordStatusChange } from "@/lib/tracking-utils";
import { sendEmail } from "@/lib/email-sender";
import { bookingConfirmedHtml } from "@/lib/emails/templates";
import { confirmBookingFromQuoteSchema } from "@/lib/quotes/schemas";
import { verifyQuoteForCheckout } from "@/lib/quotes/service";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

const FAILED_PAYMENT_INTENT_STATUSES = new Set(["requires_payment_method", "canceled"]);

function generateRef(): string {
  const year = new Date().getFullYear();
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let ref = "";
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)];
  return `MAR-${year}-${ref}`;
}

type NormalisedQuoteInput = {
  moveType: string;
  moveDate?: string | null;
  arrivalWindow?: "morning" | "afternoon" | "evening" | null;
  customerNote?: string;
  stops: Array<{
    role: "collection" | "delivery" | "additional-stop";
    access: {
      fullAddress: string;
      postcode: string;
      lat: number;
      lng: number;
      floor: number;
      hasLift: boolean;
      accessRestrictions?: string;
      notes?: string;
    };
  }>;
  inventory: Array<{ itemId: string; quantity: number; room: string }>;
  services: {
    packing?: boolean;
    dismantling?: boolean;
    reassembly?: boolean;
  };
};

function isNormalisedQuoteInput(value: unknown): value is NormalisedQuoteInput {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.moveType === "string" && Array.isArray(record.stops);
}

function timeFromWindow(window?: string | null): string {
  if (window === "afternoon") return "13:00";
  if (window === "evening") return "17:00";
  return "09:00";
}

function labelFromMoveType(moveType: string): string {
  return moveType
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function penceToPounds(pence: number): number {
  return Math.round(pence) / 100;
}

function isSameUtcDate(a: Date | null | undefined, b: Date): boolean {
  return a?.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      quoteReference?: string;
      idempotencyKey?: string;
      paymentIntentId: string;
    };
    if (body.quoteReference) {
      const parsed = confirmBookingFromQuoteSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid booking confirmation request" }, { status: 400 });
      }

      const pi = await stripe.paymentIntents.retrieve(parsed.data.paymentIntentId);
      if (pi.status !== "succeeded") {
        if (FAILED_PAYMENT_INTENT_STATUSES.has(pi.status)) {
          await releaseQuotePromotionReservations({
            quoteReference: parsed.data.quoteReference,
            reason: "payment_intent_failed",
            paymentIntentId: pi.id,
          });
          const quote = await db.quote.findUnique({
            where: { reference: parsed.data.quoteReference },
            select: { id: true, reference: true },
          });
          if (quote) {
            await db.quoteEvent.create({
              data: {
                quoteId: quote.id,
                reference: quote.reference,
                type: "payment_failed",
                metadata: {
                  paymentIntentId: pi.id,
                  stripeStatus: pi.status,
                },
              },
            });
          }
        }
        return NextResponse.json({ error: "Payment not confirmed" }, { status: 400 });
      }

      const quote = await db.quote.findUnique({
        where: { reference: parsed.data.quoteReference },
        include: { booking: { select: { reference: true } } },
      });
      if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
      if (quote.booking) return NextResponse.json({ bookingRef: quote.booking.reference });
      if (quote.status === "CONSUMED") {
        const existing = await db.booking.findUnique({
          where: { quoteId: quote.id },
          select: { reference: true },
        });
        if (existing) return NextResponse.json({ bookingRef: existing.reference });
        return NextResponse.json({ error: "Quote has already been consumed" }, { status: 409 });
      }
      if (quote.status !== "ACCEPTED") {
        return NextResponse.json({ error: "Quote must be accepted before booking" }, { status: 422 });
      }
      if (quote.expiresAt.getTime() <= Date.now()) {
        await db.quote.update({ where: { id: quote.id }, data: { status: "EXPIRED" } });
        await releaseQuotePromotionReservations({
          quoteId: quote.id,
          reason: "quote_expired_on_booking_confirm",
          paymentIntentId: pi.id,
        });
        return NextResponse.json({ error: "Quote has expired" }, { status: 410 });
      }
      if (quote.finalTotalPence == null || quote.finalTotalPence <= 0) {
        return NextResponse.json({ error: "Quote amount is unavailable" }, { status: 422 });
      }
      const verification = await verifyQuoteForCheckout(parsed.data.quoteReference);
      if (!verification.ok) {
        await releaseQuotePromotionReservations({
          quoteReference: parsed.data.quoteReference,
          reason: `booking_confirm_blocked_${verification.code.toLowerCase()}`,
          paymentIntentId: pi.id,
        });
        return NextResponse.json(
          { error: verification.code, reasons: verification.reasons },
          { status: verification.status },
        );
      }
      if (pi.amount !== verification.finalTotalPence) {
        return NextResponse.json({ error: "Payment amount does not match accepted quote" }, { status: 409 });
      }
      if (pi.metadata?.quoteReference !== quote.reference) {
        return NextResponse.json({ error: "Payment does not belong to this quote" }, { status: 409 });
      }

      const existingByStripe = await db.booking.findFirst({
        where: { stripePaymentId: pi.id },
        select: { reference: true },
      });
      if (existingByStripe) return NextResponse.json({ bookingRef: existingByStripe.reference });

      const normalised = quote.normalisedInput;
      if (!isNormalisedQuoteInput(normalised)) {
        return NextResponse.json({ error: "Stored quote data is invalid" }, { status: 500 });
      }

      const collection = normalised.stops.find((stop) => stop.role === "collection")?.access;
      const delivery = normalised.stops.find((stop) => stop.role === "delivery")?.access;
      if (!collection || !delivery) {
        return NextResponse.json({ error: "Stored quote addresses are invalid" }, { status: 500 });
      }

      const bookingRef = generateRef();
      const totalPounds = penceToPounds(quote.finalTotalPence);
      const scheduledDate = normalised.moveDate
        ? new Date(`${normalised.moveDate}T12:00:00`)
        : new Date();
      const crew = quote.crewRecommendation as { movers?: number } | null;
      const route = quote.routeMetrics as { distanceMiles?: number } | null;
      const breakdown = Array.isArray(quote.customerBreakdown)
        ? quote.customerBreakdown as Array<{ key: string; amountPence: number }>
        : [];
      const baseLine = breakdown.find((line) => line.key === "base_service_charge");
      const notes = [
        normalised.customerNote,
        collection.accessRestrictions,
        collection.notes,
        delivery.accessRestrictions,
        delivery.notes,
      ].filter(Boolean).join("\n");

      const booking = await db.$transaction(async (tx) => {
        const consumed = await tx.quote.updateMany({
          where: {
            id: quote.id,
            status: "ACCEPTED",
            consumedAt: null,
          },
          data: {
            status: "CONSUMED",
            consumedAt: new Date(),
          },
        });
        if (consumed.count !== 1) {
          const existing = await tx.booking.findUnique({
            where: { quoteId: quote.id },
            select: { reference: true },
          });
          if (existing) return { reference: existing.reference, id: "" };
          throw new Error("Quote was already consumed");
        }

        const user = await tx.user.upsert({
          where: { email: quote.customerEmail ?? "" },
          update: {
            name: quote.customerName,
            phone: quote.customerPhone,
          },
          create: {
            name: quote.customerName,
            email: quote.customerEmail,
            phone: quote.customerPhone,
            role: "CUSTOMER",
          },
        });

        const created = await tx.booking.create({
          data: {
            reference: bookingRef,
            quoteId: quote.id,
            customerId: user.id,
            serviceSlug: normalised.moveType,
            serviceName: labelFromMoveType(normalised.moveType),
            serviceVariant: null,
            status: "CONFIRMED",
            paymentStatus: "PAID",
            pickupAddress: collection.fullAddress,
            pickupPostcode: collection.postcode,
            pickupLat: collection.lat,
            pickupLng: collection.lng,
            pickupFloor: collection.floor,
            pickupHasLift: collection.hasLift,
            dropoffAddress: delivery.fullAddress,
            dropoffPostcode: delivery.postcode,
            dropoffLat: delivery.lat,
            dropoffLng: delivery.lng,
            dropoffFloor: delivery.floor,
            dropoffHasLift: delivery.hasLift,
            distanceMiles: route?.distanceMiles ?? 0,
            scheduledDate,
            scheduledTime: timeFromWindow(normalised.arrivalWindow),
            estimatedHours: (quote.estimatedDurationMinutes ?? 0) / 60,
            basePrice: baseLine ? penceToPounds(baseLine.amountPence) : totalPounds,
            quotedPrice: totalPounds,
            finalPrice: totalPounds,
            totalPaid: penceToPounds(pi.amount),
            isPaid: true,
            stripePaymentId: pi.id,
            helpersCount: Math.max(0, (crew?.movers ?? 1) - 1),
            needsPacking: normalised.services.packing ?? false,
            needsAssembly: Boolean(normalised.services.dismantling || normalised.services.reassembly),
            notes: notes || null,
            items: normalised.inventory.map((item) => ({
              id: item.itemId,
              qty: item.quantity,
              room: item.room,
            })),
          },
        });

        if (normalised.inventory.length > 0) {
          await tx.bookingItem.createMany({
            data: normalised.inventory.map((item) => ({
              bookingId: created.id,
              itemId: item.itemId,
              quantity: item.quantity,
            })),
            skipDuplicates: true,
          });
        }

        await tx.payment.create({
          data: {
            bookingId: created.id,
            stripeId: pi.id,
            amount: penceToPounds(pi.amount),
            currency: "gbp",
            status: pi.status,
          },
        });

        const redemptions = await tx.promotionRedemption.findMany({
          where: { quoteId: quote.id, status: "RESERVED" },
          select: { id: true, campaignId: true, codeId: true, discountPence: true },
        });
        if (redemptions.length > 0) {
          await tx.promotionRedemption.updateMany({
            where: { quoteId: quote.id, status: "RESERVED" },
            data: {
              status: "REDEEMED",
              bookingId: created.id,
              redeemedAt: new Date(),
            },
          });
          for (const redemption of redemptions) {
            if (redemption.campaignId) {
              await tx.promotionCampaign.update({
                where: { id: redemption.campaignId },
                data: {
                  redemptionCount: { increment: 1 },
                  spentBudgetPence: { increment: redemption.discountPence },
                  dailySpentBudgetPence: { increment: redemption.discountPence },
                  dailyBudgetDate: new Date(),
                },
              });
            }
            if (redemption.codeId) {
              await tx.promotionCode.update({
                where: { id: redemption.codeId },
                data: { redemptionCount: { increment: 1 } },
              });
            }
          }
        }

        if (quote.beatCompetitorCampaignId) {
          const today = new Date();
          const campaign = await tx.beatCompetitorCampaign.findUnique({
            where: { id: quote.beatCompetitorCampaignId },
            select: {
              bookingCount: true,
              dailyBookingCount: true,
              dailyBookingDate: true,
              dailyBookingLimit: true,
              totalCampaignBookingLimit: true,
              autoPause: true,
              pausedAt: true,
            },
          });
          if (campaign) {
            const nextTotalCount = campaign.bookingCount + 1;
            const nextDailyCount = isSameUtcDate(campaign.dailyBookingDate, today)
              ? campaign.dailyBookingCount + 1
              : 1;
            const limitReached =
              (campaign.totalCampaignBookingLimit != null && nextTotalCount >= campaign.totalCampaignBookingLimit) ||
              (campaign.dailyBookingLimit != null && nextDailyCount >= campaign.dailyBookingLimit);

            await tx.beatCompetitorCampaign.update({
              where: { id: quote.beatCompetitorCampaignId },
              data: {
                bookingCount: nextTotalCount,
                dailyBookingCount: nextDailyCount,
                dailyBookingDate: today,
                ...(campaign.autoPause && limitReached && !campaign.pausedAt
                  ? {
                      pausedAt: today,
                      pauseReason: "Booking limit reached",
                    }
                  : {}),
              },
            });
          }
        }

        return created;
      });

      await notifyNewBooking(
        booking.reference,
        quote.customerName ?? "Customer",
        totalPounds,
        booking.id || undefined,
      ).catch(() => {});

      if (booking.id) {
        const customer = await db.user.findUnique({ where: { email: quote.customerEmail ?? "" } });
        if (customer) {
          await createBookingConversation(booking.id, customer.id).catch(() => {});
        }

        await recordStatusChange({
          bookingId: booking.id,
          toStatus: "CONFIRMED",
          changedByRole: "SYSTEM",
          note: `Created from accepted quote ${quote.reference}`,
        }).catch(() => {});
        await createTrackingEvent({
          bookingId: booking.id,
          type: "status_change",
          title: "Booking confirmed and payment received",
          description: `Your move is scheduled for ${scheduledDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`,
          isPublic: true,
        }).catch(() => {});
      }

      if (quote.customerEmail) {
        await sendEmail({
          to: quote.customerEmail,
          subject: `Booking Confirmed — ${booking.reference}`,
          html: bookingConfirmedHtml({
            customerName: quote.customerName ?? "there",
            reference: booking.reference,
            serviceName: labelFromMoveType(normalised.moveType),
            scheduledDate: scheduledDate.toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
            scheduledTime: timeFromWindow(normalised.arrivalWindow),
            pickupAddress: collection.fullAddress,
            dropoffAddress: delivery.fullAddress,
            totalPaid: totalPounds,
          }),
        }).catch(() => {});
      }

      return NextResponse.json({ bookingRef: booking.reference, quoteRef: quote.reference });
    }

    return NextResponse.json(
      {
        error: "QUOTE_REQUIRED",
        reasons: [
          "QUOTE_REQUIRED: Booking confirmation must use a server-created quote reference and cannot rely on client priceBreakdown data.",
        ],
      },
      { status: 400 },
    );
  } catch (err) {
    console.error("Confirm booking error:", err);
    return NextResponse.json({ error: "Failed to confirm booking" }, { status: 500 });
  }
}

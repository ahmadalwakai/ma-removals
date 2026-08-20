import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import {
  releaseQuotePromotionReservations,
  reserveQuotePromotionReservations,
} from "@/lib/pricing/promotion-redemptions";
import { createQuotePaymentIntentSchema } from "@/lib/quotes/schemas";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

interface CreatePaymentBody {
  quoteReference?: string;
  idempotencyKey?: string;
  amount: number;
  metadata?: Record<string, string>;
  // Server-side price verification fields
  serviceType?: string;
  serviceVariant?: string;
  distanceMiles?: number;
  pickupFloor?: number;
  pickupHasLift?: boolean;
  dropoffFloor?: number;
  dropoffHasLift?: boolean;
  helpersCount?: number;
  needsPacking?: boolean;
  needsAssembly?: boolean;
  pickupLat?: number;
  pickupLng?: number;
  pickupPostcode?: string;
  pickupRegion?: string;
  pickupCountry?: string;
  pickupFullAddress?: string;
  moveDateFlexible?: boolean;
  selectedDate?: string;
  selectedTimeSlot?: "morning" | "afternoon" | "evening";
  clientTotal?: number;
  items?: Array<{ name?: string; quantity: number; imagePath?: string; weightKg?: number }>;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreatePaymentBody;
    if (body.quoteReference) {
      const parsed = createQuotePaymentIntentSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid quote payment request" }, { status: 400 });
      }

      const quote = await db.quote.findUnique({
        where: { reference: parsed.data.quoteReference },
      });
      if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
      if (quote.status === "CONSUMED") {
        return NextResponse.json({ error: "Quote has already been booked" }, { status: 409 });
      }
      if (quote.status !== "FIXED" && quote.status !== "ACCEPTED") {
        return NextResponse.json({ error: "This quote requires manual review before payment" }, { status: 422 });
      }
      if (quote.expiresAt.getTime() <= Date.now()) {
        await db.quote.update({ where: { id: quote.id }, data: { status: "EXPIRED" } });
        await releaseQuotePromotionReservations({
          quoteId: quote.id,
          reason: "quote_expired_on_payment_intent",
        });
        return NextResponse.json({ error: "Quote has expired" }, { status: 410 });
      }
      if (quote.finalTotalPence == null || quote.finalTotalPence <= 0) {
        return NextResponse.json({ error: "Quote amount is unavailable" }, { status: 422 });
      }

      await reserveQuotePromotionReservations({
        quoteId: quote.id,
        reason: "payment_intent_started",
      });

      if (quote.stripePaymentId) {
        const existingIntent = await stripe.paymentIntents.retrieve(quote.stripePaymentId);
        if (existingIntent.client_secret && existingIntent.amount === quote.finalTotalPence) {
          return NextResponse.json({
            clientSecret: existingIntent.client_secret,
            quoteReference: quote.reference,
          });
        }
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: quote.finalTotalPence,
        currency: "gbp",
        automatic_payment_methods: { enabled: true },
        metadata: {
          quoteReference: quote.reference,
          quoteId: quote.id,
          pricingVersionId: quote.pricingVersionId ?? "",
          promotionCampaignId: quote.promotionCampaignId ?? "",
          promotionCodeId: quote.promotionCodeId ?? "",
        },
        description: `MA Removals quote ${quote.reference}`,
        statement_descriptor_suffix: "MA REMOVALS",
      }, {
        idempotencyKey: `quote:${quote.reference}:${parsed.data.idempotencyKey}`,
      });

      await db.quote.update({
        where: { id: quote.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: quote.acceptedAt ?? new Date(),
          stripePaymentId: paymentIntent.id,
        },
      });

      return NextResponse.json({
        clientSecret: paymentIntent.client_secret,
        quoteReference: quote.reference,
      });
    }

    const {
      amount,
      metadata,
      serviceType,
      serviceVariant,
      distanceMiles,
      pickupFloor,
      pickupHasLift,
      dropoffFloor,
      dropoffHasLift,
      helpersCount,
      needsPacking,
      needsAssembly,
      pickupLat,
      pickupLng,
      pickupPostcode,
      pickupRegion,
      pickupCountry,
      pickupFullAddress,
      moveDateFlexible,
      selectedDate,
      selectedTimeSlot,
      clientTotal,
      items,
    } = body;

    if (!amount || amount < 5) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    let verifiedAmount = Math.round(amount * 100); // pence

    // Server-side price verification when full context is provided
    if (
      serviceType &&
      selectedDate &&
      selectedTimeSlot &&
      typeof clientTotal === "number"
    ) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const calcRes = await fetch(`${baseUrl}/api/pricing/calculate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceType,
            serviceVariant,
            distanceMiles: distanceMiles ?? 0,
            pickupFloor: pickupFloor ?? 0,
            pickupHasLift: pickupHasLift ?? false,
            dropoffFloor: dropoffFloor ?? 0,
            dropoffHasLift: dropoffHasLift ?? false,
            helpersCount: helpersCount ?? 0,
            needsPacking: needsPacking ?? false,
            needsAssembly: needsAssembly ?? false,
            pickupLat: pickupLat ?? 51.5,
            pickupLng: pickupLng ?? -0.1,
            pickupPostcode: pickupPostcode ?? "",
            pickupRegion: pickupRegion ?? "",
            pickupCountry: pickupCountry ?? "",
            pickupFullAddress: pickupFullAddress ?? "",
            moveDateFlexible: moveDateFlexible ?? false,
            items: items ?? [],
          }),
        });

        const calcJson = (await calcRes.json().catch(() => null)) as {
          success?: boolean;
          error?: string;
          data?: {
            days: Array<{
              date: string;
              prices: { morning: number; afternoon: number; evening: number };
            }>;
          };
        } | null;

        if (!calcRes.ok || !calcJson?.success || !calcJson.data) {
          return NextResponse.json(
            { error: calcJson?.error ?? "Unable to verify price. Please go back and try again." },
            { status: calcRes.status === 422 ? 422 : 503 }
          );
        }

        const dayData = calcJson.data.days.find((d) => d.date === selectedDate);
        if (!dayData) {
          return NextResponse.json(
            { error: "Selected date is no longer available. Please choose another date." },
            { status: 422 }
          );
        }

        // Server price is in whole pounds; convert to pence for comparison.
        const serverPricePence = Math.round(dayData.prices[selectedTimeSlot] * 100);
        const clientPricePence = Math.round(clientTotal * 100);
        const diff = Math.abs(serverPricePence - clientPricePence);

        // Allow up to £0.05 (5 pence) for floating-point rounding only.
        if (diff > 5) {
          return NextResponse.json(
            { error: "Price has changed. Please go back and reselect your date." },
            { status: 422 }
          );
        }
        // Use server-authoritative price (pence).
        verifiedAmount = serverPricePence;
      } catch {
        return NextResponse.json(
          { error: "Unable to verify price. Please try again." },
          { status: 503 }
        );
      }
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: verifiedAmount,
      currency: "gbp",
      automatic_payment_methods: { enabled: true },
      metadata: metadata ?? {},
      description: "MA Removals booking",
      statement_descriptor_suffix: "MA REMOVALS",
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error("Stripe create-payment-intent error:", err);
    return NextResponse.json({ error: "Payment setup failed" }, { status: 500 });
  }
}


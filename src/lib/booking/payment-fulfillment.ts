import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { db } from "@/lib/db";

const FAILED_PAYMENT_INTENT_STATUSES = new Set(["requires_payment_method", "canceled"]);
export const CHECKOUT_PAYMENT_METHOD_TYPES = ["card"] as const;
export const STRIPE_CHECKOUT_MIN_EXPIRES_SECONDS = 30 * 60;
export const STRIPE_CHECKOUT_MAX_EXPIRES_SECONDS = 24 * 60 * 60;

type JsonRecord = Record<string, unknown>;

export type StripeKeyMode = "test" | "live";

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

export type QuoteForStripeReconciliation = {
  id: string;
  reference: string;
  status: string;
  expiresAt: Date;
  finalTotalPence: number | null;
  serverInputHash: string;
  competitorSnapshot?: unknown;
};

export type StripePaymentReconciliation =
  | { ok: true; paymentIntentId: string; totalPence: number; currency: "gbp" }
  | { ok: false; code: string; reasons: string[]; paymentIntentId?: string };

export type FulfillPaidCheckoutSessionResult =
  | {
      ok: true;
      status: "fulfilled" | "already_fulfilled" | "duplicate_successful_payment";
      bookingRef: string;
      bookingId?: string;
      quoteReference: string;
      paymentIntentId: string;
      finalTotalPence: number;
    }
  | {
      ok: false;
      status: "rejected" | "pending";
      code: string;
      reasons: string[];
      quoteReference?: string;
      paymentIntentId?: string;
    };

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function unixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

function sessionUnixTime(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function stripeKeyMode(secretKey: string | null | undefined): StripeKeyMode | null {
  const key = secretKey?.trim() ?? "";
  if (/^(sk|rk)_test_/.test(key)) return "test";
  if (/^(sk|rk)_live_/.test(key)) return "live";
  return null;
}

export function stripeEventModeMatchesKey(params: {
  eventLivemode: boolean;
  secretKey: string | null | undefined;
}):
  | { ok: true; mode: StripeKeyMode }
  | { ok: false; code: "STRIPE_SECRET_KEY_MODE_UNKNOWN" | "STRIPE_WEBHOOK_MODE_MISMATCH" } {
  const mode = stripeKeyMode(params.secretKey);
  if (!mode) return { ok: false, code: "STRIPE_SECRET_KEY_MODE_UNKNOWN" };
  if (params.eventLivemode !== (mode === "live")) {
    return { ok: false, code: "STRIPE_WEBHOOK_MODE_MISMATCH" };
  }
  return { ok: true, mode };
}

export function checkoutSessionExpiryForQuote(params: {
  quoteExpiresAt: Date;
  now?: Date;
}):
  | { ok: true; expiresAt: Date; expiresAtUnix: number; remainingSeconds: number }
  | { ok: false; code: "QUOTE_REFRESH_REQUIRED"; remainingSeconds: number } {
  const now = params.now ?? new Date();
  const remainingSeconds = Math.floor((params.quoteExpiresAt.getTime() - now.getTime()) / 1000);
  if (remainingSeconds < STRIPE_CHECKOUT_MIN_EXPIRES_SECONDS) {
    return { ok: false, code: "QUOTE_REFRESH_REQUIRED", remainingSeconds };
  }

  const ttlSeconds = Math.min(remainingSeconds, STRIPE_CHECKOUT_MAX_EXPIRES_SECONDS);
  const expiresAtUnix = unixSeconds(new Date(now.getTime() + ttlSeconds * 1000));
  return {
    ok: true,
    expiresAt: new Date(expiresAtUnix * 1000),
    expiresAtUnix,
    remainingSeconds,
  };
}

function checkoutSessionExpiryUnix(session: Stripe.Checkout.Session): number | null {
  return sessionUnixTime(session.expires_at);
}

function checkoutSessionCreatedUnix(session: Stripe.Checkout.Session): number | null {
  return sessionUnixTime(session.created);
}

function checkoutSessionIsBoundedByQuote(session: Stripe.Checkout.Session, quote: QuoteForStripeReconciliation): boolean {
  const sessionExpiresAt = checkoutSessionExpiryUnix(session);
  if (sessionExpiresAt === null) return false;
  return sessionExpiresAt <= unixSeconds(quote.expiresAt);
}

function duplicatePaymentIncidentId(quoteId: string, paymentIntentId: string): string {
  const digest = crypto
    .createHash("sha256")
    .update(`${quoteId}:${paymentIntentId}`)
    .digest("hex")
    .slice(0, 24);
  return `dup_pay_${digest}`;
}

export function checkoutAttemptIdempotencyKey(params: {
  quoteReference: string;
  serverInputHash: string;
  previousCheckoutSessionId?: string | null;
}): string {
  const attemptMarker = params.previousCheckoutSessionId
    ? `after:${params.previousCheckoutSessionId}`
    : "initial";
  return `checkout:${params.quoteReference}:${params.serverInputHash}:${attemptMarker}`;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isNormalisedQuoteInput(value: unknown): value is NormalisedQuoteInput {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.moveType === "string" && Array.isArray(record.stops);
}

function generateRef(): string {
  const year = new Date().getFullYear();
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let ref = "";
  for (let index = 0; index < 6; index += 1) ref += chars[Math.floor(Math.random() * chars.length)];
  return `MAR-${year}-${ref}`;
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

function pricingAlgorithmVersion(quote: QuoteForStripeReconciliation): string | null {
  return asString(asRecord(quote.competitorSnapshot).pricingAlgorithmVersion);
}

function paymentIntentFromSession(session: Stripe.Checkout.Session): Stripe.PaymentIntent | null {
  const value = session.payment_intent;
  return value && typeof value === "object" && "id" in value ? value as Stripe.PaymentIntent : null;
}

function paymentIntentIdFromSession(session: Stripe.Checkout.Session): string | null {
  const value = session.payment_intent;
  if (typeof value === "string") return value;
  return value && typeof value === "object" && "id" in value ? value.id : null;
}

function successfulPaymentAmountPence(paymentIntent: Stripe.PaymentIntent): number {
  return paymentIntent.amount_received > 0 ? paymentIntent.amount_received : paymentIntent.amount;
}

export function stripeMetadataForQuote(quote: QuoteForStripeReconciliation): Record<string, string> {
  return {
    quoteReference: quote.reference,
    quoteId: quote.id,
    serverInputHash: quote.serverInputHash,
    totalPence: quote.finalTotalPence == null ? "" : String(quote.finalTotalPence),
    currency: "gbp",
    pricingAlgorithmVersion: pricingAlgorithmVersion(quote) ?? "",
  };
}

export function reconcilePaidCheckoutSession(params: {
  session: Stripe.Checkout.Session;
  paymentIntent: Stripe.PaymentIntent;
  quote: QuoteForStripeReconciliation;
  now?: Date;
}): StripePaymentReconciliation {
  const { session, paymentIntent, quote } = params;
  const reasons: string[] = [];
  const quoteReference = session.metadata?.quoteReference;
  const sessionQuoteId = session.metadata?.quoteId;
  const sessionHash = session.metadata?.serverInputHash;
  const sessionPricingVersion = session.metadata?.pricingAlgorithmVersion;
  const sessionTotalPence = session.metadata?.totalPence;
  const intentQuoteReference = paymentIntent.metadata?.quoteReference;
  const intentQuoteId = paymentIntent.metadata?.quoteId;
  const intentHash = paymentIntent.metadata?.serverInputHash;
  const intentPricingVersion = paymentIntent.metadata?.pricingAlgorithmVersion;
  const intentTotalPence = paymentIntent.metadata?.totalPence;
  const expectedPricingVersion = pricingAlgorithmVersion(quote);
  const sessionExpiresAt = checkoutSessionExpiryUnix(session);
  const sessionCreatedAt = checkoutSessionCreatedUnix(session);
  const quoteExpiryUnix = unixSeconds(quote.expiresAt);

  if (quote.status !== "ACCEPTED" && quote.status !== "CONSUMED") reasons.push("QUOTE_NOT_PAYABLE");
  if (session.status === "expired") reasons.push("SESSION_EXPIRED");
  if (sessionExpiresAt !== null && sessionExpiresAt > quoteExpiryUnix) {
    reasons.push("SESSION_EXPIRES_AFTER_QUOTE");
  }
  if (sessionCreatedAt !== null && sessionCreatedAt >= quoteExpiryUnix) {
    reasons.push("SESSION_CREATED_AFTER_QUOTE_EXPIRY");
  }
  if (
    quote.expiresAt.getTime() <= (params.now ?? new Date()).getTime() &&
    quote.status !== "CONSUMED" &&
    !checkoutSessionIsBoundedByQuote(session, quote)
  ) {
    reasons.push("QUOTE_EXPIRED");
  }
  if (!Number.isSafeInteger(quote.finalTotalPence) || (quote.finalTotalPence ?? 0) <= 0) {
    reasons.push("QUOTE_TOTAL_UNAVAILABLE");
  }
  if (session.payment_status !== "paid") reasons.push("SESSION_NOT_PAID");
  if (paymentIntent.status !== "succeeded") reasons.push("PAYMENT_INTENT_NOT_SUCCEEDED");
  if (!Number.isSafeInteger(session.amount_total) || session.amount_total !== quote.finalTotalPence) {
    reasons.push("SESSION_AMOUNT_MISMATCH");
  }
  if ((session.currency ?? "").toLowerCase() !== "gbp") reasons.push("SESSION_CURRENCY_MISMATCH");
  if (successfulPaymentAmountPence(paymentIntent) !== quote.finalTotalPence) {
    reasons.push("PAYMENT_INTENT_AMOUNT_MISMATCH");
  }
  if ((paymentIntent.currency ?? "").toLowerCase() !== "gbp") reasons.push("PAYMENT_INTENT_CURRENCY_MISMATCH");
  if (quoteReference !== quote.reference || intentQuoteReference !== quote.reference) {
    reasons.push("QUOTE_REFERENCE_METADATA_MISMATCH");
  }
  if (sessionQuoteId && sessionQuoteId !== quote.id) reasons.push("QUOTE_ID_METADATA_MISMATCH");
  if (intentQuoteId && intentQuoteId !== quote.id) reasons.push("PAYMENT_INTENT_QUOTE_ID_METADATA_MISMATCH");
  if (sessionHash && sessionHash !== quote.serverInputHash) reasons.push("SERVER_INPUT_HASH_METADATA_MISMATCH");
  if (intentHash && intentHash !== quote.serverInputHash) reasons.push("PAYMENT_INTENT_HASH_METADATA_MISMATCH");
  if (sessionTotalPence && Number(sessionTotalPence) !== quote.finalTotalPence) {
    reasons.push("TOTAL_PENCE_METADATA_MISMATCH");
  }
  if (intentTotalPence && Number(intentTotalPence) !== quote.finalTotalPence) {
    reasons.push("PAYMENT_INTENT_TOTAL_PENCE_METADATA_MISMATCH");
  }
  if (expectedPricingVersion && sessionPricingVersion && sessionPricingVersion !== expectedPricingVersion) {
    reasons.push("PRICING_VERSION_METADATA_MISMATCH");
  }
  if (expectedPricingVersion && intentPricingVersion && intentPricingVersion !== expectedPricingVersion) {
    reasons.push("PAYMENT_INTENT_PRICING_VERSION_METADATA_MISMATCH");
  }

  if (reasons.length > 0) {
    return { ok: false, code: reasons[0] ?? "PAYMENT_RECONCILIATION_FAILED", reasons, paymentIntentId: paymentIntent.id };
  }

  return { ok: true, paymentIntentId: paymentIntent.id, totalPence: quote.finalTotalPence!, currency: "gbp" };
}

export async function recordCheckoutSessionFailure(params: {
  quoteReference?: string | null;
  checkoutSessionId: string;
  paymentIntentId?: string | null;
  stripeStatus: string;
  reason: string;
}) {
  const quote = params.quoteReference
    ? await db.quote.findUnique({
        where: { reference: params.quoteReference },
        select: { id: true, reference: true },
      })
    : null;

  await db.quoteEvent.create({
    data: {
      quoteId: quote?.id ?? null,
      reference: quote?.reference ?? params.quoteReference ?? null,
      type: "payment_failed",
      metadata: {
        checkoutSessionId: params.checkoutSessionId,
        paymentIntentId: params.paymentIntentId ?? null,
        stripeStatus: params.stripeStatus,
        reason: params.reason,
      },
    },
  });
}

async function recordDuplicateSuccessfulPayment(params: {
  quoteId: string;
  quoteReference: string;
  bookingRef: string;
  checkoutSessionId: string;
  paymentIntentId: string;
  amountPence: number;
}) {
  let createdIncident = false;
  try {
    await db.quoteEvent.create({
      data: {
        id: duplicatePaymentIncidentId(params.quoteId, params.paymentIntentId),
        quoteId: params.quoteId,
        reference: params.quoteReference,
        type: "duplicate_successful_payment",
        metadata: {
          bookingRef: params.bookingRef,
          checkoutSessionId: params.checkoutSessionId,
          paymentIntentId: params.paymentIntentId,
          amountPence: params.amountPence,
          currency: "gbp",
        },
      },
    });
    createdIncident = true;
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
  }

  if (!createdIncident) return;

  await db.adminNotification.create({
    data: {
      type: "duplicate_payment",
      title: "Duplicate successful Stripe payment",
      body: `${params.quoteReference} has an extra successful payment ${params.paymentIntentId}. Review in Stripe before refunding.`,
      href: "/admin/bookings",
      metadata: {
        quoteReference: params.quoteReference,
        bookingRef: params.bookingRef,
        checkoutSessionId: params.checkoutSessionId,
        paymentIntentId: params.paymentIntentId,
        amountPence: params.amountPence,
      },
    },
  }).catch(() => {});
}

async function recordPostCommitSideEffectFailure(params: {
  quoteId: string;
  quoteReference: string;
  bookingId?: string | null;
  bookingRef: string;
  paymentIntentId: string;
  sideEffect: string;
  error: unknown;
}) {
  const errorRecord = params.error instanceof Error
    ? { name: params.error.name, message: params.error.message.slice(0, 500) }
    : { name: "UnknownError", message: String(params.error).slice(0, 500) };

  try {
    await db.quoteEvent.create({
      data: {
        quoteId: params.quoteId,
        reference: params.quoteReference,
        type: "post_commit_side_effect_failed",
        metadata: jsonValue({
          bookingId: params.bookingId ?? null,
          bookingRef: params.bookingRef,
          paymentIntentId: params.paymentIntentId,
          sideEffect: params.sideEffect,
          error: errorRecord,
        }),
      },
    });
  } catch (logError) {
    console.error("Failed to persist post-commit side effect failure", {
      quoteReference: params.quoteReference,
      bookingRef: params.bookingRef,
      sideEffect: params.sideEffect,
      error: logError,
    });
  }
}

async function runPostCommitSideEffect(params: {
  quoteId: string;
  quoteReference: string;
  bookingId?: string | null;
  bookingRef: string;
  paymentIntentId: string;
  sideEffect: string;
  effect: () => Promise<unknown>;
}) {
  try {
    await params.effect();
  } catch (error) {
    console.error("Post-commit booking side effect failed", {
      quoteReference: params.quoteReference,
      bookingRef: params.bookingRef,
      sideEffect: params.sideEffect,
      error,
    });
    await recordPostCommitSideEffectFailure({ ...params, error });
  }
}

export async function fulfillPaidCheckoutSession(params: {
  session: Stripe.Checkout.Session;
  now?: Date;
}): Promise<FulfillPaidCheckoutSessionResult> {
  const { session } = params;
  const paymentIntent = paymentIntentFromSession(session);
  const paymentIntentId = paymentIntent?.id ?? paymentIntentIdFromSession(session) ?? undefined;
  const quoteReference = session.metadata?.quoteReference;

  if (!quoteReference) {
    return {
      ok: false,
      status: "rejected",
      code: "QUOTE_REFERENCE_MISSING",
      reasons: ["Checkout Session metadata is missing quoteReference"],
      paymentIntentId,
    };
  }

  if (!paymentIntent) {
    return {
      ok: false,
      status: "pending",
      code: "PAYMENT_INTENT_NOT_EXPANDED",
      reasons: ["Checkout Session payment_intent must be expanded before fulfillment"],
      quoteReference,
      paymentIntentId,
    };
  }

  if (FAILED_PAYMENT_INTENT_STATUSES.has(paymentIntent.status)) {
    await recordCheckoutSessionFailure({
      quoteReference,
      checkoutSessionId: session.id,
      paymentIntentId: paymentIntent.id,
      stripeStatus: paymentIntent.status,
      reason: paymentIntent.status,
    });
    return {
      ok: false,
      status: "rejected",
      code: "PAYMENT_FAILED",
      reasons: [`PaymentIntent status ${paymentIntent.status}`],
      quoteReference,
      paymentIntentId: paymentIntent.id,
    };
  }

  const quote = await db.quote.findUnique({
    where: { reference: quoteReference },
    include: { booking: { select: { id: true, reference: true, stripePaymentId: true } } },
  });
  if (!quote) {
    return {
      ok: false,
      status: "rejected",
      code: "QUOTE_NOT_FOUND",
      reasons: ["Quote not found"],
      quoteReference,
      paymentIntentId: paymentIntent.id,
    };
  }

  const reconciliation = reconcilePaidCheckoutSession({
    session,
    paymentIntent,
    quote,
    now: params.now,
  });
  if (!reconciliation.ok) {
    await db.quoteEvent.create({
      data: {
        quoteId: quote.id,
        reference: quote.reference,
        type: "payment_reconciliation_failed",
        metadata: {
          checkoutSessionId: session.id,
          paymentIntentId: paymentIntent.id,
          reasons: reconciliation.reasons,
          sessionAmountTotal: session.amount_total,
          sessionCurrency: session.currency,
          paymentIntentAmount: successfulPaymentAmountPence(paymentIntent),
          paymentIntentCurrency: paymentIntent.currency,
        },
      },
    });
    return {
      ok: false,
      status: "rejected",
      code: reconciliation.code,
      reasons: reconciliation.reasons,
      quoteReference: quote.reference,
      paymentIntentId: paymentIntent.id,
    };
  }

  if (quote.booking) {
    if (quote.booking.stripePaymentId !== paymentIntent.id) {
      await recordDuplicateSuccessfulPayment({
        quoteId: quote.id,
        quoteReference: quote.reference,
        bookingRef: quote.booking.reference,
        checkoutSessionId: session.id,
        paymentIntentId: paymentIntent.id,
        amountPence: reconciliation.totalPence,
      });
      return {
        ok: true,
        status: "duplicate_successful_payment",
        bookingRef: quote.booking.reference,
        bookingId: quote.booking.id,
        quoteReference: quote.reference,
        paymentIntentId: paymentIntent.id,
        finalTotalPence: reconciliation.totalPence,
      };
    }

    return {
      ok: true,
      status: "already_fulfilled",
      bookingRef: quote.booking.reference,
      bookingId: quote.booking.id,
      quoteReference: quote.reference,
      paymentIntentId: paymentIntent.id,
      finalTotalPence: reconciliation.totalPence,
    };
  }

  const normalised = quote.normalisedInput;
  if (!isNormalisedQuoteInput(normalised)) {
    return {
      ok: false,
      status: "rejected",
      code: "STORED_QUOTE_DATA_INVALID",
      reasons: ["Stored quote data is invalid"],
      quoteReference: quote.reference,
      paymentIntentId: paymentIntent.id,
    };
  }

  const collection = normalised.stops.find((stop) => stop.role === "collection")?.access;
  const delivery = normalised.stops.find((stop) => stop.role === "delivery")?.access;
  if (!collection || !delivery) {
    return {
      ok: false,
      status: "rejected",
      code: "STORED_QUOTE_ADDRESSES_INVALID",
      reasons: ["Stored quote addresses are invalid"],
      quoteReference: quote.reference,
      paymentIntentId: paymentIntent.id,
    };
  }

  const bookingRef = generateRef();
  const totalPounds = penceToPounds(reconciliation.totalPence);
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
        finalTotalPence: reconciliation.totalPence,
      },
      data: {
        status: "CONSUMED",
        consumedAt: new Date(),
        stripePaymentId: paymentIntent.id,
      },
    });
    if (consumed.count !== 1) {
      const existing = await tx.booking.findUnique({
        where: { quoteId: quote.id },
        select: { id: true, reference: true, stripePaymentId: true },
      });
      if (existing) return existing;
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
        totalPaid: penceToPounds(successfulPaymentAmountPence(paymentIntent)),
        isPaid: true,
        stripePaymentId: paymentIntent.id,
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
        stripeId: paymentIntent.id,
        amount: penceToPounds(successfulPaymentAmountPence(paymentIntent)),
        currency: "gbp",
        status: paymentIntent.status,
      },
    });

    await tx.quoteEvent.create({
      data: {
        quoteId: quote.id,
        reference: quote.reference,
        type: "payment_fulfilled",
        metadata: {
          checkoutSessionId: session.id,
          paymentIntentId: paymentIntent.id,
          amountPence: reconciliation.totalPence,
          currency: "gbp",
          bookingRef: created.reference,
        },
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

  const sideEffectContext = {
    quoteId: quote.id,
    quoteReference: quote.reference,
    bookingId: booking.id || null,
    bookingRef: booking.reference,
    paymentIntentId: paymentIntent.id,
  };

  try {
    const [
      { createBookingConversation },
      { sendEmail },
      { bookingConfirmedHtml },
      { notifyNewBooking },
      { createTrackingEvent, recordStatusChange },
    ] = await Promise.all([
      import("@/lib/chat-utils"),
      import("@/lib/email-sender"),
      import("@/lib/emails/templates"),
      import("@/lib/notifications"),
      import("@/lib/tracking-utils"),
    ]);

    await runPostCommitSideEffect({
      ...sideEffectContext,
      sideEffect: "admin_notification",
      effect: () => notifyNewBooking(
        booking.reference,
        quote.customerName ?? "Customer",
        totalPounds,
        booking.id || undefined,
      ),
    });

    if (booking.id) {
      await runPostCommitSideEffect({
        ...sideEffectContext,
        sideEffect: "booking_conversation",
        effect: async () => {
          const customer = await db.user.findUnique({ where: { email: quote.customerEmail ?? "" } });
          if (customer) await createBookingConversation(booking.id!, customer.id);
        },
      });

      await runPostCommitSideEffect({
        ...sideEffectContext,
        sideEffect: "status_history",
        effect: () => recordStatusChange({
          bookingId: booking.id!,
          toStatus: "CONFIRMED",
          changedByRole: "SYSTEM",
          note: `Created from accepted quote ${quote.reference}`,
        }),
      });
      await runPostCommitSideEffect({
        ...sideEffectContext,
        sideEffect: "tracking_event",
        effect: () => createTrackingEvent({
          bookingId: booking.id!,
          type: "status_change",
          title: "Booking confirmed and payment received",
          description: `Your move is scheduled for ${scheduledDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`,
          isPublic: true,
        }),
      });
    }

    if (quote.customerEmail) {
      await runPostCommitSideEffect({
        ...sideEffectContext,
        sideEffect: "customer_email",
        effect: () => sendEmail({
          to: quote.customerEmail!,
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
        }),
      });
    }
  } catch (error) {
    await recordPostCommitSideEffectFailure({
      ...sideEffectContext,
      sideEffect: "side_effect_module_load",
      error,
    });
  }

  return {
    ok: true,
    status: "fulfilled",
    bookingRef: booking.reference,
    bookingId: booking.id || undefined,
    quoteReference: quote.reference,
    paymentIntentId: paymentIntent.id,
    finalTotalPence: reconciliation.totalPence,
  };
}

export function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { notifyManualReviewQuote } from "@/lib/notifications";
import {
  calculateCanonicalQuotePricing,
  PRICING_ALGORITHM_VERSION,
  stableHash,
  type CanonicalPricingDependencies,
} from "@/lib/quotes/canonical-pricing";
import type { CreateQuoteRequest } from "@/lib/quotes/schemas";

export class QuoteInputError extends Error {
  status = 400;
}

export interface CustomerQuoteResponse {
  reference: string;
  status: "FIXED" | "MANUAL_REVIEW" | "ACCEPTED" | "EXPIRED" | "REJECTED";
  pricingVersion: number | null;
  pricingAlgorithmVersion: string | null;
  competitorBenchmarkId: string | null;
  benchmarkPricePence: number | null;
  serverInputHash: string | null;
  totalPence: number | null;
  originalTotalPence: number | null;
  discountTotalPence: number;
  savingPercent: number | null;
  explanation: string | null;
  expiresAt: string;
  routeMileage: number | null;
  estimatedDurationMinutes: number | null;
  vehicle: {
    name: string | null;
    multipleVehiclesRequired: boolean;
    multipleTripsLikely: boolean;
  };
  crew: {
    movers: number;
    loadingMinutes: number;
    unloadingMinutes: number;
    travelMinutes: number;
    totalJobMinutes: number;
  };
  inventory: {
    totalVolumeM3: number;
    totalWeightKg: number;
    itemUnits: number;
    fragileItemCount: number;
    heavyOrSpecialItemCount: number;
  };
  breakdown: Array<{ key: string; label: string; amountPence: number }>;
  manualReviewReasons: string[];
}

interface StoredQuoteForResponse {
  reference: string;
  status: string;
  expiresAt: Date;
  routeMetrics: unknown;
  estimatedDurationMinutes: number | null;
  manualReviewReasons: string[];
  competitorBenchmarkId?: string | null;
  competitorSnapshot?: unknown;
  serverInputHash?: string | null;
  finalTotalPence?: number | null;
  originalTotalPence?: number | null;
  discountTotalPence?: number | null;
  vehicleRecommendation?: unknown;
  crewRecommendation?: unknown;
  inventorySnapshot?: unknown;
  customerBreakdown?: unknown;
}

interface QuotePersistenceClient {
  quote: {
    findUnique(args: unknown): Promise<StoredQuoteForResponse | { id: string } | null>;
    create(args: unknown): Promise<StoredQuoteForResponse>;
  };
}

export interface CreateQuoteOptions {
  dbClient?: QuotePersistenceClient;
  pricingDependencies?: CanonicalPricingDependencies;
  notifyManualReview?: typeof notifyManualReviewQuote;
  now?: Date;
}

function generateQuoteReference(now = new Date()): string {
  const year = now.getFullYear();
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let index = 0; index < 6; index += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `MAQ-${year}-${suffix}`;
}

async function resolveQuoteReference(
  dbClient: QuotePersistenceClient,
  requestedReference: string | undefined,
  now: Date
): Promise<string> {
  if (requestedReference) {
    const existing = await dbClient.quote.findUnique({
      where: { reference: requestedReference },
      select: { id: true },
    });
    if (!existing) return requestedReference;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reference = generateQuoteReference(now);
    const existing = await dbClient.quote.findUnique({
      where: { reference },
      select: { id: true },
    });
    if (!existing) return reference;
  }

  return generateQuoteReference(now);
}

function parseMoveDate(input: CreateQuoteRequest): Date | null {
  if (!input.moveDate) return null;
  const date = new Date(`${input.moveDate}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toNullableJsonValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null || value === undefined ? Prisma.JsonNull : toJsonValue(value);
}

function responseStatus(status: string): CustomerQuoteResponse["status"] {
  if (
    status === "FIXED" ||
    status === "MANUAL_REVIEW" ||
    status === "ACCEPTED" ||
    status === "EXPIRED" ||
    status === "REJECTED"
  ) {
    return status;
  }
  return "MANUAL_REVIEW";
}

function responseFromQuote(quote: StoredQuoteForResponse): CustomerQuoteResponse {
  const routeMetrics = quote.routeMetrics && typeof quote.routeMetrics === "object"
    ? quote.routeMetrics as { distanceMiles?: number | null }
    : null;
  const competitorSnapshot = asRecord(quote.competitorSnapshot);
  const benchmarkSnapshot = asRecord(competitorSnapshot?.benchmark);
  const benchmarkPricePence = asNumber(benchmarkSnapshot?.benchmarkPricePence);
  const vehicleRecommendation = asRecord(quote.vehicleRecommendation);
  const crewRecommendation = asRecord(quote.crewRecommendation);
  const inventorySnapshot = asRecord(quote.inventorySnapshot);
  const inventorySummary = asRecord(inventorySnapshot?.summary);
  const customerBreakdown = Array.isArray(quote.customerBreakdown)
    ? quote.customerBreakdown.flatMap((entry) => {
        const record = asRecord(entry);
        const key = asString(record?.key);
        const label = asString(record?.label);
        const amountPence = asNumber(record?.amountPence);
        return key && label && amountPence !== null ? [{ key, label, amountPence }] : [];
      })
    : [];

  return {
    reference: quote.reference,
    status: responseStatus(quote.status),
    pricingVersion: null,
    pricingAlgorithmVersion: asString(competitorSnapshot?.pricingAlgorithmVersion),
    competitorBenchmarkId: quote.competitorBenchmarkId ?? null,
    benchmarkPricePence,
    serverInputHash: quote.serverInputHash ?? null,
    totalPence: quote.finalTotalPence ?? null,
    originalTotalPence: quote.originalTotalPence ?? quote.finalTotalPence ?? null,
    discountTotalPence: quote.discountTotalPence ?? 0,
    savingPercent: typeof quote.finalTotalPence === "number" && typeof benchmarkPricePence === "number" && benchmarkPricePence > 0
      ? Math.max(0, Math.round(((benchmarkPricePence - quote.finalTotalPence) / benchmarkPricePence) * 100))
      : null,
    explanation: asString(competitorSnapshot?.explanation),
    expiresAt: quote.expiresAt.toISOString(),
    routeMileage: routeMetrics?.distanceMiles ?? null,
    estimatedDurationMinutes: quote.estimatedDurationMinutes,
    vehicle: {
      name: asString(vehicleRecommendation?.name),
      multipleVehiclesRequired: asBoolean(vehicleRecommendation?.multipleVehiclesRequired) ?? false,
      multipleTripsLikely: asBoolean(vehicleRecommendation?.multipleTripsLikely) ?? false,
    },
    crew: {
      movers: asNumber(crewRecommendation?.movers) ?? 1,
      loadingMinutes: asNumber(crewRecommendation?.loadingMinutes) ?? 0,
      unloadingMinutes: asNumber(crewRecommendation?.unloadingMinutes) ?? 0,
      travelMinutes: asNumber(crewRecommendation?.travelMinutes) ?? 0,
      totalJobMinutes: asNumber(crewRecommendation?.totalJobMinutes) ?? 0,
    },
    inventory: {
      totalVolumeM3: asNumber(inventorySummary?.totalVolumeM3) ?? 0,
      totalWeightKg: asNumber(inventorySummary?.totalWeightKg) ?? 0,
      itemUnits: asNumber(inventorySummary?.itemUnits) ?? asNumber(inventorySummary?.totalUnits) ?? 0,
      fragileItemCount: asNumber(inventorySummary?.fragileItemCount) ?? 0,
      heavyOrSpecialItemCount: asNumber(inventorySummary?.heavyOrSpecialItemCount) ?? 0,
    },
    breakdown: customerBreakdown,
    manualReviewReasons: quote.manualReviewReasons,
  };
}

export async function getQuoteForCustomer(reference: string): Promise<CustomerQuoteResponse | null> {
  const quote = await db.quote.findUnique({
    where: { reference },
    select: {
      reference: true,
      status: true,
      expiresAt: true,
      routeMetrics: true,
      estimatedDurationMinutes: true,
      manualReviewReasons: true,
      competitorBenchmarkId: true,
      competitorSnapshot: true,
      serverInputHash: true,
      finalTotalPence: true,
      originalTotalPence: true,
      discountTotalPence: true,
      vehicleRecommendation: true,
      crewRecommendation: true,
      inventorySnapshot: true,
      customerBreakdown: true,
    },
  });
  return quote ? responseFromQuote(quote) : null;
}

export async function createQuote(
  input: CreateQuoteRequest,
  options: CreateQuoteOptions = {}
): Promise<CustomerQuoteResponse> {
  const now = options.now ?? new Date();
  const dbClient = (options.dbClient ?? db) as unknown as QuotePersistenceClient;
  const notifyManualReview = options.notifyManualReview ?? notifyManualReviewQuote;
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const reference = await resolveQuoteReference(dbClient, input.reference, now);

  if (input.idempotencyKey) {
    const existing = await dbClient.quote.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: {
        reference: true,
        status: true,
        expiresAt: true,
        routeMetrics: true,
        estimatedDurationMinutes: true,
        manualReviewReasons: true,
        competitorBenchmarkId: true,
        competitorSnapshot: true,
        serverInputHash: true,
        finalTotalPence: true,
        originalTotalPence: true,
        discountTotalPence: true,
        vehicleRecommendation: true,
        crewRecommendation: true,
        inventorySnapshot: true,
        customerBreakdown: true,
      },
    });
    if (existing && "reference" in existing) return responseFromQuote(existing as StoredQuoteForResponse);
  }

  const pricing = await calculateCanonicalQuotePricing(input, {
    ...options.pricingDependencies,
    now,
  });
  const accessDetails = {
    collection: input.collection,
    delivery: input.delivery,
    additionalStop: input.additionalStop ?? null,
  };
  const inventorySnapshot = {
    metricDatasetVersion: pricing.auditSnapshot?.itemMetricDatasetVersion ?? PRICING_ALGORITHM_VERSION,
    referenceProfile: pricing.auditSnapshot?.referenceProfile ?? null,
    lutonCapacityReference: pricing.auditSnapshot?.lutonCapacityReference ?? null,
    normalizedItems: pricing.canonicalInput?.inventory ?? [],
    selectedItems: pricing.inventory.lines,
    customItems: input.customItems,
    summary: pricing.inventory.summary,
  };
  const normalisedInput = pricing.canonicalInput ?? {
    pricingAlgorithmVersion: PRICING_ALGORITHM_VERSION,
    moveType: input.moveType,
    moveSize: input.moveSize ?? null,
    accessDetails,
    inventorySnapshot,
    services: input.services,
  };
  const serverInputHash = pricing.serverInputHash ?? stableHash(normalisedInput);
  const totalHandlingMinutes = pricing.inventory.summary.totalHandlingMinutes ?? 0;
  const loadingMinutes = Math.ceil(totalHandlingMinutes / 2);
  const unloadingMinutes = totalHandlingMinutes - loadingMinutes;
  const crewRecommendation = {
    movers: pricing.requiredCrew ?? input.preferredMovers ?? 1,
    requestedMovers: input.preferredMovers ?? 1,
    loadingMinutes,
    unloadingMinutes,
    travelMinutes: pricing.routeMetrics?.durationMinutes ?? 0,
    totalJobMinutes: totalHandlingMinutes + (pricing.routeMetrics?.durationMinutes ?? 0),
  };
  const competitorSnapshot = pricing.auditSnapshot ?? {
    pricingAlgorithmVersion: PRICING_ALGORITHM_VERSION,
    explanation: pricing.explanation,
  };
  const manualReviewReasons = pricing.status === "MANUAL_REVIEW" ? pricing.reasonCodes : [];

  const quote = await dbClient.quote.create({
    data: {
      reference,
      status: pricing.status,
      moveType: input.moveType,
      moveSize: input.moveSize ?? null,
      moveDate: parseMoveDate(input),
      arrivalWindow: input.arrivalWindow ?? null,
      flexibleDate: input.flexibleDate,
      flexibleTime: input.flexibleTime,
      exactTime: input.exactTime,
      earliestDate: null,
      latestDate: null,
      sameDay: input.sameDay,
      urgent: input.urgent,
      customerName: input.customer.fullName,
      customerEmail: input.customer.email,
      customerPhone: input.customer.phone,
      companyName: input.customer.companyName ?? "",
      preferredContactMethod: input.customer.preferredContactMethod ?? "phone",
      marketingConsent: input.customer.marketingConsent,
      bookingConsentAccepted: input.customer.bookingConsentAccepted,
      termsAccepted: input.customer.termsAccepted,
      normalisedInput: toJsonValue(normalisedInput),
      routeMetrics: toNullableJsonValue(pricing.routeMetrics),
      inventorySnapshot: toJsonValue(inventorySnapshot),
      accessDetails: toJsonValue(accessDetails),
      selectedServices: toJsonValue(input.services),
      vehicleRecommendation: Prisma.JsonNull,
      crewRecommendation: toJsonValue(crewRecommendation),
      estimatedDurationMinutes: pricing.routeMetrics?.durationMinutes ?? null,
      customerBreakdown: pricing.status === "FIXED" ? toJsonValue(pricing.breakdown) : [],
      internalBreakdown: toJsonValue(pricing.auditSnapshot ?? {}),
      promotionSnapshot: Prisma.JsonNull,
      competitorSnapshot: toJsonValue(competitorSnapshot),
      flexibilitySnapshot: Prisma.JsonNull,
      experimentAssignment: Prisma.JsonNull,
      preDiscountTotalPence: pricing.status === "FIXED" ? pricing.totalPence : null,
      originalTotalPence: pricing.status === "FIXED" ? pricing.totalPence : null,
      discountTotalPence: 0,
      roundingAdjustmentPence: pricing.status === "FIXED" ? 0 : null,
      finalTotalPence: pricing.status === "FIXED" ? pricing.totalPence : null,
      contributionPence: null,
      grossMarginPercentage: null,
      competitorBenchmarkId: pricing.status === "FIXED" ? pricing.competitorBenchmarkId : null,
      beatCompetitorCampaignId: null,
      manualReviewReasons,
      serverInputHash,
      idempotencyKey: input.idempotencyKey ?? null,
      sourceChannel: input.sourceChannel ?? "website",
      utmSource: input.utmSource ?? null,
      utmMedium: input.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? null,
      referralCode: input.referralCode ?? null,
      expiresAt,
    },
    select: {
      reference: true,
      status: true,
      expiresAt: true,
      routeMetrics: true,
      estimatedDurationMinutes: true,
      manualReviewReasons: true,
      competitorBenchmarkId: true,
      competitorSnapshot: true,
      serverInputHash: true,
      finalTotalPence: true,
      originalTotalPence: true,
      discountTotalPence: true,
      vehicleRecommendation: true,
      crewRecommendation: true,
      inventorySnapshot: true,
      customerBreakdown: true,
    },
  });

  if (pricing.status === "MANUAL_REVIEW") {
    await notifyManualReview(reference, input.customer.fullName, manualReviewReasons).catch(() => {});
  }
  return responseFromQuote(quote);
}

export async function verifyQuoteForCheckout(reference: string): Promise<
  | { ok: true; finalTotalPence: number }
  | { ok: false; code: string; reasons: string[]; status: number }
> {
  const quote = await db.quote.findUnique({
    where: { reference },
    select: {
      status: true,
      expiresAt: true,
      finalTotalPence: true,
    },
  });

  if (!quote) {
    return { ok: false, code: "QUOTE_NOT_FOUND", reasons: ["Quote not found"], status: 404 };
  }
  if (quote.status !== "ACCEPTED") {
    return { ok: false, code: "QUOTE_NOT_ACCEPTED", reasons: ["Quote has not been accepted"], status: 422 };
  }
  if (quote.expiresAt.getTime() <= Date.now()) {
    return { ok: false, code: "QUOTE_EXPIRED", reasons: ["Quote has expired"], status: 410 };
  }
  if (quote.finalTotalPence == null || quote.finalTotalPence <= 0) {
    return { ok: false, code: "QUOTE_REVIEW_REQUIRED", reasons: ["Team review required"], status: 422 };
  }
  return { ok: true, finalTotalPence: quote.finalTotalPence };
}

import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseItemWeightKg } from "@/lib/item-pricing";
import { notifyManualReviewQuote } from "@/lib/notifications";
import { calculateRemovalQuote, normaliseQuoteInputForPricing, type ResolvedInventoryItem, type RouteMetrics } from "@/lib/pricing/domain";
import { getCompetitorPricingContext } from "@/lib/pricing/competitor-repository";
import { getPromotionPricingContext } from "@/lib/pricing/promotion-repository";
import { getActivePricingVersion } from "@/lib/pricing/version-repository";
import { calculateServerRoute } from "@/lib/routing/mapbox";
import type { AddressAccessInput, AdditionalServicesInput, CreateQuoteRequest } from "@/lib/quotes/schemas";

export class QuoteInputError extends Error {
  status = 400;
}

const QUICK_INVENTORY_PRESETS: Record<
  string,
  Omit<ResolvedInventoryItem, "quantity" | "room">
> = {
  "preset-chest-of-drawers": {
    id: "preset-chest-of-drawers",
    category: "Bedroom",
    name: "Chest Of Drawers",
    estimatedVolumeM3: 0.9,
    estimatedWeightKg: 55,
    handlingMinutes: 16,
    requiresTwoPeople: false,
    fragile: false,
    heavy: false,
    specialist: false,
    dismantlingAvailable: false,
    assemblyAvailable: false,
    reassemblyAvailable: false,
    minimumCrew: null,
    vehicleRestrictions: [],
    active: true,
  },
  "preset-bedside-table": {
    id: "preset-bedside-table",
    category: "Bedroom",
    name: "Bedside Table",
    estimatedVolumeM3: 0.2,
    estimatedWeightKg: 12,
    handlingMinutes: 6,
    requiresTwoPeople: false,
    fragile: false,
    heavy: false,
    specialist: false,
    dismantlingAvailable: false,
    assemblyAvailable: false,
    reassemblyAvailable: false,
    minimumCrew: null,
    vehicleRestrictions: [],
    active: true,
  },
  "preset-dressing-table": {
    id: "preset-dressing-table",
    category: "Bedroom",
    name: "Dressing Table",
    estimatedVolumeM3: 0.7,
    estimatedWeightKg: 30,
    handlingMinutes: 12,
    requiresTwoPeople: false,
    fragile: false,
    heavy: false,
    specialist: false,
    dismantlingAvailable: false,
    assemblyAvailable: false,
    reassemblyAvailable: false,
    minimumCrew: null,
    vehicleRestrictions: [],
    active: true,
  },
  "preset-side-table": {
    id: "preset-side-table",
    category: "Living Room",
    name: "Side Table",
    estimatedVolumeM3: 0.18,
    estimatedWeightKg: 10,
    handlingMinutes: 5,
    requiresTwoPeople: false,
    fragile: false,
    heavy: false,
    specialist: false,
    dismantlingAvailable: false,
    assemblyAvailable: false,
    reassemblyAvailable: false,
    minimumCrew: null,
    vehicleRestrictions: [],
    active: true,
  },
  "preset-kitchen-boxes": {
    id: "preset-kitchen-boxes",
    category: "Bags, Luggage & Boxes",
    name: "Kitchen Boxes",
    estimatedVolumeM3: 0.12,
    estimatedWeightKg: 8,
    handlingMinutes: 3,
    requiresTwoPeople: false,
    fragile: false,
    heavy: false,
    specialist: false,
    dismantlingAvailable: false,
    assemblyAvailable: false,
    reassemblyAvailable: false,
    minimumCrew: null,
    vehicleRestrictions: [],
    active: true,
  },
};

export interface CustomerQuoteResponse {
  reference: string;
  status: "FIXED" | "MANUAL_REVIEW";
  pricingVersion: number | null;
  expiresAt: string;
  totalPence: number | null;
  originalTotalPence: number | null;
  discountTotalPence: number;
  promotionLabel: string | null;
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

function generateQuoteReference(now = new Date()): string {
  const year = now.getFullYear();
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `MAQ-${year}-${suffix}`;
}

async function resolveQuoteReference(requestedReference: string | undefined, now: Date): Promise<string> {
  if (requestedReference) {
    const existing = await db.quote.findUnique({
      where: { reference: requestedReference },
      select: { id: true },
    });
    if (!existing) return requestedReference;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reference = generateQuoteReference(now);
    const existing = await db.quote.findUnique({
      where: { reference },
      select: { id: true },
    });
    if (!existing) return reference;
  }

  return generateQuoteReference(now);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, stableValue(entry)])
  );
}

function stableHash(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

function routeForPricingHash(route: unknown): unknown {
  if (!route || typeof route !== "object") return null;
  const record = route as Partial<RouteMetrics>;
  return {
    distanceMiles: record.distanceMiles ?? null,
    durationMinutes: record.durationMinutes ?? null,
    routeHash: record.routeHash ?? null,
  };
}

function quoteExpiry(versionSettings: Record<string, number>, now: Date): Date {
  const configured = versionSettings.quote_expiry_hours;
  const hours = typeof configured === "number" && Number.isFinite(configured) && configured > 0
    ? configured
    : 24;
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

function parseMoveDate(input: CreateQuoteRequest): Date | null {
  if (!input.moveDate) return null;
  const date = new Date(`${input.moveDate}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sortedInventoryInput(input: CreateQuoteRequest): CreateQuoteRequest["inventory"] {
  return [...input.inventory].sort((a, b) => (
    `${a.itemId}:${a.room}:${a.quantity}`.localeCompare(`${b.itemId}:${b.room}:${b.quantity}`)
  ));
}

function sortedCustomItems(input: CreateQuoteRequest) {
  return input.customItems
    .map((item) => ({ ...item, manualReviewRequired: true }))
    .sort((a, b) => `${a.name}:${a.room}:${a.quantity}`.localeCompare(`${b.name}:${b.room}:${b.quantity}`));
}

function buildNormalisedInputForStorage(
  input: CreateQuoteRequest,
  addresses: AddressAccessInput[]
) {
  return {
    moveType: input.moveType,
    moveSize: input.moveSize,
    moveDate: input.moveDate,
    earliestDate: input.earliestDate,
    latestDate: input.latestDate,
    arrivalWindow: input.arrivalWindow,
    flexibleDate: input.flexibleDate,
    flexibleTime: input.flexibleTime,
    exactTime: input.exactTime,
    sameDay: input.sameDay,
    urgent: input.urgent,
    preferredMovers: input.preferredMovers ?? null,
    stops: addresses.map((access, index) => ({
      role: index === 0 ? "collection" : index === addresses.length - 1 ? "delivery" : "additional-stop",
      access,
    })),
    inventory: sortedInventoryInput(input),
    customItems: sortedCustomItems(input),
    services: input.services,
    customerNote: input.customer.notes ?? "",
    promotionCode: input.promotionCode,
    sourceChannel: input.sourceChannel,
    utmSource: input.utmSource,
    utmMedium: input.utmMedium,
    utmCampaign: input.utmCampaign,
    referralCode: input.referralCode,
  };
}

function estimateItemVolumeM3(item: {
  estimatedVolumeM3: number | null;
  estimatedWeightKg: number | null;
  imagePath: string | null;
  size: string;
}): number | null {
  if (item.estimatedVolumeM3 != null) return item.estimatedVolumeM3;
  const weight = item.estimatedWeightKg ?? parseItemWeightKg(item.imagePath);
  const sizeFloor: Record<string, number> = {
    small: 0.18,
    medium: 0.55,
    large: 1.25,
  };
  const floor = sizeFloor[item.size] ?? 0.55;
  const weightBased = weight > 0 ? weight * 0.025 : 0;
  return Math.round(Math.max(floor, weightBased) * 100) / 100;
}

function estimateHandlingMinutes(item: {
  handlingMinutes: number | null;
  estimatedWeightKg: number | null;
  imagePath: string | null;
  size: string;
  requiresTwoPeople: boolean;
  heavy: boolean;
  specialist: boolean;
}): number | null {
  if (item.handlingMinutes != null) return item.handlingMinutes;
  const weight = item.estimatedWeightKg ?? parseItemWeightKg(item.imagePath);
  const sizeBase: Record<string, number> = {
    small: 6,
    medium: 11,
    large: 18,
  };
  const base = sizeBase[item.size] ?? 11;
  const weightMinutes = weight > 0 ? Math.ceil(weight / 8) : 0;
  const complexity = item.requiresTwoPeople || item.heavy || item.specialist ? 6 : 0;
  return Math.max(4, base + weightMinutes + complexity);
}

function publicResponseFromQuote(quote: {
  reference: string;
  status: string;
  pricingVersion?: { version: number } | null;
  expiresAt: Date;
  finalTotalPence: number | null;
  originalTotalPence?: number | null;
  discountTotalPence?: number | null;
  promotionSnapshot?: unknown;
  routeMetrics: unknown;
  vehicleRecommendation: unknown;
  crewRecommendation: unknown;
  inventorySnapshot: unknown;
  customerBreakdown: unknown;
  manualReviewReasons: string[];
}): CustomerQuoteResponse {
  const route = quote.routeMetrics as { distanceMiles?: number } | null;
  const vehicle = quote.vehicleRecommendation as {
    name?: string | null;
    multipleVehiclesRequired?: boolean;
    multipleTripsLikely?: boolean;
  } | null;
  const crew = quote.crewRecommendation as {
    movers?: number;
    loadingMinutes?: number;
    unloadingMinutes?: number;
    travelMinutes?: number;
    totalJobMinutes?: number;
  } | null;
  const inventory = quote.inventorySnapshot as {
    totalVolumeM3?: number;
    totalWeightKg?: number;
    itemUnits?: number;
    fragileItemCount?: number;
    heavyOrSpecialItemCount?: number;
  } | null;
  const breakdown = Array.isArray(quote.customerBreakdown)
    ? quote.customerBreakdown as Array<{ key: string; label: string; amountPence: number }>
    : [];
  const promotion = quote.promotionSnapshot as { customerLabel?: string | null } | null;

  return {
    reference: quote.reference,
    status: quote.status === "FIXED" ? "FIXED" : "MANUAL_REVIEW",
    pricingVersion: quote.pricingVersion?.version ?? null,
    expiresAt: quote.expiresAt.toISOString(),
    totalPence: quote.finalTotalPence,
    originalTotalPence: quote.originalTotalPence ?? null,
    discountTotalPence: quote.discountTotalPence ?? 0,
    promotionLabel: promotion?.customerLabel ?? null,
    routeMileage: route?.distanceMiles ?? null,
    estimatedDurationMinutes: crew?.totalJobMinutes ?? null,
    vehicle: {
      name: vehicle?.name ?? null,
      multipleVehiclesRequired: vehicle?.multipleVehiclesRequired ?? false,
      multipleTripsLikely: vehicle?.multipleTripsLikely ?? false,
    },
    crew: {
      movers: crew?.movers ?? 0,
      loadingMinutes: crew?.loadingMinutes ?? 0,
      unloadingMinutes: crew?.unloadingMinutes ?? 0,
      travelMinutes: crew?.travelMinutes ?? 0,
      totalJobMinutes: crew?.totalJobMinutes ?? 0,
    },
    inventory: {
      totalVolumeM3: inventory?.totalVolumeM3 ?? 0,
      totalWeightKg: inventory?.totalWeightKg ?? 0,
      itemUnits: inventory?.itemUnits ?? 0,
      fragileItemCount: inventory?.fragileItemCount ?? 0,
      heavyOrSpecialItemCount: inventory?.heavyOrSpecialItemCount ?? 0,
    },
    breakdown,
    manualReviewReasons: quote.manualReviewReasons,
  };
}

export async function resolveInventoryForQuote(input: CreateQuoteRequest): Promise<{
  items: ResolvedInventoryItem[];
  reasons: string[];
}> {
  const reasons: string[] = [];
  if (input.customItems.length > 0) {
    reasons.push("MANUAL_REVIEW_REQUIRED: Custom inventory items require server-reviewed catalogue dimensions before automatic pricing");
  }
  const ids = Array.from(new Set(
    input.inventory
      .map((item) => item.itemId)
      .filter((itemId) => !QUICK_INVENTORY_PRESETS[itemId])
  ));
  const records = ids.length === 0
    ? []
    : await db.item.findMany({
        where: {
          OR: [
            { id: { in: ids } },
            { slug: { in: ids } },
          ],
        },
        include: { category: { select: { name: true } } },
      });
  const byId = new Map(records.flatMap((item) => [
    [item.id, item],
    [item.slug, item],
  ]));
  const resolved: ResolvedInventoryItem[] = [];

  for (const selected of input.inventory) {
    const preset = QUICK_INVENTORY_PRESETS[selected.itemId];
    if (preset) {
      resolved.push({
        ...preset,
        quantity: selected.quantity,
        room: selected.room,
      });
      continue;
    }

    const item = byId.get(selected.itemId);
    if (!item) {
      reasons.push(`Invalid inventory item ID: ${selected.itemId}`);
      resolved.push({
        id: selected.itemId,
        category: "Unknown",
        name: "Unknown item",
        quantity: selected.quantity,
        room: selected.room,
        estimatedVolumeM3: null,
        estimatedWeightKg: null,
        handlingMinutes: null,
        requiresTwoPeople: false,
        fragile: false,
        heavy: false,
        specialist: false,
        dismantlingAvailable: false,
        assemblyAvailable: false,
        reassemblyAvailable: false,
        minimumCrew: null,
        vehicleRestrictions: [],
        active: false,
      });
      continue;
    }

    const weight = item.estimatedWeightKg ?? parseItemWeightKg(item.imagePath);
    resolved.push({
      id: item.id,
      category: item.category.name,
      name: item.name,
      quantity: selected.quantity,
      room: selected.room,
      estimatedVolumeM3: estimateItemVolumeM3(item),
      estimatedWeightKg: weight > 0 ? weight : item.estimatedWeightKg,
      handlingMinutes: estimateHandlingMinutes(item),
      requiresTwoPeople: item.requiresTwoPeople,
      fragile: item.fragile,
      heavy: item.heavy,
      specialist: item.specialist,
      dismantlingAvailable: item.dismantlingAvailable,
      assemblyAvailable: item.assemblyAvailable,
      reassemblyAvailable: item.reassemblyAvailable,
      minimumCrew: item.minimumCrew,
      vehicleRestrictions: item.vehicleRestrictions,
      active: item.isActive,
    });
  }

  return { items: resolved, reasons };
}

export async function createQuote(input: CreateQuoteRequest): Promise<CustomerQuoteResponse> {
  if (input.idempotencyKey) {
    const existing = await db.quote.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { pricingVersion: { select: { version: true } } },
    });
    if (existing) return publicResponseFromQuote(existing);
  }

  const pricingVersion = await getActivePricingVersion();
  const now = new Date();
  const expiresAt = quoteExpiry(pricingVersion?.settings ?? {}, now);
  const addresses = [
    input.collection,
    ...(input.additionalStop ? [input.additionalStop] : []),
    input.delivery,
  ];
  const [inventoryResult, routeResult] = await Promise.all([
    resolveInventoryForQuote(input),
    calculateServerRoute(addresses),
  ]);
  const pricingInput = normaliseQuoteInputForPricing(input, inventoryResult.items);
  const promotion = await getPromotionPricingContext(pricingInput);
  if (promotion.invalidPromotionCode) {
    throw new QuoteInputError("Promotion code is not valid");
  }
  if (pricingVersion?.settings) {
    const minimumContribution = pricingVersion.settings.minimum_contribution;
    const minimumMargin = pricingVersion.settings.minimum_margin_percent ?? pricingVersion.settings.manual_review_min_margin_percent;
    promotion.context.minimumContributionPence =
      typeof minimumContribution === "number" && Number.isFinite(minimumContribution)
        ? Math.round(minimumContribution * 100)
        : 0;
    promotion.context.minimumMarginPercent =
      typeof minimumMargin === "number" && Number.isFinite(minimumMargin)
        ? minimumMargin
        : null;
    promotion.context.allowZeroMargin = pricingVersion.settings.allow_zero_margin === 1;
    promotion.context.allowNegativeMargin = pricingVersion.settings.allow_negative_margin === 1;
  }
  const competitor = await getCompetitorPricingContext(
    pricingInput,
    routeResult.route?.distanceMiles ?? null,
    inventoryResult.items,
  );

  const calculated = calculateRemovalQuote({
    input: pricingInput,
    inventory: inventoryResult.items,
    route: routeResult.route,
    pricingVersion,
    promotionContext: promotion.context,
    competitorContext: competitor,
    now,
    quoteExpiresAt: expiresAt,
  });

  const manualReviewReasons = Array.from(new Set([
    ...inventoryResult.reasons,
    ...routeResult.reasons,
    ...calculated.manualReviewReasons,
  ]));
  const status = manualReviewReasons.length > 0 ? "MANUAL_REVIEW" : calculated.status;
  const normalisedInput = buildNormalisedInputForStorage(pricingInput, addresses);
  const serverInputHash = stableHash({
    normalisedInput,
    route: routeForPricingHash(routeResult.route),
    inventory: [...inventoryResult.items].sort((a, b) => (
      `${a.id}:${a.room}:${a.quantity}`.localeCompare(`${b.id}:${b.room}:${b.quantity}`)
    )),
    pricingVersion: pricingVersion?.id ?? null,
    competitorContext: competitor,
  });

  const reference = await resolveQuoteReference(input.reference, now);
  const firstCampaign = calculated.promotionSummary.applied.find((entry) => entry.source === "campaign") ?? null;
  const firstCode = calculated.promotionSummary.applied.find((entry) => entry.source === "code") ?? null;
  const quote = await db.$transaction(async (tx) => {
    const created = await tx.quote.create({
      data: {
        reference,
        status,
        pricingVersionId: pricingVersion?.id ?? null,
        promotionCampaignId: firstCampaign?.id ?? null,
        promotionCodeId: firstCode?.id ?? null,
        competitorBenchmarkId: status === "FIXED" ? calculated.competitorSummary.benchmarkId : null,
        beatCompetitorCampaignId: status === "FIXED" ? calculated.competitorSummary.campaignId : null,
        moveType: pricingInput.moveType,
        moveSize: pricingInput.moveSize ?? null,
        moveDate: parseMoveDate(pricingInput),
        earliestDate: pricingInput.earliestDate ? parseMoveDate({ ...pricingInput, moveDate: pricingInput.earliestDate }) : null,
        latestDate: pricingInput.latestDate ? parseMoveDate({ ...pricingInput, moveDate: pricingInput.latestDate }) : null,
        arrivalWindow: pricingInput.arrivalWindow ?? null,
        flexibleDate: pricingInput.flexibleDate,
        flexibleTime: pricingInput.flexibleTime,
        exactTime: pricingInput.exactTime,
        sameDay: pricingInput.sameDay,
        urgent: pricingInput.urgent,
        customerName: input.customer.fullName,
        customerEmail: input.customer.email,
        customerPhone: input.customer.phone,
        companyName: input.customer.companyName || null,
        preferredContactMethod: input.customer.preferredContactMethod,
        marketingConsent: input.customer.marketingConsent,
        bookingConsentAccepted: input.customer.bookingConsentAccepted,
        termsAccepted: input.customer.termsAccepted,
        normalisedInput: normalisedInput as unknown as Prisma.InputJsonValue,
        routeMetrics: routeResult.route as unknown as Prisma.InputJsonValue,
        inventorySnapshot: calculated.inventoryMetrics as unknown as Prisma.InputJsonValue,
        accessDetails: {
          collection: input.collection,
          delivery: input.delivery,
          additionalStop: input.additionalStop ?? null,
          customerNote: input.customer.notes ?? "",
        } as unknown as Prisma.InputJsonValue,
        selectedServices: input.services as unknown as Prisma.InputJsonValue,
        vehicleRecommendation: calculated.vehicleRecommendation as unknown as Prisma.InputJsonValue,
        crewRecommendation: calculated.crewRecommendation as unknown as Prisma.InputJsonValue,
        estimatedDurationMinutes: calculated.crewRecommendation.totalJobMinutes,
        customerBreakdown: (status === "FIXED" ? calculated.customerBreakdown : []) as unknown as Prisma.InputJsonValue,
        internalBreakdown: {
          lines: calculated.internalBreakdown,
          summary: calculated.internalSummary,
        } as unknown as Prisma.InputJsonValue,
        promotionSnapshot: {
          applied: calculated.promotionSummary.applied,
          discountTotalPence: calculated.promotionSummary.discountTotalPence,
          customerLabel: calculated.customerSummary.promotionLabel,
          promotionCustomerLabel: calculated.promotionSummary.customerLabel,
        } as unknown as Prisma.InputJsonValue,
        competitorSnapshot: {
          benchmark: competitor.benchmark,
          campaign: competitor.campaign,
          serviceLevel: competitor.serviceLevel,
          packingIncluded: competitor.packingIncluded,
          evaluation: calculated.competitorSummary,
        } as unknown as Prisma.InputJsonValue,
        flexibilitySnapshot: {
          flexibleDate: input.flexibleDate,
          flexibleTime: input.flexibleTime,
          earliestDate: input.earliestDate ?? null,
          latestDate: input.latestDate ?? null,
          customerCommitment: input.flexibleDate || input.flexibleTime
            ? "We will confirm your arrival window before the move."
            : null,
        } as unknown as Prisma.InputJsonValue,
        preDiscountTotalPence: calculated.internalSummary.preDiscountTotalPence,
        originalTotalPence: calculated.customerSummary.originalTotalPence,
        discountTotalPence: status === "FIXED" ? calculated.customerSummary.discountTotalPence : 0,
        roundingAdjustmentPence: calculated.internalSummary.roundingAdjustmentPence,
        finalTotalPence: status === "FIXED" ? calculated.finalTotalPence : null,
        contributionPence: calculated.internalSummary.contributionPence,
        grossMarginPercentage: calculated.internalSummary.grossMarginPercentage,
        manualReviewReasons,
        serverInputHash,
        idempotencyKey: input.idempotencyKey,
        sourceChannel: input.sourceChannel ?? "web",
        utmSource: input.utmSource,
        utmMedium: input.utmMedium,
        utmCampaign: input.utmCampaign,
        referralCode: input.referralCode,
        expiresAt,
      },
      include: { pricingVersion: { select: { version: true } } },
    });

    await tx.quoteEvent.create({
      data: {
        quoteId: created.id,
        reference: created.reference,
        type: status === "FIXED" ? "quote_generated" : "manual_review_created",
        step: "quote_result",
        metadata: {
          status,
          promotionApplied: calculated.promotionSummary.discountTotalPence > 0,
          competitorApplied: status === "FIXED" && calculated.competitorSummary.applied,
          sourceChannel: input.sourceChannel ?? "web",
        } as Prisma.InputJsonValue,
      },
    });

    if (status === "FIXED" && calculated.promotionSummary.discountTotalPence > 0) {
      await tx.promotionRedemption.createMany({
        data: calculated.promotionSummary.applied.map((applied) => ({
          quoteId: created.id,
          campaignId: applied.source === "campaign" ? applied.id : null,
          codeId: applied.source === "code" ? applied.id : null,
          idempotencyKey: `quote:${created.reference}:${applied.source}:${applied.id}`,
          customerEmailHash: promotion.identity.emailHash,
          customerPhoneHash: promotion.identity.phoneHash,
          discountPence: applied.discountPence,
          status: "RESERVED",
          expiresAt,
          metadata: {
            customerLabel: applied.customerLabel,
            source: applied.source,
            code: applied.code ?? null,
          } as Prisma.InputJsonValue,
        })),
        skipDuplicates: true,
      });
    }

    return created;
  });

  if (quote.status === "MANUAL_REVIEW") {
    await notifyManualReviewQuote(quote.reference, quote.customerName ?? "Customer", manualReviewReasons).catch(() => {});
  }

  return publicResponseFromQuote(quote);
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function stopFromNormalised(normalised: unknown, role: string): AddressAccessInput | null {
  const stop = asArray(asRecord(normalised).stops).find((entry) => asRecord(entry).role === role);
  const access = asRecord(asRecord(stop).access);
  if (!stringValue(access.fullAddress) || !stringValue(access.postcode)) return null;
  if (typeof access.lat !== "number" || typeof access.lng !== "number") return null;
  return access as unknown as AddressAccessInput;
}

function inventoryFromNormalised(normalised: unknown): CreateQuoteRequest["inventory"] {
  return asArray(asRecord(normalised).inventory).flatMap((entry) => {
    const item = asRecord(entry);
    const itemId = stringValue(item.itemId);
    if (!itemId) return [];
    const quantity = typeof item.quantity === "number" && Number.isFinite(item.quantity)
      ? Math.max(1, Math.floor(item.quantity))
      : 1;
    const room = stringValue(item.room) ?? "other";
    return [{
      itemId,
      quantity,
      room: room as CreateQuoteRequest["inventory"][number]["room"],
    }];
  });
}

function dateString(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function quoteInputFromStoredQuote(quote: {
  normalisedInput: unknown;
  selectedServices: unknown;
  moveType: string;
  moveSize: string | null;
  moveDate: Date | null;
  earliestDate: Date | null;
  latestDate: Date | null;
  arrivalWindow: string | null;
  flexibleDate: boolean;
  flexibleTime: boolean;
  exactTime: boolean;
  sameDay: boolean;
  urgent: boolean;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  companyName: string | null;
  preferredContactMethod: string | null;
  marketingConsent: boolean;
  bookingConsentAccepted: boolean;
  termsAccepted: boolean;
  sourceChannel: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referralCode: string | null;
}): CreateQuoteRequest | null {
  const normalised = asRecord(quote.normalisedInput);
  const collection = stopFromNormalised(normalised, "collection");
  const delivery = stopFromNormalised(normalised, "delivery");
  const additionalStop = stopFromNormalised(normalised, "additional-stop");
  if (!collection || !delivery) return null;

  const moveDate =
    dateString(normalised.moveDate) ??
    quote.moveDate?.toISOString().slice(0, 10) ??
    null;
  const earliestDate =
    dateString(normalised.earliestDate) ??
    quote.earliestDate?.toISOString().slice(0, 10) ??
    null;
  const latestDate =
    dateString(normalised.latestDate) ??
    quote.latestDate?.toISOString().slice(0, 10) ??
    null;
  const arrivalWindow =
    quote.arrivalWindow === "afternoon" || quote.arrivalWindow === "evening"
      ? quote.arrivalWindow
      : quote.arrivalWindow === "morning"
        ? "morning"
        : null;
  const preferredContactMethod =
    quote.preferredContactMethod === "phone" || quote.preferredContactMethod === "sms"
      ? quote.preferredContactMethod
      : "email";

  return {
    moveType: quote.moveType as CreateQuoteRequest["moveType"],
    moveSize: (quote.moveSize ?? normalised.moveSize) as CreateQuoteRequest["moveSize"],
    collection,
    delivery,
    additionalStop,
    moveDate,
    earliestDate,
    latestDate,
    arrivalWindow,
    flexibleDate: quote.flexibleDate,
    flexibleTime: quote.flexibleTime,
    exactTime: quote.exactTime,
    sameDay: quote.sameDay,
    urgent: quote.urgent,
    preferredMovers: typeof normalised.preferredMovers === "number" ? normalised.preferredMovers : undefined,
    inventory: inventoryFromNormalised(normalised),
    customItems: [],
    services: {
      ...asRecord(normalised.services),
      ...asRecord(quote.selectedServices),
    } as AdditionalServicesInput,
    customer: {
      fullName: quote.customerName ?? "Customer",
      email: quote.customerEmail ?? "customer@example.com",
      phone: quote.customerPhone ?? "07123456789",
      notes: stringValue(normalised.customerNote) ?? "",
      companyName: quote.companyName ?? "",
      preferredContactMethod,
      marketingConsent: quote.marketingConsent,
      bookingConsentAccepted: true,
      termsAccepted: true,
    },
    promotionCode: stringValue(normalised.promotionCode) ?? undefined,
    sourceChannel: quote.sourceChannel ?? "web",
    utmSource: quote.utmSource ?? undefined,
    utmMedium: quote.utmMedium ?? undefined,
    utmCampaign: quote.utmCampaign ?? undefined,
    referralCode: quote.referralCode ?? undefined,
  };
}

export async function verifyQuoteForCheckout(reference: string): Promise<{
  ok: true;
  quote: Awaited<ReturnType<typeof db.quote.findUnique>>;
  finalTotalPence: number;
} | {
  ok: false;
  status: number;
  code: string;
  reasons: string[];
}> {
  const quote = await db.quote.findUnique({ where: { reference } });
  if (!quote) {
    return { ok: false, status: 404, code: "QUOTE_NOT_FOUND", reasons: ["Quote not found"] };
  }
  if (quote.status === "CONSUMED") {
    return { ok: false, status: 409, code: "QUOTE_CONSUMED", reasons: ["Quote has already been booked"] };
  }
  if (quote.status !== "FIXED" && quote.status !== "ACCEPTED") {
    return {
      ok: false,
      status: 422,
      code: "MANUAL_REVIEW_REQUIRED",
      reasons: ["MANUAL_REVIEW_REQUIRED: This quote requires manual review before checkout"],
    };
  }
  if (quote.expiresAt.getTime() <= Date.now()) {
    await db.quote.update({ where: { id: quote.id }, data: { status: "EXPIRED" } });
    return {
      ok: false,
      status: 410,
      code: "BENCHMARK_EXPIRED",
      reasons: ["BENCHMARK_EXPIRED: Quote has expired before checkout"],
    };
  }

  const input = quoteInputFromStoredQuote(quote);
  if (!input) {
    return {
      ok: false,
      status: 422,
      code: "MANUAL_REVIEW_REQUIRED",
      reasons: ["MANUAL_REVIEW_REQUIRED: Stored quote inputs are incomplete"],
    };
  }

  const addresses = [
    input.collection,
    ...(input.additionalStop ? [input.additionalStop] : []),
    input.delivery,
  ];
  const pricingVersion = await getActivePricingVersion();
  const [inventoryResult, routeResult] = await Promise.all([
    resolveInventoryForQuote(input),
    calculateServerRoute(addresses),
  ]);
  const pricingInput = normaliseQuoteInputForPricing(input, inventoryResult.items);
  const promotion = await getPromotionPricingContext(pricingInput);
  const competitor = await getCompetitorPricingContext(
    pricingInput,
    routeResult.route?.distanceMiles ?? null,
    inventoryResult.items,
  );
  const calculated = calculateRemovalQuote({
    input: pricingInput,
    inventory: inventoryResult.items,
    route: routeResult.route,
    pricingVersion,
    promotionContext: promotion.context,
    competitorContext: competitor,
    now: new Date(),
    quoteExpiresAt: quote.expiresAt,
  });
  const normalisedInput = buildNormalisedInputForStorage(pricingInput, addresses);
  const serverInputHash = stableHash({
    normalisedInput,
    route: routeForPricingHash(routeResult.route),
    inventory: [...inventoryResult.items].sort((a, b) => (
      `${a.id}:${a.room}:${a.quantity}`.localeCompare(`${b.id}:${b.room}:${b.quantity}`)
    )),
    pricingVersion: pricingVersion?.id ?? null,
    competitorContext: competitor,
  });
  const reasons = Array.from(new Set([
    ...inventoryResult.reasons,
    ...routeResult.reasons,
    ...calculated.manualReviewReasons,
  ]));
  if (reasons.length > 0 || calculated.status !== "FIXED" || calculated.finalTotalPence == null) {
    return {
      ok: false,
      status: 422,
      code: "MANUAL_REVIEW_REQUIRED",
      reasons,
    };
  }
  if (quote.serverInputHash !== serverInputHash) {
    return {
      ok: false,
      status: 409,
      code: "STALE_QUOTE",
      reasons: ["STALE_QUOTE: Normalized pricing inputs changed since the quote was created"],
    };
  }
  if (quote.finalTotalPence !== calculated.finalTotalPence) {
    return {
      ok: false,
      status: 409,
      code: "STALE_QUOTE",
      reasons: ["STALE_QUOTE: Authoritative benchmark total changed since the quote was created"],
    };
  }
  if (quote.competitorBenchmarkId !== calculated.competitorSummary.benchmarkId) {
    return {
      ok: false,
      status: 409,
      code: "STALE_QUOTE",
      reasons: ["STALE_QUOTE: Active benchmark selection changed since the quote was created"],
    };
  }
  return {
    ok: true,
    quote,
    finalTotalPence: calculated.finalTotalPence,
  };
}

export async function getQuoteForCustomer(reference: string): Promise<CustomerQuoteResponse | null> {
  const quote = await db.quote.findUnique({
    where: { reference },
    include: { pricingVersion: { select: { version: true } } },
  });
  return quote ? publicResponseFromQuote(quote) : null;
}

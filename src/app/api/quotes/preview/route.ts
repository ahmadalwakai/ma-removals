import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  calculateRemovalQuote,
  normaliseQuoteInputForPricing,
  type PricingVersionSnapshot,
  type ResolvedInventoryItem,
  type RouteMetrics,
} from "@/lib/pricing/domain";
import type { CompetitorPricingContext } from "@/lib/pricing/competitor-benchmarks";
import { packingChargePenceForMove } from "@/lib/pricing/packing";
import type { PromotionPricingContext } from "@/lib/pricing/promotions";
import { createQuoteRequestSchema, type AddressAccessInput } from "@/lib/quotes/schemas";

const previewRequestSchema = z.object({
  quotes: z.array(createQuoteRequestSchema).min(1).max(80),
});

export type PreviewInput = z.infer<typeof createQuoteRequestSchema>;
export type PreviewResult = {
  key: string;
  date: string | null;
  requestedMovers: number | null;
  status: "FIXED" | "MANUAL_REVIEW";
  totalPence: number | null;
  originalTotalPence?: number | null;
  discountTotalPence?: number;
  promotionLabel?: string | null;
  routeMileage?: number | null;
  estimatedDurationMinutes?: number | null;
  vehicle?: {
    name: string | null;
    multipleVehiclesRequired: boolean;
    multipleTripsLikely: boolean;
  };
  crew?: {
    movers: number;
    loadingMinutes: number;
    unloadingMinutes: number;
    travelMinutes: number;
    totalJobMinutes: number;
  };
  inventory?: {
    totalVolumeM3: number;
    totalWeightKg: number;
    itemUnits: number;
    fragileItemCount: number;
    heavyOrSpecialItemCount: number;
  };
  breakdown?: Array<{ key: string; label: string; amountPence: number }>;
  manualReviewReasons: string[];
  estimateSource?: "authoritative" | "fast";
};

type InventoryResolution = {
  items: ResolvedInventoryItem[];
  reasons: string[];
};

type RouteResolution = {
  route: RouteMetrics | null;
  reasons: string[];
};

type PromotionResolution = {
  context: PromotionPricingContext;
  invalidPromotionCode: string | null;
};

export interface PreviewDependencies {
  getActivePricingVersion: () => Promise<PricingVersionSnapshot | null>;
  resolveInventoryForQuote: (input: PreviewInput) => Promise<InventoryResolution>;
  calculateServerRoute: (addresses: AddressAccessInput[]) => Promise<RouteResolution>;
  getPromotionPricingContext: (input: PreviewInput) => Promise<PromotionResolution>;
  getCompetitorPricingContext: (
    input: PreviewInput,
    routeMileage: number | null
  ) => Promise<CompetitorPricingContext>;
}

const AUTHORITATIVE_PREVIEW_TIMEOUT_MS = 3500;
const CLIENT_ESTIMATED_VOLUME_PER_ITEM_M3 = 0.81;

class PreviewTimeoutError extends Error {
  constructor() {
    super("Quote preview calculation timed out");
  }
}

function previewKey(input: z.infer<typeof createQuoteRequestSchema>): string {
  return `${input.moveDate ?? "flexible"}::${input.preferredMovers ?? "any"}`;
}

function isLocalPreviewRequest(req: NextRequest) {
  const host = req.nextUrl.hostname || req.headers.get("host")?.split(":")[0] || "";
  return host === "localhost" || host === "127.0.0.1";
}

function quoteExpiry(settings: Record<string, number>, now: Date): Date {
  const hours = typeof settings.quote_expiry_hours === "number" && settings.quote_expiry_hours > 0
    ? settings.quote_expiry_hours
    : 24;
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

function applyPromotionProtectionSettings(
  context: PromotionPricingContext,
  settings: Record<string, number>
): PromotionPricingContext {
  const minimumContribution = settings.minimum_contribution;
  const minimumMargin = settings.minimum_margin_percent ?? settings.manual_review_min_margin_percent;

  return {
    ...context,
    minimumContributionPence:
      typeof minimumContribution === "number" && Number.isFinite(minimumContribution)
        ? Math.round(minimumContribution * 100)
        : 0,
    minimumMarginPercent:
      typeof minimumMargin === "number" && Number.isFinite(minimumMargin)
        ? minimumMargin
        : null,
    allowZeroMargin: settings.allow_zero_margin === 1,
    allowNegativeMargin: settings.allow_negative_margin === 1,
  };
}

async function defaultPreviewDependencies(): Promise<PreviewDependencies> {
  const [
    versionRepository,
    quoteService,
    routing,
    promotionRepository,
    competitorRepository,
  ] = await Promise.all([
    import("@/lib/pricing/version-repository"),
    import("@/lib/quotes/service"),
    import("@/lib/routing/mapbox"),
    import("@/lib/pricing/promotion-repository"),
    import("@/lib/pricing/competitor-repository"),
  ]);

  return {
    getActivePricingVersion: versionRepository.getActivePricingVersion,
    resolveInventoryForQuote: quoteService.resolveInventoryForQuote,
    calculateServerRoute: routing.calculateServerRoute,
    getPromotionPricingContext: promotionRepository.getPromotionPricingContext,
    getCompetitorPricingContext: competitorRepository.getCompetitorPricingContext,
  };
}

function toRad(value: number) {
  return value * Math.PI / 180;
}

function fallbackRouteMiles(input: PreviewInput) {
  const stops = [
    input.collection,
    ...(input.additionalStop ? [input.additionalStop] : []),
    input.delivery,
  ];
  let totalMiles = 0;
  for (let index = 0; index < stops.length - 1; index += 1) {
    const from = stops[index];
    const to = stops[index + 1];
    if (!from || !to) continue;
    const dLat = toRad(to.lat - from.lat);
    const dLng = toRad(to.lng - from.lng);
    const lat1 = toRad(from.lat);
    const lat2 = toRad(to.lat);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    totalMiles += 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return Math.max(1, Math.round(totalMiles * 1.18 * 10) / 10);
}

function fallbackMoveBasePence(input: PreviewInput) {
  const bySize: Record<string, number> = {
    "single-item": 6500,
    "few-items": 9500,
    studio: 16000,
    "1-bedroom": 23000,
    "2-bedrooms": 32000,
    "3-bedrooms": 46000,
    "4-bedrooms": 62000,
    "5-plus-bedrooms": 78000,
    office: 45000,
    "custom-inventory": 30000,
  };
  if (input.moveType === "piano-move") return 18000;
  if (input.moveType === "office-move") return bySize.office ?? 45000;
  if (input.moveType === "single-item-delivery") return bySize["single-item"] ?? 6500;
  if (input.moveType === "furniture-delivery" || input.moveType === "marketplace-collection") {
    return bySize["few-items"] ?? 9500;
  }
  return bySize[input.moveSize ?? "few-items"] ?? 24000;
}

function daysOut(input: PreviewInput, now: Date) {
  if (!input.moveDate) return null;
  const moveDate = new Date(`${input.moveDate}T12:00:00`);
  if (Number.isNaN(moveDate.getTime())) return null;
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  return Math.round((moveDate.getTime() - today.getTime()) / 86_400_000);
}

function fallbackScheduleAdjustmentPence(input: PreviewInput, now: Date) {
  const offset = daysOut(input, now);
  if (offset == null) return 0;
  if (offset <= 0 || input.sameDay) return 10000;
  if (offset === 1) return 7700;
  if (offset === 2 || input.urgent) return 5000;
  const moveDate = new Date(`${input.moveDate}T12:00:00`);
  const weekend = moveDate.getDay() === 0 || moveDate.getDay() === 6;
  return weekend ? 3500 : 0;
}

function fallbackAccessPence(input: PreviewInput) {
  const accessFor = (access: PreviewInput["collection"]) => {
    const floorPenalty = access.floor > 0 && !access.hasLift ? access.floor * 900 : access.floor * 250;
    const stairsPenalty = (access.internalStairs + access.externalStairs) * 250;
    const carryPenalty = Math.ceil(access.carryDistanceMeters / 20) * 300;
    const parkingPenalty = access.parking === "paid" || access.parking === "restricted" ? 1200 : 0;
    return floorPenalty + stairsPenalty + carryPenalty + parkingPenalty;
  };
  return accessFor(input.collection) + accessFor(input.delivery) + (input.additionalStop ? Math.round(accessFor(input.additionalStop) * 0.5) : 0);
}

function fallbackPreview(input: PreviewInput, now: Date): PreviewResult {
  const itemUnits = input.inventory.reduce((sum, item) => sum + item.quantity, 0) +
    input.customItems.reduce((sum, item) => sum + item.quantity, 0);
  const movers = input.preferredMovers ?? (itemUnits >= 18 || input.moveSize?.includes("bedroom") ? 2 : 1);
  const routeMileage = fallbackRouteMiles(input);
  const travelMinutes = Math.max(18, Math.round(routeMileage * 2.2));
  const loadingMinutes = Math.max(35, itemUnits * 7 + fallbackAccessPence(input) / 220);
  const unloadingMinutes = Math.max(25, Math.round(loadingMinutes * 0.72));
  const itemHandlingPence = itemUnits * 425;
  const customItemPence = input.customItems.length > 0 ? input.customItems.reduce((sum, item) => sum + item.quantity, 0) * 900 : 0;
  const distancePence = Math.max(0, Math.round(routeMileage - 5)) * 155;
  const labourPence = Math.max(0, movers - 1) * 4200;
  const packingPence = input.services.packing
    ? packingChargePenceForMove("full", input.moveSize, itemUnits)
    : input.services.packingMaterials
      ? packingChargePenceForMove("materials", input.moveSize, itemUnits)
      : 0;
  const servicesPence =
    packingPence +
    (input.services.dismantling ? 1000 * Number(input.services.dismantlingItems ?? 1) : 0) +
    (input.services.reassembly ? 1000 * Number(input.services.reassemblyItems ?? 1) : 0) +
    (input.services.furnitureProtection ? 9900 : 0);

  const subtotal =
    fallbackMoveBasePence(input) +
    distancePence +
    itemHandlingPence +
    customItemPence +
    labourPence +
    servicesPence +
    fallbackAccessPence(input) +
    fallbackScheduleAdjustmentPence(input, now);
  const totalPence = Math.max(5500, Math.ceil(subtotal / 500) * 500);

  return {
    key: previewKey(input),
    date: input.moveDate ?? null,
    requestedMovers: input.preferredMovers ?? null,
    status: "FIXED",
    totalPence,
    originalTotalPence: totalPence,
    discountTotalPence: 0,
    promotionLabel: null,
    routeMileage,
    estimatedDurationMinutes: travelMinutes + Math.round((loadingMinutes + unloadingMinutes) / Math.max(movers, 1)),
    vehicle: {
      name: itemUnits >= 35 || routeMileage > 120 ? "Luton van" : "Transit van",
      multipleVehiclesRequired: itemUnits >= 75,
      multipleTripsLikely: itemUnits >= 65,
    },
    crew: {
      movers,
      loadingMinutes: Math.round(loadingMinutes),
      unloadingMinutes: Math.round(unloadingMinutes),
      travelMinutes,
      totalJobMinutes: travelMinutes + Math.round((loadingMinutes + unloadingMinutes) / Math.max(movers, 1)),
    },
    inventory: {
      totalVolumeM3: Math.round(itemUnits * CLIENT_ESTIMATED_VOLUME_PER_ITEM_M3 * 100) / 100,
      totalWeightKg: itemUnits * 18,
      itemUnits,
      fragileItemCount: 0,
      heavyOrSpecialItemCount: input.moveType === "piano-move" ? 1 : 0,
    },
    breakdown: [],
    manualReviewReasons: [],
    estimateSource: "fast",
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  promise.catch(() => undefined);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new PreviewTimeoutError()), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function buildAuthoritativePreviews(
  quotes: PreviewInput[],
  dependencies?: PreviewDependencies
): Promise<PreviewResult[]> {
  if (quotes.length === 0) return [];

  const deps = dependencies ?? await defaultPreviewDependencies();
  const pricingVersion = await deps.getActivePricingVersion();
  const now = new Date();
  const expiresAt = quoteExpiry(pricingVersion?.settings ?? {}, now);
  const settings = pricingVersion?.settings ?? {};

  return Promise.all(quotes.map(async (input) => {
    const addresses = [
      input.collection,
      ...(input.additionalStop ? [input.additionalStop] : []),
      input.delivery,
    ];
    const [inventoryResult, routeResult] = await Promise.all([
      deps.resolveInventoryForQuote(input),
      deps.calculateServerRoute(addresses),
    ]);
    const pricingInput = normaliseQuoteInputForPricing(input, inventoryResult.items);
    const [promotion, competitor] = await Promise.all([
      deps.getPromotionPricingContext(pricingInput),
      deps.getCompetitorPricingContext(pricingInput, routeResult.route?.distanceMiles ?? null),
    ]);

    if (promotion.invalidPromotionCode) {
      return {
        key: previewKey(input),
        date: input.moveDate ?? null,
        requestedMovers: input.preferredMovers ?? null,
        status: "MANUAL_REVIEW" as const,
        totalPence: null,
        manualReviewReasons: ["Promotion code is not valid"],
        estimateSource: "authoritative" as const,
      };
    }

    const result = calculateRemovalQuote({
      input: pricingInput,
      inventory: inventoryResult.items,
      route: routeResult.route,
      pricingVersion,
      promotionContext: applyPromotionProtectionSettings(promotion.context, settings),
      competitorContext: competitor,
      now,
      quoteExpiresAt: expiresAt,
    });
    const manualReviewReasons = Array.from(new Set([
      ...inventoryResult.reasons,
      ...routeResult.reasons,
      ...result.manualReviewReasons,
    ]));
    const status = manualReviewReasons.length > 0 ? "MANUAL_REVIEW" : result.status;

    return {
      key: previewKey(input),
      date: input.moveDate ?? null,
      requestedMovers: input.preferredMovers ?? null,
      status,
      totalPence: status === "FIXED" ? result.finalTotalPence : null,
      originalTotalPence: result.customerSummary.originalTotalPence,
      discountTotalPence: result.customerSummary.discountTotalPence,
      promotionLabel: result.customerSummary.promotionLabel,
      routeMileage: result.customerSummary.routeMileage,
      estimatedDurationMinutes: result.customerSummary.estimatedDurationMinutes,
      vehicle: result.vehicleRecommendation,
      crew: result.crewRecommendation,
      inventory: result.inventoryMetrics,
      breakdown: status === "FIXED" ? result.customerBreakdown : [],
      manualReviewReasons,
      estimateSource: "authoritative" as const,
    };
  }));
}

export async function POST(req: NextRequest) {
  try {
    const parsed = previewRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid quote preview request", issues: parsed.error.issues.map((issue) => issue.message) },
        { status: 400 }
      );
    }

    const now = new Date();
    if (isLocalPreviewRequest(req)) {
      const previews = parsed.data.quotes.map((input) => fallbackPreview(input, now));
      return NextResponse.json({ previews }, {
        headers: {
          "Cache-Control": "no-store",
          "X-Quote-Preview-Source": "fast-local",
        },
      });
    }

    const authoritative = buildAuthoritativePreviews(parsed.data.quotes);

    try {
      const previews = await withTimeout(authoritative, AUTHORITATIVE_PREVIEW_TIMEOUT_MS);
      return NextResponse.json({ previews }, {
        headers: {
          "Cache-Control": "no-store",
          "X-Quote-Preview-Source": "authoritative",
        },
      });
    } catch (error) {
      if (!(error instanceof PreviewTimeoutError)) {
        console.warn("Authoritative quote preview failed; using fast estimate:", error);
      }
      const previews = parsed.data.quotes.map((input) => fallbackPreview(input, now));
      return NextResponse.json({ previews }, {
        headers: {
          "Cache-Control": "no-store",
          "X-Quote-Preview-Source": "fast",
        },
      });
    }

  } catch (error) {
    console.error("Quote preview failed:", error);
    return NextResponse.json({ error: "Unable to preview quote price" }, { status: 500 });
  }
}

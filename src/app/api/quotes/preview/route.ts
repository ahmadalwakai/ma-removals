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
  estimateSource?: "authoritative";
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
    routeMileage: number | null,
    inventory: ResolvedInventoryItem[]
  ) => Promise<CompetitorPricingContext>;
}

const AUTHORITATIVE_PREVIEW_TIMEOUT_MS = 3500;

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

function manualPreview(input: PreviewInput, reasons: string[]): PreviewResult {
  return {
    key: previewKey(input),
    date: input.moveDate ?? null,
    requestedMovers: input.preferredMovers ?? null,
    status: "MANUAL_REVIEW",
    totalPence: null,
    originalTotalPence: null,
    discountTotalPence: 0,
    promotionLabel: null,
    routeMileage: null,
    estimatedDurationMinutes: null,
    breakdown: [],
    manualReviewReasons: reasons,
    estimateSource: "authoritative",
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
      deps.getCompetitorPricingContext(pricingInput, routeResult.route?.distanceMiles ?? null, inventoryResult.items),
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

    if (isLocalPreviewRequest(req)) {
      const previews = parsed.data.quotes.map((input) => manualPreview(input, [
        "AUTHORITATIVE_ROUTE_UNAVAILABLE: Local preview cannot produce an automatic benchmark price without server-authoritative routing",
      ]));
      return NextResponse.json({ previews }, {
        headers: {
          "Cache-Control": "no-store",
          "X-Quote-Preview-Source": "manual-local",
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
        console.warn("Authoritative quote preview failed; returning manual review previews:", error);
      }
      const previews = parsed.data.quotes.map((input) => manualPreview(input, [
        "MANUAL_REVIEW_REQUIRED: Authoritative benchmark preview was unavailable before timeout",
      ]));
      return NextResponse.json({ previews }, {
        headers: {
          "Cache-Control": "no-store",
          "X-Quote-Preview-Source": "manual",
        },
      });
    }

  } catch (error) {
    console.error("Quote preview failed:", error);
    return NextResponse.json({ error: "Unable to preview quote price" }, { status: 500 });
  }
}

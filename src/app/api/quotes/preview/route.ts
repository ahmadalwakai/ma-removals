import { NextResponse } from "next/server";
import { z } from "zod";
import {
  calculateCanonicalQuotePricing,
  type CanonicalPricingDependencies,
  type CanonicalPricingResult,
} from "@/lib/quotes/canonical-pricing";
import { createQuoteRequestSchema, type CreateQuoteRequest } from "@/lib/quotes/schemas";

const previewRequestSchema = z.object({
  quotes: z.array(createQuoteRequestSchema).min(1).max(32),
});

function validationIssueCode(issue: { code: string; path: PropertyKey[] }): string {
  const [firstPath, , thirdPath] = issue.path;
  if (firstPath === "quotes" && issue.code === "too_big") return "TOO_MANY_PREVIEW_QUOTES";
  if (firstPath === "quotes" && thirdPath === "inventory" && issue.code === "too_big") {
    return "TOO_MANY_INVENTORY_ITEMS";
  }
  return "INVALID_PREVIEW_REQUEST";
}

function previewKey(date: string | null, movers: number) {
  return `${date ?? "flexible"}::${movers}`;
}

function shouldExposeDiagnostics() {
  return process.env.NODE_ENV === "development";
}

function crewFromResult(result: CanonicalPricingResult, movers: number) {
  const travelMinutes = result.routeMetrics?.durationMinutes ?? 0;
  const totalHandlingMinutes = result.inventory.summary.totalHandlingMinutes ?? 0;
  const loadingMinutes = Math.ceil(totalHandlingMinutes / 2);
  const unloadingMinutes = totalHandlingMinutes - loadingMinutes;
  return {
    movers: result.requiredCrew ?? movers,
    requestedMovers: movers,
    loadingMinutes,
    unloadingMinutes,
    travelMinutes,
    totalJobMinutes: travelMinutes + totalHandlingMinutes,
  };
}

export async function buildQuotePricePreview(
  quote: CreateQuoteRequest,
  dependencies: CanonicalPricingDependencies = {}
) {
  const movers = quote.preferredMovers ?? 1;
  const date = quote.moveDate ?? null;
  const result = await calculateCanonicalQuotePricing(quote, dependencies);

  if (result.status !== "MANUAL_REVIEW") {
    return {
      key: previewKey(date, movers),
      date,
      requestedMovers: movers,
      status: "AUTO_QUOTE" as const,
      totalPence: result.finalPricePence,
      originalTotalPence: result.finalPricePence,
      discountTotalPence: 0,
      promotionLabel: null,
      pricingAlgorithmVersion: result.pricingAlgorithmVersion,
      competitorBenchmarkId: result.competitorBenchmarkId,
      benchmarkPricePence: result.benchmarkPricePence,
      marketBenchmarkPence: result.marketBenchmarkPence,
      marketTargetPence: result.marketTargetPence,
      costFloorPence: result.costFloorPence,
      finalPricePence: result.finalPricePence,
      inputFingerprint: result.inputFingerprint,
      savingPercent: result.savingPercent,
      canonicalClassification: result.canonicalInput.classification,
      canonicalPropertySize: result.canonicalInput.propertySize,
      resolvedMoveScope: result.canonicalInput.resolvedMoveScope,
      moveScopeConfidence: result.canonicalInput.moveScopeConfidence,
      moveScopeReasonCodes: result.canonicalInput.moveScopeReasonCodes,
      moveScopeConfirmationRecommended: result.canonicalInput.moveScopeConfirmationRecommended,
      referenceProfileId: result.referenceProfile.profileId,
      referenceProfileVersion: result.referenceProfile.profileVersion,
      requiredCrew: result.requiredCrew,
      serverInputHash: result.serverInputHash,
      explanation: result.explanation,
      routeMileage: result.routeMetrics.distanceMiles,
      estimatedDurationMinutes: result.routeMetrics.durationMinutes,
      vehicle: {
        name: result.resourcePlan.vehicle.name,
        multipleVehiclesRequired: false,
        multipleTripsLikely: result.resourcePlan.vehicle.multipleTripsLikely,
      },
      inventory: result.inventory.summary,
      inventoryFacts: result.inventoryFacts,
      resourcePlan: result.resourcePlan,
      breakdown: result.breakdown,
      estimateSource: "authoritative" as const,
      crew: crewFromResult(result, movers),
      manualReviewReasons: [],
      ...(shouldExposeDiagnostics() ? {
        demandRatios: result.demandRatios,
        adjustmentBps: result.adjustmentBps,
        timingMs: result.timingMs,
      } : {}),
    };
  }

  return {
    key: previewKey(date, movers),
    date,
    requestedMovers: movers,
    status: "MANUAL_REVIEW" as const,
    totalPence: null,
    originalTotalPence: null,
    discountTotalPence: 0,
    promotionLabel: null,
    pricingAlgorithmVersion: result.pricingAlgorithmVersion,
    competitorBenchmarkId: null,
    benchmarkPricePence: null,
    marketBenchmarkPence: result.marketBenchmarkPence,
    marketTargetPence: result.marketTargetPence,
    costFloorPence: result.costFloorPence,
    finalPricePence: null,
    inputFingerprint: result.inputFingerprint,
    savingPercent: null,
    canonicalClassification: result.canonicalInput?.classification ?? null,
    canonicalPropertySize: result.canonicalInput?.propertySize ?? null,
    resolvedMoveScope: result.canonicalInput?.resolvedMoveScope ?? result.resolvedMoveScope,
    moveScopeConfidence: result.canonicalInput?.moveScopeConfidence ?? result.moveScopeConfidence,
    moveScopeReasonCodes: result.canonicalInput?.moveScopeReasonCodes ?? result.moveScopeReasonCodes,
    moveScopeConfirmationRecommended: result.canonicalInput?.moveScopeConfirmationRecommended ?? false,
    referenceProfileId: result.referenceProfile?.profileId ?? null,
    referenceProfileVersion: result.referenceProfile?.profileVersion ?? null,
    requiredCrew: result.requiredCrew ?? null,
    serverInputHash: result.serverInputHash,
    explanation: result.explanation,
    routeMileage: result.routeMetrics?.distanceMiles ?? null,
    estimatedDurationMinutes: result.routeMetrics?.durationMinutes ?? null,
    vehicle: {
      name: result.resourcePlan?.vehicle.name ?? null,
      multipleVehiclesRequired: false,
      multipleTripsLikely: result.resourcePlan?.vehicle.multipleTripsLikely ?? false,
    },
    inventory: result.inventory.summary,
    inventoryFacts: result.inventoryFacts,
    resourcePlan: result.resourcePlan ?? null,
    breakdown: [],
    estimateSource: "authoritative" as const,
    crew: crewFromResult(result, movers),
    manualReviewReasons: result.reasonCodes,
    ...(shouldExposeDiagnostics() ? { timingMs: result.timingMs } : {}),
  };
}

export function createQuotePreviewPostHandler(dependencies: CanonicalPricingDependencies = {}) {
  return async function POST(req: Request) {
    const validationStart = performance.now();
    const parsed = previewRequestSchema.safeParse(await req.json().catch(() => null));
    const requestValidationMs = Math.round((performance.now() - validationStart) * 10) / 10;
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => ({
        code: validationIssueCode(issue),
        path: issue.path.join("."),
      }));
      return NextResponse.json(
        {
          error: "Unable to load prices. Please retry.",
          code: issues[0]?.code ?? "INVALID_PREVIEW_REQUEST",
          issues,
          ...(shouldExposeDiagnostics() ? { timingMs: { requestValidation: requestValidationMs } } : {}),
        },
        { status: 400 }
      );
    }

    const pricingDependencies: CanonicalPricingDependencies = {
      ...dependencies,
      routeCache: dependencies.routeCache ?? new Map(),
      inventoryItemsCache: dependencies.inventoryItemsCache ?? new Map(),
      competitorBenchmarksCache: dependencies.competitorBenchmarksCache ?? new Map(),
    };
    const previews = await Promise.all(
      parsed.data.quotes.map((quote) => buildQuotePricePreview(quote, pricingDependencies))
    );
    return NextResponse.json({
      previews,
      ...(shouldExposeDiagnostics() ? { timingMs: { requestValidation: requestValidationMs } } : {}),
    });
  };
}

export const POST = createQuotePreviewPostHandler();

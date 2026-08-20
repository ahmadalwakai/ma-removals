import { db } from "@/lib/db";
import {
  isAnyVanCompetitorLabel,
  type BeatCompetitorCampaignSnapshot,
  type BenchmarkSelectionSnapshot,
  type CompetitorBenchmarkSnapshot,
  type CompetitorPricingContext,
  type PricingIssueCode,
} from "@/lib/pricing/competitor-benchmarks";
import {
  benchmarkSelectionCriteriaForQuote,
  type ResolvedInventoryItem,
} from "@/lib/pricing/domain";
import type { CreateQuoteRequest } from "@/lib/quotes/schemas";

function dateActive(startsAt: Date | null, endsAt: Date | null, now: Date): boolean {
  if (startsAt && startsAt.getTime() > now.getTime()) return false;
  if (endsAt && endsAt.getTime() <= now.getTime()) return false;
  return true;
}

function benchmarkSnapshot(row: Awaited<ReturnType<typeof db.competitorBenchmark.findMany>>[number]): CompetitorBenchmarkSnapshot {
  return {
    id: row.id,
    region: row.region,
    moveType: row.moveType,
    propertySize: row.propertySize,
    serviceLevel: row.serviceLevel,
    packingIncluded: row.packingIncluded,
    distanceBandMinMiles: row.distanceBandMinMiles,
    distanceBandMaxMiles: row.distanceBandMaxMiles,
    benchmarkPricePence: row.benchmarkPricePence,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: row.effectiveTo?.toISOString() ?? null,
    sourceNote: row.sourceNote,
    active: row.active,
  };
}

function campaignSnapshot(row: Awaited<ReturnType<typeof db.beatCompetitorCampaign.findFirst>>): BeatCompetitorCampaignSnapshot | null {
  if (!row) return null;
  return {
    id: row.id,
    enabled: row.enabled,
    internalName: row.internalName,
    competitorLabel: row.competitorLabel,
    applicableRegions: row.applicableRegions,
    applicableMoveTypes: row.applicableMoveTypes,
    applicablePropertySizes: row.applicablePropertySizes,
    beatPercentage: row.beatPercentage,
    beatFixedAmountPence: row.beatFixedAmountPence,
    minimumPricePence: row.minimumPricePence,
    minimumContributionPence: row.minimumContributionPence,
    minimumMarginPercent: row.minimumMarginPercent,
    maximumDiscountPence: row.maximumDiscountPence,
    allowZeroMargin: row.allowZeroMargin,
    allowNegativeMargin: row.allowNegativeMargin,
    maximumPermittedLossPence: row.maximumPermittedLossPence,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    dailyBookingLimit: row.dailyBookingLimit,
    totalCampaignBookingLimit: row.totalCampaignBookingLimit,
    dailyBookingCount: row.dailyBookingCount,
    dailyBookingDate: row.dailyBookingDate?.toISOString() ?? null,
    bookingCount: row.bookingCount,
    pausedAt: row.pausedAt?.toISOString() ?? null,
  };
}

function selectionBase(params: {
  classificationKind: BenchmarkSelectionSnapshot["classificationKind"];
  appliedFactor: 0.9 | 1;
  serviceLevel: string;
  packingIncluded: boolean;
  requestedPropertySize: string | null;
  effectivePropertySize: string | null;
  benchmarkPropertySizes: string[];
  distanceMiles: number | null;
  missingBenchmarkDimensions: string[];
}): BenchmarkSelectionSnapshot {
  return {
    ...params,
    matchingRegion: null,
    errorCode: null,
    errorMessage: null,
  };
}

function withError(
  selection: BenchmarkSelectionSnapshot,
  errorCode: PricingIssueCode,
  errorMessage: string
): BenchmarkSelectionSnapshot {
  return {
    ...selection,
    errorCode,
    errorMessage,
  };
}

async function matchingBenchmarks(params: {
  input: CreateQuoteRequest;
  region: string;
  propertySize: string;
  serviceLevel: string;
  packingIncluded: boolean;
  routeMileage: number;
}) {
  return db.competitorBenchmark.findMany({
    where: {
      region: params.region,
      moveType: params.input.moveType,
      propertySize: params.propertySize,
      serviceLevel: params.serviceLevel,
      packingIncluded: params.packingIncluded,
      distanceBandMinMiles: { lte: params.routeMileage },
      OR: [
        { distanceBandMaxMiles: null },
        { distanceBandMaxMiles: { gte: params.routeMileage } },
      ],
    },
    orderBy: [
      { effectiveFrom: "desc" },
      { createdAt: "desc" },
    ],
  });
}

export async function getCompetitorPricingContext(
  input: CreateQuoteRequest,
  routeMileage: number | null,
  inventory: ResolvedInventoryItem[] = []
): Promise<CompetitorPricingContext> {
  const now = new Date();
  const criteria = benchmarkSelectionCriteriaForQuote(input, inventory, routeMileage);
  const classification = criteria.classification;
  let selection = selectionBase({
    classificationKind: classification.kind,
    appliedFactor: classification.appliedFactor,
    serviceLevel: classification.serviceLevel,
    packingIncluded: classification.packingIncluded,
    requestedPropertySize: classification.requestedMoveSize,
    effectivePropertySize: classification.effectivePropertySize,
    benchmarkPropertySizes: classification.benchmarkPropertySizes,
    distanceMiles: routeMileage,
    missingBenchmarkDimensions: classification.missingBenchmarkDimensions,
  });

  const campaignPromise = db.beatCompetitorCampaign.findMany({
    where: {
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    orderBy: { createdAt: "desc" },
  });

  let benchmark: CompetitorBenchmarkSnapshot | null = null;

  if (routeMileage == null) {
    selection = withError(selection, "AUTHORITATIVE_ROUTE_UNAVAILABLE", "Server route mileage is required for benchmark selection");
  } else if (classification.kind === "UNSUPPORTED") {
    selection = withError(selection, "MANUAL_REVIEW_REQUIRED", "Move type or property size is not supported by benchmark pricing");
  } else if (classification.missingBenchmarkDimensions.length > 0) {
    selection = withError(
      selection,
      "MANUAL_REVIEW_REQUIRED",
      `Missing benchmark dimension: ${classification.missingBenchmarkDimensions.join(", ")}`
    );
  } else if (criteria.regionCandidates.length === 0) {
    selection = withError(selection, "BENCHMARK_UNAVAILABLE", "No deterministic collection or delivery region was available");
  } else if (classification.benchmarkPropertySizes.length === 0) {
    selection = withError(selection, "BENCHMARK_UNAVAILABLE", "No benchmark property or item class was available");
  } else {
    let sawInactiveOrExpired = false;
    let sawCandidate = false;

    outer:
    for (const region of criteria.regionCandidates) {
      for (const propertySize of classification.benchmarkPropertySizes) {
        const rows = await matchingBenchmarks({
          input,
          region,
          propertySize,
          serviceLevel: classification.serviceLevel,
          packingIncluded: classification.packingIncluded,
          routeMileage,
        });
        if (rows.length === 0) continue;
        sawCandidate = true;
        const valid = rows.filter((row) => (
          row.active &&
          row.benchmarkPricePence > 0 &&
          dateActive(row.effectiveFrom, row.effectiveTo, now)
        ));
        sawInactiveOrExpired ||= valid.length !== rows.length;

        if (valid.length > 1) {
          selection = withError(
            { ...selection, matchingRegion: region, effectivePropertySize: propertySize },
            "BENCHMARK_AMBIGUOUS",
            "Multiple active AnyVan benchmarks overlap the same region, class, date, packing mode and distance band"
          );
          break outer;
        }
        if (valid.length === 1) {
          benchmark = benchmarkSnapshot(valid[0]!);
          selection = {
            ...selection,
            matchingRegion: region,
            effectivePropertySize: propertySize,
          };
          break outer;
        }
      }
    }

    if (!benchmark && !selection.errorCode) {
      selection = withError(
        selection,
        sawCandidate && sawInactiveOrExpired ? "BENCHMARK_EXPIRED" : "BENCHMARK_UNAVAILABLE",
        sawCandidate && sawInactiveOrExpired
          ? "Only inactive, expired or not-yet-effective benchmarks matched the normalized inputs"
          : "No AnyVan benchmark matched the normalized region, class, packing mode and distance band"
      );
    }
  }

  const campaigns = await campaignPromise;
  const campaign =
    campaigns.find((entry) => entry.enabled && !entry.pausedAt && isAnyVanCompetitorLabel(entry.competitorLabel)) ??
    campaigns.find((entry) => entry.enabled && !entry.pausedAt) ??
    null;

  return {
    benchmark,
    campaign: campaignSnapshot(campaign),
    serviceLevel: classification.serviceLevel,
    packingIncluded: classification.packingIncluded,
    selection,
  };
}

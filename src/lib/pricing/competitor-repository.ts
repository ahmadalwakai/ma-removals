import { db } from "@/lib/db";
import {
  isAnyVanCompetitorLabel,
  type BeatCompetitorCampaignSnapshot,
  type CompetitorBenchmarkSnapshot,
  type CompetitorPricingContext,
} from "@/lib/pricing/competitor-benchmarks";
import type { CreateQuoteRequest } from "@/lib/quotes/schemas";

function regionCandidates(input: CreateQuoteRequest): string[] {
  return [
    input.collection.region,
    input.delivery.region,
    input.collection.city,
    input.delivery.city,
  ].filter((value): value is string => Boolean(value));
}

function benchmarkSnapshot(row: Awaited<ReturnType<typeof db.competitorBenchmark.findFirst>>): CompetitorBenchmarkSnapshot | null {
  if (!row) return null;
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

export async function getCompetitorPricingContext(
  input: CreateQuoteRequest,
  routeMileage: number | null
): Promise<CompetitorPricingContext> {
  const now = new Date();
  const regions = regionCandidates(input);
  const serviceLevel = "standard";
  // Customer-facing packing is priced as an explicit add-on. Competitor
  // benchmarks therefore lock the base move price, then the pricing domain
  // adds protected add-ons on top of that locked base.
  const hasPacking = false;
  const [campaigns, benchmark] = await Promise.all([
    db.beatCompetitorCampaign.findMany({
      where: {
        enabled: true,
        pausedAt: null,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      },
      orderBy: { createdAt: "desc" },
    }),
    input.moveSize && routeMileage != null
      ? db.competitorBenchmark.findFirst({
          where: {
            active: true,
            moveType: input.moveType,
            propertySize: input.moveSize,
            serviceLevel,
            packingIncluded: hasPacking,
            region: { in: regions },
            distanceBandMinMiles: { lte: routeMileage },
            OR: [{ distanceBandMaxMiles: null }, { distanceBandMaxMiles: { gte: routeMileage } }],
            effectiveFrom: { lte: now },
            AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }],
          },
          orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        })
      : Promise.resolve(null),
  ]);
  const campaign = campaigns.find((entry) => isAnyVanCompetitorLabel(entry.competitorLabel)) ?? campaigns[0] ?? null;

  return {
    benchmark: benchmarkSnapshot(benchmark),
    campaign: campaignSnapshot(campaign),
    serviceLevel,
    packingIncluded: hasPacking,
  };
}

import type { CreateQuoteRequest } from "@/lib/quotes/schemas";

export interface CompetitorBenchmarkSnapshot {
  id: string;
  region: string;
  moveType: string;
  propertySize: string;
  serviceLevel: string;
  packingIncluded: boolean;
  distanceBandMinMiles: number;
  distanceBandMaxMiles: number | null;
  benchmarkPricePence: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceNote: string;
  active: boolean;
}

export interface BeatCompetitorCampaignSnapshot {
  id: string;
  enabled: boolean;
  internalName: string;
  competitorLabel: string;
  applicableRegions: string[];
  applicableMoveTypes: string[];
  applicablePropertySizes: string[];
  beatPercentage: number;
  beatFixedAmountPence: number | null;
  minimumPricePence: number | null;
  minimumContributionPence: number | null;
  minimumMarginPercent: number | null;
  maximumDiscountPence: number | null;
  allowZeroMargin: boolean;
  allowNegativeMargin: boolean;
  maximumPermittedLossPence: number | null;
  startsAt: string | null;
  endsAt: string | null;
  dailyBookingLimit: number | null;
  totalCampaignBookingLimit: number | null;
  dailyBookingCount: number;
  dailyBookingDate: string | null;
  bookingCount: number;
  pausedAt: string | null;
}

export interface CompetitorPricingContext {
  benchmark: CompetitorBenchmarkSnapshot | null;
  campaign: BeatCompetitorCampaignSnapshot | null;
  serviceLevel: string;
  packingIncluded: boolean;
}

export interface CompetitorEvaluationJob {
  input: CreateQuoteRequest;
  routeMileage: number | null;
  normalOperationalPricePence: number;
  minimumCustomerPricePence: number;
  estimatedCostPence: number;
  globalMinimumContributionPence: number;
  globalMinimumMarginPercent: number | null;
  now: Date;
}

export interface CompetitorEvaluationResult {
  applied: boolean;
  benchmarkId: string | null;
  campaignId: string | null;
  normalOperationalPricePence: number;
  benchmarkPricePence: number | null;
  targetPricePence: number | null;
  safeMinimumPricePence: number | null;
  finalPricePence: number | null;
  discountPence: number;
  savingAgainstBenchmarkPence: number | null;
  appliedRule: string | null;
  unableReason: string | null;
  customerLabel: string | null;
  enforceExactTarget: boolean;
  internalNotes: string[];
}

export const ANYVAN_MINIMUM_BEAT_PERCENTAGE = 0.1;

export function isAnyVanCompetitorLabel(label: string): boolean {
  return label.replace(/[\s._-]+/g, "").toLowerCase().includes("anyvan");
}

function effectiveBeatPercentage(campaign: BeatCompetitorCampaignSnapshot): number {
  return isAnyVanCompetitorLabel(campaign.competitorLabel)
    ? Math.max(campaign.beatPercentage, ANYVAN_MINIMUM_BEAT_PERCENTAGE)
    : campaign.beatPercentage;
}

function dateActive(startsAt: string | null, endsAt: string | null, now: Date): boolean {
  if (startsAt && new Date(startsAt).getTime() > now.getTime()) return false;
  if (endsAt && new Date(endsAt).getTime() <= now.getTime()) return false;
  return true;
}

function listMatches(allowed: string[], value: string | null | undefined): boolean {
  if (allowed.length === 0) return true;
  if (!value) return false;
  return allowed.some((entry) => entry.toLowerCase() === value.toLowerCase());
}

function sameUtcDay(a: string | null, b: Date): boolean {
  return a?.slice(0, 10) === b.toISOString().slice(0, 10);
}

function regionMatches(allowed: string[], input: CreateQuoteRequest): boolean {
  if (allowed.length === 0) return true;
  const candidates = [
    input.collection.region,
    input.delivery.region,
    input.collection.city,
    input.delivery.city,
  ].filter((value): value is string => Boolean(value)).map((value) => value.toLowerCase());
  return allowed.some((entry) => candidates.includes(entry.toLowerCase()));
}

function safeMinimumPrice(params: {
  minimumCustomerPricePence: number;
  estimatedCostPence: number;
  globalMinimumContributionPence: number;
  globalMinimumMarginPercent: number | null;
  campaign: BeatCompetitorCampaignSnapshot;
}): number {
  const campaign = params.campaign;
  const minimumPrice = Math.max(params.minimumCustomerPricePence, campaign.minimumPricePence ?? 0);
  const minimumContribution = campaign.minimumContributionPence ?? params.globalMinimumContributionPence;
  const minimumMargin = campaign.minimumMarginPercent ?? params.globalMinimumMarginPercent;
  const negativeMarginAllowed = campaign.allowNegativeMargin && campaign.maximumPermittedLossPence != null;
  let safe = minimumPrice;

  if (negativeMarginAllowed) {
    safe = Math.max(safe, params.estimatedCostPence - campaign.maximumPermittedLossPence!);
    if (minimumContribution > 0) {
      safe = Math.max(safe, params.estimatedCostPence + minimumContribution);
    }
  } else {
    const contributionFloor = campaign.allowZeroMargin ? minimumContribution : Math.max(1, minimumContribution);
    safe = Math.max(safe, params.estimatedCostPence + contributionFloor);
  }

  if (minimumMargin != null && minimumMargin < 1) {
    safe = Math.max(safe, Math.ceil(params.estimatedCostPence / (1 - minimumMargin)));
  }

  return Math.max(0, Math.ceil(safe));
}

export function evaluateCompetitorBenchmark(
  job: CompetitorEvaluationJob,
  context: CompetitorPricingContext | null | undefined
): CompetitorEvaluationResult {
  const empty: CompetitorEvaluationResult = {
    applied: false,
    benchmarkId: null,
    campaignId: null,
    normalOperationalPricePence: job.normalOperationalPricePence,
    benchmarkPricePence: null,
    targetPricePence: null,
    safeMinimumPricePence: null,
    finalPricePence: null,
    discountPence: 0,
    savingAgainstBenchmarkPence: null,
    appliedRule: null,
    unableReason: null,
    customerLabel: null,
    enforceExactTarget: false,
    internalNotes: [],
  };
  if (!context?.campaign) return { ...empty, unableReason: "Beat competitor mode is not configured" };
  const campaign = context.campaign;
  if (!campaign.enabled || campaign.pausedAt) return { ...empty, campaignId: campaign.id, unableReason: "Beat competitor mode is disabled or paused" };
  if (!dateActive(campaign.startsAt, campaign.endsAt, job.now)) return { ...empty, campaignId: campaign.id, unableReason: "Beat competitor campaign is not active for this date" };
  if (campaign.totalCampaignBookingLimit != null && campaign.bookingCount >= campaign.totalCampaignBookingLimit) {
    return { ...empty, campaignId: campaign.id, unableReason: "Beat competitor total booking limit has been reached" };
  }
  const effectiveDailyBookingCount = sameUtcDay(campaign.dailyBookingDate, job.now) ? campaign.dailyBookingCount : 0;
  if (campaign.dailyBookingLimit != null && effectiveDailyBookingCount >= campaign.dailyBookingLimit) {
    return { ...empty, campaignId: campaign.id, unableReason: "Beat competitor daily booking limit has been reached" };
  }
  const anyVanCampaign = isAnyVanCompetitorLabel(campaign.competitorLabel);
  if (!regionMatches(campaign.applicableRegions, job.input)) return { ...empty, campaignId: campaign.id, unableReason: "Beat competitor campaign does not apply to this region" };
  if (!anyVanCampaign && !listMatches(campaign.applicableMoveTypes, job.input.moveType)) {
    return { ...empty, campaignId: campaign.id, unableReason: "Beat competitor campaign does not apply to this move type" };
  }
  if (!anyVanCampaign && !listMatches(campaign.applicablePropertySizes, job.input.moveSize)) {
    return { ...empty, campaignId: campaign.id, unableReason: "Beat competitor campaign does not apply to this property size" };
  }

  const benchmark = context.benchmark;
  if (!benchmark) return { ...empty, campaignId: campaign.id, unableReason: "No eligible competitor benchmark is configured" };
  if (!benchmark.active || !dateActive(benchmark.effectiveFrom, benchmark.effectiveTo, job.now)) {
    return { ...empty, benchmarkId: benchmark.id, campaignId: campaign.id, unableReason: "Competitor benchmark is inactive or expired" };
  }
  if (benchmark.moveType !== job.input.moveType) return { ...empty, benchmarkId: benchmark.id, campaignId: campaign.id, unableReason: "Competitor benchmark move type mismatch" };
  if (benchmark.propertySize !== job.input.moveSize) return { ...empty, benchmarkId: benchmark.id, campaignId: campaign.id, unableReason: "Competitor benchmark property size mismatch" };
  if (benchmark.packingIncluded !== context.packingIncluded) return { ...empty, benchmarkId: benchmark.id, campaignId: campaign.id, unableReason: "Competitor benchmark packing mode mismatch" };
  if (job.routeMileage == null || job.routeMileage < benchmark.distanceBandMinMiles) {
    return { ...empty, benchmarkId: benchmark.id, campaignId: campaign.id, unableReason: "Competitor benchmark distance band mismatch" };
  }
  if (benchmark.distanceBandMaxMiles != null && job.routeMileage > benchmark.distanceBandMaxMiles) {
    return { ...empty, benchmarkId: benchmark.id, campaignId: campaign.id, unableReason: "Competitor benchmark distance band mismatch" };
  }

  const safeMinimum = safeMinimumPrice({
    minimumCustomerPricePence: job.minimumCustomerPricePence,
    estimatedCostPence: job.estimatedCostPence,
    globalMinimumContributionPence: job.globalMinimumContributionPence,
    globalMinimumMarginPercent: job.globalMinimumMarginPercent,
    campaign,
  });
  const beatPercentage = effectiveBeatPercentage(campaign);
  const percentageBeat = Math.ceil(benchmark.benchmarkPricePence * beatPercentage);
  let target = Math.max(0, benchmark.benchmarkPricePence - percentageBeat - (campaign.beatFixedAmountPence ?? 0));
  let maxDiscountLimited = false;
  if (campaign.maximumDiscountPence != null && job.normalOperationalPricePence - target > campaign.maximumDiscountPence) {
    target = job.normalOperationalPricePence - campaign.maximumDiscountPence;
    maxDiscountLimited = true;
  }
  const finalPrice = Math.min(job.normalOperationalPricePence, Math.max(target, safeMinimum));
  const discount = Math.max(0, job.normalOperationalPricePence - finalPrice);
  const savingAgainstBenchmark = benchmark.benchmarkPricePence - finalPrice;
  const unableReason = maxDiscountLimited
    ? "Maximum discount cap limited the benchmark target"
    : finalPrice >= benchmark.benchmarkPricePence
      ? "Safe minimum price prevents beating the configured benchmark"
      : null;

  return {
    applied: discount > 0,
    benchmarkId: benchmark.id,
    campaignId: campaign.id,
    normalOperationalPricePence: job.normalOperationalPricePence,
    benchmarkPricePence: benchmark.benchmarkPricePence,
    targetPricePence: target,
    safeMinimumPricePence: safeMinimum,
    finalPricePence: discount > 0 ? finalPrice : null,
    discountPence: discount,
    savingAgainstBenchmarkPence: savingAgainstBenchmark > 0 ? savingAgainstBenchmark : 0,
    appliedRule: discount > 0 ? "beat_competitor" : null,
    unableReason,
    customerLabel: discount > 0 ? "Online booking price" : null,
    enforceExactTarget: false,
    internalNotes: [
      `Beat competitor campaign ${campaign.internalName} evaluated against ${campaign.competitorLabel}`,
      ...(anyVanCampaign && campaign.beatPercentage < ANYVAN_MINIMUM_BEAT_PERCENTAGE
        ? [`AnyVan minimum beat raised from ${Math.round(campaign.beatPercentage * 100)}% to 10%`]
        : []),
      ...(campaign.allowNegativeMargin && campaign.maximumPermittedLossPence == null
        ? ["Negative-margin setting ignored because no maximum permitted loss is configured"]
        : []),
      ...(anyVanCampaign
        ? ["AnyVan minimum beat applies across all move types and property sizes with standard margin and discount protections"]
        : []),
      `Benchmark ${benchmark.id} source note: ${benchmark.sourceNote}`,
      ...(maxDiscountLimited ? ["Maximum discount cap reached"] : []),
      ...(unableReason ? [unableReason] : []),
    ],
  };
}

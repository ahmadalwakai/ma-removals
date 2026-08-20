import type { CreateQuoteRequest } from "@/lib/quotes/schemas";

export type PricingIssueCode =
  | "BENCHMARK_UNAVAILABLE"
  | "BENCHMARK_EXPIRED"
  | "BENCHMARK_AMBIGUOUS"
  | "MANUAL_REVIEW_REQUIRED"
  | "AUTHORITATIVE_ROUTE_UNAVAILABLE"
  | "SAFETY_REVIEW_REQUIRED";

export type PricingClassificationKind = "FULL_HOUSE" | "ITEM_LED" | "UNSUPPORTED";

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

export interface BenchmarkSelectionSnapshot {
  classificationKind: PricingClassificationKind;
  appliedFactor: 0.9 | 1;
  serviceLevel: string;
  packingIncluded: boolean;
  requestedPropertySize: string | null;
  effectivePropertySize: string | null;
  benchmarkPropertySizes: string[];
  matchingRegion: string | null;
  distanceMiles: number | null;
  missingBenchmarkDimensions: string[];
  errorCode: PricingIssueCode | null;
  errorMessage: string | null;
}

export interface CompetitorPricingContext {
  benchmark: CompetitorBenchmarkSnapshot | null;
  campaign: BeatCompetitorCampaignSnapshot | null;
  serviceLevel: string;
  packingIncluded: boolean;
  selection: BenchmarkSelectionSnapshot;
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

export const ANYVAN_HOUSE_FACTOR = 0.9 as const;
export const ANYVAN_ITEM_LED_FACTOR = 1 as const;

export function isAnyVanCompetitorLabel(label: string): boolean {
  return label.replace(/[\s._-]+/g, "").toLowerCase().includes("anyvan");
}

export function pricingIssueReason(code: PricingIssueCode, detail: string): string {
  return `${code}: ${detail}`;
}

function emptyEvaluation(
  job: CompetitorEvaluationJob,
  unableReason: string | null,
  benchmarkId: string | null = null,
  campaignId: string | null = null
): CompetitorEvaluationResult {
  return {
    applied: false,
    benchmarkId,
    campaignId,
    normalOperationalPricePence: job.normalOperationalPricePence,
    benchmarkPricePence: null,
    targetPricePence: null,
    safeMinimumPricePence: null,
    finalPricePence: null,
    discountPence: 0,
    savingAgainstBenchmarkPence: null,
    appliedRule: null,
    unableReason,
    customerLabel: null,
    enforceExactTarget: false,
    internalNotes: unableReason ? [unableReason] : [],
  };
}

export function evaluateCompetitorBenchmark(
  job: CompetitorEvaluationJob,
  context: CompetitorPricingContext | null | undefined
): CompetitorEvaluationResult {
  if (!context?.benchmark) {
    return emptyEvaluation(job, context?.selection.errorCode ?? "BENCHMARK_UNAVAILABLE");
  }

  const benchmark = context.benchmark;
  const factor = context.selection.appliedFactor;
  const targetPricePence = Math.floor(benchmark.benchmarkPricePence * factor);
  const discountPence = Math.max(0, benchmark.benchmarkPricePence - targetPricePence);

  return {
    applied: true,
    benchmarkId: benchmark.id,
    campaignId: context.campaign?.id ?? null,
    normalOperationalPricePence: job.normalOperationalPricePence,
    benchmarkPricePence: benchmark.benchmarkPricePence,
    targetPricePence,
    safeMinimumPricePence: null,
    finalPricePence: targetPricePence,
    discountPence,
    savingAgainstBenchmarkPence: discountPence,
    appliedRule: factor === ANYVAN_HOUSE_FACTOR ? "anyvan_house_90_percent" : "anyvan_item_led_100_percent",
    unableReason: null,
    customerLabel: factor === ANYVAN_HOUSE_FACTOR ? "10% below AnyVan benchmark" : "AnyVan benchmark price",
    enforceExactTarget: true,
    internalNotes: [
      `Selected benchmark ${benchmark.id}`,
      `Benchmark source note: ${benchmark.sourceNote}`,
      `Applied factor ${factor.toFixed(2)}`,
    ],
  };
}

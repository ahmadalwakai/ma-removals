import type { CreateQuoteRequest } from "@/lib/quotes/schemas";

export type PromotionCampaignKind =
  | "STANDARD"
  | "GROWTH"
  | "AGGRESSIVE"
  | "OCCUPANCY_FILL"
  | "BACKHAUL"
  | "STUDENT_MOVE"
  | "SINGLE_ITEM"
  | "LAST_MINUTE"
  | "RECOVERY"
  | "MANUAL_CAMPAIGN";

export interface PromotionCampaignSnapshot {
  id: string;
  type: PromotionCampaignKind;
  internalName: string;
  customerLabel: string;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  percentageReduction: number | null;
  fixedReductionPence: number | null;
  maximumDiscountPence: number | null;
  maximumDiscountPercent: number | null;
  hardMinimumPricePence: number | null;
  hardMinimumContributionPence: number | null;
  hardMinimumMarginPercent: number | null;
  allowZeroMargin: boolean;
  allowNegativeMargin: boolean;
  maximumPermittedLossPence: number | null;
  campaignBudgetPence: number | null;
  dailyBudgetPence: number | null;
  spentBudgetPence: number;
  dailySpentBudgetPence: number;
  maximumRedemptions: number | null;
  redemptionCount: number;
  stackable: boolean;
  pausedAt: string | null;
  rules: Record<string, unknown> | null;
}

export interface PromotionCodeSnapshot {
  id: string;
  code: string;
  normalizedCode: string;
  internalName: string;
  customerLabel: string;
  active: boolean;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  maximumDiscountPence: number | null;
  minimumSubtotalPence: number | null;
  maximumSubtotalPence: number | null;
  startsAt: string | null;
  endsAt: string | null;
  maximumRedemptions: number | null;
  maximumRedemptionsPerCustomer: number | null;
  applicableMoveTypes: string[];
  applicableRegions: string[];
  applicableWeekdays: number[];
  applicableVehicleClasses: string[];
  firstBookingOnly: boolean;
  stackable: boolean;
  redemptionCount: number;
  campaignId: string | null;
}

export interface PromotionPricingContext {
  campaigns: PromotionCampaignSnapshot[];
  promotionCode: PromotionCodeSnapshot | null;
  priorCompletedBookings: number;
  minimumContributionPence: number;
  minimumMarginPercent: number | null;
  allowZeroMargin: boolean;
  allowNegativeMargin: boolean;
}

export interface PromotionJobContext {
  input: CreateQuoteRequest;
  routeMileage: number | null;
  totalVolumeM3: number;
  totalJobMinutes: number;
  movers: number;
  vehicleClassId: string | null;
  vehicleName: string | null;
  heavyOrSpecialItemCount: number;
  subtotalPence: number;
  estimatedCostPence: number;
  now: Date;
}

export interface AppliedPromotion {
  source: "campaign" | "code";
  id: string;
  code?: string;
  type?: PromotionCampaignKind;
  customerLabel: string;
  discountPence: number;
  stackable: boolean;
}

export interface PromotionEvaluationResult {
  applied: AppliedPromotion[];
  discountTotalPence: number;
  customerLabel: string | null;
  manualReviewReasons: string[];
  internalNotes: string[];
}

export function normalizePromotionCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry)) : [];
}

function dateActive(startsAt: string | null, endsAt: string | null, now: Date): boolean {
  if (startsAt && new Date(startsAt).getTime() > now.getTime()) return false;
  if (endsAt && new Date(endsAt).getTime() <= now.getTime()) return false;
  return true;
}

function moveDate(input: CreateQuoteRequest): Date | null {
  if (!input.moveDate) return null;
  const date = new Date(`${input.moveDate}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
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

function computeCampaignDiscount(campaign: PromotionCampaignSnapshot, subtotalPence: number): number {
  let discount = 0;
  if (campaign.percentageReduction != null) {
    discount += Math.round(subtotalPence * campaign.percentageReduction);
  }
  if (campaign.fixedReductionPence != null) {
    discount += campaign.fixedReductionPence;
  }
  if (campaign.maximumDiscountPercent != null) {
    discount = Math.min(discount, Math.round(subtotalPence * campaign.maximumDiscountPercent));
  }
  if (campaign.maximumDiscountPence != null) {
    discount = Math.min(discount, campaign.maximumDiscountPence);
  }
  return Math.max(0, Math.min(discount, subtotalPence));
}

function computeCodeDiscount(code: PromotionCodeSnapshot, subtotalPence: number): number {
  const raw = code.discountType === "FIXED"
    ? code.discountValue
    : Math.round(subtotalPence * (code.discountValue / 10_000));
  const capped = code.maximumDiscountPence == null ? raw : Math.min(raw, code.maximumDiscountPence);
  return Math.max(0, Math.min(capped, subtotalPence));
}

function passesMarginProtection(params: {
  subtotalPence: number;
  discountPence: number;
  estimatedCostPence: number;
  minimumPricePence: number;
  minimumContributionPence: number;
  minimumMarginPercent: number | null;
  allowZeroMargin: boolean;
  allowNegativeMargin: boolean;
  maximumPermittedLossPence: number | null;
}): boolean {
  const finalPence = params.subtotalPence - params.discountPence;
  if (finalPence < params.minimumPricePence) return false;
  const contribution = finalPence - params.estimatedCostPence;
  if (!params.allowNegativeMargin && contribution < 0) return false;
  if (!params.allowZeroMargin && contribution <= 0) return false;
  if (params.maximumPermittedLossPence != null && contribution < -params.maximumPermittedLossPence) return false;
  if (contribution < params.minimumContributionPence) return false;
  const margin = finalPence > 0 ? contribution / finalPence : -1;
  if (params.minimumMarginPercent != null && margin < params.minimumMarginPercent) return false;
  return true;
}

function campaignCandidate(
  campaign: PromotionCampaignSnapshot,
  job: PromotionJobContext,
  context: PromotionPricingContext
): AppliedPromotion | null {
  if (!campaign.active || campaign.pausedAt) return null;
  if (!dateActive(campaign.startsAt, campaign.endsAt, job.now)) return null;
  if (campaign.maximumRedemptions != null && campaign.redemptionCount >= campaign.maximumRedemptions) return null;
  if (campaign.campaignBudgetPence != null && campaign.spentBudgetPence >= campaign.campaignBudgetPence) return null;
  if (campaign.dailyBudgetPence != null && campaign.dailySpentBudgetPence >= campaign.dailyBudgetPence) return null;

  const rules = campaign.rules ?? {};
  const moveTypes = asStringArray(rules.applicableMoveTypes);
  if (moveTypes.length > 0 && !moveTypes.includes(job.input.moveType)) return null;
  const weekdays = asNumberArray(rules.applicableWeekdays);
  const date = moveDate(job.input);
  if (weekdays.length > 0 && (!date || !weekdays.includes(date.getDay()))) return null;
  const regions = asStringArray(rules.applicableRegions);
  if (!regionMatches(regions, job.input)) return null;
  const vehicleClasses = asStringArray(rules.applicableVehicleClasses);
  if (vehicleClasses.length > 0 && !vehicleClasses.includes(job.vehicleClassId ?? job.vehicleName ?? "")) return null;
  const minMileage = typeof rules.minimumMileage === "number" ? rules.minimumMileage : null;
  const maxMileage = typeof rules.maximumMileage === "number" ? rules.maximumMileage : null;
  if (minMileage != null && (job.routeMileage == null || job.routeMileage < minMileage)) return null;
  if (maxMileage != null && (job.routeMileage == null || job.routeMileage > maxMileage)) return null;
  const maxVolume = typeof rules.maximumInventoryVolumeM3 === "number" ? rules.maximumInventoryVolumeM3 : null;
  if (maxVolume != null && job.totalVolumeM3 > maxVolume) return null;
  const maxDuration = typeof rules.maximumJobDurationMinutes === "number" ? rules.maximumJobDurationMinutes : null;
  if (maxDuration != null && job.totalJobMinutes > maxDuration) return null;
  const maxMovers = typeof rules.maximumMovers === "number" ? rules.maximumMovers : null;
  if (maxMovers != null && job.movers > maxMovers) return null;
  if (rules.excludeSpecialistItems === true && job.heavyOrSpecialItemCount > 0) return null;
  const minBasket = typeof rules.minimumBasketPence === "number" ? rules.minimumBasketPence : null;
  const maxBasket = typeof rules.maximumBasketPence === "number" ? rules.maximumBasketPence : null;
  if (minBasket != null && job.subtotalPence < minBasket) return null;
  if (maxBasket != null && job.subtotalPence > maxBasket) return null;
  if (rules.flexibleDateOnly === true && !job.input.flexibleDate) return null;
  if (rules.flexibleTimeOnly === true && !job.input.flexibleTime) return null;
  if (rules.firstBookingOnly === true && context.priorCompletedBookings > 0) return null;

  const discountPence = computeCampaignDiscount(campaign, job.subtotalPence);
  if (discountPence <= 0) return null;
  const minimumPricePence = campaign.hardMinimumPricePence ?? 0;
  const minimumContributionPence = campaign.hardMinimumContributionPence ?? context.minimumContributionPence;
  const minimumMarginPercent = campaign.hardMinimumMarginPercent ?? context.minimumMarginPercent;
  if (!passesMarginProtection({
    subtotalPence: job.subtotalPence,
    discountPence,
    estimatedCostPence: job.estimatedCostPence,
    minimumPricePence,
    minimumContributionPence,
    minimumMarginPercent,
    allowZeroMargin: campaign.allowZeroMargin || context.allowZeroMargin,
    allowNegativeMargin: campaign.allowNegativeMargin || context.allowNegativeMargin,
    maximumPermittedLossPence: campaign.maximumPermittedLossPence,
  })) {
    return null;
  }

  return {
    source: "campaign",
    id: campaign.id,
    type: campaign.type,
    customerLabel: campaign.customerLabel,
    discountPence,
    stackable: campaign.stackable,
  };
}

function codeCandidate(
  code: PromotionCodeSnapshot | null,
  job: PromotionJobContext,
  context: PromotionPricingContext
): AppliedPromotion | null {
  if (!code?.active) return null;
  if (!dateActive(code.startsAt, code.endsAt, job.now)) return null;
  if (code.maximumRedemptions != null && code.redemptionCount >= code.maximumRedemptions) return null;
  if (code.minimumSubtotalPence != null && job.subtotalPence < code.minimumSubtotalPence) return null;
  if (code.maximumSubtotalPence != null && job.subtotalPence > code.maximumSubtotalPence) return null;
  if (code.applicableMoveTypes.length > 0 && !code.applicableMoveTypes.includes(job.input.moveType)) return null;
  if (!regionMatches(code.applicableRegions, job.input)) return null;
  const date = moveDate(job.input);
  if (code.applicableWeekdays.length > 0 && (!date || !code.applicableWeekdays.includes(date.getDay()))) return null;
  if (code.applicableVehicleClasses.length > 0 && !code.applicableVehicleClasses.includes(job.vehicleClassId ?? job.vehicleName ?? "")) return null;
  if (code.firstBookingOnly && context.priorCompletedBookings > 0) return null;

  const discountPence = computeCodeDiscount(code, job.subtotalPence);
  if (discountPence <= 0) return null;
  if (!passesMarginProtection({
    subtotalPence: job.subtotalPence,
    discountPence,
    estimatedCostPence: job.estimatedCostPence,
    minimumPricePence: 0,
    minimumContributionPence: context.minimumContributionPence,
    minimumMarginPercent: context.minimumMarginPercent,
    allowZeroMargin: context.allowZeroMargin,
    allowNegativeMargin: context.allowNegativeMargin,
    maximumPermittedLossPence: null,
  })) {
    return null;
  }

  return {
    source: "code",
    id: code.id,
    code: code.normalizedCode,
    customerLabel: code.customerLabel,
    discountPence,
    stackable: code.stackable,
  };
}

export function evaluatePromotions(
  job: PromotionJobContext,
  context: PromotionPricingContext | null | undefined
): PromotionEvaluationResult {
  if (!context) {
    return { applied: [], discountTotalPence: 0, customerLabel: null, manualReviewReasons: [], internalNotes: [] };
  }

  const internalNotes: string[] = [];
  const campaignCandidates = context.campaigns
    .map((campaign) => campaignCandidate(campaign, job, context))
    .filter((candidate): candidate is AppliedPromotion => Boolean(candidate))
    .sort((a, b) => b.discountPence - a.discountPence);
  const code = codeCandidate(context.promotionCode, job, context);

  let applied: AppliedPromotion[] = [];
  if (code && !code.stackable) {
    const bestAuto = campaignCandidates[0] ?? null;
    applied = !bestAuto || code.discountPence >= bestAuto.discountPence ? [code] : [bestAuto];
  } else {
    const stackableCampaigns = campaignCandidates.filter((candidate) => candidate.stackable);
    const bestNonStackable = campaignCandidates.find((candidate) => !candidate.stackable) ?? null;
    applied = [...(code ? [code] : []), ...stackableCampaigns];
    if (bestNonStackable && applied.length === 0) applied = [bestNonStackable];
    if (bestNonStackable && applied.length > 0 && applied.every((candidate) => candidate.stackable)) {
      applied.push(bestNonStackable);
    }
  }

  let runningDiscount = 0;
  const safeApplied: AppliedPromotion[] = [];
  for (const candidate of applied) {
    const proposedDiscount = Math.min(candidate.discountPence, Math.max(0, job.subtotalPence - runningDiscount));
    if (proposedDiscount <= 0) continue;
    if (!passesMarginProtection({
      subtotalPence: job.subtotalPence,
      discountPence: runningDiscount + proposedDiscount,
      estimatedCostPence: job.estimatedCostPence,
      minimumPricePence: 0,
      minimumContributionPence: context.minimumContributionPence,
      minimumMarginPercent: context.minimumMarginPercent,
      allowZeroMargin: context.allowZeroMargin,
      allowNegativeMargin: context.allowNegativeMargin,
      maximumPermittedLossPence: null,
    })) {
      internalNotes.push(`Skipped ${candidate.customerLabel} because margin protection blocked the combined discount`);
      continue;
    }
    runningDiscount += proposedDiscount;
    safeApplied.push({ ...candidate, discountPence: proposedDiscount });
  }

  return {
    applied: safeApplied,
    discountTotalPence: runningDiscount,
    customerLabel: safeApplied[0]?.customerLabel ?? null,
    manualReviewReasons: [],
    internalNotes,
  };
}

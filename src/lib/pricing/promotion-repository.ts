import crypto from "node:crypto";
import { db } from "@/lib/db";
import { normalizePromotionCode, type PromotionCampaignSnapshot, type PromotionCodeSnapshot, type PromotionPricingContext } from "@/lib/pricing/promotions";
import type { CreateQuoteRequest } from "@/lib/quotes/schemas";

function hashIdentity(value: string | undefined | null): string | null {
  if (!value) return null;
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function asRules(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function campaignSnapshot(campaign: Awaited<ReturnType<typeof db.promotionCampaign.findMany>>[number]): PromotionCampaignSnapshot {
  return {
    id: campaign.id,
    type: campaign.type,
    internalName: campaign.internalName,
    customerLabel: campaign.customerLabel,
    active: campaign.active,
    startsAt: campaign.startsAt?.toISOString() ?? null,
    endsAt: campaign.endsAt?.toISOString() ?? null,
    percentageReduction: campaign.percentageReduction,
    fixedReductionPence: campaign.fixedReductionPence,
    maximumDiscountPence: campaign.maximumDiscountPence,
    maximumDiscountPercent: campaign.maximumDiscountPercent,
    hardMinimumPricePence: campaign.hardMinimumPricePence,
    hardMinimumContributionPence: campaign.hardMinimumContributionPence,
    hardMinimumMarginPercent: campaign.hardMinimumMarginPercent,
    allowZeroMargin: campaign.allowZeroMargin,
    allowNegativeMargin: campaign.allowNegativeMargin,
    maximumPermittedLossPence: campaign.maximumPermittedLossPence,
    campaignBudgetPence: campaign.campaignBudgetPence,
    dailyBudgetPence: campaign.dailyBudgetPence,
    spentBudgetPence: campaign.spentBudgetPence,
    dailySpentBudgetPence: campaign.dailySpentBudgetPence,
    maximumRedemptions: campaign.maximumRedemptions,
    redemptionCount: campaign.redemptionCount,
    stackable: campaign.stackable,
    pausedAt: campaign.pausedAt?.toISOString() ?? null,
    rules: asRules(campaign.rules),
  };
}

function codeSnapshot(code: Awaited<ReturnType<typeof db.promotionCode.findFirst>>): PromotionCodeSnapshot | null {
  if (!code) return null;
  return {
    id: code.id,
    code: code.code,
    normalizedCode: code.normalizedCode,
    internalName: code.internalName,
    customerLabel: code.customerLabel,
    active: code.active,
    discountType: code.discountType,
    discountValue: code.discountValue,
    maximumDiscountPence: code.maximumDiscountPence,
    minimumSubtotalPence: code.minimumSubtotalPence,
    maximumSubtotalPence: code.maximumSubtotalPence,
    startsAt: code.startsAt?.toISOString() ?? null,
    endsAt: code.endsAt?.toISOString() ?? null,
    maximumRedemptions: code.maximumRedemptions,
    maximumRedemptionsPerCustomer: code.maximumRedemptionsPerCustomer,
    applicableMoveTypes: code.applicableMoveTypes,
    applicableRegions: code.applicableRegions,
    applicableWeekdays: code.applicableWeekdays,
    applicableVehicleClasses: code.applicableVehicleClasses,
    firstBookingOnly: code.firstBookingOnly,
    stackable: code.stackable,
    redemptionCount: code.redemptionCount,
    campaignId: code.campaignId,
  };
}

export async function getPromotionPricingContext(input: CreateQuoteRequest): Promise<{
  context: PromotionPricingContext;
  invalidPromotionCode: string | null;
  identity: { emailHash: string | null; phoneHash: string | null };
}> {
  const normalizedCode = input.promotionCode ? normalizePromotionCode(input.promotionCode) : null;
  const now = new Date();
  const [campaigns, code, priorCompletedBookings] = await Promise.all([
    db.promotionCampaign.findMany({
      where: {
        active: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      },
      orderBy: [{ type: "asc" }, { createdAt: "desc" }],
      take: 50,
    }),
    normalizedCode
      ? db.promotionCode.findFirst({ where: { normalizedCode } })
      : Promise.resolve(null),
    db.booking.count({
      where: {
        status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
        OR: [
          { customer: { email: input.customer.email } },
          { customer: { phone: input.customer.phone } },
        ],
      },
    }),
  ]);

  return {
    context: {
      campaigns: campaigns.map(campaignSnapshot),
      promotionCode: codeSnapshot(code),
      priorCompletedBookings,
      minimumContributionPence: 0,
      minimumMarginPercent: null,
      allowZeroMargin: false,
      allowNegativeMargin: false,
    },
    invalidPromotionCode: normalizedCode && !code ? normalizedCode : null,
    identity: {
      emailHash: hashIdentity(input.customer.email),
      phoneHash: hashIdentity(input.customer.phone),
    },
  };
}

import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizePromotionCode } from "@/lib/pricing/promotions";
import { promotionCampaignSchema, promotionCodeAdminSchema } from "@/lib/quotes/schemas";

const promotionAdminSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("campaign"),
    campaign: promotionCampaignSchema,
  }),
  z.object({
    kind: z.literal("code"),
    code: promotionCodeAdminSchema,
  }),
]);

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

function asDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

function campaignRiskErrors(input: z.infer<typeof promotionCampaignSchema>): string[] {
  const errors: string[] = [];
  if (!input.active) return errors;
  if (input.allowNegativeMargin) {
    errors.push("Negative-margin campaigns cannot be activated with the current admin role model");
  }
  if (input.type === "AGGRESSIVE" && input.hardMinimumPricePence == null) {
    errors.push("Aggressive campaigns require a hard minimum price");
  }
  if (input.type === "AGGRESSIVE" && input.maximumDiscountPence == null && input.maximumDiscountPercent == null) {
    errors.push("Aggressive campaigns require a maximum discount cap");
  }
  if (input.campaignBudgetPence != null && input.campaignBudgetPence <= 0) {
    errors.push("Campaign budget must be positive when set");
  }
  return errors;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [campaigns, codes] = await Promise.all([
    db.promotionCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    db.promotionCode.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  return NextResponse.json({
    campaigns,
    codes,
  });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = promotionAdminSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid promotion request" }, { status: 400 });
  }

  if (parsed.data.kind === "campaign") {
    const input = parsed.data.campaign;
    const riskErrors = campaignRiskErrors(input);
    if (riskErrors.length > 0) {
      return NextResponse.json({ error: "Campaign cannot be activated", reasons: riskErrors }, { status: 422 });
    }

    const campaign = await db.promotionCampaign.create({
      data: {
        type: input.type,
        internalName: input.internalName,
        customerLabel: input.customerLabel,
        active: input.active,
        startsAt: asDate(input.startsAt),
        endsAt: asDate(input.endsAt),
        percentageReduction: input.percentageReduction,
        fixedReductionPence: input.fixedReductionPence,
        maximumDiscountPence: input.maximumDiscountPence,
        maximumDiscountPercent: input.maximumDiscountPercent,
        hardMinimumPricePence: input.hardMinimumPricePence,
        hardMinimumContributionPence: input.hardMinimumContributionPence,
        hardMinimumMarginPercent: input.hardMinimumMarginPercent,
        allowZeroMargin: input.allowZeroMargin,
        allowNegativeMargin: input.allowNegativeMargin,
        maximumPermittedLossPence: input.maximumPermittedLossPence,
        campaignBudgetPence: input.campaignBudgetPence,
        dailyBudgetPence: input.dailyBudgetPence,
        maximumRedemptions: input.maximumRedemptions,
        stackable: input.stackable,
        autoPauseOnBudget: input.autoPauseOnBudget,
        rules: input.rules as Prisma.InputJsonValue | undefined,
        createdById: session.user.id,
        updatedById: session.user.id,
      },
    });

    await db.pricingAuditLog.create({
      data: {
        actorId: session.user.id,
        action: "promotion_campaign_create",
        entityType: "PromotionCampaign",
        entityId: campaign.id,
        after: campaign as unknown as Prisma.InputJsonValue,
        reason: input.reason,
      },
    });

    return NextResponse.json({ campaign });
  }

  const input = parsed.data.code;
  if (input.discountType === "PERCENTAGE" && input.discountValue > 9500) {
    return NextResponse.json({ error: "Percentage codes use basis points and cannot exceed 9500" }, { status: 422 });
  }
  const normalizedCode = normalizePromotionCode(input.code);
  const code = await db.promotionCode.upsert({
    where: { normalizedCode },
    update: {
      code: input.code.toUpperCase(),
      internalName: input.internalName,
      customerLabel: input.customerLabel,
      active: input.active,
      discountType: input.discountType,
      discountValue: input.discountValue,
      maximumDiscountPence: input.maximumDiscountPence,
      minimumSubtotalPence: input.minimumSubtotalPence,
      maximumSubtotalPence: input.maximumSubtotalPence,
      startsAt: asDate(input.startsAt),
      endsAt: asDate(input.endsAt),
      maximumRedemptions: input.maximumRedemptions,
      maximumRedemptionsPerCustomer: input.maximumRedemptionsPerCustomer,
      applicableMoveTypes: input.applicableMoveTypes,
      applicableRegions: input.applicableRegions,
      applicableWeekdays: input.applicableWeekdays,
      applicableVehicleClasses: input.applicableVehicleClasses,
      firstBookingOnly: input.firstBookingOnly,
      stackable: input.stackable,
      campaignId: input.campaignId,
    },
    create: {
      code: input.code.toUpperCase(),
      normalizedCode,
      internalName: input.internalName,
      customerLabel: input.customerLabel,
      active: input.active,
      discountType: input.discountType,
      discountValue: input.discountValue,
      maximumDiscountPence: input.maximumDiscountPence,
      minimumSubtotalPence: input.minimumSubtotalPence,
      maximumSubtotalPence: input.maximumSubtotalPence,
      startsAt: asDate(input.startsAt),
      endsAt: asDate(input.endsAt),
      maximumRedemptions: input.maximumRedemptions,
      maximumRedemptionsPerCustomer: input.maximumRedemptionsPerCustomer,
      applicableMoveTypes: input.applicableMoveTypes,
      applicableRegions: input.applicableRegions,
      applicableWeekdays: input.applicableWeekdays,
      applicableVehicleClasses: input.applicableVehicleClasses,
      firstBookingOnly: input.firstBookingOnly,
      stackable: input.stackable,
      campaignId: input.campaignId,
      createdById: session.user.id,
    },
  });

  await db.pricingAuditLog.create({
    data: {
      actorId: session.user.id,
      action: "promotion_code_upsert",
      entityType: "PromotionCode",
      entityId: code.id,
      after: code as unknown as Prisma.InputJsonValue,
      reason: input.reason,
    },
  });

  return NextResponse.json({ code });
}

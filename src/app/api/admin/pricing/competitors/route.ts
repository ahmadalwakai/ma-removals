import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAnyVanCompetitorLabel } from "@/lib/pricing/competitor-benchmarks";
import {
  beatCompetitorCampaignSchema,
  competitorBenchmarkAdminSchema,
} from "@/lib/quotes/schemas";

const competitorAdminSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("benchmark"),
    benchmark: competitorBenchmarkAdminSchema,
  }),
  z.object({
    kind: z.literal("beatCampaign"),
    campaign: beatCompetitorCampaignSchema,
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

function campaignRiskErrors(input: z.infer<typeof beatCompetitorCampaignSchema>): string[] {
  const errors: string[] = [];
  if (!input.enabled) return errors;
  if (!isAnyVanCompetitorLabel(input.competitorLabel) && input.maximumDiscountPence == null) {
    errors.push("Enabled beat competitor campaigns require a maximum discount cap");
  }
  if (input.allowNegativeMargin && input.maximumPermittedLossPence == null) {
    errors.push("Negative-margin beat competitor campaigns require a maximum permitted loss");
  }
  if (input.allowNegativeMargin && input.minimumPricePence == null) {
    errors.push("Negative-margin beat competitor campaigns require a minimum customer price");
  }
  return errors;
}

function rangesOverlap(aMin: number, aMax: number | null, bMin: number, bMax: number | null) {
  const aEnd = aMax ?? Number.POSITIVE_INFINITY;
  const bEnd = bMax ?? Number.POSITIVE_INFINITY;
  return aMin <= bEnd && bMin <= aEnd;
}

function dateRangesOverlap(aStart: Date, aEnd: Date | null, bStart: Date, bEnd: Date | null) {
  const aStop = aEnd?.getTime() ?? Number.POSITIVE_INFINITY;
  const bStop = bEnd?.getTime() ?? Number.POSITIVE_INFINITY;
  return aStart.getTime() < bStop && bStart.getTime() < aStop;
}

function benchmarkDiagnostics(benchmarks: Awaited<ReturnType<typeof db.competitorBenchmark.findMany>>) {
  const now = new Date();
  const expiredBenchmarkIds = benchmarks
    .filter((benchmark) => benchmark.active && benchmark.effectiveTo && benchmark.effectiveTo.getTime() <= now.getTime())
    .map((benchmark) => benchmark.id);
  const overlappingBenchmarkPairs: Array<{ firstId: string; secondId: string }> = [];

  for (let firstIndex = 0; firstIndex < benchmarks.length; firstIndex += 1) {
    const first = benchmarks[firstIndex]!;
    if (!first.active) continue;
    for (let secondIndex = firstIndex + 1; secondIndex < benchmarks.length; secondIndex += 1) {
      const second = benchmarks[secondIndex]!;
      if (!second.active) continue;
      const sameClass =
        first.region === second.region &&
        first.moveType === second.moveType &&
        first.propertySize === second.propertySize &&
        first.serviceLevel === second.serviceLevel &&
        first.packingIncluded === second.packingIncluded;
      if (!sameClass) continue;
      if (!rangesOverlap(first.distanceBandMinMiles, first.distanceBandMaxMiles, second.distanceBandMinMiles, second.distanceBandMaxMiles)) continue;
      if (!dateRangesOverlap(first.effectiveFrom, first.effectiveTo, second.effectiveFrom, second.effectiveTo)) continue;
      overlappingBenchmarkPairs.push({ firstId: first.id, secondId: second.id });
    }
  }

  return {
    expiredBenchmarkIds,
    overlappingBenchmarkPairs,
  };
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [benchmarks, beatCampaigns] = await Promise.all([
    db.competitorBenchmark.findMany({
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    db.beatCompetitorCampaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return NextResponse.json({
    benchmarks,
    beatCampaigns,
    diagnostics: benchmarkDiagnostics(benchmarks),
  });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = competitorAdminSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid competitor pricing request" }, { status: 400 });
  }

  if (parsed.data.kind === "benchmark") {
    const input = parsed.data.benchmark;
    const benchmark = await db.competitorBenchmark.create({
      data: {
        region: input.region,
        moveType: input.moveType,
        propertySize: input.propertySize,
        serviceLevel: input.serviceLevel,
        packingIncluded: input.packingIncluded,
        distanceBandMinMiles: input.distanceBandMinMiles,
        distanceBandMaxMiles: input.distanceBandMaxMiles,
        benchmarkPricePence: input.benchmarkPricePence,
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: asDate(input.effectiveTo),
        sourceNote: input.sourceNote,
        active: input.active,
        createdById: session.user.id,
        updatedById: session.user.id,
      },
    });

    await db.pricingAuditLog.create({
      data: {
        actorId: session.user.id,
        action: "competitor_benchmark_create",
        entityType: "CompetitorBenchmark",
        entityId: benchmark.id,
        after: benchmark as unknown as Prisma.InputJsonValue,
        reason: input.reason,
      },
    });

    return NextResponse.json({ benchmark });
  }

  const input = parsed.data.campaign;
  const riskErrors = campaignRiskErrors(input);
  if (riskErrors.length > 0) {
    return NextResponse.json({ error: "Beat competitor campaign cannot be activated", reasons: riskErrors }, { status: 422 });
  }

  const campaign = await db.beatCompetitorCampaign.create({
    data: {
      enabled: input.enabled,
      internalName: input.internalName,
      competitorLabel: input.competitorLabel,
      applicableRegions: input.applicableRegions,
      applicableMoveTypes: input.applicableMoveTypes,
      applicablePropertySizes: input.applicablePropertySizes,
      beatPercentage: input.beatPercentage,
      beatFixedAmountPence: input.beatFixedAmountPence,
      minimumPricePence: input.minimumPricePence,
      minimumContributionPence: input.minimumContributionPence,
      minimumMarginPercent: input.minimumMarginPercent,
      maximumDiscountPence: input.maximumDiscountPence,
      allowZeroMargin: input.allowZeroMargin,
      allowNegativeMargin: input.allowNegativeMargin,
      maximumPermittedLossPence: input.maximumPermittedLossPence,
      startsAt: asDate(input.startsAt),
      endsAt: asDate(input.endsAt),
      dailyBookingLimit: input.dailyBookingLimit,
      totalCampaignBookingLimit: input.totalCampaignBookingLimit,
      autoPause: input.autoPause,
      createdById: session.user.id,
      updatedById: session.user.id,
    },
  });

  await db.pricingAuditLog.create({
    data: {
      actorId: session.user.id,
      action: "beat_competitor_campaign_create",
      entityType: "BeatCompetitorCampaign",
      entityId: campaign.id,
      after: campaign as unknown as Prisma.InputJsonValue,
      reason: input.reason,
    },
  });

  return NextResponse.json({ campaign });
}

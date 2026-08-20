import { db } from "@/lib/db";
import { PricingClient } from "@/components/admin/pricing/PricingClient";
import { REQUIRED_PRICING_KEYS, validatePricingSnapshot } from "@/lib/pricing/version-repository";
import type { PricingVehicleClass } from "@/lib/pricing/domain";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  const configs = await db.pricingConfig.findMany({ orderBy: [{ category: "asc" }, { key: "asc" }] });
  const vehicles = await db.vehicleClassConfig.findMany({ orderBy: { name: "asc" } });
  const versions = await db.pricingVersion.findMany({ orderBy: { version: "desc" }, take: 30 });
  const campaigns = await db.promotionCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  const codes = await db.promotionCode.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  const benchmarks = await db.competitorBenchmark.findMany({ orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }], take: 50 });
  const beatCampaigns = await db.beatCompetitorCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  const serialised = configs.map((c) => ({ ...c, updatedAt: c.updatedAt.toISOString() }));
  const vehicleRows: PricingVehicleClass[] = vehicles.map((vehicle) => ({
    id: vehicle.id,
    name: vehicle.name,
    isActive: vehicle.isActive,
    maxUsableVolumeM3: vehicle.maxUsableVolumeM3,
    maxPayloadKg: vehicle.maxPayloadKg,
    minCrew: vehicle.minCrew,
    maxCrew: vehicle.maxCrew,
    baseFeePence: vehicle.baseFeePence,
    perMilePence: vehicle.perMilePence,
    perHourPence: vehicle.perHourPence,
    loadingEfficiencyFactor: vehicle.loadingEfficiencyFactor,
    unloadingEfficiencyFactor: vehicle.unloadingEfficiencyFactor,
    fleetCount: vehicle.fleetCount,
    manualReviewThresholdM3: vehicle.manualReviewThresholdM3,
    manualReviewPayloadKg: vehicle.manualReviewPayloadKg,
  }));
  const versionRows = versions.map((version) => ({
    id: version.id,
    version: version.version,
    status: version.status,
    label: version.label,
    createdAt: version.createdAt.toISOString(),
    activatedAt: version.activatedAt?.toISOString() ?? null,
    validation: validatePricingSnapshot({
      settings: version.settings as Record<string, number>,
      vehicleClasses: Array.isArray(version.vehicleClasses)
        ? version.vehicleClasses as unknown as PricingVehicleClass[]
        : [],
    }),
  }));

  return (
    <PricingClient
      configs={serialised}
      vehicles={vehicleRows}
      versions={versionRows}
      campaigns={campaigns.map((campaign) => ({
        ...campaign,
        startsAt: campaign.startsAt?.toISOString() ?? null,
        endsAt: campaign.endsAt?.toISOString() ?? null,
        pausedAt: campaign.pausedAt?.toISOString() ?? null,
        dailyBudgetDate: campaign.dailyBudgetDate?.toISOString() ?? null,
        createdAt: campaign.createdAt.toISOString(),
        updatedAt: campaign.updatedAt.toISOString(),
      }))}
      codes={codes.map((code) => ({
        ...code,
        startsAt: code.startsAt?.toISOString() ?? null,
        endsAt: code.endsAt?.toISOString() ?? null,
        createdAt: code.createdAt.toISOString(),
        updatedAt: code.updatedAt.toISOString(),
      }))}
      benchmarks={benchmarks.map((benchmark) => ({
        ...benchmark,
        effectiveFrom: benchmark.effectiveFrom.toISOString(),
        effectiveTo: benchmark.effectiveTo?.toISOString() ?? null,
        createdAt: benchmark.createdAt.toISOString(),
        updatedAt: benchmark.updatedAt.toISOString(),
      }))}
      beatCampaigns={beatCampaigns.map((campaign) => ({
        ...campaign,
        startsAt: campaign.startsAt?.toISOString() ?? null,
        endsAt: campaign.endsAt?.toISOString() ?? null,
        dailyBookingDate: campaign.dailyBookingDate?.toISOString() ?? null,
        pausedAt: campaign.pausedAt?.toISOString() ?? null,
        createdAt: campaign.createdAt.toISOString(),
        updatedAt: campaign.updatedAt.toISOString(),
      }))}
      requiredKeys={[...REQUIRED_PRICING_KEYS]}
    />
  );
}

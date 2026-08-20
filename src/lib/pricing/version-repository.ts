import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { PricingVehicleClass, PricingVersionSnapshot } from "@/lib/pricing/domain";

export const REQUIRED_PRICING_KEYS = [
  "labour_hourly_rate",
  "inventory_handling_per_minute",
  "access_difficulty_unit",
  "additional_stop_fee",
  "optional_service_unit",
  "heavy_item_unit",
  "regional_charge",
  "parking_or_toll_charge",
  "contingency_percent",
  "permitted_discount",
  "minimum_booking_amount",
  "rounding_increment",
  "internal_cost_percent",
  "quote_expiry_hours",
  "urgency_today",
  "urgency_tomorrow",
  "urgency_2_days",
  "weekend_multiplier",
  "base_house_move",
  "base_office_removals",
  "base_furniture_removals",
  "base_piano_moves",
  "base_van_with_man",
  "single_item_base_fee",
] as const;

function asSettings(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const settings: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      settings[key] = raw;
    }
  }
  return settings;
}

function asVehicleClasses(value: unknown): PricingVehicleClass[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as PricingVehicleClass;
    if (typeof row.id !== "string" || typeof row.name !== "string") return [];
    return [row];
  });
}

export async function getActivePricingVersion(): Promise<PricingVersionSnapshot | null> {
  const version = await db.pricingVersion.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { version: "desc" },
  });
  if (!version) return null;

  return {
    id: version.id,
    version: version.version,
    status: version.status,
    settings: asSettings(version.settings),
    vehicleClasses: asVehicleClasses(version.vehicleClasses),
  };
}

export async function getCurrentPricingSettings(): Promise<Record<string, number>> {
  const configs = await db.pricingConfig.findMany({ where: { isActive: true } });
  return configs.reduce<Record<string, number>>((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

export async function getCurrentVehicleClasses(): Promise<PricingVehicleClass[]> {
  const vehicles = await db.vehicleClassConfig.findMany({ orderBy: { name: "asc" } });
  return vehicles.map((vehicle) => ({
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
}

export interface PricingValidationResult {
  ok: boolean;
  reasons: string[];
}

export function validatePricingSnapshot(snapshot: {
  settings: Record<string, number>;
  vehicleClasses: PricingVehicleClass[];
}): PricingValidationResult {
  const reasons: string[] = [];

  for (const key of REQUIRED_PRICING_KEYS) {
    const value = snapshot.settings[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      reasons.push(`Missing required pricing setting: ${key}`);
    }
  }

  const positiveKeys = REQUIRED_PRICING_KEYS.filter(
    (key) => ![
      "regional_charge",
      "parking_or_toll_charge",
      "permitted_discount",
      "contingency_percent",
      "internal_cost_percent",
    ].includes(key)
  );
  for (const key of positiveKeys) {
    const value = snapshot.settings[key];
    if (typeof value === "number" && value <= 0) {
      reasons.push(`${key} must be greater than zero`);
    }
  }
  const contingency = snapshot.settings.contingency_percent;
  if (typeof contingency === "number" && (contingency < 0 || contingency > 1)) {
    reasons.push("contingency_percent must be between 0 and 1");
  }
  const costPercent = snapshot.settings.internal_cost_percent;
  if (typeof costPercent === "number" && (costPercent <= 0 || costPercent >= 1)) {
    reasons.push("internal_cost_percent must be greater than 0 and less than 1");
  }
  for (const key of ["urgency_today", "urgency_tomorrow", "urgency_2_days", "weekend_multiplier"] as const) {
    const value = snapshot.settings[key];
    if (typeof value === "number" && value < 1) {
      reasons.push(`${key} must be at least 1`);
    }
  }

  const activeVehicles = snapshot.vehicleClasses.filter((vehicle) => vehicle.isActive);
  if (activeVehicles.length === 0) {
    reasons.push("At least one active vehicle class is required");
  }

  for (const vehicle of activeVehicles) {
    if (vehicle.maxUsableVolumeM3 == null) reasons.push(`${vehicle.name} is missing maximum usable volume`);
    if (vehicle.maxPayloadKg == null) reasons.push(`${vehicle.name} is missing maximum payload`);
    if (vehicle.baseFeePence == null) reasons.push(`${vehicle.name} is missing base fee`);
    if (vehicle.perMilePence == null) reasons.push(`${vehicle.name} is missing per-mile price`);
    if (vehicle.perHourPence == null) reasons.push(`${vehicle.name} is missing per-hour price`);
    if (vehicle.loadingEfficiencyFactor == null) reasons.push(`${vehicle.name} is missing loading efficiency`);
    if (vehicle.unloadingEfficiencyFactor == null) reasons.push(`${vehicle.name} is missing unloading efficiency`);
    if (vehicle.maxCrew < vehicle.minCrew) reasons.push(`${vehicle.name} maximum crew is less than minimum crew`);
  }

  return { ok: reasons.length === 0, reasons };
}

export async function createDraftPricingVersion(params: {
  label?: string;
  actorId?: string;
  reason?: string;
} = {}) {
  const settings = await getCurrentPricingSettings();
  const vehicleClasses = await getCurrentVehicleClasses();
  const latest = await db.pricingVersion.findFirst({ orderBy: { version: "desc" } });
  const versionNumber = (latest?.version ?? 0) + 1;

  const version = await db.pricingVersion.create({
    data: {
      version: versionNumber,
      status: "DRAFT",
      label: params.label ?? `Pricing version ${versionNumber}`,
      settings: settings as Prisma.InputJsonValue,
      vehicleClasses: vehicleClasses as unknown as Prisma.InputJsonValue,
      createdById: params.actorId,
    },
  });

  await db.pricingAuditLog.create({
    data: {
      actorId: params.actorId,
      action: "create_draft",
      entityType: "PricingVersion",
      entityId: version.id,
      after: { version: version.version, settings, vehicleClasses } as unknown as Prisma.InputJsonValue,
      reason: params.reason,
    },
  });

  return version;
}

export async function activatePricingVersion(params: {
  versionId: string;
  actorId?: string;
  reason: string;
}) {
  const version = await db.pricingVersion.findUnique({ where: { id: params.versionId } });
  if (!version) {
    return { ok: false as const, reasons: ["Pricing version not found"] };
  }

  const validation = validatePricingSnapshot({
    settings: asSettings(version.settings),
    vehicleClasses: asVehicleClasses(version.vehicleClasses),
  });
  if (!validation.ok) {
    return { ok: false as const, reasons: validation.reasons };
  }

  const activated = await db.$transaction(async (tx) => {
    await tx.pricingVersion.updateMany({
      where: { status: "ACTIVE" },
      data: { status: "ARCHIVED", deactivatedAt: new Date() },
    });

    const updated = await tx.pricingVersion.update({
      where: { id: version.id },
      data: {
        status: "ACTIVE",
        activatedAt: new Date(),
        activatedById: params.actorId,
      },
    });

    await tx.pricingAuditLog.create({
      data: {
        actorId: params.actorId,
        action: "activate",
        entityType: "PricingVersion",
        entityId: version.id,
        after: { version: updated.version, status: updated.status },
        reason: params.reason,
      },
    });

    return updated;
  });

  return { ok: true as const, version: activated };
}

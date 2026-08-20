import type {
  AdditionalServicesInput,
  AddressAccessInput,
  CreateQuoteRequest,
} from "@/lib/quotes/schemas";
import {
  evaluateCompetitorBenchmark,
  type CompetitorPricingContext,
  type CompetitorEvaluationResult,
} from "@/lib/pricing/competitor-benchmarks";
import { calculateDistanceCharge } from "@/lib/distance-pricing";
import { packingChargePenceForMove } from "@/lib/pricing/packing";
import { evaluatePromotions, type PromotionPricingContext } from "@/lib/pricing/promotions";
import { applyCustomerRounding } from "@/lib/pricing/rounding";

export interface ResolvedInventoryItem {
  id: string;
  category: string;
  name: string;
  quantity: number;
  room: string;
  estimatedVolumeM3: number | null;
  estimatedWeightKg: number | null;
  handlingMinutes: number | null;
  requiresTwoPeople: boolean;
  fragile: boolean;
  heavy?: boolean;
  specialist?: boolean;
  dismantlingAvailable: boolean;
  assemblyAvailable: boolean;
  reassemblyAvailable?: boolean;
  minimumCrew?: number | null;
  vehicleRestrictions?: string[];
  active: boolean;
}

export interface PricingVehicleClass {
  id: string;
  name: string;
  isActive: boolean;
  maxUsableVolumeM3: number | null;
  maxPayloadKg: number | null;
  minCrew: number;
  maxCrew: number;
  baseFeePence: number | null;
  perMilePence: number | null;
  perHourPence: number | null;
  loadingEfficiencyFactor: number | null;
  unloadingEfficiencyFactor: number | null;
  fleetCount: number | null;
  manualReviewThresholdM3: number | null;
  manualReviewPayloadKg: number | null;
}

export interface PricingVersionSnapshot {
  id: string;
  version: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  settings: Record<string, number>;
  vehicleClasses: PricingVehicleClass[];
}

export interface RouteMetrics {
  distanceMiles: number;
  durationMinutes: number;
  geometry?: string | null;
  calculatedAt: string;
  routeHash: string;
}

export interface PriceLine {
  key: string;
  label: string;
  amountPence: number;
}

export interface InternalPriceLine extends PriceLine {
  explanation: string;
}

export interface InventoryMetrics {
  totalVolumeM3: number;
  totalWeightKg: number;
  totalHandlingMinutes: number;
  twoPersonItemCount: number;
  fragileItemCount: number;
  heavyOrSpecialItemCount: number;
  itemUnits: number;
}

export interface VehicleRecommendation {
  vehicleClassId: string | null;
  name: string | null;
  multipleVehiclesRequired: boolean;
  multipleTripsLikely: boolean;
  capacityUtilisation: number | null;
  payloadUtilisation: number | null;
}

export interface CrewRecommendation {
  movers: number;
  chargeableLabourMinutes: number;
  loadingMinutes: number;
  unloadingMinutes: number;
  travelMinutes: number;
  totalJobMinutes: number;
}

export interface PricingResult {
  pricingVersionId: string | null;
  pricingVersionNumber: number | null;
  status: "FIXED" | "MANUAL_REVIEW";
  finalTotalPence: number | null;
  customerBreakdown: PriceLine[];
  internalBreakdown: InternalPriceLine[];
  inventoryMetrics: InventoryMetrics;
  vehicleRecommendation: VehicleRecommendation;
  crewRecommendation: CrewRecommendation;
  manualReviewReasons: string[];
  customerSummary: {
    routeMileage: number | null;
    estimatedDurationMinutes: number | null;
    quoteExpiresAt: string;
    originalTotalPence: number | null;
    discountTotalPence: number;
    promotionLabel: string | null;
  };
  promotionSummary: {
    applied: Array<{
      source: "campaign" | "code";
      id: string;
      code?: string;
      type?: string;
      customerLabel: string;
      discountPence: number;
    }>;
    discountTotalPence: number;
    customerLabel: string | null;
  };
  competitorSummary: CompetitorEvaluationResult;
  internalSummary: {
    estimatedCostPence: number | null;
    grossProfitPence: number | null;
    grossMarginPercentage: number | null;
    contributionPence: number | null;
    preDiscountTotalPence: number | null;
    roundingAdjustmentPence: number | null;
    appliedRuleExplanations: string[];
  };
}

function poundsToPence(value: number): number {
  return Math.round(value * 100);
}

function setting(settings: Record<string, number>, key: string): number | null {
  const value = settings[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function requiredSetting(
  settings: Record<string, number>,
  key: string,
  reasons: string[]
): number {
  const value = setting(settings, key);
  if (value == null) {
    reasons.push(`Missing pricing setting: ${key}`);
    return 0;
  }
  return value;
}

function addLine(
  lines: PriceLine[],
  internal: InternalPriceLine[],
  key: string,
  label: string,
  amountPence: number,
  explanation: string
) {
  if (amountPence === 0) return;
  lines.push({ key, label, amountPence });
  internal.push({ key, label, amountPence, explanation });
}

function applyCompetitorPriceCeiling(
  valuePence: number,
  competitorResult: CompetitorEvaluationResult,
  minimumCustomerPricePence: number,
  protectedAddonPence = 0
): number {
  if (!competitorResult.applied || competitorResult.finalPricePence == null) return valuePence;
  const benchmarkCeilingPence = competitorResult.finalPricePence + protectedAddonPence;
  const safeMinimum = (competitorResult.safeMinimumPricePence ?? minimumCustomerPricePence) + protectedAddonPence;
  const minimumCustomerTotalPence = minimumCustomerPricePence + protectedAddonPence;
  return Math.max(
    safeMinimum,
    minimumCustomerTotalPence,
    Math.min(valuePence, benchmarkCeilingPence)
  );
}

function dateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
}

function daysBetween(a: Date, b: Date): number {
  const one = dateOnly(a).getTime();
  const two = dateOnly(b).getTime();
  return Math.round((two - one) / 86_400_000);
}

function moveTypeBaseKey(moveType: CreateQuoteRequest["moveType"]): string {
  const map: Record<CreateQuoteRequest["moveType"], string> = {
    "house-move": "base_house_move",
    "flat-move": "base_house_move",
    "office-move": "base_office_removals",
    "student-move": "base_van_with_man",
    "single-item-delivery": "single_item_base_fee",
    "furniture-delivery": "base_furniture_removals",
    "marketplace-collection": "base_furniture_removals",
    "piano-move": "base_piano_moves",
    other: "base_van_with_man",
  };
  return map[moveType];
}

function formatMoveType(moveType: string): string {
  return moveType
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type MoveComplexity = "single_item" | "few_items" | "small_move" | "house_removal";
type MoveSize = NonNullable<CreateQuoteRequest["moveSize"]>;

const HOME_MOVE_TYPES: CreateQuoteRequest["moveType"][] = ["house-move", "flat-move"];
const ITEM_LED_MOVE_SIZES: MoveSize[] = ["single-item", "few-items", "custom-inventory"];
const FULL_HOUSE_BASELINE_UNITS: Partial<Record<MoveSize, number>> = {
  "1-bedroom": 35,
  "2-bedrooms": 50,
  "3-bedrooms": 68,
  "4-bedrooms": 93,
  "5-plus-bedrooms": 95,
};

function settingWithFallback(settings: Record<string, number>, key: string, fallback: number): number {
  return setting(settings, key) ?? fallback;
}

function isHomeMoveType(moveType: CreateQuoteRequest["moveType"]): boolean {
  return HOME_MOVE_TYPES.includes(moveType);
}

function isItemLedMoveSize(moveSize: CreateQuoteRequest["moveSize"]): boolean {
  return moveSize != null && ITEM_LED_MOVE_SIZES.includes(moveSize);
}

function moveComplexity(
  input: CreateQuoteRequest,
  metrics: InventoryMetrics,
  settings: Record<string, number>
): MoveComplexity {
  const itemLedMoveTypes: CreateQuoteRequest["moveType"][] = [
    "furniture-delivery",
    "marketplace-collection",
    "single-item-delivery",
  ];
  const isItemLed =
    itemLedMoveTypes.includes(input.moveType) ||
    (isHomeMoveType(input.moveType) && isItemLedMoveSize(input.moveSize));
  if (!isItemLed) return "house_removal";

  if (metrics.totalVolumeM3 > 10 || metrics.totalWeightKg > 600) return "house_removal";

  const singleThreshold = settingWithFallback(settings, "single_item_threshold", 1);
  const fewThreshold = settingWithFallback(settings, "few_items_threshold", 5);
  const smallThreshold = settingWithFallback(settings, "small_move_threshold", 10);

  if (metrics.itemUnits <= singleThreshold) return "single_item";
  if (metrics.itemUnits <= fewThreshold) return "few_items";
  if (metrics.itemUnits <= smallThreshold) return "small_move";
  return "house_removal";
}

function baseChargeForQuote(
  input: CreateQuoteRequest,
  metrics: InventoryMetrics,
  settings: Record<string, number>,
  reasons: string[]
): {
  amountPounds: number;
  label: string;
  usesOperationalVehicleAndLabour: boolean;
  explanation: string;
} {
  const complexity = moveComplexity(input, metrics, settings);
  if (complexity === "single_item") {
    return {
      amountPounds: settingWithFallback(settings, "single_item_base_fee", 23.94),
      label: "Single item move",
      usesOperationalVehicleAndLabour: false,
      explanation: "Single-item inventory base includes standard van and driver allocation",
    };
  }
  if (complexity === "few_items") {
    return {
      amountPounds: settingWithFallback(settings, "few_items_base_fee", 32.92),
      label: "Few items move",
      usesOperationalVehicleAndLabour: false,
      explanation: "Few-items inventory base includes standard van and driver allocation",
    };
  }
  if (complexity === "small_move") {
    return {
      amountPounds: settingWithFallback(settings, "small_move_base_fee", 50.87),
      label: "Small move",
      usesOperationalVehicleAndLabour: false,
      explanation: "Small-move inventory base includes standard van and driver allocation",
    };
  }

  const key = moveTypeBaseKey(input.moveType);
  return {
    amountPounds: requiredSetting(settings, key, reasons),
    label: `${formatMoveType(input.moveType)} service charge`,
    usesOperationalVehicleAndLabour: true,
    explanation: `Applied configured base key ${key}`,
  };
}

function inventoryMetrics(items: ResolvedInventoryItem[]): InventoryMetrics {
  return items.reduce<InventoryMetrics>(
    (acc, item) => {
      const qty = Math.max(0, Math.floor(item.quantity));
      acc.itemUnits += qty;
      acc.totalVolumeM3 += (item.estimatedVolumeM3 ?? 0) * qty;
      acc.totalWeightKg += (item.estimatedWeightKg ?? 0) * qty;
      acc.totalHandlingMinutes += (item.handlingMinutes ?? 0) * qty;
      if (item.requiresTwoPeople) acc.twoPersonItemCount += qty;
      if (item.fragile) acc.fragileItemCount += qty;
      if (item.heavy || item.specialist || (item.estimatedWeightKg ?? 0) >= 80 || /piano|safe|hot tub|vault|pool table/i.test(item.name)) {
        acc.heavyOrSpecialItemCount += qty;
      }
      return acc;
    },
    {
      totalVolumeM3: 0,
      totalWeightKg: 0,
      totalHandlingMinutes: 0,
      twoPersonItemCount: 0,
      fragileItemCount: 0,
      heavyOrSpecialItemCount: 0,
      itemUnits: 0,
    }
  );
}

function inferredHomeMoveSize(metrics: InventoryMetrics): MoveSize {
  const volume = metrics.totalVolumeM3;
  const units = metrics.itemUnits;

  if (units > 0) {
    if (units <= 35) return "1-bedroom";
    if (units <= 50) return "2-bedrooms";
    if (units <= 68) return "3-bedrooms";
    if (units <= 93) return "4-bedrooms";
    return "5-plus-bedrooms";
  }

  if (volume <= 14) return "1-bedroom";
  if (volume <= 35) return "2-bedrooms";
  if (volume <= 50) return "3-bedrooms";
  if (volume <= 70) return "4-bedrooms";
  return "5-plus-bedrooms";
}

function fullHouseBaselineUnits(moveSize: CreateQuoteRequest["moveSize"]): number | null {
  if (!moveSize) return null;
  return FULL_HOUSE_BASELINE_UNITS[moveSize] ?? null;
}

function extraInventoryCharge(
  input: CreateQuoteRequest,
  metrics: InventoryMetrics,
  settings: Record<string, number>
): { amountPence: number; extraUnits: number; explanation: string } | null {
  if (!isHomeMoveType(input.moveType)) return null;

  const baselineUnits = fullHouseBaselineUnits(input.moveSize);
  if (baselineUnits == null || metrics.itemUnits <= baselineUnits || metrics.itemUnits <= 0) return null;

  const extraUnits = metrics.itemUnits - baselineUnits;
  const averageVolumeM3 = metrics.totalVolumeM3 / metrics.itemUnits;
  const averageWeightKg = metrics.totalWeightKg / metrics.itemUnits;
  const averageHandlingMinutes = metrics.totalHandlingMinutes / metrics.itemUnits;

  const perItemPounds = settingWithFallback(settings, "extra_inventory_item_unit", 6);
  const perM3Pounds = settingWithFallback(settings, "extra_inventory_volume_m3_unit", 3);
  const perKgPounds = settingWithFallback(settings, "extra_inventory_weight_kg_unit", 0.05);
  const perMinutePounds = settingWithFallback(settings, "extra_inventory_handling_minute_unit", 0.25);

  const extraVolumeM3 = averageVolumeM3 * extraUnits;
  const extraWeightKg = averageWeightKg * extraUnits;
  const extraHandlingMinutes = averageHandlingMinutes * extraUnits;
  const amountPounds =
    extraUnits * perItemPounds +
    extraVolumeM3 * perM3Pounds +
    extraWeightKg * perKgPounds +
    extraHandlingMinutes * perMinutePounds;

  return {
    amountPence: poundsToPence(amountPounds),
    extraUnits,
    explanation:
      `Full-house baseline for ${input.moveSize} is ${baselineUnits} items; ` +
      `${extraUnits} extra item${extraUnits === 1 ? "" : "s"} priced from average item count, volume, weight, and handling time`,
  };
}

export function normaliseQuoteInputForPricing(
  input: CreateQuoteRequest,
  inventory: ResolvedInventoryItem[]
): CreateQuoteRequest {
  if (!isHomeMoveType(input.moveType) || !isItemLedMoveSize(input.moveSize)) {
    return input;
  }

  const metrics = inventoryMetrics(inventory);
  const remainsItemLed =
    metrics.totalVolumeM3 <= 10 &&
    metrics.totalWeightKg <= 600 &&
    metrics.itemUnits <= 10;

  if (remainsItemLed) return input;

  return {
    ...input,
    moveSize: inferredHomeMoveSize(metrics),
  };
}

function accessDifficulty(access: AddressAccessInput): number {
  let score = 0;
  score += access.floor * (access.hasLift ? 0.4 : 1);
  score += access.internalStairs * 0.5;
  score += access.externalStairs * 0.75;
  score += Math.ceil(access.carryDistanceMeters / 25) * 0.6;
  if (access.parking === "restricted" || access.parking === "unknown") score += 1.5;
  if (access.narrowRoad) score += 2;
  if (access.loadingBayAvailable) score -= 0.8;
  return score;
}

function optionalServiceUnits(services: AdditionalServicesInput): number {
  const excluded = new Set([
    "packing",
    "packingMaterials",
    "unpacking",
    "dismantling",
    "reassembly",
    "furnitureProtection",
    "mattressProtection",
    "tvProtection",
    "dismantlingItems",
    "reassemblyItems",
  ]);
  return Object.entries(services as Record<string, unknown>).filter(([key, value]) => (
    !excluded.has(key) && value === true
  )).length;
}

function serviceItemCount(services: AdditionalServicesInput, key: string): number {
  const value = (services as Record<string, unknown>)[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(99, Math.floor(value)));
}

function packingChargePence(
  services: AdditionalServicesInput,
  moveSize: CreateQuoteRequest["moveSize"],
  metrics: InventoryMetrics
): number {
  if (services.packing) {
    return packingChargePenceForMove("full", moveSize, metrics.itemUnits);
  }

  if (services.packingMaterials) {
    return packingChargePenceForMove("materials", moveSize, metrics.itemUnits);
  }

  return 0;
}

function chooseVehicle(
  vehicles: PricingVehicleClass[],
  metrics: InventoryMetrics,
  reasons: string[]
): VehicleRecommendation {
  const active = vehicles
    .filter((vehicle) => vehicle.isActive)
    .sort((a, b) => (a.maxUsableVolumeM3 ?? Number.MAX_SAFE_INTEGER) - (b.maxUsableVolumeM3 ?? Number.MAX_SAFE_INTEGER));

  if (active.length === 0) {
    reasons.push("No active vehicle class is configured");
    return {
      vehicleClassId: null,
      name: null,
      multipleVehiclesRequired: false,
      multipleTripsLikely: false,
      capacityUtilisation: null,
      payloadUtilisation: null,
    };
  }

  const invalid = active.find(
    (vehicle) =>
      vehicle.maxUsableVolumeM3 == null ||
      vehicle.maxPayloadKg == null ||
      vehicle.baseFeePence == null ||
      vehicle.perMilePence == null ||
      vehicle.perHourPence == null ||
      vehicle.loadingEfficiencyFactor == null ||
      vehicle.unloadingEfficiencyFactor == null
  );
  if (invalid) {
    reasons.push(`Vehicle class ${invalid.name} is missing operational or pricing settings`);
  }

  const selected = active.find(
    (vehicle) =>
      (vehicle.maxUsableVolumeM3 ?? -1) >= metrics.totalVolumeM3 &&
      (vehicle.maxPayloadKg ?? -1) >= metrics.totalWeightKg
  );

  if (!selected) {
    const largest = active[active.length - 1] ?? null;
    return {
      vehicleClassId: largest?.id ?? null,
      name: largest?.name ?? null,
      multipleVehiclesRequired: true,
      multipleTripsLikely: true,
      capacityUtilisation:
        largest?.maxUsableVolumeM3 ? metrics.totalVolumeM3 / largest.maxUsableVolumeM3 : null,
      payloadUtilisation:
        largest?.maxPayloadKg ? metrics.totalWeightKg / largest.maxPayloadKg : null,
    };
  }

  const aboveVolumeThreshold = selected.manualReviewThresholdM3 != null && metrics.totalVolumeM3 >= selected.manualReviewThresholdM3;
  const abovePayloadThreshold = selected.manualReviewPayloadKg != null && metrics.totalWeightKg >= selected.manualReviewPayloadKg;

  return {
    vehicleClassId: selected.id,
    name: selected.name,
    multipleVehiclesRequired: false,
    multipleTripsLikely: aboveVolumeThreshold || abovePayloadThreshold,
    capacityUtilisation:
      selected.maxUsableVolumeM3 ? metrics.totalVolumeM3 / selected.maxUsableVolumeM3 : null,
    payloadUtilisation:
      selected.maxPayloadKg ? metrics.totalWeightKg / selected.maxPayloadKg : null,
  };
}

function selectedVehicle(
  vehicles: PricingVehicleClass[],
  recommendation: VehicleRecommendation
): PricingVehicleClass | null {
  return vehicles.find((vehicle) => vehicle.id === recommendation.vehicleClassId) ?? null;
}

function vehicleUsageUnits(vehicle: PricingVehicleClass | null, recommendation: VehicleRecommendation): number {
  if (!vehicle) return 1;
  const byVolume = vehicle.maxUsableVolumeM3 && recommendation.capacityUtilisation
    ? Math.ceil(recommendation.capacityUtilisation)
    : 1;
  const byPayload = vehicle.maxPayloadKg && recommendation.payloadUtilisation
    ? Math.ceil(recommendation.payloadUtilisation)
    : 1;
  return Math.max(1, byVolume, byPayload);
}

function chargeableVehicleUnits(vehicleUnits: number, settings: Record<string, number>): number {
  const extraCapacityFactor = Math.max(
    0,
    Math.min(1, setting(settings, "additional_vehicle_charge_factor") ?? 0.5)
  );
  const extraUnits = Math.max(0, vehicleUnits - 1);
  return 1 + extraUnits * extraCapacityFactor;
}

function formatVehicleUnits(units: number): string {
  if (Number.isInteger(units)) return units.toString();
  return units.toFixed(1).replace(/\.0$/, "");
}

function crewRecommendation(
  input: CreateQuoteRequest,
  inventory: ResolvedInventoryItem[],
  metrics: InventoryMetrics,
  route: RouteMetrics | null,
  vehicle: PricingVehicleClass | null,
  reasons: string[]
): CrewRecommendation {
  const loadingEfficiency = vehicle?.loadingEfficiencyFactor ?? 1;
  const unloadingEfficiency = vehicle?.unloadingEfficiencyFactor ?? 1;
  const collectionDifficulty = accessDifficulty(input.collection);
  const deliveryDifficulty = accessDifficulty(input.delivery);
  const stopDifficulty = input.additionalStop ? accessDifficulty(input.additionalStop) * 0.5 : 0;
  const accessMultiplier = 1 + (collectionDifficulty + deliveryDifficulty + stopDifficulty) * 0.04;
  const baseHandling = Math.max(metrics.totalHandlingMinutes, metrics.itemUnits * 4);
  const loadingMinutes = Math.ceil((baseHandling * accessMultiplier) / loadingEfficiency);
  const unloadingMinutes = Math.ceil((baseHandling * (1 + deliveryDifficulty * 0.04)) / unloadingEfficiency);
  const travelMinutes = route?.durationMinutes ?? 0;

  const preferredMovers = input.preferredMovers;
  const hasPreferredMovers = typeof preferredMovers === "number" && Number.isFinite(preferredMovers);
  const vehicleMinimumCrew = vehicle?.minCrew ?? 1;
  let requiredMovers = hasPreferredMovers ? Math.max(1, Math.floor(preferredMovers)) : vehicleMinimumCrew;
  if (!hasPreferredMovers && (metrics.twoPersonItemCount > 0 || metrics.heavyOrSpecialItemCount > 0)) requiredMovers = Math.max(requiredMovers, 2);
  if (!hasPreferredMovers) {
    for (const item of inventory) {
      if (item.minimumCrew != null) requiredMovers = Math.max(requiredMovers, item.minimumCrew);
    }
  }
  if (
    !hasPreferredMovers &&
    (metrics.totalHandlingMinutes > 420 || collectionDifficulty + deliveryDifficulty > 14)
  ) {
    requiredMovers = Math.max(requiredMovers, 3);
  }
  let movers = requiredMovers;
  if (input.services.additionalMover && !hasPreferredMovers) movers += 1;
  if (vehicle && movers > vehicle.maxCrew) {
    reasons.push(`Required crew exceeds maximum crew for ${vehicle.name}`);
    movers = vehicle.maxCrew;
  }

  const totalJobMinutes = loadingMinutes + unloadingMinutes + travelMinutes;
  const chargeableLabourMinutes = Math.max(60, Math.ceil((loadingMinutes + unloadingMinutes) / Math.max(movers, 1)));

  return {
    movers,
    chargeableLabourMinutes,
    loadingMinutes,
    unloadingMinutes,
    travelMinutes,
    totalJobMinutes,
  };
}

export function calculateRemovalQuote(params: {
  input: CreateQuoteRequest;
  inventory: ResolvedInventoryItem[];
  route: RouteMetrics | null;
  pricingVersion: PricingVersionSnapshot | null;
  promotionContext?: PromotionPricingContext | null;
  competitorContext?: CompetitorPricingContext | null;
  now: Date;
  quoteExpiresAt: Date;
}): PricingResult {
  const { input, inventory, route, pricingVersion, promotionContext, competitorContext, now, quoteExpiresAt } = params;
  const reasons: string[] = [];
  const customerBreakdown: PriceLine[] = [];
  const internalBreakdown: InternalPriceLine[] = [];

  if (!pricingVersion) {
    reasons.push("No active pricing version is published");
  } else if (pricingVersion.status !== "ACTIVE") {
    reasons.push("Pricing version is not active");
  }

  if (input.customItems.length > 0) {
    reasons.push("Custom inventory items require manual review");
  }

  if (!route) {
    reasons.push("Server route calculation is unavailable");
  }

  for (const item of inventory) {
    if (!item.active) reasons.push(`Inventory item is inactive: ${item.name}`);
    if (item.estimatedWeightKg == null) reasons.push(`Missing weight for inventory item: ${item.name}`);
    if (item.estimatedVolumeM3 == null) reasons.push(`Missing volume for inventory item: ${item.name}`);
    if (item.handlingMinutes == null) reasons.push(`Missing handling time for inventory item: ${item.name}`);
  }

  if (input.moveDate) {
    const moveDate = new Date(`${input.moveDate}T12:00:00`);
    if (Number.isNaN(moveDate.getTime()) || daysBetween(now, moveDate) < 0) {
      reasons.push("Move date is in the past or invalid");
    }
  } else if (!input.flexibleDate) {
    reasons.push("Move date is required unless flexible date is selected");
  }

  if (input.collection.postcode.replace(/\s+/g, "").toUpperCase() === input.delivery.postcode.replace(/\s+/g, "").toUpperCase()) {
    if (input.collection.fullAddress.trim().toLowerCase() === input.delivery.fullAddress.trim().toLowerCase()) {
      reasons.push("Collection and delivery addresses are identical");
    }
  }

  const metrics = inventoryMetrics(inventory);
  const versionSettings = pricingVersion?.settings ?? {};
  const vehicleRecommendation = chooseVehicle(pricingVersion?.vehicleClasses ?? [], metrics, reasons);
  const vehicle = selectedVehicle(pricingVersion?.vehicleClasses ?? [], vehicleRecommendation);
  const vehicleUnits = vehicleUsageUnits(vehicle, vehicleRecommendation);
  const vehiclePricingUnits = chargeableVehicleUnits(vehicleUnits, versionSettings);
  const crew = crewRecommendation(input, inventory, metrics, route, vehicle, reasons);

  if (vehicle) {
    for (const item of inventory) {
      if (item.vehicleRestrictions?.length && item.vehicleRestrictions.includes(vehicle.id)) {
        reasons.push(`${item.name} cannot be moved in ${vehicle.name}`);
      }
    }
  }

  const baseCharge = baseChargeForQuote(input, metrics, versionSettings, reasons);
  addLine(
    customerBreakdown,
    internalBreakdown,
    "base_service_charge",
    baseCharge.label,
    poundsToPence(baseCharge.amountPounds),
    baseCharge.explanation
  );

  if (baseCharge.usesOperationalVehicleAndLabour && vehicle) {
    addLine(
      customerBreakdown,
      internalBreakdown,
      "vehicle_charge",
      vehicleUnits > 1
        ? `${vehicle.name} capacity supplement x${formatVehicleUnits(vehiclePricingUnits)}`
        : `${vehicle.name} vehicle`,
      Math.round((vehicle.baseFeePence ?? 0) * vehiclePricingUnits),
      vehicleUnits > 1
        ? "Selected the largest active vehicle and priced additional capacity using the configured supplement instead of automatically charging a full duplicate vehicle"
        : "Selected the smallest active vehicle that fits authoritative volume and payload"
    );
  }

  const helperPrice = setting(versionSettings, "helper_price") ?? setting(versionSettings, "labour_hourly_rate") ?? 21.55;
  const additionalMoverChargePence = poundsToPence(Math.max(0, crew.movers - 1) * helperPrice);
  if (baseCharge.usesOperationalVehicleAndLabour) {
    const labourHourlyRate = requiredSetting(versionSettings, "labour_hourly_rate", reasons);
    const labourHours = crew.chargeableLabourMinutes / 60;
    addLine(
      customerBreakdown,
      internalBreakdown,
      "labour_charge",
      `${crew.movers} mover${crew.movers === 1 ? "" : "s"}`,
      poundsToPence(labourHourlyRate * crew.movers * labourHours),
      "Crew size and chargeable time derived from handling time, stairs, carry distance, lift availability, heavy items, and vehicle limits"
    );
    if (additionalMoverChargePence > 0) {
      addLine(
        customerBreakdown,
        internalBreakdown,
        "additional_helper_charge",
        `${crew.movers - 1} additional helper${crew.movers === 2 ? "" : "s"}`,
        additionalMoverChargePence,
        "Selected extra helpers use the configured helper price"
      );
    }
  } else {
    addLine(
      customerBreakdown,
      internalBreakdown,
      "additional_helper_charge",
      `${crew.movers - 1} additional helper${crew.movers === 2 ? "" : "s"}`,
      additionalMoverChargePence,
      "Inventory-led base includes the van and driver; selected extra helpers use the configured helper price"
    );
  }

  if (route) {
    const distanceCharge = calculateDistanceCharge(route.distanceMiles, versionSettings);
    const distanceChargePence = Math.round(poundsToPence(distanceCharge.total) * vehiclePricingUnits);
    addLine(
      customerBreakdown,
      internalBreakdown,
      "distance_charge",
      `Route distance (${route.distanceMiles.toFixed(1)} miles)`,
      distanceChargePence,
      vehicleUnits > 1
        ? "Server-authoritative Mapbox distance priced from public marketplace distance bands and required capacity units"
        : "Server-authoritative Mapbox distance priced from public marketplace distance bands"
    );
  }

  const itemHandlingPerMinute = baseCharge.usesOperationalVehicleAndLabour
    ? setting(versionSettings, "full_service_inventory_complexity_per_minute") ?? 0
    : requiredSetting(versionSettings, "inventory_handling_per_minute", reasons);
  addLine(
    customerBreakdown,
    internalBreakdown,
    "inventory_handling_charge",
    "Inventory handling",
    poundsToPence(metrics.totalHandlingMinutes * itemHandlingPerMinute),
    baseCharge.usesOperationalVehicleAndLabour
      ? "Optional full-service complexity charge; labour already prices the core handling time"
      : "Authoritative catalogue handling minutes multiplied by configured minute rate"
  );

  const extraInventory = extraInventoryCharge(input, metrics, versionSettings);
  if (extraInventory) {
    addLine(
      customerBreakdown,
      internalBreakdown,
      "extra_inventory_charge",
      `Extra inventory (${extraInventory.extraUnits} item${extraInventory.extraUnits === 1 ? "" : "s"})`,
      extraInventory.amountPence,
      extraInventory.explanation
    );
  }

  const accessUnit = requiredSetting(versionSettings, "access_difficulty_unit", reasons);
  const accessChargePounds =
    (accessDifficulty(input.collection) + accessDifficulty(input.delivery) + (input.additionalStop ? accessDifficulty(input.additionalStop) * 0.5 : 0)) * accessUnit;
  addLine(
    customerBreakdown,
    internalBreakdown,
    "access_charge",
    "Access requirements",
    poundsToPence(accessChargePounds),
    "Floors, stairs, lift availability, parking, and carry distance converted to configured access units"
  );

  if (input.additionalStop) {
    const stopFee = requiredSetting(versionSettings, "additional_stop_fee", reasons);
    addLine(
      customerBreakdown,
      internalBreakdown,
      "additional_stop_charge",
      "Additional stop",
      poundsToPence(stopFee),
      "Additional stop requested by customer"
    );
  }

  const packingPence = packingChargePence(input.services, input.moveSize, metrics);
  if (packingPence > 0) {
    addLine(
      customerBreakdown,
      internalBreakdown,
      "packing_charge",
      input.services.packing ? "Full packing service" : "Packing materials",
      packingPence,
      input.services.packing
        ? "Premium full packing charged from GBP 145 plus GBP 3 per item after 20 items"
        : "Premium packing materials charged at GBP 45"
    );
  }

  const serviceCount = optionalServiceUnits(input.services);
  if (serviceCount > 0) {
    const serviceUnit = requiredSetting(versionSettings, "optional_service_unit", reasons);
    addLine(
      customerBreakdown,
      internalBreakdown,
      "optional_services_charge",
      "Additional services",
      poundsToPence(serviceCount * serviceUnit),
      "Selected optional services multiplied by configured service unit"
    );
  }

  const furnitureHelpItems =
    serviceItemCount(input.services, "dismantlingItems") +
    serviceItemCount(input.services, "reassemblyItems");
  if (furnitureHelpItems > 0) {
    addLine(
      customerBreakdown,
      internalBreakdown,
      "assembly_dismantling_charge",
      "Dismantling / assembly",
      poundsToPence(furnitureHelpItems * 10),
      "Dismantling and assembly charged at GBP 10 per selected item"
    );
  }

  const heavyItemUnit = requiredSetting(versionSettings, "heavy_item_unit", reasons);
  addLine(
    customerBreakdown,
    internalBreakdown,
    "heavy_and_special_item_charge",
    "Heavy or specialist handling",
    poundsToPence(metrics.heavyOrSpecialItemCount * heavyItemUnit),
    "Heavy, specialist, and two-person items resolved from the server catalogue"
  );

  const moveDate = input.moveDate ? new Date(`${input.moveDate}T12:00:00`) : null;
  let scheduleAdjustmentPence = 0;
  let scheduleAdjustmentLabel = "";
  let scheduleAdjustmentExplanation = "";
  if (moveDate) {
    const daysOut = daysBetween(now, moveDate);
    if (daysOut === 0 || input.sameDay) {
      scheduleAdjustmentPence = poundsToPence(100);
      scheduleAdjustmentLabel = "Same-day surcharge";
      scheduleAdjustmentExplanation = "Fixed same-day booking surcharge";
    } else if (daysOut === 1) {
      scheduleAdjustmentPence = poundsToPence(77);
      scheduleAdjustmentLabel = "Next-day surcharge";
      scheduleAdjustmentExplanation = "Fixed next-day booking surcharge";
    } else if (daysOut === 2 || input.urgent) {
      scheduleAdjustmentPence = poundsToPence(50);
      scheduleAdjustmentLabel = "Short-notice surcharge";
      scheduleAdjustmentExplanation = "Fixed third-day booking surcharge";
    }
  }

  if (scheduleAdjustmentPence > 0) {
    addLine(
      customerBreakdown,
      internalBreakdown,
      "schedule_surcharge",
      scheduleAdjustmentLabel,
      scheduleAdjustmentPence,
      scheduleAdjustmentExplanation
    );
  }

  const regionalCharge = requiredSetting(versionSettings, "regional_charge", reasons);
  addLine(
    customerBreakdown,
    internalBreakdown,
    "regional_charge",
    "Regional operating adjustment",
    poundsToPence(regionalCharge),
    "Configured regional adjustment for the active pricing version"
  );

  const parkingOrTollCharge = input.collection.parking === "paid" || input.delivery.parking === "paid"
    ? requiredSetting(versionSettings, "parking_or_toll_charge", reasons)
    : 0;
  addLine(
    customerBreakdown,
    internalBreakdown,
    "parking_or_toll_charge",
    "Parking or toll allowance",
    poundsToPence(parkingOrTollCharge),
    "Applied only when paid parking is declared"
  );

  const subtotalBeforeContingency = customerBreakdown.reduce((sum, line) => sum + line.amountPence, 0);
  const contingencyPercent = requiredSetting(versionSettings, "contingency_percent", reasons);
  addLine(
    customerBreakdown,
    internalBreakdown,
    "contingency_charge",
    "Operational contingency",
    Math.round(subtotalBeforeContingency * contingencyPercent),
    "Configured contingency percentage applied to operational subtotal"
  );

  const preDiscountTotalPence = customerBreakdown.reduce((sum, line) => sum + line.amountPence, 0);
  const discount = Math.max(0, requiredSetting(versionSettings, "permitted_discount", reasons));
  addLine(
    customerBreakdown,
    internalBreakdown,
    "permitted_discounts",
    "Permitted discount",
    -poundsToPence(discount),
    "Only configured permitted discounts can reduce the price"
  );

  const minBookingAmount = poundsToPence(requiredSetting(versionSettings, "minimum_booking_amount", reasons));
  const roundingPolicy = poundsToPence(requiredSetting(versionSettings, "rounding_increment", reasons));
  const roundingStrategy = setting(versionSettings, "rounding_strategy");
  const estimatedCostPercent = requiredSetting(versionSettings, "internal_cost_percent", reasons);
  const globalMinimumContribution = poundsToPence(setting(versionSettings, "minimum_contribution") ?? 0);
  const globalMinimumMargin = setting(versionSettings, "minimum_margin_percent") ?? setting(versionSettings, "manual_review_min_margin_percent");
  const subtotalBeforeCompetitor = customerBreakdown.reduce((sum, line) => sum + line.amountPence, 0);
  const protectedCompetitorLineKeys = new Set([
    "schedule_surcharge",
    "vehicle_charge",
    "labour_charge",
    "additional_helper_charge",
    "inventory_handling_charge",
    "packing_charge",
    "optional_services_charge",
    "assembly_dismantling_charge",
    "heavy_and_special_item_charge",
    "extra_inventory_charge",
  ]);
  const competitorProtectedAddonPence = customerBreakdown
    .filter((line) => protectedCompetitorLineKeys.has(line.key))
    .reduce((sum, line) => sum + Math.max(0, line.amountPence), 0);
  const competitorEligibleSubtotalPence = Math.max(0, subtotalBeforeCompetitor - competitorProtectedAddonPence);
  const estimatedCostForCompetitor = Math.round(Math.max(competitorEligibleSubtotalPence, minBookingAmount) * estimatedCostPercent);
  const competitorResult = evaluateCompetitorBenchmark({
    input,
    routeMileage: route?.distanceMiles ?? null,
    normalOperationalPricePence: competitorEligibleSubtotalPence,
    minimumCustomerPricePence: minBookingAmount,
    estimatedCostPence: estimatedCostForCompetitor,
    globalMinimumContributionPence: globalMinimumContribution,
    globalMinimumMarginPercent: globalMinimumMargin,
    now,
  }, competitorContext);
  if (competitorResult.applied && competitorResult.discountPence > 0) {
    addLine(
      customerBreakdown,
      internalBreakdown,
      "competitor_benchmark_adjustment",
      competitorResult.customerLabel ?? "Online booking price",
      -competitorResult.discountPence,
      "Admin-configured competitor benchmark target applied server-side after safe minimum, contribution, and margin checks"
    );
  }
  internalBreakdown.push(...competitorResult.internalNotes.map((note, index) => ({
    key: `competitor_note_${index + 1}`,
    label: "Competitor note",
    amountPence: 0,
    explanation: note,
  })));

  const subtotalBeforePromotions = customerBreakdown.reduce((sum, line) => sum + line.amountPence, 0);
  const estimatedCostForProtection = Math.round(Math.max(subtotalBeforePromotions, minBookingAmount) * estimatedCostPercent);
  const promotionResult = evaluatePromotions({
    input,
    routeMileage: route?.distanceMiles ?? null,
    totalVolumeM3: metrics.totalVolumeM3,
    totalJobMinutes: crew.totalJobMinutes,
    movers: crew.movers,
    vehicleClassId: vehicle?.id ?? null,
    vehicleName: vehicle?.name ?? null,
    heavyOrSpecialItemCount: metrics.heavyOrSpecialItemCount,
    subtotalPence: subtotalBeforePromotions,
    estimatedCostPence: estimatedCostForProtection,
    now,
  }, promotionContext);
  for (const applied of promotionResult.applied) {
    addLine(
      customerBreakdown,
      internalBreakdown,
      `promotion_${applied.source}_${applied.id}`,
      applied.customerLabel,
      -applied.discountPence,
      `${applied.source === "code" ? "Promotion code" : "Automatic campaign"} applied server-side after eligibility, budget, and margin checks`
    );
  }
  internalBreakdown.push(...promotionResult.internalNotes.map((note, index) => ({
    key: `promotion_note_${index + 1}`,
    label: "Promotion note",
    amountPence: 0,
    explanation: note,
  })));
  reasons.push(...promotionResult.manualReviewReasons);

  const rawTotal = customerBreakdown.reduce((sum, line) => sum + line.amountPence, 0);
  const competitorSafeMinimumTotalPence = competitorResult.applied
    ? Math.max(
        minBookingAmount,
        competitorResult.safeMinimumPricePence ?? minBookingAmount
      ) + competitorProtectedAddonPence
    : minBookingAmount;
  const withMinimum = Math.max(rawTotal, competitorSafeMinimumTotalPence);
  let finalTotalPence = applyCustomerRounding({
    valuePence: withMinimum,
    minimumPence: competitorSafeMinimumTotalPence,
    incrementPence: Math.max(1, roundingPolicy),
    strategy: roundingStrategy,
  });
  finalTotalPence = applyCompetitorPriceCeiling(finalTotalPence, competitorResult, minBookingAmount, competitorProtectedAddonPence);
  const originalTotalPence = applyCustomerRounding({
    valuePence: Math.max(preDiscountTotalPence, minBookingAmount),
    minimumPence: minBookingAmount,
    incrementPence: Math.max(1, roundingPolicy),
    strategy: roundingStrategy,
  });
  let roundingAdjustmentPence = 0;

  if (finalTotalPence <= 0) {
    reasons.push("Pricing invariant failed: final total must be positive");
  }

  if (setting(versionSettings, "vat_rate") != null && setting(versionSettings, "vat_enabled") === 1) {
    const vatRate = requiredSetting(versionSettings, "vat_rate", reasons);
    const vatAmount = Math.round(finalTotalPence * vatRate);
    addLine(
      customerBreakdown,
      internalBreakdown,
      "vat",
      "VAT",
      vatAmount,
      "VAT applied because active business pricing explicitly enables VAT"
    );
    finalTotalPence = applyCustomerRounding({
      valuePence: finalTotalPence + vatAmount,
      minimumPence: competitorSafeMinimumTotalPence + vatAmount,
      incrementPence: Math.max(1, roundingPolicy),
      strategy: roundingStrategy,
    });
    finalTotalPence = applyCompetitorPriceCeiling(
      finalTotalPence,
      competitorResult,
      minBookingAmount,
      competitorProtectedAddonPence + vatAmount
    );
  }

  const visibleTotalBeforeRounding = customerBreakdown.reduce((sum, line) => sum + line.amountPence, 0);
  roundingAdjustmentPence = finalTotalPence - visibleTotalBeforeRounding;
  addLine(
    customerBreakdown,
    internalBreakdown,
    "rounding_adjustment",
    roundingAdjustmentPence > 0 ? "Rounding adjustment" : "Rounded price",
    roundingAdjustmentPence,
    "Customer total reconciled to the configured rounding policy without changing the underlying pricing inputs"
  );

  const estimatedCostPence = Math.round(finalTotalPence * estimatedCostPercent);
  const grossProfitPence = finalTotalPence - estimatedCostPence;
  const contributionPence = grossProfitPence;
  const grossMarginPercentage = finalTotalPence > 0 ? grossProfitPence / finalTotalPence : null;
  const lowMarginThreshold = setting(versionSettings, "manual_review_min_margin_percent");
  if (lowMarginThreshold != null && grossMarginPercentage != null && grossMarginPercentage < lowMarginThreshold) {
    reasons.push("Gross margin is below configured manual-review threshold");
  }
  const highQuoteThreshold = setting(versionSettings, "manual_review_high_quote_amount");
  if (highQuoteThreshold != null && finalTotalPence >= poundsToPence(highQuoteThreshold)) {
    reasons.push("Quote exceeds configured high-value manual-review threshold");
  }

  const uniqueReasons = Array.from(new Set(reasons));
  const status = uniqueReasons.length > 0 ? "MANUAL_REVIEW" : "FIXED";
  const competitorDiscountTotalPence = competitorResult.applied ? competitorResult.discountPence : 0;
  const customerDiscountTotalPence = competitorDiscountTotalPence + promotionResult.discountTotalPence;
  const customerDiscountLabel = promotionResult.customerLabel ?? competitorResult.customerLabel;

  return {
    pricingVersionId: pricingVersion?.id ?? null,
    pricingVersionNumber: pricingVersion?.version ?? null,
    status,
    finalTotalPence: status === "FIXED" ? finalTotalPence : null,
    customerBreakdown: status === "FIXED" ? customerBreakdown : [],
    internalBreakdown,
    inventoryMetrics: {
      ...metrics,
      totalVolumeM3: Math.round(metrics.totalVolumeM3 * 100) / 100,
      totalWeightKg: Math.round(metrics.totalWeightKg * 10) / 10,
    },
    vehicleRecommendation,
    crewRecommendation: crew,
    manualReviewReasons: uniqueReasons,
    customerSummary: {
      routeMileage: route?.distanceMiles ?? null,
      estimatedDurationMinutes: crew.totalJobMinutes || null,
      quoteExpiresAt: quoteExpiresAt.toISOString(),
      originalTotalPence: status === "FIXED" ? originalTotalPence : null,
      discountTotalPence: status === "FIXED" ? customerDiscountTotalPence : 0,
      promotionLabel: status === "FIXED" ? customerDiscountLabel : null,
    },
    promotionSummary: {
      applied: status === "FIXED" ? promotionResult.applied.map((applied) => ({
        source: applied.source,
        id: applied.id,
        code: applied.code,
        type: applied.type,
        customerLabel: applied.customerLabel,
        discountPence: applied.discountPence,
      })) : [],
      discountTotalPence: status === "FIXED" ? promotionResult.discountTotalPence : 0,
      customerLabel: status === "FIXED" ? promotionResult.customerLabel : null,
    },
    competitorSummary: status === "FIXED" ? competitorResult : {
      ...competitorResult,
      applied: false,
      discountPence: 0,
      finalPricePence: null,
    },
    internalSummary: {
      estimatedCostPence: status === "FIXED" ? estimatedCostPence : null,
      grossProfitPence: status === "FIXED" ? grossProfitPence : null,
      grossMarginPercentage: status === "FIXED" ? grossMarginPercentage : null,
      contributionPence: status === "FIXED" ? contributionPence : null,
      preDiscountTotalPence: status === "FIXED" ? preDiscountTotalPence : null,
      roundingAdjustmentPence: status === "FIXED" ? roundingAdjustmentPence : null,
      appliedRuleExplanations: internalBreakdown.map((line) => line.explanation),
    },
  };
}

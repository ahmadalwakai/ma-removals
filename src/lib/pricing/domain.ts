import crypto from "node:crypto";
import type {
  AdditionalServicesInput,
  AddressAccessInput,
  CreateQuoteRequest,
} from "@/lib/quotes/schemas";
import { packingChargePenceForMove } from "@/lib/pricing/packing";
import {
  ANYVAN_HOUSE_FACTOR,
  ANYVAN_ITEM_LED_FACTOR,
  pricingIssueReason,
  type CompetitorBenchmarkSnapshot,
  type CompetitorEvaluationResult,
  type CompetitorPricingContext,
  type PricingClassificationKind,
  type PricingIssueCode,
} from "@/lib/pricing/competitor-benchmarks";
import type { PromotionPricingContext } from "@/lib/pricing/promotions";

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

export interface PricingClassification {
  kind: PricingClassificationKind;
  requestedMoveSize: string | null;
  effectivePropertySize: string | null;
  inventoryInferredPropertySize: string | null;
  benchmarkPropertySizes: string[];
  appliedFactor: 0.9 | 1;
  serviceLevel: string;
  packingIncluded: boolean;
  missingBenchmarkDimensions: string[];
  auditInput: Record<string, unknown>;
}

export interface BenchmarkSelectionCriteria {
  classification: PricingClassification;
  regionCandidates: string[];
  routeMileage: number | null;
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

const HOME_MOVE_TYPES = new Set<CreateQuoteRequest["moveType"]>(["house-move", "flat-move"]);
const ITEM_LED_MOVE_TYPES = new Set<CreateQuoteRequest["moveType"]>([
  "single-item-delivery",
  "furniture-delivery",
  "marketplace-collection",
]);
const HOME_PROPERTY_SIZES = [
  "studio",
  "1-bedroom",
  "2-bedrooms",
  "3-bedrooms",
  "4-bedrooms",
  "5-plus-bedrooms",
] as const;
const ITEM_LED_MOVE_SIZES = new Set(["single-item", "few-items", "custom-inventory"]);
const HOME_SIZE_RANK = new Map<string, number>(HOME_PROPERTY_SIZES.map((size, index) => [size, index]));

function poundsToPence(value: number): number {
  return Math.round(value * 100);
}

function setting(settings: Record<string, number>, key: string): number | null {
  const value = settings[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function settingWithFallback(settings: Record<string, number>, key: string, fallback: number): number {
  return setting(settings, key) ?? fallback;
}

function issue(code: PricingIssueCode, detail: string): string {
  return pricingIssueReason(code, detail);
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stableHash(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function inventoryMetrics(items: ResolvedInventoryItem[]): InventoryMetrics {
  return items.reduce<InventoryMetrics>(
    (acc, item) => {
      const qty = Math.max(0, Math.floor(item.quantity));
      acc.itemUnits += qty;
      acc.totalVolumeM3 += (item.estimatedVolumeM3 ?? 0) * qty;
      acc.totalWeightKg += (item.estimatedWeightKg ?? 0) * qty;
      acc.totalHandlingMinutes += (item.handlingMinutes ?? 0) * qty;
      if (item.requiresTwoPeople) acc.twoPersonItemCount += qty;
      if (item.fragile) acc.fragileItemCount += qty;
      if (
        item.heavy ||
        item.specialist ||
        (item.estimatedWeightKg ?? 0) >= 80 ||
        /piano|safe|hot tub|vault|pool table/i.test(item.name)
      ) {
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

function roundMetrics(metrics: InventoryMetrics): InventoryMetrics {
  return {
    ...metrics,
    totalVolumeM3: Math.round(metrics.totalVolumeM3 * 100) / 100,
    totalWeightKg: Math.round(metrics.totalWeightKg * 10) / 10,
  };
}

function inferHomeSizeFromInventory(metrics: InventoryMetrics): (typeof HOME_PROPERTY_SIZES)[number] | null {
  if (metrics.itemUnits <= 0 && metrics.totalVolumeM3 <= 0) return null;
  const units = metrics.itemUnits;
  const volume = metrics.totalVolumeM3;

  if (units > 93 || volume > 70) return "5-plus-bedrooms";
  if (units > 68 || volume > 50) return "4-bedrooms";
  if (units > 50 || volume > 35) return "3-bedrooms";
  if (units > 35 || volume > 14) return "2-bedrooms";
  if (units > 20 || volume > 8) return "1-bedroom";
  return "studio";
}

function largerHomeSize(
  declared: string | null | undefined,
  inferred: string | null
): string | null {
  if (!declared || !HOME_SIZE_RANK.has(declared)) return inferred;
  if (!inferred || !HOME_SIZE_RANK.has(inferred)) return declared;
  return (HOME_SIZE_RANK.get(inferred) ?? 0) > (HOME_SIZE_RANK.get(declared) ?? 0)
    ? inferred
    : declared;
}

function normalisedInventoryAudit(items: ResolvedInventoryItem[]) {
  return items
    .map((item) => ({
      id: item.id,
      category: item.category,
      name: item.name,
      quantity: Math.max(0, Math.floor(item.quantity)),
      volumeM3: item.estimatedVolumeM3 ?? null,
      weightKg: item.estimatedWeightKg ?? null,
      handlingMinutes: item.handlingMinutes ?? null,
      requiresTwoPeople: item.requiresTwoPeople,
      fragile: item.fragile,
      heavy: Boolean(item.heavy),
      specialist: Boolean(item.specialist),
      minimumCrew: item.minimumCrew ?? null,
    }))
    .sort((a, b) => `${a.id}:${a.name}:${a.quantity}`.localeCompare(`${b.id}:${b.name}:${b.quantity}`));
}

function itemLedBenchmarkKeys(items: ResolvedInventoryItem[], metrics: InventoryMetrics): {
  keys: string[];
  missingDimensions: string[];
  auditInput: Record<string, unknown>;
} {
  const expanded = normalisedInventoryAudit(items).filter((item) => item.quantity > 0);
  const missingDimensions: string[] = [];

  if (metrics.itemUnits <= 0 || expanded.length === 0) {
    return {
      keys: [],
      missingDimensions: ["inventory_item_identity"],
      auditInput: { inventory: expanded },
    };
  }

  if (metrics.itemUnits === 1 && expanded.length === 1) {
    const item = expanded[0]!;
    const itemKey = slug(item.name);
    const categoryKey = slug(item.category);
    return {
      keys: [
        itemKey ? `item:${itemKey}` : null,
        categoryKey ? `category:${categoryKey}` : null,
      ].filter((value): value is string => Boolean(value)),
      missingDimensions,
      auditInput: { inventory: expanded },
    };
  }

  const digest = stableHash(expanded);
  return {
    keys: [`inventory:${digest}`],
    missingDimensions,
    auditInput: {
      inventory: expanded,
      inventoryBenchmarkKey: `inventory:${digest}`,
    },
  };
}

export function classifyQuoteForPricing(
  input: CreateQuoteRequest,
  inventory: ResolvedInventoryItem[]
): PricingClassification {
  const metrics = inventoryMetrics(inventory);
  const requestedMoveSize = input.moveSize ?? null;
  const packingIncluded = Boolean(input.services?.packing);
  const serviceLevel = "standard";

  if (HOME_MOVE_TYPES.has(input.moveType) && requestedMoveSize && HOME_SIZE_RANK.has(requestedMoveSize)) {
    const inferred = inferHomeSizeFromInventory(metrics);
    const effectivePropertySize = largerHomeSize(requestedMoveSize, inferred);
    return {
      kind: "FULL_HOUSE",
      requestedMoveSize,
      effectivePropertySize,
      inventoryInferredPropertySize: inferred,
      benchmarkPropertySizes: effectivePropertySize ? [effectivePropertySize] : [],
      appliedFactor: ANYVAN_HOUSE_FACTOR,
      serviceLevel,
      packingIncluded,
      missingBenchmarkDimensions: [],
      auditInput: {
        requestedMoveSize,
        inventoryInferredPropertySize: inferred,
        effectivePropertySize,
      },
    };
  }

  const itemLed =
    ITEM_LED_MOVE_TYPES.has(input.moveType) ||
    (HOME_MOVE_TYPES.has(input.moveType) && ITEM_LED_MOVE_SIZES.has(requestedMoveSize ?? ""));

  if (itemLed) {
    const keys = itemLedBenchmarkKeys(inventory, metrics);
    return {
      kind: "ITEM_LED",
      requestedMoveSize,
      effectivePropertySize: keys.keys[0] ?? requestedMoveSize,
      inventoryInferredPropertySize: null,
      benchmarkPropertySizes: keys.keys,
      appliedFactor: ANYVAN_ITEM_LED_FACTOR,
      serviceLevel,
      packingIncluded,
      missingBenchmarkDimensions: keys.missingDimensions,
      auditInput: {
        ...keys.auditInput,
        requestedMoveSize,
        itemUnits: metrics.itemUnits,
        totalVolumeM3: Math.round(metrics.totalVolumeM3 * 100) / 100,
        totalWeightKg: Math.round(metrics.totalWeightKg * 10) / 10,
        heavyOrSpecialItemCount: metrics.heavyOrSpecialItemCount,
      },
    };
  }

  return {
    kind: "UNSUPPORTED",
    requestedMoveSize,
    effectivePropertySize: null,
    inventoryInferredPropertySize: null,
    benchmarkPropertySizes: [],
    appliedFactor: ANYVAN_ITEM_LED_FACTOR,
    serviceLevel,
    packingIncluded,
    missingBenchmarkDimensions: ["supported_move_type_or_property_size"],
    auditInput: {
      moveType: input.moveType,
      requestedMoveSize,
    },
  };
}

export function regionCandidatesForBenchmark(input: CreateQuoteRequest): string[] {
  return uniqueStrings([
    input.collection.city,
    input.delivery.city,
    input.collection.region,
    input.delivery.region,
    input.collection.country === "United Kingdom" ? "Scotland" : null,
  ]);
}

export function benchmarkSelectionCriteriaForQuote(
  input: CreateQuoteRequest,
  inventory: ResolvedInventoryItem[],
  routeMileage: number | null
): BenchmarkSelectionCriteria {
  return {
    classification: classifyQuoteForPricing(input, inventory),
    regionCandidates: regionCandidatesForBenchmark(input),
    routeMileage,
  };
}

export function normaliseQuoteInputForPricing(
  input: CreateQuoteRequest,
  inventory: ResolvedInventoryItem[]
): CreateQuoteRequest {
  const classification = classifyQuoteForPricing(input, inventory);
  if (classification.kind !== "FULL_HOUSE") return input;
  if (!classification.effectivePropertySize || classification.effectivePropertySize === input.moveSize) {
    return input;
  }
  return {
    ...input,
    moveSize: classification.effectivePropertySize as CreateQuoteRequest["moveSize"],
  };
}

function accessDifficulty(access: AddressAccessInput): number {
  let score = 0;
  score += access.floor * (access.hasLift ? 0.4 : 1);
  score += access.internalStairs * 0.5;
  score += access.externalStairs * 0.75;
  score += Math.ceil(access.carryDistanceMeters / 25) * 0.6;
  if (access.parking === "restricted" || access.parking === "unknown") score += 1.5;
  if (access.parking === "paid") score += 1;
  if (access.narrowRoad) score += 2;
  if (access.loadingBayAvailable) score -= 0.8;
  return Math.max(0, score);
}

function serviceItemCount(services: AdditionalServicesInput, key: string): number {
  const value = (services as Record<string, unknown>)[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(99, Math.floor(value)));
}

function chooseVehicle(
  vehicles: PricingVehicleClass[],
  metrics: InventoryMetrics
): VehicleRecommendation {
  const active = vehicles
    .filter((vehicle) => vehicle.isActive)
    .sort((a, b) => (a.maxUsableVolumeM3 ?? Number.MAX_SAFE_INTEGER) - (b.maxUsableVolumeM3 ?? Number.MAX_SAFE_INTEGER));

  if (active.length === 0) {
    return {
      vehicleClassId: null,
      name: null,
      multipleVehiclesRequired: false,
      multipleTripsLikely: false,
      capacityUtilisation: null,
      payloadUtilisation: null,
    };
  }

  const selected = active.find(
    (vehicle) =>
      (vehicle.maxUsableVolumeM3 ?? -1) >= metrics.totalVolumeM3 &&
      (vehicle.maxPayloadKg ?? -1) >= metrics.totalWeightKg
  );
  const vehicle = selected ?? active[active.length - 1]!;
  const capacityUtilisation = vehicle.maxUsableVolumeM3
    ? metrics.totalVolumeM3 / vehicle.maxUsableVolumeM3
    : null;
  const payloadUtilisation = vehicle.maxPayloadKg
    ? metrics.totalWeightKg / vehicle.maxPayloadKg
    : null;

  return {
    vehicleClassId: vehicle.id,
    name: vehicle.name,
    multipleVehiclesRequired: !selected,
    multipleTripsLikely:
      !selected ||
      (vehicle.manualReviewThresholdM3 != null && metrics.totalVolumeM3 >= vehicle.manualReviewThresholdM3) ||
      (vehicle.manualReviewPayloadKg != null && metrics.totalWeightKg >= vehicle.manualReviewPayloadKg),
    capacityUtilisation,
    payloadUtilisation,
  };
}

function selectedVehicle(
  vehicles: PricingVehicleClass[],
  recommendation: VehicleRecommendation
): PricingVehicleClass | null {
  return vehicles.find((vehicle) => vehicle.id === recommendation.vehicleClassId) ?? null;
}

function inferredCrew(
  input: CreateQuoteRequest,
  inventory: ResolvedInventoryItem[],
  metrics: InventoryMetrics,
  vehicle: PricingVehicleClass | null
): number {
  const itemMinimum = inventory.reduce((max, item) => Math.max(max, item.minimumCrew ?? 0), 0);
  const heavyMinimum = metrics.heavyOrSpecialItemCount > 0 || metrics.twoPersonItemCount > 0 ? 2 : 1;
  const volumeMinimum = metrics.totalVolumeM3 > 35 || metrics.itemUnits > 50 ? 3 : metrics.totalVolumeM3 > 8 || metrics.itemUnits > 20 ? 2 : 1;
  const requested = input.preferredMovers ?? 0;
  const minimum = Math.max(1, itemMinimum, heavyMinimum, volumeMinimum, requested);
  const maxCrew = vehicle?.maxCrew ?? 12;
  return Math.min(maxCrew, minimum);
}

function crewRecommendation(
  input: CreateQuoteRequest,
  inventory: ResolvedInventoryItem[],
  metrics: InventoryMetrics,
  route: RouteMetrics | null,
  vehicle: PricingVehicleClass | null
): CrewRecommendation {
  const movers = inferredCrew(input, inventory, metrics, vehicle);
  const accessMinutes = Math.round((accessDifficulty(input.collection) + accessDifficulty(input.delivery)) * 8);
  const loadingMinutes = Math.max(15, Math.ceil(metrics.totalHandlingMinutes * (vehicle?.loadingEfficiencyFactor ?? 1) + accessMinutes));
  const unloadingMinutes = Math.max(10, Math.ceil(metrics.totalHandlingMinutes * 0.65 * (vehicle?.unloadingEfficiencyFactor ?? 1) + accessMinutes * 0.65));
  const travelMinutes = route?.durationMinutes ?? 0;
  const chargeableLabourMinutes = Math.ceil((loadingMinutes + unloadingMinutes) / Math.max(1, movers));
  return {
    movers,
    chargeableLabourMinutes,
    loadingMinutes,
    unloadingMinutes,
    travelMinutes,
    totalJobMinutes: travelMinutes + chargeableLabourMinutes,
  };
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

function optionalServiceLines(params: {
  input: CreateQuoteRequest;
  classification: PricingClassification;
  metrics: InventoryMetrics;
  settings: Record<string, number>;
  benchmark: CompetitorBenchmarkSnapshot | null;
  crew: CrewRecommendation;
  inferredCrewCount: number;
  customerBreakdown: PriceLine[];
  internalBreakdown: InternalPriceLine[];
}) {
  const {
    input,
    classification,
    metrics,
    settings,
    benchmark,
    crew,
    inferredCrewCount,
    customerBreakdown,
    internalBreakdown,
  } = params;
  const services = input.services;

  if (services.packing && !benchmark?.packingIncluded) {
    addLine(
      customerBreakdown,
      internalBreakdown,
      "packing_charge",
      "Full packing service",
      packingChargePenceForMove("full", input.moveSize, metrics.itemUnits),
      "Packing is charged separately because the selected benchmark does not include equivalent packing"
    );
  } else if (!services.packing && services.packingMaterials) {
    addLine(
      customerBreakdown,
      internalBreakdown,
      "packing_materials_charge",
      "Packing materials",
      packingChargePenceForMove("materials", input.moveSize, metrics.itemUnits),
      "Packing materials are an optional add-on outside the selected move benchmark"
    );
  }

  const furnitureHelpItems =
    serviceItemCount(services, "dismantlingItems") +
    serviceItemCount(services, "reassemblyItems") +
    (services.dismantling ? 1 : 0) +
    (services.reassembly ? 1 : 0);
  if (furnitureHelpItems > 0) {
    const unitPence = poundsToPence(settingWithFallback(settings, "assembly_price_per_item", 13.17));
    addLine(
      customerBreakdown,
      internalBreakdown,
      "assembly_dismantling_charge",
      "Dismantling / reassembly",
      furnitureHelpItems * unitPence,
      "Furniture dismantling and reassembly are separated from the competitor benchmark"
    );
  }

  if (input.additionalStop) {
    addLine(
      customerBreakdown,
      internalBreakdown,
      "additional_stop_charge",
      "Additional stop",
      poundsToPence(settingWithFallback(settings, "additional_stop_fee", 14.96)),
      "Additional stops are priced separately unless included in a matching benchmark"
    );
  }

  const accessScore = accessDifficulty(input.collection) + accessDifficulty(input.delivery) +
    (input.additionalStop ? accessDifficulty(input.additionalStop) * 0.5 : 0);
  if (accessScore >= 4) {
    addLine(
      customerBreakdown,
      internalBreakdown,
      "difficult_access_charge",
      "Difficult access",
      poundsToPence(Math.ceil(accessScore) * settingWithFallback(settings, "access_difficulty_unit", 2.39)),
      "Difficult access is separated from the standard benchmark service"
    );
  }

  const explicitServiceKeys = [
    "unpacking",
    "furnitureProtection",
    "mattressProtection",
    "tvProtection",
    "wasteDisposal",
    "waitingTime",
  ] as const;
  const explicitUnits = explicitServiceKeys.reduce((sum, key) => sum + (services[key] ? 1 : 0), 0);
  if (explicitUnits > 0) {
    addLine(
      customerBreakdown,
      internalBreakdown,
      "optional_services_charge",
      "Additional services",
      poundsToPence(explicitUnits * settingWithFallback(settings, "optional_service_unit", 10.77)),
      "Optional services not represented by the benchmark are displayed separately"
    );
  }

  if (classification.kind === "FULL_HOUSE" && (metrics.heavyOrSpecialItemCount > 0 || services.heavyItemHandling || services.pianoHandling)) {
    const units = Math.max(metrics.heavyOrSpecialItemCount, services.heavyItemHandling || services.pianoHandling ? 1 : 0);
    addLine(
      customerBreakdown,
      internalBreakdown,
      "heavy_and_special_item_charge",
      "Heavy or specialist handling",
      poundsToPence(units * settingWithFallback(settings, "heavy_item_unit", 23.94)),
      "Heavy or specialist items are separated because the selected home-removal benchmark is a standard-service benchmark"
    );
  }

  const extraMovers = Math.max(0, crew.movers - inferredCrewCount);
  if (extraMovers > 0 || services.additionalMover) {
    const units = Math.max(extraMovers, services.additionalMover ? 1 : 0);
    addLine(
      customerBreakdown,
      internalBreakdown,
      "additional_helper_charge",
      `${units} additional mover${units === 1 ? "" : "s"}`,
      poundsToPence(units * settingWithFallback(settings, "helper_price", 21.55)),
      "Customer-requested extra crew is separated from the benchmark move price"
    );
  }
}

function benchmarkSelectionIssue(
  input: CreateQuoteRequest,
  route: RouteMetrics | null,
  criteria: BenchmarkSelectionCriteria,
  context: CompetitorPricingContext | null | undefined,
  now: Date
): string | null {
  const classification = criteria.classification;
  const benchmark = context?.benchmark ?? null;

  if (!route) {
    return issue("AUTHORITATIVE_ROUTE_UNAVAILABLE", "Server route mileage is required before an automatic price can be issued");
  }
  if (classification.kind === "UNSUPPORTED") {
    return issue("MANUAL_REVIEW_REQUIRED", "Move type and property size do not map to a supported AnyVan benchmark class");
  }
  if (classification.missingBenchmarkDimensions.length > 0) {
    return issue(
      "MANUAL_REVIEW_REQUIRED",
      `Missing benchmark dimension: ${classification.missingBenchmarkDimensions.join(", ")}`
    );
  }
  if (context?.selection.errorCode) {
    return issue(context.selection.errorCode, context.selection.errorMessage ?? "Benchmark selection failed");
  }
  if (!benchmark) {
    return issue("BENCHMARK_UNAVAILABLE", "No active AnyVan benchmark matched the normalized pricing inputs");
  }
  if (!benchmark.active) {
    return issue("BENCHMARK_EXPIRED", "Selected benchmark is inactive");
  }
  if (new Date(benchmark.effectiveFrom).getTime() > now.getTime()) {
    return issue("BENCHMARK_EXPIRED", "Selected benchmark is not yet effective");
  }
  if (benchmark.effectiveTo && new Date(benchmark.effectiveTo).getTime() <= now.getTime()) {
    return issue("BENCHMARK_EXPIRED", "Selected benchmark has expired");
  }
  if (!Number.isInteger(benchmark.benchmarkPricePence) || benchmark.benchmarkPricePence <= 0) {
    return issue("BENCHMARK_UNAVAILABLE", "Selected benchmark has no positive benchmarkPricePence");
  }
  if (benchmark.moveType !== input.moveType) {
    return issue("BENCHMARK_UNAVAILABLE", "Selected benchmark move type does not match the quote");
  }
  if (!classification.benchmarkPropertySizes.includes(benchmark.propertySize)) {
    return issue("BENCHMARK_UNAVAILABLE", "Selected benchmark property or item class does not match the quote");
  }
  if (benchmark.serviceLevel !== classification.serviceLevel) {
    return issue("BENCHMARK_UNAVAILABLE", "Selected benchmark service level does not match the quote");
  }
  if (benchmark.packingIncluded !== classification.packingIncluded) {
    return issue("BENCHMARK_UNAVAILABLE", "Selected benchmark packing mode does not match the quote");
  }
  if (!criteria.regionCandidates.some((region) => region.toLowerCase() === benchmark.region.toLowerCase())) {
    return issue("BENCHMARK_UNAVAILABLE", "Selected benchmark region does not match collection or delivery region");
  }
  if (route.distanceMiles < benchmark.distanceBandMinMiles) {
    return issue("BENCHMARK_UNAVAILABLE", "Authoritative route mileage is below the selected benchmark distance band");
  }
  if (benchmark.distanceBandMaxMiles != null && route.distanceMiles > benchmark.distanceBandMaxMiles) {
    return issue("BENCHMARK_UNAVAILABLE", "Authoritative route mileage is above the selected benchmark distance band");
  }

  return null;
}

function competitorSummary(params: {
  benchmark: CompetitorBenchmarkSnapshot | null;
  context: CompetitorPricingContext | null | undefined;
  classification: PricingClassification;
  customerMovePricePence: number | null;
  finalTotalPence: number | null;
  unableReason: string | null;
}): CompetitorEvaluationResult {
  const benchmark = params.benchmark;
  const factor = params.classification.appliedFactor;
  if (!benchmark || params.customerMovePricePence == null || params.unableReason) {
    return {
      applied: false,
      benchmarkId: benchmark?.id ?? null,
      campaignId: params.context?.campaign?.id ?? null,
      normalOperationalPricePence: 0,
      benchmarkPricePence: benchmark?.benchmarkPricePence ?? null,
      targetPricePence: benchmark ? Math.floor(benchmark.benchmarkPricePence * factor) : null,
      safeMinimumPricePence: null,
      finalPricePence: null,
      discountPence: 0,
      savingAgainstBenchmarkPence: null,
      appliedRule: null,
      unableReason: params.unableReason,
      customerLabel: null,
      enforceExactTarget: true,
      internalNotes: params.unableReason ? [params.unableReason] : [],
    };
  }

  const discountPence = Math.max(0, benchmark.benchmarkPricePence - params.customerMovePricePence);
  return {
    applied: true,
    benchmarkId: benchmark.id,
    campaignId: params.context?.campaign?.id ?? null,
    normalOperationalPricePence: params.finalTotalPence ?? params.customerMovePricePence,
    benchmarkPricePence: benchmark.benchmarkPricePence,
    targetPricePence: params.customerMovePricePence,
    safeMinimumPricePence: null,
    finalPricePence: params.finalTotalPence,
    discountPence,
    savingAgainstBenchmarkPence: discountPence,
    appliedRule: factor === ANYVAN_HOUSE_FACTOR ? "anyvan_house_90_percent" : "anyvan_item_led_100_percent",
    unableReason: null,
    customerLabel: factor === ANYVAN_HOUSE_FACTOR ? "10% below AnyVan benchmark" : "AnyVan benchmark price",
    enforceExactTarget: true,
    internalNotes: [
      `Selected AnyVan benchmark ${benchmark.id}`,
      `Region ${benchmark.region}; distance band ${benchmark.distanceBandMinMiles}-${benchmark.distanceBandMaxMiles ?? "open"} miles`,
      `Benchmark price ${benchmark.benchmarkPricePence}; applied factor ${factor.toFixed(2)}`,
      `Source note: ${benchmark.sourceNote}`,
    ],
  };
}

function estimatedInternalCostPence(params: {
  settings: Record<string, number>;
  vehicle: PricingVehicleClass | null;
  route: RouteMetrics | null;
  crew: CrewRecommendation;
  metrics: InventoryMetrics;
}): number | null {
  const route = params.route;
  if (!route) return null;
  const labourRate = settingWithFallback(params.settings, "labour_hourly_rate", 20.95);
  const labour = poundsToPence(labourRate * params.crew.movers * (params.crew.chargeableLabourMinutes / 60));
  const vehicleBase = params.vehicle?.baseFeePence ?? poundsToPence(20);
  const mileage = Math.round((params.vehicle?.perMilePence ?? 65) * route.distanceMiles);
  const hourly = Math.round((params.vehicle?.perHourPence ?? poundsToPence(8)) * (params.crew.totalJobMinutes / 60));
  const handling = poundsToPence(params.metrics.heavyOrSpecialItemCount * 8);
  return Math.max(0, Math.round(labour + vehicleBase + mileage + hourly + handling));
}

function safetyIssue(params: {
  finalTotalPence: number | null;
  estimatedCostPence: number | null;
  settings: Record<string, number>;
}): string | null {
  if (params.finalTotalPence == null || params.estimatedCostPence == null) return null;
  const allowNegativeMargin = setting(params.settings, "allow_negative_margin") === 1;
  const allowZeroMargin = setting(params.settings, "allow_zero_margin") === 1;
  const minimumContribution = poundsToPence(setting(params.settings, "minimum_contribution") ?? 0);
  const minimumMargin = setting(params.settings, "minimum_margin_percent") ?? setting(params.settings, "manual_review_min_margin_percent");
  const contribution = params.finalTotalPence - params.estimatedCostPence;

  if (!allowNegativeMargin && contribution < 0) {
    return issue("SAFETY_REVIEW_REQUIRED", "Benchmark price is below independently estimated cost");
  }
  if (!allowZeroMargin && contribution === 0) {
    return issue("SAFETY_REVIEW_REQUIRED", "Benchmark price leaves zero contribution");
  }
  if (contribution < minimumContribution) {
    return issue("SAFETY_REVIEW_REQUIRED", "Benchmark price is below configured minimum contribution");
  }
  if (minimumMargin != null) {
    const margin = params.finalTotalPence > 0 ? contribution / params.finalTotalPence : -1;
    if (margin < minimumMargin) {
      return issue("SAFETY_REVIEW_REQUIRED", "Benchmark price is below configured minimum margin");
    }
  }
  return null;
}

export function calculateRemovalQuote(params: {
  input: CreateQuoteRequest;
  inventory: ResolvedInventoryItem[];
  route: RouteMetrics | null;
  pricingVersion: PricingVersionSnapshot | null;
  promotionContext?: PromotionPricingContext | null;
  competitorContext?: CompetitorPricingContext | null;
  now?: Date;
  quoteExpiresAt?: Date;
}): PricingResult {
  void params.promotionContext;
  const now = params.now ?? new Date();
  const settings = params.pricingVersion?.settings ?? {};
  const quoteExpiresAt = params.quoteExpiresAt ?? new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const metrics = inventoryMetrics(params.inventory);
  const roundedMetrics = roundMetrics(metrics);
  const classification = classifyQuoteForPricing(params.input, params.inventory);
  const criteria = benchmarkSelectionCriteriaForQuote(
    params.input,
    params.inventory,
    params.route?.distanceMiles ?? null
  );
  const vehicleRecommendation = chooseVehicle(params.pricingVersion?.vehicleClasses ?? [], metrics);
  const vehicle = selectedVehicle(params.pricingVersion?.vehicleClasses ?? [], vehicleRecommendation);
  const inferredCrewCount = inferredCrew(params.input, params.inventory, metrics, vehicle);
  const crew = crewRecommendation(params.input, params.inventory, metrics, params.route, vehicle);
  const benchmark = params.competitorContext?.benchmark ?? null;
  const internalBreakdown: InternalPriceLine[] = [];
  const customerBreakdown: PriceLine[] = [];
  const reasons: string[] = [];

  if (!params.pricingVersion) {
    reasons.push(issue("MANUAL_REVIEW_REQUIRED", "No active pricing version is configured for operational cost controls"));
  }

  const selectionIssue = benchmarkSelectionIssue(params.input, params.route, criteria, params.competitorContext, now);
  if (selectionIssue) reasons.push(selectionIssue);

  let customerMovePricePence: number | null = null;
  if (!selectionIssue && benchmark) {
    customerMovePricePence = Math.floor(benchmark.benchmarkPricePence * classification.appliedFactor);
    addLine(
      customerBreakdown,
      internalBreakdown,
      "anyvan_benchmark_move_price",
      classification.appliedFactor === ANYVAN_HOUSE_FACTOR
        ? "Move price at 90% of AnyVan benchmark"
        : "Move price at AnyVan benchmark",
      customerMovePricePence,
      classification.appliedFactor === ANYVAN_HOUSE_FACTOR
        ? "Full-house customer move price is floor(AnyVan benchmark * 0.90), with no later rounding above that target"
        : "Item-led customer move price is exactly 100% of the selected AnyVan benchmark"
    );
  }

  if (!selectionIssue) {
    optionalServiceLines({
      input: params.input,
      classification,
      metrics,
      settings,
      benchmark,
      crew,
      inferredCrewCount,
      customerBreakdown,
      internalBreakdown,
    });
  }

  const preSafetyTotalPence = selectionIssue
    ? null
    : customerBreakdown.reduce((sum, line) => sum + line.amountPence, 0);
  const estimatedCostPence = estimatedInternalCostPence({
    settings,
    vehicle,
    route: params.route,
    crew,
    metrics,
  });
  const safety = safetyIssue({
    finalTotalPence: preSafetyTotalPence,
    estimatedCostPence,
    settings,
  });
  if (safety) reasons.push(safety);

  const uniqueReasons = Array.from(new Set(reasons));
  const status: PricingResult["status"] = uniqueReasons.length > 0 ? "MANUAL_REVIEW" : "FIXED";
  const finalTotalPence = status === "FIXED" ? preSafetyTotalPence : null;
  const grossProfitPence = finalTotalPence != null && estimatedCostPence != null
    ? finalTotalPence - estimatedCostPence
    : null;
  const grossMarginPercentage = finalTotalPence && grossProfitPence != null
    ? grossProfitPence / finalTotalPence
    : null;
  const benchmarkDiscountPence =
    status === "FIXED" && benchmark && customerMovePricePence != null
      ? Math.max(0, benchmark.benchmarkPricePence - customerMovePricePence)
      : 0;
  const originalTotalPence =
    status === "FIXED" && benchmark
      ? benchmark.benchmarkPricePence + customerBreakdown
          .filter((line) => line.key !== "anyvan_benchmark_move_price")
          .reduce((sum, line) => sum + line.amountPence, 0)
      : null;
  const competitor = competitorSummary({
    benchmark,
    context: params.competitorContext,
    classification,
    customerMovePricePence,
    finalTotalPence,
    unableReason: uniqueReasons[0] ?? null,
  });

  internalBreakdown.push({
    key: "pricing_classification",
    label: "Pricing classification",
    amountPence: 0,
    explanation: JSON.stringify({
      kind: classification.kind,
      requestedMoveSize: classification.requestedMoveSize,
      effectivePropertySize: classification.effectivePropertySize,
      benchmarkPropertySizes: classification.benchmarkPropertySizes,
      appliedFactor: classification.appliedFactor,
      packingIncluded: classification.packingIncluded,
      auditInput: classification.auditInput,
    }),
  });
  if (estimatedCostPence != null) {
    internalBreakdown.push({
      key: "estimated_internal_cost",
      label: "Estimated internal cost",
      amountPence: estimatedCostPence,
      explanation: "Internal cost is estimated independently from the benchmark customer price using crew, route, vehicle and handling inputs",
    });
  }

  return {
    pricingVersionId: params.pricingVersion?.id ?? null,
    pricingVersionNumber: params.pricingVersion?.version ?? null,
    status,
    finalTotalPence,
    customerBreakdown: status === "FIXED" ? customerBreakdown : [],
    internalBreakdown,
    inventoryMetrics: roundedMetrics,
    vehicleRecommendation,
    crewRecommendation: crew,
    manualReviewReasons: uniqueReasons,
    customerSummary: {
      routeMileage: params.route?.distanceMiles ?? null,
      estimatedDurationMinutes: crew.totalJobMinutes || null,
      quoteExpiresAt: quoteExpiresAt.toISOString(),
      originalTotalPence,
      discountTotalPence: status === "FIXED" ? benchmarkDiscountPence : 0,
      promotionLabel: status === "FIXED" ? competitor.customerLabel : null,
    },
    promotionSummary: {
      applied: [],
      discountTotalPence: 0,
      customerLabel: null,
    },
    competitorSummary: competitor,
    internalSummary: {
      estimatedCostPence,
      grossProfitPence,
      grossMarginPercentage,
      contributionPence: grossProfitPence,
      preDiscountTotalPence: originalTotalPence,
      roundingAdjustmentPence: 0,
      appliedRuleExplanations: internalBreakdown.map((line) => line.explanation),
    },
  };
}

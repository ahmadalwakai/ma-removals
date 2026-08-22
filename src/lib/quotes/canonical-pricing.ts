import crypto from "node:crypto";
import { db } from "@/lib/db";
import {
  ITEM_METRICS_DATASET_VERSION,
  getItemMetricBySlug,
  type ItemMetricConfidence,
} from "@/lib/items/item-metrics";
import { findCanonicalInventoryItemsForPricing } from "@/lib/items/catalog";
import { normalizeCanonicalInventory } from "@/lib/quotes/canonical-inventory";
import { packingChargePenceForMove } from "@/lib/packing";
import { PRICING_ALGORITHM_VERSION } from "@/lib/quotes/pricing-version";
import type { AddressAccessInput, CreateQuoteRequest, CustomInventoryItem } from "@/lib/quotes/schemas";
import {
  findDynamicReferenceProfile,
  type DynamicPricingClassification,
  type DynamicReferenceProfile,
} from "@/lib/quotes/reference-profiles";
import { calculateServerRoute, type RouteCalculationResult } from "@/lib/routing/mapbox";
import type { RouteMetrics } from "@/lib/routing/types";

export { PRICING_ALGORITHM_VERSION };

export type PricingClassification = DynamicPricingClassification;

export type ManualReviewReasonCode =
  | "PRICING_INPUT_INVALID"
  | "INVENTORY_REQUIRED"
  | "DISTANCE_OUT_OF_RANGE"
  | "CAPACITY_REVIEW"
  | "PAYLOAD_REVIEW"
  | "CREW_UNSAFE"
  | "ACCESS_REVIEW"
  | "SPECIALIST_REVIEW"
  | "DATE_REVIEW"
  | "COST_FLOOR_CONFLICT"
  | "STALE_PREVIEW"
  | "PAYMENT_AMOUNT_MISMATCH"
  | "ITEM_NOT_FOUND"
  | "ITEM_INACTIVE"
  | "ITEM_METRICS_MISSING"
  | "ITEM_METRICS_LOW_CONFIDENCE"
  | "CUSTOM_INVENTORY"
  | "SPECIALIST_ITEM_REQUIRES_REVIEW"
  | "INVALID_ITEM_QUANTITY"
  | "DYNAMIC_REFERENCE_MISSING"
  | "UNSUPPORTED_MOVE_CLASSIFICATION"
  | "CREW_REQUIREMENT_UNSUPPORTED"
  | "MISSING_BENCHMARK"
  | "EXPIRED_BENCHMARK"
  | "AMBIGUOUS_BENCHMARK"
  | "ROUTE_UNAVAILABLE"
  | "ROUTE_UNRELIABLE"
  | "DEMAND_EXCEEDS_AUTOMATIC_RANGE"
  | "LUTON_REFERENCE_CAPACITY_MISSING"
  | "AMBIGUOUS_LUTON_REFERENCE_CAPACITY"
  | "DATA_UNAVAILABLE";

export type ManualReviewReason = ManualReviewReasonCode;

type InternalManualReviewReasonCode =
  | ManualReviewReasonCode
  | "ITEM_NOT_FOUND"
  | "ITEM_INACTIVE"
  | "ITEM_METRICS_MISSING"
  | "ITEM_METRICS_LOW_CONFIDENCE"
  | "CUSTOM_INVENTORY"
  | "SPECIALIST_ITEM_REQUIRES_REVIEW"
  | "INVALID_ITEM_QUANTITY"
  | "DYNAMIC_REFERENCE_MISSING"
  | "UNSUPPORTED_MOVE_CLASSIFICATION"
  | "CREW_REQUIREMENT_UNSUPPORTED"
  | "MISSING_BENCHMARK"
  | "EXPIRED_BENCHMARK"
  | "AMBIGUOUS_BENCHMARK"
  | "ROUTE_UNAVAILABLE"
  | "ROUTE_UNRELIABLE"
  | "DEMAND_EXCEEDS_AUTOMATIC_RANGE"
  | "LUTON_REFERENCE_CAPACITY_MISSING"
  | "AMBIGUOUS_LUTON_REFERENCE_CAPACITY"
  | "DATA_UNAVAILABLE";

export type ControllingCapacityDimension = "VOLUME" | "WEIGHT" | "EQUAL";

export interface VehicleClassConfigForPricing {
  id: string;
  name: string;
  isActive: boolean;
  maxUsableVolumeM3: number | null;
  maxPayloadKg: number | null;
  updatedAt: Date | string;
}

export interface LutonCapacityReferenceSnapshot {
  id: string;
  name: string;
  isActive: boolean;
  updatedAt: string;
  maxUsableVolumeM3: number;
  maxPayloadKg: number;
}

export interface PricingTimingMs {
  requestValidation: number;
  routeCalculation: number;
  inventoryResolution: number;
  benchmarkQuery: number;
  canonicalCalculation: number;
  total: number;
}

export interface CompetitorBenchmarkForPricing {
  id: string;
  region: string;
  moveType: string;
  propertySize: string;
  serviceLevel: string;
  packingIncluded: boolean;
  distanceBandMinMiles: number;
  distanceBandMaxMiles: number | null;
  benchmarkPricePence: number;
  effectiveFrom: Date | string;
  effectiveTo: Date | string | null;
  sourceNote: string;
  active: boolean;
}

export interface InventoryRecordForPricing {
  id: string;
  slug?: string | null;
  name: string;
  imagePath: string | null;
  weight: string;
  size: string;
  estimatedVolumeM3: number | null;
  estimatedWeightKg: number | null;
  handlingMinutes?: number | null;
  requiresTwoPeople: boolean;
  fragile: boolean;
  heavy: boolean;
  specialist: boolean;
  minimumCrew: number | null;
  isActive: boolean;
  category?: {
    name: string;
    type: string;
  } | null;
}

export interface ResolvedInventoryLine {
  itemId: string;
  itemSlug: string;
  quantity: number;
  room: string | null;
  name: string;
  categoryName: string | null;
  categoryType: string | null;
  transportedLengthM: number;
  transportedWidthM: number;
  transportedHeightM: number;
  estimatedVolumeM3: number;
  estimatedWeightKg: number;
  handlingMinutes: number;
  bulky: boolean;
  requiresTwoPeople: boolean;
  fragile: boolean;
  heavy: boolean;
  specialist: boolean;
  minimumCrew: number;
  metricDatasetVersion: string;
  metricConfidence: ItemMetricConfidence;
  metricRationale: string;
}

export interface InventorySummary {
  totalUnits: number;
  itemUnits: number;
  totalVolumeM3: number;
  totalWeightKg: number;
  totalHandlingMinutes: number;
  heavyUnitCount: number;
  bulkyUnitCount: number;
  twoPersonUnitCount: number;
  specialistUnitCount: number;
  fragileItemCount: number;
  heavyOrSpecialItemCount: number;
}

export type ResolvedMoveScope =
  | "FULL_PROPERTY_MOVE"
  | "PARTIAL_PROPERTY_MOVE"
  | "SINGLE_ITEM_MOVE"
  | "FEW_ITEMS_MOVE"
  | "STUDENT_MOVE"
  | "MAN_AND_VAN_MOVE"
  | "BUSINESS_MOVE"
  | "UNSUPPORTED_MOVE";

export type MoveScopeConfidence = "HIGH" | "MEDIUM" | "LOW";

export type MoveScopeReasonCode =
  | "NO_EXPLICIT_INVENTORY_FULL_PROPERTY_ASSUMED"
  | "PROPERTY_REFERENCE_INVENTORY_MATCH"
  | "PROPERTY_INVENTORY_BELOW_FULL_REFERENCE"
  | "PROPERTY_SINGLE_ITEM_SELECTED"
  | "EXPLICIT_INDIVIDUAL_ITEM_SERVICE"
  | "EXPLICIT_STUDENT_SERVICE"
  | "EXPLICIT_MAN_AND_VAN_SERVICE"
  | "EXPLICIT_BUSINESS_SERVICE"
  | "CUSTOM_INVENTORY_LOW_CONFIDENCE"
  | "UNSUPPORTED_PROPERTY_SIZE"
  | "UNSUPPORTED_MOVE_TYPE";

export interface InventoryFacts {
  totalPhysicalUnits: number;
  totalVolumeM3: number;
  totalWeightKg: number;
  totalHandlingMinutes: number;
  heavyUnitCount: number;
  bulkyUnitCount: number;
  specialUnitCount: number;
  onePersonUnitCount: number;
  twoPersonUnitCount: number;
  fragileItemCount: number;
  heavyOrSpecialItemCount: number;
  roomCoverage: string[];
  roomCoverageCount: number;
  largestItem: {
    itemId: string | null;
    name: string | null;
    volumeM3: number;
    weightKg: number;
    handlingMinutes: number;
    minimumCrew: number;
    bulky: boolean;
    heavy: boolean;
    specialist: boolean;
  };
  requiredCrewFromItems: number;
  usableVehicleLoadRatioBps: number | null;
}

export interface MoveScopeResolution {
  resolvedMoveScope: ResolvedMoveScope;
  confidence: MoveScopeConfidence;
  reasonCodes: MoveScopeReasonCode[];
  classification: PricingClassification | "UNSUPPORTED";
  propertySize: string | null;
  propertyCoverageBps: number | null;
  propertyVolumeRatioBps: number | null;
  propertyWeightRatioBps: number | null;
  propertyHandlingRatioBps: number | null;
  confirmationRecommended: boolean;
}

export interface ResourcePlan {
  crew: {
    requestedMovers: number;
    requiredMovers: number;
    itemMinimumCrew: number;
    twoPersonHandlingRequired: boolean;
  };
  vehicle: {
    name: string;
    usableVolumeM3: number;
    payloadKg: number;
    loadRatioBps: number;
    trips: number;
    multipleTripsLikely: boolean;
  };
  capacity: {
    volumeCapacityBps: number;
    weightCapacityBps: number;
    controllingCapacityDimension: ControllingCapacityDimension;
  };
  handling: {
    loadingMinutes: number;
    unloadingMinutes: number;
    totalHandlingMinutes: number;
  };
}

export interface DemandRatiosBps {
  volumeCapacityBps: number;
  weightCapacityBps: number;
  controllingCapacityDimension: ControllingCapacityDimension;
  lutonCapacityDemandBps: number;
  referenceVolumeCapacityBps: number;
  referenceWeightCapacityBps: number;
  referenceLutonDemandBps: number;
  relativeCapacityDemandBps: number;
  handlingRelativeBps: number;
  crewRelativeBps: number;
  effectiveDemandBps: number;
  volumeRatioBps: number;
  weightRatioBps: number;
  handlingRatioBps: number;
  crewRatioBps: number;
  inventoryDemandBps: number;
  controllingDemandDimension: "volume" | "weight" | "equal" | "handling" | "crew";
}

export interface CanonicalPricingInput {
  pricingAlgorithmVersion: string;
  pricingCurveVersion: string;
  itemMetricDatasetVersion: string;
  moveType: string;
  classification: PricingClassification | "UNSUPPORTED";
  resolvedMoveScope: ResolvedMoveScope;
  moveScopeConfidence: MoveScopeConfidence;
  moveScopeReasonCodes: MoveScopeReasonCode[];
  moveScopeConfirmationRecommended: boolean;
  propertyCoverageBps: number | null;
  region: string;
  propertySize: string | null;
  serviceLevel: string;
  packingIncluded: boolean;
  routeDistanceMiles: number | null;
  routeDurationMinutes: number | null;
  routeHash: string | null;
  referenceProfileId: string | null;
  referenceProfileVersion: string | null;
  lutonCapacityReference: LutonCapacityReferenceSnapshot | null;
  inventory: Array<{
    itemId: string;
    itemSlug: string;
    quantity: number;
    room: string | null;
    itemMetricVersion: string;
  }>;
  customInventory: Array<{
    name: string;
    quantity: number;
    room: string;
  }>;
  inventoryFacts: InventoryFacts;
  crewRequirement: {
    requestedMovers: number;
    requiredMovers: number;
  };
  bookingChannel: string;
  moveDate: string | null;
  effectiveDate: string;
  pickupWindow: "morning" | "afternoon" | "evening" | null;
  urgency: "STANDARD" | "URGENT" | "SAME_DAY";
  dayType: "WEEKDAY" | "WEEKEND";
  waitingMinutes: number;
  dateFlexibility: {
    flexibleDate: boolean;
    flexibleTime: boolean;
    exactTime: boolean;
    earliestDate: string | null;
    latestDate: string | null;
  };
  access: {
    stops: Array<{
      role: "collection" | "delivery" | "additional-stop";
      floor: number;
      hasLift: boolean;
      internalStairs: number;
      externalStairs: number;
      carryDistanceMeters: number;
      parking: string;
      narrowRoad: boolean;
      loadingBayAvailable: boolean;
    }>;
  };
  services: {
    packing: boolean;
    packingMaterials: boolean;
    unpacking: boolean;
    dismantling: boolean;
    reassembly: boolean;
    furnitureProtection: boolean;
    mattressProtection: boolean;
    tvProtection: boolean;
    wasteDisposal: boolean;
    additionalMover: boolean;
    waitingTime: boolean;
    heavyItemHandling: boolean;
    pianoHandling: boolean;
    dismantlingItems: number;
    reassemblyItems: number;
  };
}

export interface PricingAuditSnapshot {
  pricingAlgorithmVersion: string;
  itemMetricDatasetVersion: string;
  explanation: string;
  classification: PricingClassification | "UNSUPPORTED";
  resolvedMoveScope?: ResolvedMoveScope;
  moveScopeConfidence?: MoveScopeConfidence;
  moveScopeReasonCodes?: MoveScopeReasonCode[];
  moveScopeConfirmationRecommended?: boolean;
  propertyCoverageBps?: number | null;
  inventoryFacts?: InventoryFacts;
  resourcePlan?: ResourcePlan | null;
  referenceProfile?: {
    profileId: string;
    profileVersion: string;
    classification: PricingClassification;
    propertySize: string | null;
    referenceUnits: number;
    referenceVolumeM3: number;
    referenceWeightKg: number;
    referenceHandlingMinutes: number;
    referenceCrew: number;
    items: Array<{ slug: string; quantity: number }>;
    rationale: string;
  };
  normalizedInventory?: Array<{ itemId: string; itemSlug: string; quantity: number; room: string | null; itemMetricVersion: string }>;
  inventorySummary?: InventorySummary;
  requiredCrew?: number;
  demandRatios?: DemandRatiosBps;
  adjustmentBps?: number;
  pricingCurveVersion?: string;
  baseTargetBps?: number;
  lutonFullLoadTargetPence?: number;
  lutonLoadPriceFloorPence?: number;
  costBasedQuotePence?: number;
  costSafeFloorPence?: number;
  competitorTargetPence?: number | null;
  competitorClaimSuppressedReason?: string | null;
  marketBenchmarkPence?: number | null;
  baseMarketBenchmarkPence?: number | null;
  marketTargetPence?: number | null;
  roundedTargetPence?: number | null;
  baseRoundedTargetPence?: number | null;
  dateSurchargePence?: number;
  costFloorPence?: number | null;
  directOperatingCostPence?: number;
  contributionPence?: number | null;
  contributionMargin?: number | null;
  vehicleTrips?: number;
  marketCeilingPence?: number;
  marketCeilingReached?: boolean;
  totalVolumeM3?: number;
  totalWeightKg?: number;
  lutonCapacityReference?: LutonCapacityReferenceSnapshot | null;
  lutonUsableVolumeM3?: number;
  lutonPayloadKg?: number;
  volumeCapacityBps?: number;
  weightCapacityBps?: number;
  controllingCapacityDimension?: ControllingCapacityDimension;
  referenceLutonDemandBps?: number;
  relativeCapacityDemandBps?: number;
  handlingRelativeBps?: number;
  crewRelativeBps?: number;
  effectiveDemandBps?: number;
  finalTotalPence?: number | null;
  finalPricePence?: number | null;
  actualSavingBps?: number;
  serverInputHash?: string;
  benchmark?: {
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
  };
}

export type PricingBreakdown = Array<{ key: string; label: string; amountPence: number }>;

export interface AutoQuoteCanonicalPricingResult {
  status: "AUTO_QUOTE" | "FIXED";
  quoteId: string;
  modelVersion: string;
  currency: "GBP";
  marketBenchmarkPence: number;
  marketTargetPence: number;
  roundedTargetPence: number;
  costFloorPence: number;
  finalPricePence: number;
  savingsPence: number;
  savingsRate: number;
  directOperatingCostPence: number;
  contributionPence: number;
  contributionMargin: number;
  crewSize: number;
  vehicleTrips: number;
  estimatedVolumeM3: number;
  estimatedWeightKg: number;
  expiresAt?: string;
  inputFingerprint: string;
  totalPence: number;
  benchmarkPricePence: number | null;
  savingPercent: number | null;
  pricingAlgorithmVersion: string;
  competitorBenchmarkId: string | null;
  serverInputHash: string;
  explanation: string;
  canonicalInput: CanonicalPricingInput;
  auditSnapshot: PricingAuditSnapshot;
  routeMetrics: RouteMetrics;
  referenceProfile: DynamicReferenceProfile;
  lutonCapacityReference: LutonCapacityReferenceSnapshot;
  requiredCrew: number;
  demandRatios: DemandRatiosBps;
  adjustmentBps: number;
  baseTargetBps: number;
  marketCeilingPence: number;
  inventory: {
    lines: ResolvedInventoryLine[];
    summary: InventorySummary;
  };
  resolvedMoveScope: ResolvedMoveScope;
  moveScopeConfidence: MoveScopeConfidence;
  moveScopeReasonCodes: MoveScopeReasonCode[];
  inventoryFacts: InventoryFacts;
  resourcePlan: ResourcePlan;
  breakdown: PricingBreakdown;
  timingMs?: PricingTimingMs;
}

export interface ManualReviewCanonicalPricingResult {
  status: "MANUAL_REVIEW";
  quoteId: string;
  modelVersion: string;
  currency: "GBP";
  marketBenchmarkPence: number | null;
  marketTargetPence: number | null;
  costFloorPence: number | null;
  expiresAt: string;
  inputFingerprint: string;
  totalPence: null;
  pricingAlgorithmVersion: string;
  reasonCodes: ManualReviewReasonCode[];
  serverInputHash?: string;
  explanation: string;
  canonicalInput?: CanonicalPricingInput;
  auditSnapshot?: PricingAuditSnapshot;
  routeMetrics: RouteMetrics | null;
  referenceProfile?: DynamicReferenceProfile | null;
  lutonCapacityReference?: LutonCapacityReferenceSnapshot | null;
  requiredCrew?: number;
  inventory: {
    lines: ResolvedInventoryLine[];
    summary: InventorySummary;
  };
  resolvedMoveScope: ResolvedMoveScope;
  moveScopeConfidence: MoveScopeConfidence;
  moveScopeReasonCodes: MoveScopeReasonCode[];
  inventoryFacts: InventoryFacts;
  resourcePlan?: ResourcePlan | null;
  breakdown: [];
  timingMs?: PricingTimingMs;
}

export type CanonicalPricingResult = AutoQuoteCanonicalPricingResult | ManualReviewCanonicalPricingResult;

export interface BenchmarkSearchCriteria {
  classification: PricingClassification;
  region: string;
  moveType: string;
  propertySize: string | null;
  serviceLevel: string;
  packingIncluded: boolean;
  routeDistanceMiles: number;
  effectiveDate: string;
}

type PricingRequestCacheEntry<T> = {
  promise: Promise<T>;
  expiresAt: number;
};

export type PricingRequestCache<T> = Map<string, PricingRequestCacheEntry<T>>;

export interface CanonicalPricingDependencies {
  now?: Date;
  findInventoryItems?: (itemIds: string[]) => Promise<InventoryRecordForPricing[]>;
  findCompetitorBenchmarks?: (criteria: BenchmarkSearchCriteria) => Promise<CompetitorBenchmarkForPricing[]>;
  findVehicleClassConfigs?: () => Promise<VehicleClassConfigForPricing[]>;
  calculateRoute?: (addresses: AddressAccessInput[]) => Promise<RouteCalculationResult>;
  routeCache?: PricingRequestCache<RouteCalculationResult>;
  inventoryItemsCache?: PricingRequestCache<InventoryRecordForPricing[]>;
  competitorBenchmarksCache?: PricingRequestCache<CompetitorBenchmarkForPricing[]>;
  vehicleClassConfigCache?: PricingRequestCache<VehicleClassConfigForPricing[]>;
}

const PRICING_DATA_STORE_TIMEOUT_MS = 2_000;
const PRICING_REQUEST_CACHE_TTL_MS = 30_000;
const PRICING_REQUEST_CACHE_MAX_ENTRIES = 64;
const MAX_ITEM_QUANTITY = 99;
const MAX_AUTOMATIC_CREW = 2;
const LUTON_VAN_CLASS_NAME = "LUTON_VAN";
const LUTON_VAN_CONFIG_NAMES = [LUTON_VAN_CLASS_NAME, "Luton van"] as const;
const LUTON_CAPACITY_REFERENCE_CACHE_KEY = "active-vehicle-class-config:LUTON_VAN";
const PRICING_CURVE_VERSION = "market-target-cost-floor-v1";
const DEFAULT_PRICING_REGION = "Scotland";
const MARKET_TARGET_BPS = 9_000;
const PRICE_INCREMENT_PENCE = 500;
const EARLY_MOVE_DATE_SURCHARGE_PENCE = [10_039, 7_151, 5_021, 2_073, 1_033, 596] as const;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MINIMUM_MARGIN_BPS = 2_200;
const PAYMENT_PERCENTAGE_FEE_BPS = 150;
const PAYMENT_FIXED_FEE_PENCE = 20;
const MIN_AUTOMATIC_ADJUSTMENT_BPS = 7_000;
const MAX_AUTOMATIC_ADJUSTMENT_BPS = 70_000;
const MAX_AUTOMATIC_INVENTORY_DEMAND_BPS = 180_000;
const MAX_AUTOMATIC_LUTON_CAPACITY_BPS = 10_000;
const MAX_AUTOMATIC_FULL_HOUSE_LUTON_CAPACITY_BPS = 35_000;
const CANONICAL_LUTON_USABLE_VOLUME_M3 = 18;
const CANONICAL_LUTON_PAYLOAD_KG = 1200;
const LOCAL_FULL_LUTON_LOAD_TARGET_PENCE = 54_900;
const FULL_LUTON_LOAD_INCLUDED_MILES = 10;
const FULL_LUTON_LOAD_EXTRA_MILE_PENCE = 300;
const INCLUDED_ROUTE_DURATION_MINUTES = 30;
const PROPERTY_FLOW_SINGLE_ITEM_MAX_UNITS = 1;
const PROPERTY_FULL_MOVE_MIN_REFERENCE_DEMAND_BPS = 5_500;
const MAX_AUTO_DISTANCE_MILES = 620;
const MAX_NO_LIFT_FLOOR_AUTO = 4;
const MAX_LIFT_FLOOR_AUTO = 12;
const MAX_WALK_DISTANCE_AUTO_METRES = 120;
const MAX_WAITING_MINUTES_AUTO = 90;
const DISPATCH_COST_PENCE = 1_200;
const ADMIN_COST_PENCE = 900;
const LABOUR_MINUTE_COST_PENCE = 32;
const FUEL_MILE_COST_PENCE = 42;
const VEHICLE_WEAR_MILE_COST_PENCE = 16;
const SPECIALIST_UNIT_COST_PENCE = 2_000;
const RETURN_LEG_MULTIPLIER_BPS = 15_000;
const INDIVIDUAL_ITEM_DISPATCH_COST_PENCE = 400;
const INDIVIDUAL_ITEM_ADMIN_COST_PENCE = 250;
const INDIVIDUAL_ITEM_LABOUR_MINUTE_COST_PENCE = 18;
const INDIVIDUAL_ITEM_FUEL_MILE_COST_PENCE = 35;
const INDIVIDUAL_ITEM_VEHICLE_WEAR_MILE_COST_PENCE = 8;
const INDIVIDUAL_ITEM_RETURN_LEG_MULTIPLIER_BPS = 10_000;
const INDIVIDUAL_ITEM_URGENT_COST_PENCE = 1_500;
const REFERENCE_BASE_PRICE_PENCE: Record<PricingClassification, Record<string, number>> = {
  FULL_HOUSE: {
    studio: 27_500,
    "1-bedroom": 36_000,
    "2-bedrooms": 42_500,
    "3-bedrooms": 52_500,
    "4-bedrooms": 69_500,
    "5-plus-bedrooms": 78_500,
  },
  INDIVIDUAL_ITEMS: {
    "single-item": 4_900,
    "few-items": 7_200,
  },
  STUDENT_MOVE: {
    "few-items": 14_500,
  },
  MAN_AND_VAN: {
    "few-items": 9_500,
  },
  BUSINESS_REMOVAL: {
    office: 54_000,
  },
};
const EXTRA_MILE_PENCE: Record<PricingClassification, number> = {
  FULL_HOUSE: 260,
  STUDENT_MOVE: 190,
  MAN_AND_VAN: 210,
  BUSINESS_REMOVAL: 280,
  INDIVIDUAL_ITEMS: 170,
};
const EXTRA_ROUTE_MINUTE_PENCE: Record<PricingClassification, number> = {
  FULL_HOUSE: 80,
  STUDENT_MOVE: 55,
  MAN_AND_VAN: 60,
  BUSINESS_REMOVAL: 90,
  INDIVIDUAL_ITEMS: 45,
};
const SUPPORTED_FULL_HOUSE_PROPERTY_SIZES = new Set([
  "studio",
  "1-bedroom",
  "2-bedrooms",
  "3-bedrooms",
  "4-bedrooms",
  "5-plus-bedrooms",
]);
const COMPLETE_PROPERTY_MOVE_TYPES = new Set(["house-move", "flat-move"]);
const INDIVIDUAL_ITEM_MOVE_TYPES = new Set(["single-item-delivery", "furniture-delivery", "piano-move"]);
const MOVE_TYPE_MIN_CREW: Record<PricingClassification, number> = {
  FULL_HOUSE: 1,
  INDIVIDUAL_ITEMS: 1,
  STUDENT_MOVE: 1,
  MAN_AND_VAN: 1,
  BUSINESS_REMOVAL: 1,
};
function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, stableValue(entry)])
  );
}

export function stableHash(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

function monotonicNow() {
  return globalThis.performance?.now() ?? Date.now();
}

function elapsedMs(start: number): number {
  return Math.round((monotonicNow() - start) * 10) / 10;
}

function emptyTiming(): PricingTimingMs {
  return {
    requestValidation: 0,
    routeCalculation: 0,
    inventoryResolution: 0,
    benchmarkQuery: 0,
    canonicalCalculation: 0,
    total: 0,
  };
}

function finishTiming(timingMs: PricingTimingMs, totalStart: number): PricingTimingMs {
  return { ...timingMs, total: elapsedMs(totalStart) };
}

function withTiming<T extends CanonicalPricingResult>(
  result: T,
  timingMs: PricingTimingMs,
  totalStart: number
): T {
  return { ...result, timingMs: finishTiming(timingMs, totalStart) };
}

function cachedPromise<T>(
  cache: PricingRequestCache<T> | undefined,
  key: string,
  factory: () => Promise<T>,
  shouldCache: (value: T) => boolean = () => true
): Promise<T> {
  if (!cache) return factory();
  const now = Date.now();
  for (const [entryKey, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(entryKey);
  }

  const existing = cache.get(key);
  if (existing) return existing.promise;

  while (cache.size >= PRICING_REQUEST_CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }

  const entry: PricingRequestCacheEntry<T> = {
    expiresAt: now + PRICING_REQUEST_CACHE_TTL_MS,
    promise: factory().then(
      (value) => {
        if (cache.get(key) !== entry) return value;
        if (!shouldCache(value)) {
          cache.delete(key);
          return value;
        }
        cache.set(key, {
          promise: Promise.resolve(value),
          expiresAt: Date.now() + PRICING_REQUEST_CACHE_TTL_MS,
        });
        return value;
      },
      (error) => {
        if (cache.get(key) === entry) cache.delete(key);
        throw error;
      }
    ),
  };
  cache.set(key, entry);
  return entry.promise;
}

async function withDataStoreTimeout<T>(operation: string, promise: Promise<T>): Promise<T> {
  promise.catch(() => undefined);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${operation} database timeout`)), PRICING_DATA_STORE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function publicManualReviewReasonCode(reasonCode: InternalManualReviewReasonCode): ManualReviewReasonCode {
  switch (reasonCode) {
    case "ITEM_NOT_FOUND":
    case "ITEM_INACTIVE":
    case "ITEM_METRICS_MISSING":
    case "ITEM_METRICS_LOW_CONFIDENCE":
    case "CUSTOM_INVENTORY":
    case "INVALID_ITEM_QUANTITY":
      return "INVENTORY_REQUIRED";
    case "SPECIALIST_ITEM_REQUIRES_REVIEW":
      return "SPECIALIST_REVIEW";
    case "CREW_REQUIREMENT_UNSUPPORTED":
      return "CREW_UNSAFE";
    case "ROUTE_UNAVAILABLE":
    case "ROUTE_UNRELIABLE":
      return "DISTANCE_OUT_OF_RANGE";
    case "DEMAND_EXCEEDS_AUTOMATIC_RANGE":
    case "LUTON_REFERENCE_CAPACITY_MISSING":
    case "AMBIGUOUS_LUTON_REFERENCE_CAPACITY":
      return "CAPACITY_REVIEW";
    case "UNSUPPORTED_MOVE_CLASSIFICATION":
    case "DYNAMIC_REFERENCE_MISSING":
    case "MISSING_BENCHMARK":
    case "EXPIRED_BENCHMARK":
    case "AMBIGUOUS_BENCHMARK":
    case "DATA_UNAVAILABLE":
      return "PRICING_INPUT_INVALID";
    default:
      return reasonCode;
  }
}

function uniqueReasonCodes(reasonCodes: InternalManualReviewReasonCode[]): ManualReviewReasonCode[] {
  return Array.from(new Set(reasonCodes.map(publicManualReviewReasonCode)));
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateFromMoveDate(input: CreateQuoteRequest, now: Date): Date {
  if (!input.moveDate) return now;
  const parsed = new Date(`${input.moveDate}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? now : parsed;
}

function utcDateOnlyTime(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function moveDateLeadDays(effectiveDate: Date, now: Date): number {
  return Math.round((utcDateOnlyTime(effectiveDate) - utcDateOnlyTime(now)) / MILLISECONDS_PER_DAY);
}

function earlyMoveDateSurchargePence(
  canonicalInput: Pick<CanonicalPricingInput, "moveDate" | "urgency">,
  effectiveDate: Date,
  now: Date
): number {
  if (!canonicalInput.moveDate && canonicalInput.urgency !== "SAME_DAY") return 0;
  const leadDays = canonicalInput.urgency === "SAME_DAY" ? 0 : moveDateLeadDays(effectiveDate, now);
  return leadDays >= 0 && leadDays < EARLY_MOVE_DATE_SURCHARGE_PENCE.length
    ? EARLY_MOVE_DATE_SURCHARGE_PENCE[leadDays] ?? 0
    : 0;
}

function toTime(value: Date | string | null): number | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

function normalizeString(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function inferPricingRegion(address: AddressAccessInput): string {
  const explicitRegion = normalizeString(address.region);
  if (explicitRegion) return explicitRegion;

  const country = normalizeString(address.country);
  if (/scotland/i.test(country)) return DEFAULT_PRICING_REGION;

  const city = normalizeString(address.city);
  if (/(glasgow|edinburgh|dundee|aberdeen|stirling|paisley|motherwell|hamilton|cumbernauld)/i.test(city)) {
    return DEFAULT_PRICING_REGION;
  }

  const postcode = normalizeString(address.postcode).toUpperCase();
  if (/^(AB|DD|DG|EH|FK|G|HS|IV|KA|KW|KY|ML|PA|PH|TD|ZE)(?:\d|\s|$)/.test(postcode)) {
    return DEFAULT_PRICING_REGION;
  }

  if (address.lat >= 54.6 && address.lat <= 61.2 && address.lng >= -8.9 && address.lng <= -0.7) {
    return DEFAULT_PRICING_REGION;
  }

  return "";
}

function serviceLevelFromInput(input: CreateQuoteRequest): string {
  const services = input.services as Record<string, unknown>;
  const raw = services.serviceLevel ?? services.service_level;
  return typeof raw === "string" && raw.trim() ? raw.trim() : "standard";
}

function bookingChannelFromInput(input: CreateQuoteRequest): string {
  const source = normalizeString(input.sourceChannel).toUpperCase().replace(/[-\s]+/g, "_");
  if (source === "ADMIN_PHONE_BOOKING") return "ADMIN_PHONE_BOOKING";
  if (source === "PUBLIC_SELF_BOOKING" || source === "WEB" || source === "WEBSITE" || source === "") {
    return "PUBLIC_SELF_BOOKING";
  }
  return source;
}

function packingIncludedFromInput(input: CreateQuoteRequest): boolean {
  return Boolean(input.services.packing);
}

function pricingMoveTypeForClassification(
  input: CreateQuoteRequest,
  classification: PricingClassification | "UNSUPPORTED",
  propertySize: string | null
): string {
  if (classification === "INDIVIDUAL_ITEMS" && COMPLETE_PROPERTY_MOVE_TYPES.has(input.moveType)) {
    return propertySize === "single-item" ? "single-item-delivery" : "furniture-delivery";
  }
  return input.moveType;
}

function propertyReferenceProfileForInput(input: CreateQuoteRequest): DynamicReferenceProfile | null {
  const moveSize = input.moveSize ?? null;
  if (!COMPLETE_PROPERTY_MOVE_TYPES.has(input.moveType) || !moveSize || !SUPPORTED_FULL_HOUSE_PROPERTY_SIZES.has(moveSize)) {
    return null;
  }
  return findDynamicReferenceProfile({
    classification: "FULL_HOUSE",
    moveType: input.moveType,
    propertySize: moveSize,
  });
}

function emptyInventoryFacts(): InventoryFacts {
  return {
    totalPhysicalUnits: 0,
    totalVolumeM3: 0,
    totalWeightKg: 0,
    totalHandlingMinutes: 0,
    heavyUnitCount: 0,
    bulkyUnitCount: 0,
    specialUnitCount: 0,
    onePersonUnitCount: 0,
    twoPersonUnitCount: 0,
    fragileItemCount: 0,
    heavyOrSpecialItemCount: 0,
    roomCoverage: [],
    roomCoverageCount: 0,
    largestItem: {
      itemId: null,
      name: null,
      volumeM3: 0,
      weightKg: 0,
      handlingMinutes: 0,
      minimumCrew: 1,
      bulky: false,
      heavy: false,
      specialist: false,
    },
    requiredCrewFromItems: 1,
    usableVehicleLoadRatioBps: null,
  };
}

function inventoryFactsFor(
  inventory: { lines: ResolvedInventoryLine[]; summary: InventorySummary },
  usableVehicleLoadRatioBps: number | null = null
): InventoryFacts {
  if (inventory.lines.length === 0) {
    return { ...emptyInventoryFacts(), usableVehicleLoadRatioBps };
  }

  const largestItem = inventory.lines.reduce<ResolvedInventoryLine | null>((largest, item) => {
    if (!largest) return item;
    const itemScore = Math.max(
      volumeLitres(item.estimatedVolumeM3),
      weightDeciKg(item.estimatedWeightKg),
      item.handlingMinutes * 10
    );
    const largestScore = Math.max(
      volumeLitres(largest.estimatedVolumeM3),
      weightDeciKg(largest.estimatedWeightKg),
      largest.handlingMinutes * 10
    );
    return itemScore > largestScore ? item : largest;
  }, null);
  const roomCoverage = Array.from(new Set(
    inventory.lines
      .map((item) => item.room)
      .filter((room): room is string => Boolean(room))
  )).sort();
  const requiredCrewFromItems = inventory.lines.reduce(
    (max, item) => Math.max(max, item.minimumCrew, item.requiresTwoPeople ? 2 : 1),
    1
  );

  return {
    totalPhysicalUnits: inventory.summary.totalUnits,
    totalVolumeM3: inventory.summary.totalVolumeM3,
    totalWeightKg: inventory.summary.totalWeightKg,
    totalHandlingMinutes: inventory.summary.totalHandlingMinutes,
    heavyUnitCount: inventory.summary.heavyUnitCount,
    bulkyUnitCount: inventory.summary.bulkyUnitCount,
    specialUnitCount: inventory.summary.specialistUnitCount,
    onePersonUnitCount: Math.max(0, inventory.summary.totalUnits - inventory.summary.twoPersonUnitCount),
    twoPersonUnitCount: inventory.summary.twoPersonUnitCount,
    fragileItemCount: inventory.summary.fragileItemCount,
    heavyOrSpecialItemCount: inventory.summary.heavyOrSpecialItemCount,
    roomCoverage,
    roomCoverageCount: roomCoverage.length,
    largestItem: {
      itemId: largestItem?.itemId ?? null,
      name: largestItem?.name ?? null,
      volumeM3: largestItem?.estimatedVolumeM3 ?? 0,
      weightKg: largestItem?.estimatedWeightKg ?? 0,
      handlingMinutes: largestItem?.handlingMinutes ?? 0,
      minimumCrew: largestItem?.minimumCrew ?? 1,
      bulky: largestItem?.bulky ?? false,
      heavy: largestItem?.heavy ?? false,
      specialist: largestItem?.specialist ?? false,
    },
    requiredCrewFromItems,
    usableVehicleLoadRatioBps,
  };
}

function propertyInventoryCoverage(
  inventorySummary: InventorySummary,
  referenceProfile: DynamicReferenceProfile
) {
  const volumeRatioBps = roundHalfUpRatioBps(
    volumeLitres(inventorySummary.totalVolumeM3),
    volumeLitres(referenceProfile.referenceVolumeM3)
  );
  const weightRatioBps = roundHalfUpRatioBps(
    weightDeciKg(inventorySummary.totalWeightKg),
    weightDeciKg(referenceProfile.referenceWeightKg)
  );
  const handlingRatioBps = roundHalfUpRatioBps(
    inventorySummary.totalHandlingMinutes,
    referenceProfile.referenceHandlingMinutes
  );
  const propertyCoverageBps = Math.max(volumeRatioBps, weightRatioBps, handlingRatioBps);
  return { volumeRatioBps, weightRatioBps, handlingRatioBps, propertyCoverageBps };
}

function moveScopeResolutionFor(params: {
  input: CreateQuoteRequest;
  inventory: { lines: ResolvedInventoryLine[]; summary: InventorySummary };
  propertyReferenceProfile: DynamicReferenceProfile | null;
}): MoveScopeResolution {
  const { input, inventory, propertyReferenceProfile } = params;
  const moveSize = input.moveSize ?? null;
  const totalUnits = inventory.summary.totalUnits;

  if (input.customItems.length > 0 || moveSize === "custom-inventory") {
    return {
      resolvedMoveScope: "UNSUPPORTED_MOVE",
      confidence: "LOW",
      reasonCodes: ["CUSTOM_INVENTORY_LOW_CONFIDENCE"],
      classification: "UNSUPPORTED",
      propertySize: moveSize,
      propertyCoverageBps: null,
      propertyVolumeRatioBps: null,
      propertyWeightRatioBps: null,
      propertyHandlingRatioBps: null,
      confirmationRecommended: false,
    };
  }

  if (input.moveType === "office-move") {
    return {
      resolvedMoveScope: "BUSINESS_MOVE",
      confidence: "HIGH",
      reasonCodes: ["EXPLICIT_BUSINESS_SERVICE"],
      classification: "BUSINESS_REMOVAL",
      propertySize: "office",
      propertyCoverageBps: null,
      propertyVolumeRatioBps: null,
      propertyWeightRatioBps: null,
      propertyHandlingRatioBps: null,
      confirmationRecommended: false,
    };
  }

  if (input.moveType === "student-move") {
    return {
      resolvedMoveScope: "STUDENT_MOVE",
      confidence: "HIGH",
      reasonCodes: ["EXPLICIT_STUDENT_SERVICE"],
      classification: "STUDENT_MOVE",
      propertySize: "few-items",
      propertyCoverageBps: null,
      propertyVolumeRatioBps: null,
      propertyWeightRatioBps: null,
      propertyHandlingRatioBps: null,
      confirmationRecommended: false,
    };
  }

  if (input.moveType === "marketplace-collection") {
    return {
      resolvedMoveScope: "MAN_AND_VAN_MOVE",
      confidence: "HIGH",
      reasonCodes: ["EXPLICIT_MAN_AND_VAN_SERVICE"],
      classification: "MAN_AND_VAN",
      propertySize: "few-items",
      propertyCoverageBps: null,
      propertyVolumeRatioBps: null,
      propertyWeightRatioBps: null,
      propertyHandlingRatioBps: null,
      confirmationRecommended: false,
    };
  }

  if (INDIVIDUAL_ITEM_MOVE_TYPES.has(input.moveType) || moveSize === "single-item" || moveSize === "few-items") {
    const propertySize = moveSize === "single-item" ||
      (moveSize !== "few-items" && (input.moveType === "single-item-delivery" || totalUnits <= 1))
      ? "single-item"
      : "few-items";
    return {
      resolvedMoveScope: propertySize === "single-item" && totalUnits <= 1 ? "SINGLE_ITEM_MOVE" : "FEW_ITEMS_MOVE",
      confidence: "HIGH",
      reasonCodes: ["EXPLICIT_INDIVIDUAL_ITEM_SERVICE"],
      classification: "INDIVIDUAL_ITEMS",
      propertySize,
      propertyCoverageBps: null,
      propertyVolumeRatioBps: null,
      propertyWeightRatioBps: null,
      propertyHandlingRatioBps: null,
      confirmationRecommended: false,
    };
  }

  if (COMPLETE_PROPERTY_MOVE_TYPES.has(input.moveType)) {
    if (!moveSize || !SUPPORTED_FULL_HOUSE_PROPERTY_SIZES.has(moveSize)) {
      return {
        resolvedMoveScope: "UNSUPPORTED_MOVE",
        confidence: "LOW",
        reasonCodes: ["UNSUPPORTED_PROPERTY_SIZE"],
        classification: "UNSUPPORTED",
        propertySize: moveSize,
        propertyCoverageBps: null,
        propertyVolumeRatioBps: null,
        propertyWeightRatioBps: null,
        propertyHandlingRatioBps: null,
        confirmationRecommended: false,
      };
    }

    if (totalUnits === 0) {
      return {
        resolvedMoveScope: "FULL_PROPERTY_MOVE",
        confidence: "MEDIUM",
        reasonCodes: ["NO_EXPLICIT_INVENTORY_FULL_PROPERTY_ASSUMED"],
        classification: "FULL_HOUSE",
        propertySize: moveSize,
        propertyCoverageBps: null,
        propertyVolumeRatioBps: null,
        propertyWeightRatioBps: null,
        propertyHandlingRatioBps: null,
        confirmationRecommended: false,
      };
    }

    if (totalUnits <= PROPERTY_FLOW_SINGLE_ITEM_MAX_UNITS) {
      return {
        resolvedMoveScope: "SINGLE_ITEM_MOVE",
        confidence: "HIGH",
        reasonCodes: ["PROPERTY_SINGLE_ITEM_SELECTED"],
        classification: "INDIVIDUAL_ITEMS",
        propertySize: "single-item",
        propertyCoverageBps: null,
        propertyVolumeRatioBps: null,
        propertyWeightRatioBps: null,
        propertyHandlingRatioBps: null,
        confirmationRecommended: true,
      };
    }

    if (!propertyReferenceProfile) {
      return {
        resolvedMoveScope: "UNSUPPORTED_MOVE",
        confidence: "LOW",
        reasonCodes: ["UNSUPPORTED_PROPERTY_SIZE"],
        classification: "UNSUPPORTED",
        propertySize: moveSize,
        propertyCoverageBps: null,
        propertyVolumeRatioBps: null,
        propertyWeightRatioBps: null,
        propertyHandlingRatioBps: null,
        confirmationRecommended: false,
      };
    }

    const coverage = propertyInventoryCoverage(inventory.summary, propertyReferenceProfile);
    if (coverage.propertyCoverageBps < PROPERTY_FULL_MOVE_MIN_REFERENCE_DEMAND_BPS) {
      return {
        resolvedMoveScope: "PARTIAL_PROPERTY_MOVE",
        confidence: coverage.propertyCoverageBps < 4_000 ? "HIGH" : "MEDIUM",
        reasonCodes: ["PROPERTY_INVENTORY_BELOW_FULL_REFERENCE"],
        classification: "INDIVIDUAL_ITEMS",
        propertySize: "few-items",
        propertyCoverageBps: coverage.propertyCoverageBps,
        propertyVolumeRatioBps: coverage.volumeRatioBps,
        propertyWeightRatioBps: coverage.weightRatioBps,
        propertyHandlingRatioBps: coverage.handlingRatioBps,
        confirmationRecommended: true,
      };
    }

    return {
      resolvedMoveScope: "FULL_PROPERTY_MOVE",
      confidence: "HIGH",
      reasonCodes: ["PROPERTY_REFERENCE_INVENTORY_MATCH"],
      classification: "FULL_HOUSE",
      propertySize: moveSize,
      propertyCoverageBps: coverage.propertyCoverageBps,
      propertyVolumeRatioBps: coverage.volumeRatioBps,
      propertyWeightRatioBps: coverage.weightRatioBps,
      propertyHandlingRatioBps: coverage.handlingRatioBps,
      confirmationRecommended: false,
    };
  }

  return {
    resolvedMoveScope: "UNSUPPORTED_MOVE",
    confidence: "LOW",
    reasonCodes: ["UNSUPPORTED_MOVE_TYPE"],
    classification: "UNSUPPORTED",
    propertySize: moveSize,
    propertyCoverageBps: null,
    propertyVolumeRatioBps: null,
    propertyWeightRatioBps: null,
    propertyHandlingRatioBps: null,
    confirmationRecommended: false,
  };
}

function canonicalCustomInventory(customItems: CustomInventoryItem[]) {
  return customItems
    .map((item) => ({
      name: item.name.trim(),
      quantity: item.quantity,
      room: item.room,
    }))
    .sort((a, b) => (
      a.name.localeCompare(b.name) ||
      a.room.localeCompare(b.room) ||
      a.quantity - b.quantity
    ));
}

function serviceBoolean(services: Record<string, unknown>, key: string): boolean {
  return services[key] === true;
}

function serviceCount(services: Record<string, unknown>, key: string): number {
  const value = services[key];
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(99, Math.floor(value)))
    : 0;
}

function canonicalServices(input: CreateQuoteRequest): CanonicalPricingInput["services"] {
  const services = input.services as Record<string, unknown>;
  return {
    packing: serviceBoolean(services, "packing"),
    packingMaterials: serviceBoolean(services, "packingMaterials"),
    unpacking: serviceBoolean(services, "unpacking"),
    dismantling: serviceBoolean(services, "dismantling"),
    reassembly: serviceBoolean(services, "reassembly"),
    furnitureProtection: serviceBoolean(services, "furnitureProtection"),
    mattressProtection: serviceBoolean(services, "mattressProtection"),
    tvProtection: serviceBoolean(services, "tvProtection"),
    wasteDisposal: serviceBoolean(services, "wasteDisposal"),
    additionalMover: serviceBoolean(services, "additionalMover"),
    waitingTime: serviceBoolean(services, "waitingTime"),
    heavyItemHandling: serviceBoolean(services, "heavyItemHandling"),
    pianoHandling: serviceBoolean(services, "pianoHandling"),
    dismantlingItems: serviceCount(services, "dismantlingItems"),
    reassemblyItems: serviceCount(services, "reassemblyItems"),
  };
}

function canonicalUrgency(input: CreateQuoteRequest): CanonicalPricingInput["urgency"] {
  if (input.sameDay) return "SAME_DAY";
  if (input.urgent) return "URGENT";
  return "STANDARD";
}

function canonicalDayType(effectiveDate: Date): CanonicalPricingInput["dayType"] {
  const day = effectiveDate.getUTCDay();
  return day === 0 || day === 6 ? "WEEKEND" : "WEEKDAY";
}

function canonicalWaitingMinutes(input: CreateQuoteRequest): number {
  const services = input.services as Record<string, unknown>;
  const value = services.waitingMinutes;
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(8 * 60, Math.floor(value)))
    : 0;
}

function canonicalAccessStop(role: "collection" | "delivery" | "additional-stop", access: AddressAccessInput) {
  return {
    role,
    floor: access.floor,
    hasLift: access.hasLift,
    internalStairs: access.internalStairs,
    externalStairs: access.externalStairs,
    carryDistanceMeters: access.carryDistanceMeters,
    parking: access.parking,
    narrowRoad: access.narrowRoad,
    loadingBayAvailable: access.loadingBayAvailable,
  };
}

function canonicalAccess(input: CreateQuoteRequest): CanonicalPricingInput["access"] {
  return {
    stops: [
      canonicalAccessStop("collection", input.collection),
      ...(input.additionalStop ? [canonicalAccessStop("additional-stop", input.additionalStop)] : []),
      canonicalAccessStop("delivery", input.delivery),
    ],
  };
}

function timestampString(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function isPositiveFiniteNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function resolveLutonCapacityReference(
  configs: VehicleClassConfigForPricing[]
):
  | { status: "OK"; reference: LutonCapacityReferenceSnapshot }
  | { status: "MISSING" | "AMBIGUOUS" } {
  const exactActiveMatches = configs.filter((config) => (
    (LUTON_VAN_CONFIG_NAMES as readonly string[]).includes(config.name) &&
    config.isActive
  ));

  if (exactActiveMatches.length === 0) return { status: "MISSING" };
  if (exactActiveMatches.length > 1) return { status: "AMBIGUOUS" };

  const [config] = exactActiveMatches;
  if (
    !config ||
    !isPositiveFiniteNumber(config.maxUsableVolumeM3) ||
    !isPositiveFiniteNumber(config.maxPayloadKg)
  ) {
    return { status: "MISSING" };
  }

  return {
    status: "OK",
    reference: {
      id: config.id,
      name: config.name,
      isActive: config.isActive,
      updatedAt: timestampString(config.updatedAt),
      maxUsableVolumeM3: Math.min(config.maxUsableVolumeM3, CANONICAL_LUTON_USABLE_VOLUME_M3),
      maxPayloadKg: Math.min(config.maxPayloadKg, CANONICAL_LUTON_PAYLOAD_KG),
    },
  };
}

export function canonicalRequestedInventory(input: CreateQuoteRequest): {
  lines: Array<{ itemId: string; quantity: number; room: string | null }>;
  invalidQuantity: boolean;
} {
  const normalized = normalizeCanonicalInventory(input.inventory, {
    itemMetricVersion: ITEM_METRICS_DATASET_VERSION,
    maxQuantity: MAX_ITEM_QUANTITY,
  });
  return {
    lines: normalized.lines.map((item) => ({ itemId: item.itemId, quantity: item.quantity, room: item.room })),
    invalidQuantity: normalized.invalidQuantity,
  };
}

function roundVolume(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function roundWeight(value: number): number {
  return Math.round(value * 10) / 10;
}

function emptyInventorySummary(): InventorySummary {
  return {
    totalUnits: 0,
    itemUnits: 0,
    totalVolumeM3: 0,
    totalWeightKg: 0,
    totalHandlingMinutes: 0,
    heavyUnitCount: 0,
    bulkyUnitCount: 0,
    twoPersonUnitCount: 0,
    specialistUnitCount: 0,
    fragileItemCount: 0,
    heavyOrSpecialItemCount: 0,
  };
}

function summarizeInventory(lines: ResolvedInventoryLine[]): InventorySummary {
  const totalUnits = lines.reduce((sum, item) => sum + item.quantity, 0);
  return {
    totalUnits,
    itemUnits: totalUnits,
    totalVolumeM3: roundVolume(lines.reduce((sum, item) => sum + item.estimatedVolumeM3 * item.quantity, 0)),
    totalWeightKg: roundWeight(lines.reduce((sum, item) => sum + item.estimatedWeightKg * item.quantity, 0)),
    totalHandlingMinutes: lines.reduce((sum, item) => sum + item.handlingMinutes * item.quantity, 0),
    heavyUnitCount: lines.reduce((sum, item) => sum + (item.heavy ? item.quantity : 0), 0),
    bulkyUnitCount: lines.reduce((sum, item) => sum + (item.bulky ? item.quantity : 0), 0),
    twoPersonUnitCount: lines.reduce((sum, item) => sum + (item.requiresTwoPeople ? item.quantity : 0), 0),
    specialistUnitCount: lines.reduce((sum, item) => sum + (item.specialist ? item.quantity : 0), 0),
    fragileItemCount: lines.reduce((sum, item) => sum + (item.fragile ? item.quantity : 0), 0),
    heavyOrSpecialItemCount: lines.reduce(
      (sum, item) => sum + (item.heavy || item.specialist || item.requiresTwoPeople ? item.quantity : 0),
      0
    ),
  };
}

async function defaultFindInventoryItems(itemIds: string[]): Promise<InventoryRecordForPricing[]> {
  if (itemIds.length === 0) return [];
  return await withDataStoreTimeout(
    "Inventory resolution",
    findCanonicalInventoryItemsForPricing(itemIds)
  );
}

async function defaultFindCompetitorBenchmarks(
  criteria: BenchmarkSearchCriteria
): Promise<CompetitorBenchmarkForPricing[]> {
  return await withDataStoreTimeout(
    "Benchmark query",
    db.competitorBenchmark.findMany({
      where: {
        active: true,
        region: criteria.region,
        moveType: criteria.moveType,
        serviceLevel: criteria.serviceLevel,
        packingIncluded: criteria.packingIncluded,
        ...(criteria.propertySize === null ? {} : { propertySize: criteria.propertySize }),
      },
      orderBy: { createdAt: "asc" },
    })
  );
}

async function defaultFindVehicleClassConfigs(): Promise<VehicleClassConfigForPricing[]> {
  return await withDataStoreTimeout(
    "Luton capacity reference",
    db.vehicleClassConfig.findMany({
      where: {
        name: { in: [...LUTON_VAN_CONFIG_NAMES] },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        maxUsableVolumeM3: true,
        maxPayloadKg: true,
        updatedAt: true,
      },
      orderBy: { id: "asc" },
    })
  );
}

function metricFromRecord(record: InventoryRecordForPricing) {
  if (record.slug && record.slug !== record.id) return null;
  return getItemMetricBySlug(record.id);
}

function logInventoryResolutionIssue(itemId: string, reason: string): void {
  console.warn("Inventory item resolution failed:", { itemId, reason });
}

async function resolveInventory(
  input: CreateQuoteRequest,
  findInventoryItems: (itemIds: string[]) => Promise<InventoryRecordForPricing[]>
): Promise<{
  lines: ResolvedInventoryLine[];
  summary: InventorySummary;
  reasonCodes: InternalManualReviewReasonCode[];
}> {
  const requested = canonicalRequestedInventory(input);
  const reasonCodes: InternalManualReviewReasonCode[] = [];
  if (requested.invalidQuantity) reasonCodes.push("INVALID_ITEM_QUANTITY");
  const identities = Array.from(new Set(requested.lines.map((item) => item.itemId)));
  const records = await findInventoryItems(identities);
  const byIdentity = new Map<string, InventoryRecordForPricing[]>();
  for (const record of records) {
    const keys = new Set([record.id, record.slug].filter((value): value is string => Boolean(value)));
    for (const key of keys) {
      const existing = byIdentity.get(key) ?? [];
      existing.push(record);
      byIdentity.set(key, existing);
    }
  }

  const lines = requested.lines.flatMap((item) => {
    const matches = byIdentity.get(item.itemId) ?? [];
    const uniqueMatches = Array.from(new Map(matches.map((record) => [record.id, record])).values());
    if (uniqueMatches.length > 1) {
      reasonCodes.push("DATA_UNAVAILABLE");
      logInventoryResolutionIssue(item.itemId, "AMBIGUOUS_ITEM_ID");
      return [];
    }

    const record = uniqueMatches[0];
    if (!record) {
      reasonCodes.push("ITEM_NOT_FOUND");
      logInventoryResolutionIssue(item.itemId, "ITEM_NOT_FOUND");
      return [];
    }
    if (!record.isActive) {
      reasonCodes.push("ITEM_INACTIVE");
      logInventoryResolutionIssue(item.itemId, "ITEM_INACTIVE");
      return [];
    }

    const metric = metricFromRecord(record);
    if (!metric) {
      reasonCodes.push("ITEM_METRICS_MISSING");
      logInventoryResolutionIssue(item.itemId, "ITEM_METRICS_MISSING");
      return [];
    }
    if (metric.confidence === "LOW") reasonCodes.push("ITEM_METRICS_LOW_CONFIDENCE");
    if (metric.specialist) reasonCodes.push("SPECIALIST_ITEM_REQUIRES_REVIEW");

    return [{
      itemId: record.id,
      itemSlug: metric.slug,
      quantity: item.quantity,
      room: item.room,
      name: record.name,
      categoryName: record.category?.name ?? null,
      categoryType: record.category?.type ?? null,
      transportedLengthM: metric.transportedLengthM,
      transportedWidthM: metric.transportedWidthM,
      transportedHeightM: metric.transportedHeightM,
      estimatedVolumeM3: metric.estimatedVolumeM3,
      estimatedWeightKg: metric.estimatedWeightKg,
      handlingMinutes: metric.handlingMinutes,
      bulky: metric.bulky,
      requiresTwoPeople: metric.requiresTwoPeople,
      fragile: record.fragile,
      heavy: metric.heavy,
      specialist: metric.specialist,
      minimumCrew: metric.minimumCrew,
      metricDatasetVersion: ITEM_METRICS_DATASET_VERSION,
      metricConfidence: metric.confidence,
      metricRationale: metric.rationale,
    }];
  });

  return {
    lines,
    summary: summarizeInventory(lines),
    reasonCodes: uniqueReasonCodes(reasonCodes),
  };
}

function canonicalInputFor(params: {
  input: CreateQuoteRequest;
  classification: CanonicalPricingInput["classification"];
  propertySize: string | null;
  moveScope: MoveScopeResolution;
  routeMetrics: RouteMetrics | null;
  effectiveDate: Date;
  inventory: { lines: ResolvedInventoryLine[] };
  inventoryFacts: InventoryFacts;
  referenceProfile: DynamicReferenceProfile | null;
  lutonCapacityReference: LutonCapacityReferenceSnapshot | null;
  requiredCrew: number;
}): CanonicalPricingInput {
  return {
    pricingAlgorithmVersion: PRICING_ALGORITHM_VERSION,
    pricingCurveVersion: PRICING_CURVE_VERSION,
    itemMetricDatasetVersion: ITEM_METRICS_DATASET_VERSION,
    moveType: pricingMoveTypeForClassification(params.input, params.classification, params.propertySize),
    classification: params.classification,
    resolvedMoveScope: params.moveScope.resolvedMoveScope,
    moveScopeConfidence: params.moveScope.confidence,
    moveScopeReasonCodes: params.moveScope.reasonCodes,
    moveScopeConfirmationRecommended: params.moveScope.confirmationRecommended,
    propertyCoverageBps: params.moveScope.propertyCoverageBps,
    region: inferPricingRegion(params.input.collection),
    propertySize: params.propertySize,
    serviceLevel: serviceLevelFromInput(params.input),
    packingIncluded: packingIncludedFromInput(params.input),
    routeDistanceMiles: params.routeMetrics?.distanceMiles ?? null,
    routeDurationMinutes: params.routeMetrics?.durationMinutes ?? null,
    routeHash: params.routeMetrics?.routeHash ?? null,
    referenceProfileId: params.referenceProfile?.profileId ?? null,
    referenceProfileVersion: params.referenceProfile?.profileVersion ?? null,
    lutonCapacityReference: params.lutonCapacityReference,
    inventory: params.inventory.lines
      .map((item) => ({
        itemId: item.itemId,
        itemSlug: item.itemSlug,
        quantity: item.quantity,
        room: item.room,
        itemMetricVersion: item.metricDatasetVersion,
      }))
      .sort((a, b) => (
        a.itemSlug.localeCompare(b.itemSlug) ||
        a.itemId.localeCompare(b.itemId) ||
        (a.room ?? "").localeCompare(b.room ?? "")
      )),
    customInventory: canonicalCustomInventory(params.input.customItems),
    inventoryFacts: params.inventoryFacts,
    crewRequirement: {
      requestedMovers: params.input.preferredMovers ?? 1,
      requiredMovers: params.requiredCrew,
    },
    bookingChannel: bookingChannelFromInput(params.input),
    moveDate: params.input.moveDate ?? null,
    effectiveDate: dateOnly(params.effectiveDate),
    pickupWindow: params.input.arrivalWindow ?? null,
    urgency: canonicalUrgency(params.input),
    dayType: canonicalDayType(params.effectiveDate),
    waitingMinutes: canonicalWaitingMinutes(params.input),
    dateFlexibility: {
      flexibleDate: params.input.flexibleDate,
      flexibleTime: params.input.flexibleTime,
      exactTime: params.input.exactTime,
      earliestDate: params.input.earliestDate ?? null,
      latestDate: params.input.latestDate ?? null,
    },
    access: canonicalAccess(params.input),
    services: canonicalServices(params.input),
  };
}

function referenceProfileSnapshot(referenceProfile: DynamicReferenceProfile | null | undefined) {
  if (!referenceProfile) return undefined;
  return {
    profileId: referenceProfile.profileId,
    profileVersion: referenceProfile.profileVersion,
    classification: referenceProfile.classification,
    propertySize: referenceProfile.propertySize,
    referenceUnits: referenceProfile.referenceUnits,
    referenceVolumeM3: referenceProfile.referenceVolumeM3,
    referenceWeightKg: referenceProfile.referenceWeightKg,
    referenceHandlingMinutes: referenceProfile.referenceHandlingMinutes,
    referenceCrew: referenceProfile.referenceCrew,
    items: referenceProfile.items.map((item) => ({ slug: item.slug, quantity: item.quantity })),
    rationale: referenceProfile.rationale,
  };
}

function pricingResultIdentity(canonicalInput: CanonicalPricingInput | undefined, fallback: unknown) {
  const inputFingerprint = canonicalInput ? stableHash(canonicalInput) : stableHash(fallback);
  return {
    inputFingerprint,
    quoteId: inputFingerprint.slice(0, 24),
  };
}

function quoteExpiryFromNow(now: Date): Date {
  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
}

function manualResult(params: {
  reasonCodes: InternalManualReviewReasonCode[];
  canonicalInput?: CanonicalPricingInput;
  routeMetrics: RouteMetrics | null;
  referenceProfile?: DynamicReferenceProfile | null;
  lutonCapacityReference?: LutonCapacityReferenceSnapshot | null;
  requiredCrew?: number;
  inventory: { lines: ResolvedInventoryLine[]; summary: InventorySummary };
  demandRatios?: DemandRatiosBps;
  marketBenchmarkPence?: number | null;
  marketTargetPence?: number | null;
  costFloorPence?: number | null;
  directOperatingCostPence?: number;
  resourcePlan?: ResourcePlan | null;
  expiresAt: string;
  explanation?: string;
}): ManualReviewCanonicalPricingResult {
  const reasonCodes = uniqueReasonCodes(params.reasonCodes);
  const identity = pricingResultIdentity(params.canonicalInput, { reasonCodes, routeMetrics: params.routeMetrics });
  const serverInputHash = params.canonicalInput ? identity.inputFingerprint : undefined;
  const expiresAt = params.expiresAt ?? quoteExpiryFromNow(new Date()).toISOString();
  const explanation = params.explanation ?? "A fixed price cannot be issued automatically for this request.";
  return {
    status: "MANUAL_REVIEW",
    quoteId: identity.quoteId,
    modelVersion: PRICING_ALGORITHM_VERSION,
    currency: "GBP",
    marketBenchmarkPence: params.marketBenchmarkPence ?? null,
    marketTargetPence: params.marketTargetPence ?? null,
    costFloorPence: params.costFloorPence ?? null,
    expiresAt,
    inputFingerprint: identity.inputFingerprint,
    totalPence: null,
    pricingAlgorithmVersion: PRICING_ALGORITHM_VERSION,
    reasonCodes,
    serverInputHash,
    explanation,
    canonicalInput: params.canonicalInput,
    auditSnapshot: params.canonicalInput
      ? {
          pricingAlgorithmVersion: PRICING_ALGORITHM_VERSION,
          itemMetricDatasetVersion: ITEM_METRICS_DATASET_VERSION,
          explanation,
          classification: params.canonicalInput.classification,
          resolvedMoveScope: params.canonicalInput.resolvedMoveScope,
          moveScopeConfidence: params.canonicalInput.moveScopeConfidence,
          moveScopeReasonCodes: params.canonicalInput.moveScopeReasonCodes,
          moveScopeConfirmationRecommended: params.canonicalInput.moveScopeConfirmationRecommended,
          propertyCoverageBps: params.canonicalInput.propertyCoverageBps,
          inventoryFacts: params.canonicalInput.inventoryFacts,
          resourcePlan: params.resourcePlan ?? null,
          referenceProfile: referenceProfileSnapshot(params.referenceProfile),
          lutonCapacityReference: params.lutonCapacityReference ?? params.canonicalInput.lutonCapacityReference,
          lutonUsableVolumeM3: params.lutonCapacityReference?.maxUsableVolumeM3,
          lutonPayloadKg: params.lutonCapacityReference?.maxPayloadKg,
          normalizedInventory: params.canonicalInput.inventory,
          inventorySummary: params.inventory.summary,
          totalVolumeM3: params.inventory.summary.totalVolumeM3,
          totalWeightKg: params.inventory.summary.totalWeightKg,
          requiredCrew: params.requiredCrew,
          demandRatios: params.demandRatios,
          marketBenchmarkPence: params.marketBenchmarkPence ?? null,
          marketTargetPence: params.marketTargetPence ?? null,
          costFloorPence: params.costFloorPence ?? null,
          directOperatingCostPence: params.directOperatingCostPence ?? 0,
          volumeCapacityBps: params.demandRatios?.volumeCapacityBps,
          weightCapacityBps: params.demandRatios?.weightCapacityBps,
          controllingCapacityDimension: params.demandRatios?.controllingCapacityDimension,
          referenceLutonDemandBps: params.demandRatios?.referenceLutonDemandBps,
          relativeCapacityDemandBps: params.demandRatios?.relativeCapacityDemandBps,
          handlingRelativeBps: params.demandRatios?.handlingRelativeBps,
          crewRelativeBps: params.demandRatios?.crewRelativeBps,
          effectiveDemandBps: params.demandRatios?.effectiveDemandBps,
          pricingCurveVersion: PRICING_CURVE_VERSION,
          finalTotalPence: null,
          finalPricePence: null,
          serverInputHash,
        }
      : undefined,
    routeMetrics: params.routeMetrics,
    referenceProfile: params.referenceProfile,
    lutonCapacityReference: params.lutonCapacityReference,
    requiredCrew: params.requiredCrew,
    inventory: params.inventory,
    resolvedMoveScope: params.canonicalInput?.resolvedMoveScope ?? "UNSUPPORTED_MOVE",
    moveScopeConfidence: params.canonicalInput?.moveScopeConfidence ?? "LOW",
    moveScopeReasonCodes: params.canonicalInput?.moveScopeReasonCodes ?? [],
    inventoryFacts: params.canonicalInput?.inventoryFacts ?? inventoryFactsFor(params.inventory),
    resourcePlan: params.resourcePlan ?? null,
    breakdown: [],
  };
}

function isDistanceBandMatch(benchmark: CompetitorBenchmarkForPricing, distanceMiles: number): boolean {
  if (distanceMiles < benchmark.distanceBandMinMiles) return false;
  return benchmark.distanceBandMaxMiles === null || distanceMiles < benchmark.distanceBandMaxMiles;
}

function isBenchmarkDimensionMatch(
  benchmark: CompetitorBenchmarkForPricing,
  canonicalInput: CanonicalPricingInput
): boolean {
  if (!benchmark.active) return false;
  if (benchmark.region !== canonicalInput.region) return false;
  if (benchmark.moveType !== canonicalInput.moveType) return false;
  if (benchmark.serviceLevel !== canonicalInput.serviceLevel) return false;
  if (benchmark.packingIncluded !== canonicalInput.packingIncluded) return false;
  if (canonicalInput.propertySize !== null && benchmark.propertySize !== canonicalInput.propertySize) return false;
  return true;
}

function isEligibleNow(benchmark: CompetitorBenchmarkForPricing, effectiveTime: number): boolean {
  const from = toTime(benchmark.effectiveFrom);
  const to = toTime(benchmark.effectiveTo);
  return from !== null && from <= effectiveTime && (to === null || to >= effectiveTime);
}

function isExpiredAt(benchmark: CompetitorBenchmarkForPricing, effectiveTime: number): boolean {
  const from = toTime(benchmark.effectiveFrom);
  const to = toTime(benchmark.effectiveTo);
  return from !== null && to !== null && from <= effectiveTime && to < effectiveTime;
}

function roundHalfUpDivide(numerator: number, denominator: number): number {
  return Math.floor((numerator + denominator / 2) / denominator);
}

function roundHalfUpRatioBps(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return Math.floor((numerator * 10_000 + denominator / 2) / denominator);
}

function multiplyPenceByBpsHalfUp(amountPence: number, bps: number): number {
  return Math.floor((amountPence * bps + 5_000) / 10_000);
}

export function floorToIncrementPence(amountPence: number, incrementPence = PRICE_INCREMENT_PENCE): number {
  if (!Number.isFinite(amountPence) || amountPence <= 0) return 0;
  return Math.floor(amountPence / incrementPence) * incrementPence;
}

export function ceilToIncrementPence(amountPence: number, incrementPence = PRICE_INCREMENT_PENCE): number {
  if (!Number.isFinite(amountPence) || amountPence <= 0) return 0;
  return Math.ceil(amountPence / incrementPence) * incrementPence;
}

export function calculateMarketTargetPence(marketBenchmarkPence: number): number {
  if (!Number.isSafeInteger(marketBenchmarkPence) || marketBenchmarkPence <= 0) return 0;
  return Math.floor((marketBenchmarkPence * MARKET_TARGET_BPS) / 10_000);
}

export function calculateCostFloorPence(params: {
  directOperatingCostPence: number;
  paymentFixedFeePence?: number;
  paymentPercentageFeeBps?: number;
  minimumMarginBps?: number;
  incrementPence?: number;
}): number {
  const directOperatingCostPence = Math.max(0, Math.ceil(params.directOperatingCostPence));
  const paymentFixedFeePence = params.paymentFixedFeePence ?? PAYMENT_FIXED_FEE_PENCE;
  const paymentPercentageFeeBps = params.paymentPercentageFeeBps ?? PAYMENT_PERCENTAGE_FEE_BPS;
  const minimumMarginBps = params.minimumMarginBps ?? MINIMUM_MARGIN_BPS;
  const denominatorBps = 10_000 - minimumMarginBps - paymentPercentageFeeBps;
  if (denominatorBps <= 0) return Number.MAX_SAFE_INTEGER;
  return ceilToIncrementPence(
    Math.ceil(((directOperatingCostPence + paymentFixedFeePence) * 10_000) / denominatorBps),
    params.incrementPence ?? PRICE_INCREMENT_PENCE
  );
}

export function calculatePortfolioWeightedDiscount(quotes: Array<{
  marketBenchmarkPence: number | null;
  finalPricePence: number | null;
}>): { marketBenchmarkPence: number; finalPricePence: number; savingsPence: number; savingsRate: number } {
  const totals = quotes.reduce<{ marketBenchmarkPence: number; finalPricePence: number }>(
    (sum, quote) => {
      if (
        typeof quote.marketBenchmarkPence !== "number" ||
        typeof quote.finalPricePence !== "number" ||
        quote.marketBenchmarkPence <= 0 ||
        quote.finalPricePence < 0
      ) {
        return sum;
      }
      return {
        marketBenchmarkPence: sum.marketBenchmarkPence + quote.marketBenchmarkPence,
        finalPricePence: sum.finalPricePence + quote.finalPricePence,
      };
    },
    { marketBenchmarkPence: 0, finalPricePence: 0 }
  );
  const savingsPence = Math.max(0, totals.marketBenchmarkPence - totals.finalPricePence);
  return {
    ...totals,
    savingsPence,
    savingsRate: totals.marketBenchmarkPence > 0 ? savingsPence / totals.marketBenchmarkPence : 0,
  };
}

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

function fullLutonLoadTargetPence(distanceMiles: number): number {
  const extraMiles = Math.max(0, Math.ceil(distanceMiles - FULL_LUTON_LOAD_INCLUDED_MILES));
  return LOCAL_FULL_LUTON_LOAD_TARGET_PENCE + extraMiles * FULL_LUTON_LOAD_EXTRA_MILE_PENCE;
}

function referenceBasePricePence(canonicalInput: CanonicalPricingInput, referenceProfile: DynamicReferenceProfile): number {
  if (canonicalInput.classification === "UNSUPPORTED") return 0;
  const propertySize = canonicalInput.propertySize ?? referenceProfile.propertySize ?? "few-items";
  const classificationPrices = REFERENCE_BASE_PRICE_PENCE[canonicalInput.classification];
  return (
    classificationPrices[propertySize] ??
    classificationPrices["few-items"] ??
    Object.values(classificationPrices)[0] ??
    10_000
  );
}

function routeDistanceCostPence(classification: PricingClassification, distanceMiles: number): number {
  const extraMiles = Math.max(0, distanceMiles - FULL_LUTON_LOAD_INCLUDED_MILES);
  return Math.ceil(extraMiles * EXTRA_MILE_PENCE[classification]);
}

function routeDurationCostPence(classification: PricingClassification, durationMinutes: number): number {
  const extraMinutes = Math.max(0, durationMinutes - INCLUDED_ROUTE_DURATION_MINUTES);
  return Math.ceil(extraMinutes * EXTRA_ROUTE_MINUTE_PENCE[classification]);
}

function accessCostPence(access: CanonicalPricingInput["access"]): number {
  return access.stops.reduce((sum, stop) => {
    const floorCost = stop.floor <= 0
      ? 0
      : stop.floor * (stop.hasLift ? 250 : 650);
    const stairCost = (stop.internalStairs + stop.externalStairs) * 250;
    const carryCost = Math.ceil(stop.carryDistanceMeters / 10) * 150;
    const parkingCost = stop.parking === "paid" || stop.parking === "restricted" ? 600 : 0;
    const narrowRoadCost = stop.narrowRoad ? 500 : 0;
    const loadingBayCredit = stop.loadingBayAvailable ? -150 : 0;
    return sum + Math.max(0, floorCost + stairCost + carryCost + parkingCost + narrowRoadCost + loadingBayCredit);
  }, 0);
}

function accessReviewReasons(access: CanonicalPricingInput["access"]): InternalManualReviewReasonCode[] {
  const needsReview = access.stops.some((stop) => (
    stop.carryDistanceMeters > MAX_WALK_DISTANCE_AUTO_METRES ||
    (!stop.hasLift && stop.floor > MAX_NO_LIFT_FLOOR_AUTO) ||
    (stop.hasLift && stop.floor > MAX_LIFT_FLOOR_AUTO)
  ));
  return needsReview ? ["ACCESS_REVIEW"] : [];
}

function dateReviewReasons(
  canonicalInput: CanonicalPricingInput,
  effectiveDate: Date,
  now: Date
): InternalManualReviewReasonCode[] {
  const todayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const serviceDate = new Date(Date.UTC(effectiveDate.getUTCFullYear(), effectiveDate.getUTCMonth(), effectiveDate.getUTCDate()));
  if (serviceDate.getTime() < todayDate.getTime()) return ["DATE_REVIEW"];
  if (canonicalInput.waitingMinutes > MAX_WAITING_MINUTES_AUTO) return ["DATE_REVIEW"];
  return [];
}

function packingModeFromCanonicalServices(services: CanonicalPricingInput["services"]) {
  if (services.packing) return "full" as const;
  if (services.packingMaterials) return "materials" as const;
  return "none" as const;
}

function serviceCostPence(canonicalInput: CanonicalPricingInput, selectedUnits: number): number {
  const services = canonicalInput.services;
  const packingPence = packingChargePenceForMove(
    packingModeFromCanonicalServices(services),
    canonicalInput.propertySize,
    selectedUnits
  );
  const dismantlingPence = services.dismantling ? Math.max(1, services.dismantlingItems || selectedUnits) * 1_000 : 0;
  const reassemblyPence = services.reassembly ? Math.max(1, services.reassemblyItems || selectedUnits) * 1_000 : 0;
  const protectionPence =
    (services.furnitureProtection ? 900 : 0) +
    (services.mattressProtection ? 700 : 0) +
    (services.tvProtection ? 900 : 0);
  const handlingPence =
    (services.heavyItemHandling ? 1_500 : 0) +
    (services.pianoHandling ? 4_000 : 0) +
    (services.waitingTime ? 1_500 : 0) +
    (services.wasteDisposal ? 2_500 : 0);
  return packingPence + dismantlingPence + reassemblyPence + protectionPence + handlingPence;
}

function timingCostPence(canonicalInput: CanonicalPricingInput, effectiveDate: Date, now: Date): number {
  const services = canonicalInput.services;
  const urgentMoveCost = canonicalInput.classification === "INDIVIDUAL_ITEMS"
    ? INDIVIDUAL_ITEM_URGENT_COST_PENCE
    : 2_000;
  const dateLeadCost = earlyMoveDateSurchargePence(canonicalInput, effectiveDate, now);
  const urgentCost = canonicalInput.urgency === "URGENT" && dateLeadCost === 0
      ? urgentMoveCost
      : 0;
  const weekendCost = canonicalInput.dayType === "WEEKEND" ? 1_500 : 0;
  const eveningCost = canonicalInput.pickupWindow === "evening" ? 900 : 0;
  const waitingCost = Math.ceil(canonicalInput.waitingMinutes / 15) * 500;
  return urgentCost + weekendCost + eveningCost + waitingCost + (services.waitingTime ? 1_000 : 0);
}

function roundUpToPoundsPence(amountPence: number): number {
  return Math.max(0, Math.ceil(amountPence / 100) * 100);
}

function operatingCostConfig(classification: PricingClassification) {
  if (classification === "INDIVIDUAL_ITEMS") {
    return {
      dispatchPence: INDIVIDUAL_ITEM_DISPATCH_COST_PENCE,
      administrationPence: INDIVIDUAL_ITEM_ADMIN_COST_PENCE,
      labourMinuteCostPence: INDIVIDUAL_ITEM_LABOUR_MINUTE_COST_PENCE,
      fuelMileCostPence: INDIVIDUAL_ITEM_FUEL_MILE_COST_PENCE,
      vehicleWearMileCostPence: INDIVIDUAL_ITEM_VEHICLE_WEAR_MILE_COST_PENCE,
      returnLegMultiplierBps: INDIVIDUAL_ITEM_RETURN_LEG_MULTIPLIER_BPS,
    };
  }

  return {
    dispatchPence: DISPATCH_COST_PENCE,
    administrationPence: ADMIN_COST_PENCE,
    labourMinuteCostPence: LABOUR_MINUTE_COST_PENCE,
    fuelMileCostPence: FUEL_MILE_COST_PENCE,
    vehicleWearMileCostPence: VEHICLE_WEAR_MILE_COST_PENCE,
    returnLegMultiplierBps: RETURN_LEG_MULTIPLIER_BPS,
  };
}

function calculateOperationalQuote(params: {
  canonicalInput: CanonicalPricingInput;
  routeMetrics: RouteMetrics;
  referenceProfile: DynamicReferenceProfile;
  inventory: { lines: ResolvedInventoryLine[]; summary: InventorySummary };
  demandRatios: DemandRatiosBps;
  adjustmentBps: number;
  effectiveDate: Date;
  now: Date;
}) {
  const classification = params.canonicalInput.classification;
  if (classification === "UNSUPPORTED") {
    return {
      baseServiceChargePence: 0,
      routeDistancePence: 0,
      routeDurationPence: 0,
      inventoryCapacityPence: 0,
      crewPence: 0,
      accessPence: 0,
      servicePence: 0,
      timingPence: 0,
      laborPence: 0,
      fuelPence: 0,
      vehicleWearPence: 0,
      dispatchPence: 0,
      administrationPence: 0,
      specialistPence: 0,
      directOperatingCostPence: 0,
      costFloorPence: 0,
      vehicleTrips: 0,
      costBasedQuotePence: 0,
      costSafeFloorPence: 0,
    };
  }

  const effectiveSummary = effectiveSummaryForDemand(
    classification,
    params.inventory.summary,
    params.referenceProfile
  );
  const selectedUnits = Math.max(effectiveSummary.totalUnits, params.inventory.summary.totalUnits);
  const baseServiceChargePence = multiplyPenceByBpsHalfUp(
    referenceBasePricePence(params.canonicalInput, params.referenceProfile),
    params.adjustmentBps
  );
  const routeDistancePence = routeDistanceCostPence(classification, params.routeMetrics.distanceMiles);
  const routeDurationPence = routeDurationCostPence(classification, params.routeMetrics.durationMinutes);
  const inventoryCapacityPence = multiplyPenceByBpsHalfUp(
    fullLutonLoadTargetPence(params.routeMetrics.distanceMiles),
    params.demandRatios.lutonCapacityDemandBps
  );
  const extraCrew = Math.max(0, params.canonicalInput.crewRequirement.requiredMovers - 1);
  const crewPence = Math.ceil(effectiveSummary.totalHandlingMinutes * extraCrew * 35);
  const accessPence = accessCostPence(params.canonicalInput.access);
  const servicePence = serviceCostPence(params.canonicalInput, selectedUnits);
  const timingPence = timingCostPence(params.canonicalInput, params.effectiveDate, params.now);
  const costConfig = operatingCostConfig(classification);
  const vehicleTrips = Math.max(1, Math.ceil(params.demandRatios.lutonCapacityDemandBps / 10_000));
  const billableDistanceMiles = Math.ceil(params.routeMetrics.distanceMiles * costConfig.returnLegMultiplierBps / 10_000);
  const billableDrivingMinutes = Math.ceil(params.routeMetrics.durationMinutes * costConfig.returnLegMultiplierBps / 10_000);
  const laborPence = Math.ceil(
    (billableDrivingMinutes + effectiveSummary.totalHandlingMinutes) *
    params.canonicalInput.crewRequirement.requiredMovers *
    costConfig.labourMinuteCostPence
  );
  const fuelPence = Math.ceil(billableDistanceMiles * costConfig.fuelMileCostPence);
  const vehicleWearPence = Math.ceil(billableDistanceMiles * costConfig.vehicleWearMileCostPence);
  const specialistPence = params.inventory.summary.specialistUnitCount * SPECIALIST_UNIT_COST_PENCE;
  const directOperatingCostPence =
    laborPence +
    fuelPence +
    vehicleWearPence +
    costConfig.dispatchPence +
    costConfig.administrationPence +
    Math.ceil(accessPence * 0.75) +
    Math.ceil(servicePence * 0.65) +
    specialistPence +
    timingPence;
  const costFloorPence = calculateCostFloorPence({ directOperatingCostPence });
  const subtotalPence =
    baseServiceChargePence +
    routeDistancePence +
    routeDurationPence +
    crewPence +
    accessPence +
    servicePence +
    timingPence;
  const capacityFloorPence =
    inventoryCapacityPence +
    routeDistancePence +
    Math.floor(routeDurationPence / 2) +
    accessPence +
    servicePence +
    timingPence;
  const costBasedQuotePence = roundUpToPoundsPence(Math.max(subtotalPence, capacityFloorPence));
  const costSafeFloorPence = costFloorPence;

  return {
    baseServiceChargePence,
    routeDistancePence,
    routeDurationPence,
    inventoryCapacityPence,
    crewPence,
    accessPence,
    servicePence,
    timingPence,
    laborPence,
    fuelPence,
    vehicleWearPence,
    dispatchPence: costConfig.dispatchPence,
    administrationPence: costConfig.administrationPence,
    specialistPence,
    directOperatingCostPence,
    costFloorPence,
    vehicleTrips,
    costBasedQuotePence,
    costSafeFloorPence,
  };
}

function benchmarkSnapshot(benchmark: CompetitorBenchmarkForPricing) {
  const from = new Date(benchmark.effectiveFrom);
  const to = benchmark.effectiveTo === null ? null : new Date(benchmark.effectiveTo);
  return {
    id: benchmark.id,
    region: benchmark.region,
    moveType: benchmark.moveType,
    propertySize: benchmark.propertySize,
    serviceLevel: benchmark.serviceLevel,
    packingIncluded: benchmark.packingIncluded,
    distanceBandMinMiles: benchmark.distanceBandMinMiles,
    distanceBandMaxMiles: benchmark.distanceBandMaxMiles,
    benchmarkPricePence: benchmark.benchmarkPricePence,
    effectiveFrom: Number.isNaN(from.getTime()) ? String(benchmark.effectiveFrom) : from.toISOString(),
    effectiveTo: to === null ? null : Number.isNaN(to.getTime()) ? String(benchmark.effectiveTo) : to.toISOString(),
    sourceNote: benchmark.sourceNote,
  };
}

function marketBenchmarkForDemand(
  benchmark: CompetitorBenchmarkForPricing,
  adjustmentBps: number,
  canonicalInput: CanonicalPricingInput
): number {
  if (canonicalInput.classification === "INDIVIDUAL_ITEMS" && canonicalInput.propertySize === "single-item") {
    return benchmark.benchmarkPricePence;
  }
  return Math.max(1, multiplyPenceByBpsHalfUp(benchmark.benchmarkPricePence, adjustmentBps));
}

function effectiveSummaryForDemand(
  classification: PricingClassification,
  inventorySummary: InventorySummary,
  referenceProfile: DynamicReferenceProfile
): InventorySummary {
  if (inventorySummary.totalUnits > 0 || classification !== "FULL_HOUSE") return inventorySummary;
  return {
    totalUnits: referenceProfile.referenceUnits,
    itemUnits: referenceProfile.referenceUnits,
    totalVolumeM3: referenceProfile.referenceVolumeM3,
    totalWeightKg: referenceProfile.referenceWeightKg,
    totalHandlingMinutes: referenceProfile.referenceHandlingMinutes,
    heavyUnitCount: 0,
    bulkyUnitCount: 0,
    twoPersonUnitCount: 0,
    specialistUnitCount: 0,
    fragileItemCount: 0,
    heavyOrSpecialItemCount: 0,
  };
}

function volumeLitres(valueM3: number): number {
  return Math.round(valueM3 * 1_000);
}

function weightDeciKg(valueKg: number): number {
  return Math.round(valueKg * 10);
}

function fixedTotalsFromLines(lines: ResolvedInventoryLine[]) {
  return lines.reduce(
    (totals, item) => ({
      volumeLitres: totals.volumeLitres + volumeLitres(item.estimatedVolumeM3) * item.quantity,
      weightDeciKg: totals.weightDeciKg + weightDeciKg(item.estimatedWeightKg) * item.quantity,
    }),
    { volumeLitres: 0, weightDeciKg: 0 }
  );
}

function fixedTotalsFromReferenceProfile(referenceProfile: DynamicReferenceProfile) {
  return referenceProfile.items.reduce(
    (totals, item) => ({
      volumeLitres: totals.volumeLitres + volumeLitres(item.metric.estimatedVolumeM3) * item.quantity,
      weightDeciKg: totals.weightDeciKg + weightDeciKg(item.metric.estimatedWeightKg) * item.quantity,
    }),
    { volumeLitres: 0, weightDeciKg: 0 }
  );
}

function fixedTotalsFromSummary(summary: InventorySummary) {
  return {
    volumeLitres: volumeLitres(summary.totalVolumeM3),
    weightDeciKg: weightDeciKg(summary.totalWeightKg),
  };
}

function controllingCapacityDimension(volumeCapacityBps: number, weightCapacityBps: number): ControllingCapacityDimension {
  if (volumeCapacityBps > weightCapacityBps) return "VOLUME";
  if (weightCapacityBps > volumeCapacityBps) return "WEIGHT";
  return "EQUAL";
}

function controllingDemandDimension(params: {
  capacityDimension: ControllingCapacityDimension;
  relativeCapacityDemandBps: number;
  handlingRelativeBps: number;
}): DemandRatiosBps["controllingDemandDimension"] {
  const effectiveDemandBps = Math.max(
    params.relativeCapacityDemandBps,
    params.handlingRelativeBps
  );
  if (effectiveDemandBps === params.relativeCapacityDemandBps) {
    return params.capacityDimension.toLowerCase() as DemandRatiosBps["controllingDemandDimension"];
  }
  return "handling";
}

function calculateDemandRatios(params: {
  classification: PricingClassification;
  inventory: { lines: ResolvedInventoryLine[]; summary: InventorySummary };
  referenceProfile: DynamicReferenceProfile;
  lutonCapacityReference: LutonCapacityReferenceSnapshot;
  requiredCrew: number;
}): DemandRatiosBps {
  const summary = effectiveSummaryForDemand(params.classification, params.inventory.summary, params.referenceProfile);
  const inventoryTotals = params.inventory.summary.totalUnits > 0
    ? fixedTotalsFromLines(params.inventory.lines)
    : fixedTotalsFromSummary(summary);
  const referenceTotals = fixedTotalsFromReferenceProfile(params.referenceProfile);
  const lutonVolumeLitres = volumeLitres(params.lutonCapacityReference.maxUsableVolumeM3);
  const lutonPayloadDeciKg = weightDeciKg(params.lutonCapacityReference.maxPayloadKg);
  const volumeCapacityBps = roundHalfUpRatioBps(inventoryTotals.volumeLitres, lutonVolumeLitres);
  const weightCapacityBps = roundHalfUpRatioBps(inventoryTotals.weightDeciKg, lutonPayloadDeciKg);
  const capacityDimension = controllingCapacityDimension(volumeCapacityBps, weightCapacityBps);
  const lutonCapacityDemandBps = Math.max(volumeCapacityBps, weightCapacityBps);
  const referenceVolumeCapacityBps = roundHalfUpRatioBps(referenceTotals.volumeLitres, lutonVolumeLitres);
  const referenceWeightCapacityBps = roundHalfUpRatioBps(referenceTotals.weightDeciKg, lutonPayloadDeciKg);
  const referenceLutonDemandBps = Math.max(referenceVolumeCapacityBps, referenceWeightCapacityBps);
  const relativeCapacityDemandBps = roundHalfUpRatioBps(lutonCapacityDemandBps, referenceLutonDemandBps);
  const handlingRelativeBps = roundHalfUpRatioBps(
    summary.totalHandlingMinutes,
    params.referenceProfile.referenceHandlingMinutes
  );
  const crewRelativeBps = roundHalfUpRatioBps(params.requiredCrew, params.referenceProfile.referenceCrew);
  const effectiveDemandBps = Math.max(relativeCapacityDemandBps, handlingRelativeBps);
  const demandDimension = controllingDemandDimension({
    capacityDimension,
    relativeCapacityDemandBps,
    handlingRelativeBps,
  });

  return {
    volumeCapacityBps,
    weightCapacityBps,
    controllingCapacityDimension: capacityDimension,
    lutonCapacityDemandBps,
    referenceVolumeCapacityBps,
    referenceWeightCapacityBps,
    referenceLutonDemandBps,
    relativeCapacityDemandBps,
    handlingRelativeBps,
    crewRelativeBps,
    effectiveDemandBps,
    volumeRatioBps: roundHalfUpRatioBps(inventoryTotals.volumeLitres, referenceTotals.volumeLitres),
    weightRatioBps: roundHalfUpRatioBps(inventoryTotals.weightDeciKg, referenceTotals.weightDeciKg),
    handlingRatioBps: handlingRelativeBps,
    crewRatioBps: crewRelativeBps,
    inventoryDemandBps: effectiveDemandBps,
    controllingDemandDimension: demandDimension,
  };
}

export function adjustmentBpsForDemand(effectiveDemandBps: number): number {
  if (effectiveDemandBps <= 10_000) {
    return clamp(
      MIN_AUTOMATIC_ADJUSTMENT_BPS,
      10_000,
      MIN_AUTOMATIC_ADJUSTMENT_BPS + roundHalfUpDivide(3_000 * effectiveDemandBps, 10_000)
    );
  }

  const extraDemandBps = effectiveDemandBps - 10_000;
  return clamp(
    10_000,
    MAX_AUTOMATIC_ADJUSTMENT_BPS,
    10_000 + roundHalfUpDivide(60_000 * extraDemandBps, extraDemandBps + 60_000)
  );
}

function requiredCrewFor(
  classification: PricingClassification | "UNSUPPORTED",
  requestedCrew: number,
  lines: ResolvedInventoryLine[]
): number {
  const classificationMin = classification === "UNSUPPORTED" ? 1 : MOVE_TYPE_MIN_CREW[classification];
  const itemMinimumCrew = lines.reduce((max, item) => Math.max(max, item.minimumCrew), 1);
  const twoPersonCrew = lines.some((item) => item.requiresTwoPeople) ? 2 : 1;
  return Math.max(requestedCrew, classificationMin, itemMinimumCrew, twoPersonCrew);
}

function resourcePlanFor(params: {
  canonicalInput: CanonicalPricingInput;
  inventory: { lines: ResolvedInventoryLine[]; summary: InventorySummary };
  demandRatios: DemandRatiosBps;
  lutonCapacityReference: LutonCapacityReferenceSnapshot;
  vehicleTrips: number;
}): ResourcePlan {
  const totalHandlingMinutes = params.inventory.summary.totalHandlingMinutes;
  const loadingMinutes = Math.ceil(totalHandlingMinutes / 2);
  const unloadingMinutes = totalHandlingMinutes - loadingMinutes;
  const itemMinimumCrew = params.inventory.lines.reduce(
    (max, item) => Math.max(max, item.minimumCrew, item.requiresTwoPeople ? 2 : 1),
    1
  );

  return {
    crew: {
      requestedMovers: params.canonicalInput.crewRequirement.requestedMovers,
      requiredMovers: params.canonicalInput.crewRequirement.requiredMovers,
      itemMinimumCrew,
      twoPersonHandlingRequired: params.inventory.lines.some((item) => item.requiresTwoPeople),
    },
    vehicle: {
      name: params.lutonCapacityReference.name,
      usableVolumeM3: params.lutonCapacityReference.maxUsableVolumeM3,
      payloadKg: params.lutonCapacityReference.maxPayloadKg,
      loadRatioBps: params.demandRatios.lutonCapacityDemandBps,
      trips: params.vehicleTrips,
      multipleTripsLikely: params.vehicleTrips > 1,
    },
    capacity: {
      volumeCapacityBps: params.demandRatios.volumeCapacityBps,
      weightCapacityBps: params.demandRatios.weightCapacityBps,
      controllingCapacityDimension: params.demandRatios.controllingCapacityDimension,
    },
    handling: {
      loadingMinutes,
      unloadingMinutes,
      totalHandlingMinutes,
    },
  };
}

export function evaluateCanonicalPricing(
  canonicalInput: CanonicalPricingInput,
  benchmarks: CompetitorBenchmarkForPricing[],
  inventory: { lines: ResolvedInventoryLine[]; summary: InventorySummary },
  routeMetrics: RouteMetrics,
  referenceProfile: DynamicReferenceProfile,
  lutonCapacityReference: LutonCapacityReferenceSnapshot,
  effectiveDate: Date,
  now: Date,
  expiresAt: string
): CanonicalPricingResult {
  const distanceMiles = canonicalInput.routeDistanceMiles;
  const effectiveTime = effectiveDate.getTime();

  if (canonicalInput.classification === "UNSUPPORTED") {
    return manualResult({
      reasonCodes: ["UNSUPPORTED_MOVE_CLASSIFICATION"],
      canonicalInput,
      routeMetrics,
      referenceProfile,
      lutonCapacityReference,
      requiredCrew: canonicalInput.crewRequirement.requiredMovers,
      inventory,
      expiresAt,
    });
  }

  if (distanceMiles === null || !Number.isFinite(distanceMiles)) {
    return manualResult({
      reasonCodes: ["ROUTE_UNAVAILABLE"],
      canonicalInput,
      routeMetrics,
      referenceProfile,
      lutonCapacityReference,
      requiredCrew: canonicalInput.crewRequirement.requiredMovers,
      inventory,
      expiresAt,
    });
  }

  if (distanceMiles <= 0 || distanceMiles > MAX_AUTO_DISTANCE_MILES) {
    return manualResult({
      reasonCodes: ["DISTANCE_OUT_OF_RANGE"],
      canonicalInput,
      routeMetrics,
      referenceProfile,
      lutonCapacityReference,
      requiredCrew: canonicalInput.crewRequirement.requiredMovers,
      inventory,
      expiresAt,
    });
  }

  const classification = canonicalInput.classification;
  const demandRatios = calculateDemandRatios({
    classification,
    inventory,
    referenceProfile,
    lutonCapacityReference,
    requiredCrew: canonicalInput.crewRequirement.requiredMovers,
  });
  const preliminaryResourcePlan = resourcePlanFor({
    canonicalInput,
    inventory,
    demandRatios,
    lutonCapacityReference,
    vehicleTrips: Math.max(1, Math.ceil(demandRatios.lutonCapacityDemandBps / 10_000)),
  });
  const maxAutomaticCapacityBps = classification === "FULL_HOUSE"
    ? MAX_AUTOMATIC_FULL_HOUSE_LUTON_CAPACITY_BPS
    : MAX_AUTOMATIC_LUTON_CAPACITY_BPS;
  if (
    demandRatios.volumeCapacityBps > maxAutomaticCapacityBps ||
    demandRatios.weightCapacityBps > maxAutomaticCapacityBps ||
    demandRatios.effectiveDemandBps > MAX_AUTOMATIC_INVENTORY_DEMAND_BPS
  ) {
    return manualResult({
      reasonCodes: ["DEMAND_EXCEEDS_AUTOMATIC_RANGE"],
      canonicalInput,
      routeMetrics,
      referenceProfile,
      lutonCapacityReference,
      requiredCrew: canonicalInput.crewRequirement.requiredMovers,
      inventory,
      demandRatios,
      resourcePlan: preliminaryResourcePlan,
      expiresAt,
      explanation: "This inventory is outside the automatic pricing range and requires team review.",
    });
  }

  const adjustmentBps = adjustmentBpsForDemand(demandRatios.effectiveDemandBps);
  const costModel = calculateOperationalQuote({
    canonicalInput,
    routeMetrics,
    referenceProfile,
    inventory,
    demandRatios,
    adjustmentBps,
    effectiveDate,
    now,
  });
  const resourcePlan = resourcePlanFor({
    canonicalInput,
    inventory,
    demandRatios,
    lutonCapacityReference,
    vehicleTrips: costModel.vehicleTrips,
  });
  const pricedInventoryFacts: InventoryFacts = {
    ...canonicalInput.inventoryFacts,
    usableVehicleLoadRatioBps: demandRatios.lutonCapacityDemandBps,
  };
  const safetyReasons: InternalManualReviewReasonCode[] = [
    ...accessReviewReasons(canonicalInput.access),
    ...dateReviewReasons(canonicalInput, effectiveDate, now),
    ...(inventory.summary.specialistUnitCount > 0 ? ["SPECIALIST_REVIEW" as const] : []),
  ];
  if (safetyReasons.length > 0) {
    return manualResult({
      reasonCodes: safetyReasons,
      canonicalInput,
      routeMetrics,
      referenceProfile,
      lutonCapacityReference,
      requiredCrew: canonicalInput.crewRequirement.requiredMovers,
      inventory,
      demandRatios,
      resourcePlan,
      directOperatingCostPence: costModel.directOperatingCostPence,
      costFloorPence: costModel.costFloorPence,
      expiresAt,
    });
  }
  const targetBps = MARKET_TARGET_BPS;
  const lutonFullLoadTargetPence = fullLutonLoadTargetPence(distanceMiles);
  const lutonLoadPriceFloorPence = costModel.inventoryCapacityPence;

  const dimensionMatches = benchmarks.filter((benchmark) => (
    isBenchmarkDimensionMatch(benchmark, canonicalInput) &&
    isDistanceBandMatch(benchmark, distanceMiles)
  ));
  const eligibleMatches = dimensionMatches.filter((benchmark) => isEligibleNow(benchmark, effectiveTime));
  const expiredOnly = dimensionMatches.length > 0 && dimensionMatches.every((benchmark) => isExpiredAt(benchmark, effectiveTime));
  let benchmark = eligibleMatches.length === 1 ? eligibleMatches[0] ?? null : null;
  let competitorClaimSuppressedReason: string | null = null;

  if (dimensionMatches.length === 0) {
    competitorClaimSuppressedReason = "missing_benchmark";
  } else if (eligibleMatches.length === 0) {
    competitorClaimSuppressedReason = expiredOnly ? "expired_benchmark" : "missing_benchmark";
  } else if (eligibleMatches.length > 1) {
    competitorClaimSuppressedReason = "ambiguous_benchmark";
    benchmark = null;
  } else if (!benchmark || !Number.isSafeInteger(benchmark.benchmarkPricePence) || benchmark.benchmarkPricePence <= 0) {
    competitorClaimSuppressedReason = "invalid_benchmark";
    benchmark = null;
  }

  if (!benchmark) {
    return manualResult({
      reasonCodes: [
        competitorClaimSuppressedReason === "ambiguous_benchmark"
          ? "AMBIGUOUS_BENCHMARK"
          : competitorClaimSuppressedReason === "expired_benchmark"
            ? "EXPIRED_BENCHMARK"
            : "MISSING_BENCHMARK",
      ],
      canonicalInput,
      routeMetrics,
      referenceProfile,
      lutonCapacityReference,
      requiredCrew: canonicalInput.crewRequirement.requiredMovers,
      inventory,
      demandRatios,
      resourcePlan,
      directOperatingCostPence: costModel.directOperatingCostPence,
      costFloorPence: costModel.costFloorPence,
      expiresAt,
    });
  }

  const marketBenchmarkPence = marketBenchmarkForDemand(benchmark, adjustmentBps, canonicalInput);
  const marketTargetPence = calculateMarketTargetPence(marketBenchmarkPence);
  const roundedTargetPence = floorToIncrementPence(marketTargetPence);
  const dateSurchargePence = earlyMoveDateSurchargePence(canonicalInput, effectiveDate, now);
  const datedTargetPence = roundedTargetPence + dateSurchargePence;
  const datedMarketBenchmarkPence = marketBenchmarkPence + dateSurchargePence;
  const costFloorPence = costModel.costFloorPence;
  const competitorTargetPence = datedTargetPence;
  const benchmarkData = benchmarkSnapshot(benchmark);
  const conflictFingerprint = stableHash({
    ...canonicalInput,
    benchmark: {
      id: benchmarkData.id,
      pricePence: marketBenchmarkPence,
      effectiveFrom: benchmarkData.effectiveFrom,
      effectiveTo: benchmarkData.effectiveTo,
    },
    demandRatios,
    adjustmentBps,
    pricingCurveVersion: PRICING_CURVE_VERSION,
    targetBps,
    lutonFullLoadTargetPence,
    lutonLoadPriceFloorPence,
    costBasedQuotePence: costModel.costBasedQuotePence,
    costSafeFloorPence: costFloorPence,
    directOperatingCostPence: costModel.directOperatingCostPence,
    competitorTargetPence,
    competitorClaimSuppressedReason,
    inventorySummary: inventory.summary,
    roundedTargetPence: datedTargetPence,
    dateSurchargePence,
    datedTargetPence,
    costFloorPence,
  });
  if (datedTargetPence < costFloorPence) {
    return manualResult({
      reasonCodes: ["COST_FLOOR_CONFLICT"],
      canonicalInput,
      routeMetrics,
      referenceProfile,
      lutonCapacityReference,
      requiredCrew: canonicalInput.crewRequirement.requiredMovers,
      inventory,
      demandRatios,
      resourcePlan,
      marketBenchmarkPence,
      marketTargetPence,
      costFloorPence,
      directOperatingCostPence: costModel.directOperatingCostPence,
      expiresAt,
      explanation: "The 10% below-market target is below the configured cost floor.",
    });
  }

  const totalPence = datedTargetPence;
  const finalPricePence = datedTargetPence;
  const savingsPence = datedMarketBenchmarkPence - finalPricePence;
  const savingsRate = datedMarketBenchmarkPence > 0 ? savingsPence / datedMarketBenchmarkPence : 0;
  const contributionPence = finalPricePence - costModel.directOperatingCostPence;
  const contributionMargin = finalPricePence > 0 ? contributionPence / finalPricePence : 0;
  const actualSavingBps = roundHalfUpRatioBps(savingsPence, datedMarketBenchmarkPence);
  const serverInputHash = stableHash({
    conflictFingerprint,
    finalPricePence,
    contributionPence,
    contributionMargin,
  });
  const identity = pricingResultIdentity(canonicalInput, { serverInputHash });
  const savingPercent = Math.round(savingsRate * 100);
  const explanation = [
    `Algorithm ${PRICING_ALGORITHM_VERSION}`,
    `classification ${classification}`,
    `reference ${referenceProfile.profileId}@${referenceProfile.profileVersion}`,
    "Market benchmark target checked against cost floor",
    `market benchmark ${benchmark.id}`,
  ].join("; ");
  const routeAndTravelPence =
    costModel.routeDistancePence +
    costModel.routeDurationPence +
    costModel.timingPence;
  const breakdown = [
    { key: "base_service_charge", label: "Route, inventory and handling", amountPence: costModel.baseServiceChargePence },
    { key: "route_travel", label: "Route mileage and travel time", amountPence: routeAndTravelPence },
    ...(dateSurchargePence > 0
      ? [{ key: "early_move_date", label: "Short-notice moving date", amountPence: dateSurchargePence }]
      : []),
    { key: "crew", label: "Crew requirement", amountPence: costModel.crewPence },
    { key: "access", label: "Access, stairs and carry distance", amountPence: costModel.accessPence },
    { key: "packing_services", label: "Packing and selected services", amountPence: costModel.servicePence },
    { key: "market_target_adjustment", label: "Market target adjustment", amountPence: finalPricePence - costModel.costBasedQuotePence },
  ];

  return {
    status: "AUTO_QUOTE",
    quoteId: identity.quoteId,
    modelVersion: PRICING_ALGORITHM_VERSION,
    currency: "GBP",
    marketBenchmarkPence: datedMarketBenchmarkPence,
    marketTargetPence,
    roundedTargetPence: datedTargetPence,
    costFloorPence,
    finalPricePence,
    savingsPence,
    savingsRate,
    directOperatingCostPence: costModel.directOperatingCostPence,
    contributionPence,
    contributionMargin,
    crewSize: canonicalInput.crewRequirement.requiredMovers,
    vehicleTrips: costModel.vehicleTrips,
    estimatedVolumeM3: inventory.summary.totalVolumeM3,
    estimatedWeightKg: inventory.summary.totalWeightKg,
    expiresAt,
    inputFingerprint: identity.inputFingerprint,
    totalPence,
    benchmarkPricePence: datedMarketBenchmarkPence,
    savingPercent,
    pricingAlgorithmVersion: PRICING_ALGORITHM_VERSION,
    competitorBenchmarkId: benchmark.id,
    serverInputHash,
    explanation,
    canonicalInput,
    auditSnapshot: {
      pricingAlgorithmVersion: PRICING_ALGORITHM_VERSION,
      itemMetricDatasetVersion: ITEM_METRICS_DATASET_VERSION,
      explanation,
      benchmark: benchmarkData,
      classification,
      referenceProfile: referenceProfileSnapshot(referenceProfile),
      resolvedMoveScope: canonicalInput.resolvedMoveScope,
      moveScopeConfidence: canonicalInput.moveScopeConfidence,
      moveScopeReasonCodes: canonicalInput.moveScopeReasonCodes,
      moveScopeConfirmationRecommended: canonicalInput.moveScopeConfirmationRecommended,
      propertyCoverageBps: canonicalInput.propertyCoverageBps,
      inventoryFacts: pricedInventoryFacts,
      resourcePlan,
      lutonCapacityReference,
      lutonUsableVolumeM3: lutonCapacityReference.maxUsableVolumeM3,
      lutonPayloadKg: lutonCapacityReference.maxPayloadKg,
      normalizedInventory: canonicalInput.inventory,
      inventorySummary: inventory.summary,
      totalVolumeM3: inventory.summary.totalVolumeM3,
      totalWeightKg: inventory.summary.totalWeightKg,
      requiredCrew: canonicalInput.crewRequirement.requiredMovers,
      demandRatios,
      adjustmentBps,
      pricingCurveVersion: PRICING_CURVE_VERSION,
      baseTargetBps: targetBps,
      lutonFullLoadTargetPence,
      lutonLoadPriceFloorPence,
      costBasedQuotePence: costModel.costBasedQuotePence,
      costSafeFloorPence: costFloorPence,
      competitorTargetPence,
      competitorClaimSuppressedReason,
      marketBenchmarkPence: datedMarketBenchmarkPence,
      baseMarketBenchmarkPence: marketBenchmarkPence,
      marketTargetPence,
      roundedTargetPence: datedTargetPence,
      baseRoundedTargetPence: roundedTargetPence,
      dateSurchargePence,
      costFloorPence,
      directOperatingCostPence: costModel.directOperatingCostPence,
      contributionPence,
      contributionMargin,
      vehicleTrips: costModel.vehicleTrips,
      marketCeilingPence: costModel.costBasedQuotePence,
      marketCeilingReached: false,
      volumeCapacityBps: demandRatios.volumeCapacityBps,
      weightCapacityBps: demandRatios.weightCapacityBps,
      controllingCapacityDimension: demandRatios.controllingCapacityDimension,
      referenceLutonDemandBps: demandRatios.referenceLutonDemandBps,
      relativeCapacityDemandBps: demandRatios.relativeCapacityDemandBps,
      handlingRelativeBps: demandRatios.handlingRelativeBps,
      crewRelativeBps: demandRatios.crewRelativeBps,
      effectiveDemandBps: demandRatios.effectiveDemandBps,
      finalTotalPence: totalPence,
      finalPricePence,
      actualSavingBps,
      serverInputHash,
    },
    routeMetrics,
    referenceProfile,
    lutonCapacityReference,
    requiredCrew: canonicalInput.crewRequirement.requiredMovers,
    demandRatios,
    adjustmentBps,
    baseTargetBps: targetBps,
    marketCeilingPence: costModel.costBasedQuotePence,
    inventory,
    resolvedMoveScope: canonicalInput.resolvedMoveScope,
    moveScopeConfidence: canonicalInput.moveScopeConfidence,
    moveScopeReasonCodes: canonicalInput.moveScopeReasonCodes,
    inventoryFacts: pricedInventoryFacts,
    resourcePlan,
    breakdown,
  };
}

export async function calculateCanonicalQuotePricing(
  input: CreateQuoteRequest,
  dependencies: CanonicalPricingDependencies = {}
): Promise<CanonicalPricingResult> {
  const totalStart = monotonicNow();
  const timingMs = emptyTiming();
  const now = dependencies.now ?? new Date();
  const quoteExpiresAt = quoteExpiryFromNow(now).toISOString();
  const effectiveDate = dateFromMoveDate(input, now);
  const findInventoryItems = dependencies.findInventoryItems ?? defaultFindInventoryItems;
  const findCompetitorBenchmarks = dependencies.findCompetitorBenchmarks ?? defaultFindCompetitorBenchmarks;
  const findVehicleClassConfigs = dependencies.findVehicleClassConfigs ?? defaultFindVehicleClassConfigs;
  const calculateRoute = dependencies.calculateRoute ?? calculateServerRoute;
  const reasonCodes: InternalManualReviewReasonCode[] = [];
  let inventory: { lines: ResolvedInventoryLine[]; summary: InventorySummary; reasonCodes: InternalManualReviewReasonCode[] };

  const inventoryStart = monotonicNow();
  try {
    const requested = canonicalRequestedInventory(input);
    inventory = await resolveInventory(input, (itemIds) => cachedPromise(
      dependencies.inventoryItemsCache,
      stableHash([...itemIds].sort()),
      () => findInventoryItems(itemIds)
    ));
    if (requested.invalidQuantity) reasonCodes.push("INVALID_ITEM_QUANTITY");
  } catch {
    timingMs.inventoryResolution = elapsedMs(inventoryStart);
    const emptyInventory = { lines: [], summary: emptyInventorySummary() };
    const moveScope = moveScopeResolutionFor({
      input,
      inventory: emptyInventory,
      propertyReferenceProfile: propertyReferenceProfileForInput(input),
    });
    const classification = moveScope.classification;
    const propertySize = moveScope.propertySize;
    const requiredCrew = requiredCrewFor(classification, input.preferredMovers ?? 1, []);
    const canonicalInput = canonicalInputFor({
      input,
      classification,
      propertySize,
      moveScope,
      routeMetrics: null,
      effectiveDate,
      inventory: { lines: [] },
      inventoryFacts: inventoryFactsFor(emptyInventory),
      referenceProfile: null,
      lutonCapacityReference: null,
      requiredCrew,
    });
    return withTiming(
      manualResult({
        reasonCodes: ["DATA_UNAVAILABLE"],
        canonicalInput,
        routeMetrics: null,
        referenceProfile: null,
        requiredCrew,
        inventory: { lines: [], summary: emptyInventorySummary() },
        expiresAt: quoteExpiresAt,
        explanation: "Pricing data is temporarily unavailable. Please retry.",
      }),
      timingMs,
      totalStart
    );
  }
  timingMs.inventoryResolution = elapsedMs(inventoryStart);
  reasonCodes.push(...inventory.reasonCodes);
  if (input.customItems.length > 0 || input.moveSize === "custom-inventory") reasonCodes.push("CUSTOM_INVENTORY");

  const routeAddresses = [
    input.collection,
    ...(input.additionalStop ? [input.additionalStop] : []),
    input.delivery,
  ];
  const routeStart = monotonicNow();
  const routeResult = await cachedPromise(
    dependencies.routeCache,
    stableHash(routeAddresses),
    () => calculateRoute(routeAddresses),
    (result) => Boolean(result.route && result.reasons.length === 0)
  );
  timingMs.routeCalculation = elapsedMs(routeStart);
  if (!routeResult.route) {
    reasonCodes.push("ROUTE_UNAVAILABLE");
  } else if (
    routeResult.reasons.length > 0 ||
    !Number.isFinite(routeResult.route.distanceMiles) ||
    routeResult.route.distanceMiles <= 0 ||
    !routeResult.route.routeHash
  ) {
    reasonCodes.push("ROUTE_UNRELIABLE");
  }

  const canonicalStart = monotonicNow();
  const moveScope = moveScopeResolutionFor({
    input,
    inventory,
    propertyReferenceProfile: propertyReferenceProfileForInput(input),
  });
  const classification = moveScope.classification;
  if (classification === "UNSUPPORTED") reasonCodes.push("UNSUPPORTED_MOVE_CLASSIFICATION");
  const propertySize = moveScope.propertySize;
  const pricingMoveType = pricingMoveTypeForClassification(input, classification, propertySize);
  const referenceProfile = classification === "UNSUPPORTED"
    ? null
    : findDynamicReferenceProfile({ classification, moveType: pricingMoveType, propertySize });
  if (classification !== "UNSUPPORTED" && !referenceProfile) reasonCodes.push("DYNAMIC_REFERENCE_MISSING");
  if (inventory.summary.totalUnits === 0 && classification !== "FULL_HOUSE") {
    reasonCodes.push("ITEM_METRICS_MISSING");
  }
  const requiredCrew = requiredCrewFor(classification, input.preferredMovers ?? 1, inventory.lines);
  if (requiredCrew > MAX_AUTOMATIC_CREW) reasonCodes.push("CREW_REQUIREMENT_UNSUPPORTED");

  let lutonCapacityReference: LutonCapacityReferenceSnapshot | null = null;
  if (classification !== "UNSUPPORTED" && referenceProfile) {
    try {
      const configs = await cachedPromise(
        dependencies.vehicleClassConfigCache,
        LUTON_CAPACITY_REFERENCE_CACHE_KEY,
        () => findVehicleClassConfigs()
      );
      const resolved = resolveLutonCapacityReference(configs);
      if (resolved.status === "OK") {
        lutonCapacityReference = resolved.reference;
      } else {
        reasonCodes.push(
          resolved.status === "AMBIGUOUS"
            ? "AMBIGUOUS_LUTON_REFERENCE_CAPACITY"
            : "LUTON_REFERENCE_CAPACITY_MISSING"
        );
      }
    } catch {
      reasonCodes.push("DATA_UNAVAILABLE");
    }
  }

  const canonicalInput = canonicalInputFor({
    input,
    classification,
    propertySize,
    moveScope,
    routeMetrics: routeResult.route,
    effectiveDate,
    inventory,
    inventoryFacts: inventoryFactsFor(inventory),
    referenceProfile,
    lutonCapacityReference,
    requiredCrew,
  });
  if (!canonicalInput.region) reasonCodes.push("DATA_UNAVAILABLE");
  timingMs.canonicalCalculation += elapsedMs(canonicalStart);

  if (
    reasonCodes.length > 0 ||
    classification === "UNSUPPORTED" ||
    !routeResult.route ||
    !referenceProfile ||
    !lutonCapacityReference
  ) {
    return withTiming(
      manualResult({
        reasonCodes,
        canonicalInput,
        routeMetrics: routeResult.route,
        referenceProfile,
        lutonCapacityReference,
        requiredCrew,
        inventory: { lines: inventory.lines, summary: inventory.summary },
        expiresAt: quoteExpiresAt,
      }),
      timingMs,
      totalStart
    );
  }

  const benchmarkCriteria = {
    classification,
    region: canonicalInput.region,
    moveType: canonicalInput.moveType,
    propertySize: canonicalInput.propertySize,
    serviceLevel: canonicalInput.serviceLevel,
    packingIncluded: canonicalInput.packingIncluded,
    routeDistanceMiles: routeResult.route.distanceMiles,
    effectiveDate: canonicalInput.effectiveDate,
  };
  let benchmarks: CompetitorBenchmarkForPricing[];
  const benchmarkStart = monotonicNow();
  try {
    benchmarks = await cachedPromise(
      dependencies.competitorBenchmarksCache,
      stableHash(benchmarkCriteria),
      () => findCompetitorBenchmarks(benchmarkCriteria)
    );
  } catch {
    timingMs.benchmarkQuery = elapsedMs(benchmarkStart);
    benchmarks = [];
  }
  timingMs.benchmarkQuery = elapsedMs(benchmarkStart);

  const evaluationStart = monotonicNow();
  const result = evaluateCanonicalPricing(
    canonicalInput,
    benchmarks,
    { lines: inventory.lines, summary: inventory.summary },
    routeResult.route,
    referenceProfile,
    lutonCapacityReference,
    effectiveDate,
    now,
    quoteExpiresAt
  );
  timingMs.canonicalCalculation += elapsedMs(evaluationStart);
  return withTiming(result, timingMs, totalStart);
}

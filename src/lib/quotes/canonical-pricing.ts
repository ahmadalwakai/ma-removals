import crypto from "node:crypto";
import { db } from "@/lib/db";
import {
  ITEM_METRICS_DATASET_VERSION,
  getItemMetricBySlug,
  type ItemMetricConfidence,
} from "@/lib/items/item-metrics";
import { normalizeCanonicalInventory } from "@/lib/quotes/canonical-inventory";
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
    itemMetricVersion: string;
  }>;
  customInventory: Array<{
    name: string;
    quantity: number;
    room: string;
  }>;
  crewRequirement: {
    requestedMovers: number;
    requiredMovers: number;
  };
  bookingChannel: string;
  moveDate: string | null;
  effectiveDate: string;
}

export interface PricingAuditSnapshot {
  pricingAlgorithmVersion: string;
  itemMetricDatasetVersion: string;
  explanation: string;
  classification: PricingClassification | "UNSUPPORTED";
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
  normalizedInventory?: Array<{ itemId: string; itemSlug: string; quantity: number; itemMetricVersion: string }>;
  inventorySummary?: InventorySummary;
  requiredCrew?: number;
  demandRatios?: DemandRatiosBps;
  adjustmentBps?: number;
  pricingCurveVersion?: string;
  baseTargetBps?: number;
  lutonFullLoadTargetPence?: number;
  lutonLoadPriceFloorPence?: number;
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

export interface FixedCanonicalPricingResult {
  status: "FIXED";
  totalPence: number;
  benchmarkPricePence: number;
  savingPercent: number;
  pricingAlgorithmVersion: string;
  competitorBenchmarkId: string;
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
  breakdown: Array<{ key: string; label: string; amountPence: number }>;
  timingMs?: PricingTimingMs;
}

export interface ManualReviewCanonicalPricingResult {
  status: "MANUAL_REVIEW";
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
  breakdown: [];
  timingMs?: PricingTimingMs;
}

export type CanonicalPricingResult = FixedCanonicalPricingResult | ManualReviewCanonicalPricingResult;

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
const PRICING_CURVE_VERSION = "luton-capacity-rational-v3";
const DEFAULT_PRICING_REGION = "Scotland";
const MIN_AUTOMATIC_ADJUSTMENT_BPS = 7_000;
const MAX_AUTOMATIC_ADJUSTMENT_BPS = 70_000;
const MAX_AUTOMATIC_INVENTORY_DEMAND_BPS = 180_000;
const MAX_AUTOMATIC_LUTON_CAPACITY_BPS = 10_000;
const MAX_AUTOMATIC_FULL_HOUSE_LUTON_CAPACITY_BPS = 30_000;
const CANONICAL_LUTON_USABLE_VOLUME_M3 = 18;
const CANONICAL_LUTON_PAYLOAD_KG = 1200;
const LOCAL_FULL_LUTON_LOAD_TARGET_PENCE = 54_900;
const FULL_LUTON_LOAD_INCLUDED_MILES = 10;
const FULL_LUTON_LOAD_EXTRA_MILE_PENCE = 300;
const MARKET_CEILING_BPS: Record<PricingClassification, number> = {
  FULL_HOUSE: 50_000,
  STUDENT_MOVE: 40_000,
  MAN_AND_VAN: 50_000,
  BUSINESS_REMOVAL: 50_000,
  INDIVIDUAL_ITEMS: 200_000,
};
const FALLBACK_LUTON_CONFIG: VehicleClassConfigForPricing = {
  id: "fallback-luton-capacity-v1",
  name: "Luton van",
  isActive: true,
  maxUsableVolumeM3: CANONICAL_LUTON_USABLE_VOLUME_M3,
  maxPayloadKg: CANONICAL_LUTON_PAYLOAD_KG,
  updatedAt: "2026-08-21T00:00:00.000Z",
};
const FALLBACK_BENCHMARK_BASE_PENCE: Record<PricingClassification, Record<string, number>> = {
  FULL_HOUSE: {
    studio: 25_000,
    "1-bedroom": 34_000,
    "2-bedrooms": 48_000,
    "3-bedrooms": 68_000,
    "4-bedrooms": 88_000,
    "5-plus-bedrooms": 110_000,
  },
  INDIVIDUAL_ITEMS: {
    "single-item": 6_500,
    "few-items": 6_900,
  },
  STUDENT_MOVE: {
    "few-items": 16_000,
  },
  MAN_AND_VAN: {
    "few-items": 10_000,
  },
  BUSINESS_REMOVAL: {
    office: 55_000,
  },
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
const BASE_TARGET_BPS: Record<PricingClassification, number> = {
  FULL_HOUSE: 9_000,
  STUDENT_MOVE: 9_000,
  MAN_AND_VAN: 9_000,
  BUSINESS_REMOVAL: 9_000,
  INDIVIDUAL_ITEMS: 9_000,
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

function uniqueReasonCodes(reasonCodes: ManualReviewReasonCode[]) {
  return Array.from(new Set(reasonCodes));
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateFromMoveDate(input: CreateQuoteRequest, now: Date): Date {
  if (!input.moveDate) return now;
  const parsed = new Date(`${input.moveDate}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? now : parsed;
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

function classifyInput(input: CreateQuoteRequest): PricingClassification | "UNSUPPORTED" {
  const moveSize = input.moveSize ?? null;

  if (input.customItems.length > 0 || moveSize === "custom-inventory") return "UNSUPPORTED";
  if (input.moveType === "office-move") return "BUSINESS_REMOVAL";
  if (input.moveType === "student-move") return "STUDENT_MOVE";
  if (input.moveType === "marketplace-collection") return "MAN_AND_VAN";
  if (INDIVIDUAL_ITEM_MOVE_TYPES.has(input.moveType) || moveSize === "single-item" || moveSize === "few-items") {
    return "INDIVIDUAL_ITEMS";
  }
  if (
    COMPLETE_PROPERTY_MOVE_TYPES.has(input.moveType) &&
    moveSize !== null &&
    SUPPORTED_FULL_HOUSE_PROPERTY_SIZES.has(moveSize)
  ) {
    return "FULL_HOUSE";
  }
  return "UNSUPPORTED";
}

function propertySizeForClassification(
  input: CreateQuoteRequest,
  classification: PricingClassification | "UNSUPPORTED",
  totalUnits: number
): string | null {
  if (classification === "FULL_HOUSE") return input.moveSize ?? null;
  if (classification === "BUSINESS_REMOVAL") return "office";
  if (classification === "STUDENT_MOVE" || classification === "MAN_AND_VAN") return "few-items";
  if (classification === "INDIVIDUAL_ITEMS") {
    if (input.moveSize === "single-item") return "single-item";
    if (input.moveSize === "few-items") return "few-items";
    return totalUnits <= 1 ? "single-item" : "few-items";
  }
  return input.moveSize ?? null;
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
  lines: Array<{ itemId: string; quantity: number }>;
  invalidQuantity: boolean;
} {
  const normalized = normalizeCanonicalInventory(input.inventory, {
    itemMetricVersion: ITEM_METRICS_DATASET_VERSION,
    maxQuantity: MAX_ITEM_QUANTITY,
  });
  return {
    lines: normalized.lines.map((item) => ({ itemId: item.itemId, quantity: item.quantity })),
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
  try {
    return await withDataStoreTimeout(
      "Inventory resolution",
      db.item.findMany({
        where: {
          OR: [
            { id: { in: itemIds } },
            { slug: { in: itemIds } },
          ],
        },
        select: {
          id: true,
          slug: true,
          name: true,
          imagePath: true,
          weight: true,
          size: true,
          estimatedVolumeM3: true,
          estimatedWeightKg: true,
          handlingMinutes: true,
          requiresTwoPeople: true,
          fragile: true,
          heavy: true,
          specialist: true,
          minimumCrew: true,
          isActive: true,
          category: {
            select: {
              name: true,
              type: true,
            },
          },
        },
      })
    );
  } catch {
    return fallbackInventoryRecords(itemIds);
  }
}

function fallbackInventoryRecords(itemIds: string[]): InventoryRecordForPricing[] {
  return itemIds.flatMap((itemId) => {
    const metric = getItemMetricBySlug(itemId);
    if (!metric) return [];
    return [{
      id: metric.slug,
      slug: metric.slug,
      name: metric.name,
      imagePath: metric.imagePath,
      weight: metric.heavy ? "heavy" : "medium",
      size: metric.bulky ? "large" : "medium",
      estimatedVolumeM3: metric.estimatedVolumeM3,
      estimatedWeightKg: metric.estimatedWeightKg,
      handlingMinutes: metric.handlingMinutes,
      requiresTwoPeople: metric.requiresTwoPeople,
      fragile: false,
      heavy: metric.heavy,
      specialist: metric.specialist,
      minimumCrew: metric.minimumCrew,
      isActive: true,
      category: {
        name: metric.categoryName,
        type: "both",
      },
    }];
  });
}

function fallbackCompetitorBenchmark(criteria: BenchmarkSearchCriteria): CompetitorBenchmarkForPricing {
  const propertySize = criteria.propertySize ?? "few-items";
  const classificationFallback = FALLBACK_BENCHMARK_BASE_PENCE[criteria.classification];
  const basePricePence =
    classificationFallback[propertySize] ??
    classificationFallback["few-items"] ??
    Object.values(classificationFallback)[0] ??
    10_000;
  const extraMiles = Math.max(0, Math.ceil(criteria.routeDistanceMiles - FULL_LUTON_LOAD_INCLUDED_MILES));
  const benchmarkPricePence = basePricePence + extraMiles * FULL_LUTON_LOAD_EXTRA_MILE_PENCE;

  return {
    id: `fallback-${criteria.classification.toLowerCase()}-${propertySize}`,
    region: criteria.region || DEFAULT_PRICING_REGION,
    moveType: criteria.moveType,
    propertySize,
    serviceLevel: criteria.serviceLevel,
    packingIncluded: criteria.packingIncluded,
    distanceBandMinMiles: 0,
    distanceBandMaxMiles: null,
    benchmarkPricePence,
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveTo: null,
    sourceNote: "Fallback benchmark used because pricing data store was unavailable.",
    active: true,
  };
}

async function defaultFindCompetitorBenchmarks(
  criteria: BenchmarkSearchCriteria
): Promise<CompetitorBenchmarkForPricing[]> {
  try {
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
  } catch {
    return [fallbackCompetitorBenchmark(criteria)];
  }
}

async function defaultFindVehicleClassConfigs(): Promise<VehicleClassConfigForPricing[]> {
  try {
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
  } catch {
    return [FALLBACK_LUTON_CONFIG];
  }
}

function metricFromRecord(record: InventoryRecordForPricing) {
  const catalogueMetric = getItemMetricBySlug(record.slug ?? record.id);
  if (catalogueMetric) return catalogueMetric;

  if (
    record.slug &&
    record.estimatedVolumeM3 !== null &&
    record.estimatedVolumeM3 > 0 &&
    record.estimatedWeightKg !== null &&
    record.estimatedWeightKg > 0 &&
    record.handlingMinutes !== null &&
    record.handlingMinutes !== undefined &&
    record.handlingMinutes > 0
  ) {
    const transportedLengthM = Math.max(0.01, roundVolume(record.estimatedVolumeM3 ** (1 / 3)));
    return {
      slug: record.slug,
      transportedLengthM,
      transportedWidthM: transportedLengthM,
      transportedHeightM: transportedLengthM,
      estimatedVolumeM3: record.estimatedVolumeM3,
      estimatedWeightKg: record.estimatedWeightKg,
      handlingMinutes: record.handlingMinutes,
      bulky: record.estimatedVolumeM3 >= 0.85,
      requiresTwoPeople: record.requiresTwoPeople,
      heavy: record.heavy,
      specialist: record.specialist,
      minimumCrew: record.minimumCrew ?? (record.requiresTwoPeople ? 2 : 1),
      confidence: "MEDIUM" as const,
      rationale: "Existing database metrics were present for this item.",
    };
  }
  return null;
}

async function resolveInventory(
  input: CreateQuoteRequest,
  findInventoryItems: (itemIds: string[]) => Promise<InventoryRecordForPricing[]>
): Promise<{
  lines: ResolvedInventoryLine[];
  summary: InventorySummary;
  reasonCodes: ManualReviewReasonCode[];
}> {
  const requested = canonicalRequestedInventory(input);
  const reasonCodes: ManualReviewReasonCode[] = [];
  if (requested.invalidQuantity) reasonCodes.push("INVALID_ITEM_QUANTITY");
  const identities = requested.lines.map((item) => item.itemId);
  const records = await findInventoryItems(identities);
  const byIdentity = new Map<string, InventoryRecordForPricing>();
  for (const record of records) {
    byIdentity.set(record.id, record);
    if (record.slug) byIdentity.set(record.slug, record);
  }

  const lines = requested.lines.flatMap((item) => {
    const record = byIdentity.get(item.itemId);
    if (!record) {
      reasonCodes.push("ITEM_NOT_FOUND");
      return [];
    }
    if (!record.isActive) {
      reasonCodes.push("ITEM_INACTIVE");
      return [];
    }

    const metric = metricFromRecord(record);
    if (!metric) {
      reasonCodes.push("ITEM_METRICS_MISSING");
      return [];
    }
    if (metric.confidence === "LOW") reasonCodes.push("ITEM_METRICS_LOW_CONFIDENCE");
    if (metric.specialist) reasonCodes.push("SPECIALIST_ITEM_REQUIRES_REVIEW");

    return [{
      itemId: record.id,
      itemSlug: metric.slug,
      quantity: item.quantity,
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
  routeMetrics: RouteMetrics | null;
  effectiveDate: Date;
  inventory: { lines: ResolvedInventoryLine[] };
  referenceProfile: DynamicReferenceProfile | null;
  lutonCapacityReference: LutonCapacityReferenceSnapshot | null;
  requiredCrew: number;
}): CanonicalPricingInput {
  return {
    pricingAlgorithmVersion: PRICING_ALGORITHM_VERSION,
    pricingCurveVersion: PRICING_CURVE_VERSION,
    itemMetricDatasetVersion: ITEM_METRICS_DATASET_VERSION,
    moveType: params.input.moveType,
    classification: params.classification,
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
        itemMetricVersion: item.metricDatasetVersion,
      }))
      .sort((a, b) => a.itemSlug.localeCompare(b.itemSlug) || a.itemId.localeCompare(b.itemId)),
    customInventory: canonicalCustomInventory(params.input.customItems),
    crewRequirement: {
      requestedMovers: params.input.preferredMovers ?? 1,
      requiredMovers: params.requiredCrew,
    },
    bookingChannel: bookingChannelFromInput(params.input),
    moveDate: params.input.moveDate ?? null,
    effectiveDate: dateOnly(params.effectiveDate),
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

function manualResult(params: {
  reasonCodes: ManualReviewReasonCode[];
  canonicalInput?: CanonicalPricingInput;
  routeMetrics: RouteMetrics | null;
  referenceProfile?: DynamicReferenceProfile | null;
  lutonCapacityReference?: LutonCapacityReferenceSnapshot | null;
  requiredCrew?: number;
  inventory: { lines: ResolvedInventoryLine[]; summary: InventorySummary };
  demandRatios?: DemandRatiosBps;
  explanation?: string;
}): ManualReviewCanonicalPricingResult {
  const reasonCodes = uniqueReasonCodes(params.reasonCodes);
  const serverInputHash = params.canonicalInput ? stableHash(params.canonicalInput) : undefined;
  const explanation = params.explanation ?? "A fixed price cannot be issued automatically for this request.";
  return {
    status: "MANUAL_REVIEW",
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
          serverInputHash,
        }
      : undefined,
    routeMetrics: params.routeMetrics,
    referenceProfile: params.referenceProfile,
    lutonCapacityReference: params.lutonCapacityReference,
    requiredCrew: params.requiredCrew,
    inventory: params.inventory,
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

function multiplyPenceByTwoBpsHalfUp(amountPence: number, firstBps: number, secondBps: number): number {
  const denominator = 100_000_000;
  return Math.floor((amountPence * firstBps * secondBps + Math.floor(denominator / 2)) / denominator);
}

function multiplyPenceByBpsHalfUp(amountPence: number, bps: number): number {
  return Math.floor((amountPence * bps + 5_000) / 10_000);
}

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

function fullLutonLoadTargetPence(distanceMiles: number): number {
  const extraMiles = Math.max(0, Math.ceil(distanceMiles - FULL_LUTON_LOAD_INCLUDED_MILES));
  return LOCAL_FULL_LUTON_LOAD_TARGET_PENCE + extraMiles * FULL_LUTON_LOAD_EXTRA_MILE_PENCE;
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

export function evaluateCanonicalPricing(
  canonicalInput: CanonicalPricingInput,
  benchmarks: CompetitorBenchmarkForPricing[],
  inventory: { lines: ResolvedInventoryLine[]; summary: InventorySummary },
  routeMetrics: RouteMetrics,
  referenceProfile: DynamicReferenceProfile,
  lutonCapacityReference: LutonCapacityReferenceSnapshot,
  effectiveDate: Date
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
    });
  }

  const dimensionMatches = benchmarks.filter((benchmark) => (
    isBenchmarkDimensionMatch(benchmark, canonicalInput) &&
    isDistanceBandMatch(benchmark, distanceMiles)
  ));

  if (dimensionMatches.length === 0) {
    return manualResult({
      reasonCodes: ["MISSING_BENCHMARK"],
      canonicalInput,
      routeMetrics,
      referenceProfile,
      lutonCapacityReference,
      requiredCrew: canonicalInput.crewRequirement.requiredMovers,
      inventory,
    });
  }

  const eligibleMatches = dimensionMatches.filter((benchmark) => isEligibleNow(benchmark, effectiveTime));
  if (eligibleMatches.length === 0) {
    const expiredOnly = dimensionMatches.every((benchmark) => isExpiredAt(benchmark, effectiveTime));
    return manualResult({
      reasonCodes: [expiredOnly ? "EXPIRED_BENCHMARK" : "MISSING_BENCHMARK"],
      canonicalInput,
      routeMetrics,
      referenceProfile,
      lutonCapacityReference,
      requiredCrew: canonicalInput.crewRequirement.requiredMovers,
      inventory,
    });
  }

  if (eligibleMatches.length > 1) {
    return manualResult({
      reasonCodes: ["AMBIGUOUS_BENCHMARK"],
      canonicalInput,
      routeMetrics,
      referenceProfile,
      lutonCapacityReference,
      requiredCrew: canonicalInput.crewRequirement.requiredMovers,
      inventory,
    });
  }

  const benchmark = eligibleMatches[0];
  if (!benchmark || !Number.isSafeInteger(benchmark.benchmarkPricePence) || benchmark.benchmarkPricePence <= 0) {
    return manualResult({
      reasonCodes: ["DATA_UNAVAILABLE"],
      canonicalInput,
      routeMetrics,
      referenceProfile,
      lutonCapacityReference,
      requiredCrew: canonicalInput.crewRequirement.requiredMovers,
      inventory,
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
      explanation: "This inventory is outside the automatic pricing range and requires team review.",
    });
  }

  const adjustmentBps = adjustmentBpsForDemand(demandRatios.effectiveDemandBps);
  const baseTargetBps = BASE_TARGET_BPS[classification];
  const lutonFullLoadTargetPence = fullLutonLoadTargetPence(distanceMiles);
  const lutonLoadPriceFloorPence = multiplyPenceByBpsHalfUp(
    lutonFullLoadTargetPence,
    demandRatios.lutonCapacityDemandBps
  );
  const marketCeilingPence = Math.max(
    benchmark.benchmarkPricePence,
    multiplyPenceByTwoBpsHalfUp(benchmark.benchmarkPricePence, MARKET_CEILING_BPS[classification], 10_000),
    multiplyPenceByBpsHalfUp(lutonFullLoadTargetPence, 12_000)
  );
  const dynamicCandidate = multiplyPenceByTwoBpsHalfUp(
    benchmark.benchmarkPricePence,
    baseTargetBps,
    adjustmentBps
  );
  const totalPence = Math.min(Math.max(dynamicCandidate, lutonLoadPriceFloorPence), marketCeilingPence);
  const actualSavingBps = roundHalfUpRatioBps(benchmark.benchmarkPricePence - totalPence, benchmark.benchmarkPricePence);
  const benchmarkData = benchmarkSnapshot(benchmark);
  const serverInputHash = stableHash({
    ...canonicalInput,
    benchmark: {
      id: benchmark.id,
      pricePence: benchmark.benchmarkPricePence,
      effectiveFrom: benchmarkData.effectiveFrom,
      effectiveTo: benchmarkData.effectiveTo,
    },
    demandRatios,
    adjustmentBps,
    pricingCurveVersion: PRICING_CURVE_VERSION,
    baseTargetBps,
    lutonFullLoadTargetPence,
    lutonLoadPriceFloorPence,
    marketCeilingPence,
    marketCeilingReached: totalPence === marketCeilingPence,
    lutonLoadPriceFloorApplied: totalPence === lutonLoadPriceFloorPence && lutonLoadPriceFloorPence > dynamicCandidate,
    inventorySummary: inventory.summary,
    totalPence,
  });
  const savingPercent = Math.max(
    0,
    Math.round(((benchmark.benchmarkPricePence - totalPence) / benchmark.benchmarkPricePence) * 100)
  );
  const explanation = [
    `Algorithm ${PRICING_ALGORITHM_VERSION}`,
    `classification ${classification}`,
    `benchmark ${benchmark.id}`,
    `reference ${referenceProfile.profileId}@${referenceProfile.profileVersion}`,
    "Price adjusted for inventory size and weight",
  ].join("; ");

  return {
    status: "FIXED",
    totalPence,
    benchmarkPricePence: benchmark.benchmarkPricePence,
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
      baseTargetBps,
      lutonFullLoadTargetPence,
      lutonLoadPriceFloorPence,
      marketCeilingPence,
      marketCeilingReached: totalPence === marketCeilingPence,
      volumeCapacityBps: demandRatios.volumeCapacityBps,
      weightCapacityBps: demandRatios.weightCapacityBps,
      controllingCapacityDimension: demandRatios.controllingCapacityDimension,
      referenceLutonDemandBps: demandRatios.referenceLutonDemandBps,
      relativeCapacityDemandBps: demandRatios.relativeCapacityDemandBps,
      handlingRelativeBps: demandRatios.handlingRelativeBps,
      crewRelativeBps: demandRatios.crewRelativeBps,
      effectiveDemandBps: demandRatios.effectiveDemandBps,
      finalTotalPence: totalPence,
      actualSavingBps,
      serverInputHash,
    },
    routeMetrics,
    referenceProfile,
    lutonCapacityReference,
    requiredCrew: canonicalInput.crewRequirement.requiredMovers,
    demandRatios,
    adjustmentBps,
    baseTargetBps,
    marketCeilingPence,
    inventory,
    breakdown: [{ key: "dynamic_inventory_price", label: "Price adjusted for inventory size and weight", amountPence: totalPence }],
  };
}

export async function calculateCanonicalQuotePricing(
  input: CreateQuoteRequest,
  dependencies: CanonicalPricingDependencies = {}
): Promise<CanonicalPricingResult> {
  const totalStart = monotonicNow();
  const timingMs = emptyTiming();
  const now = dependencies.now ?? new Date();
  const effectiveDate = dateFromMoveDate(input, now);
  const findInventoryItems = dependencies.findInventoryItems ?? defaultFindInventoryItems;
  const findCompetitorBenchmarks = dependencies.findCompetitorBenchmarks ?? defaultFindCompetitorBenchmarks;
  const findVehicleClassConfigs = dependencies.findVehicleClassConfigs ?? defaultFindVehicleClassConfigs;
  const calculateRoute = dependencies.calculateRoute ?? calculateServerRoute;
  const reasonCodes: ManualReviewReasonCode[] = [];
  let inventory: { lines: ResolvedInventoryLine[]; summary: InventorySummary; reasonCodes: ManualReviewReasonCode[] };

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
    const classification = classifyInput(input);
    const propertySize = propertySizeForClassification(input, classification, 0);
    const requiredCrew = requiredCrewFor(classification, input.preferredMovers ?? 1, []);
    const canonicalInput = canonicalInputFor({
      input,
      classification,
      propertySize,
      routeMetrics: null,
      effectiveDate,
      inventory: { lines: [] },
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
  const classification = classifyInput(input);
  if (classification === "UNSUPPORTED") reasonCodes.push("UNSUPPORTED_MOVE_CLASSIFICATION");
  const propertySize = propertySizeForClassification(input, classification, inventory.summary.totalUnits);
  const referenceProfile = classification === "UNSUPPORTED"
    ? null
    : findDynamicReferenceProfile({ classification, moveType: input.moveType, propertySize });
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
    routeMetrics: routeResult.route,
    effectiveDate,
    inventory,
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
    return withTiming(
      manualResult({
        reasonCodes: ["DATA_UNAVAILABLE"],
        canonicalInput,
        routeMetrics: routeResult.route,
        referenceProfile,
        lutonCapacityReference,
        requiredCrew,
        inventory: { lines: inventory.lines, summary: inventory.summary },
        explanation: "Pricing data is temporarily unavailable. Please retry.",
      }),
      timingMs,
      totalStart
    );
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
    effectiveDate
  );
  timingMs.canonicalCalculation += elapsedMs(evaluationStart);
  return withTiming(result, timingMs, totalStart);
}

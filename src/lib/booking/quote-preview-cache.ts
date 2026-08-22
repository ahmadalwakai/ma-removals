import {
  canonicalInventorySignature,
  normalizeCanonicalInventory,
  type CanonicalInventoryInputLine,
} from "@/lib/quotes/canonical-inventory";
import { ITEM_METRICS_DATASET_VERSION } from "@/lib/items/item-metrics-version";
import { PRICING_ALGORITHM_VERSION } from "@/lib/quotes/pricing-version";

export const PRICE_PREVIEW_MAX_QUOTES_PER_REQUEST = 32;
export const PRICE_PREVIEW_SCOPE_VERSION = "quote-preview-scope-v3";

export interface PricePreviewScopeInput {
  inventory: readonly CanonicalInventoryInputLine[];
  customInventory?: readonly { name: string; quantity: number; room: string }[];
  moveType: string;
  propertySize?: string | null;
  pricingClassification?: string | null;
  packingIncluded: boolean;
  serviceLevel: string;
  crew: number | readonly number[];
  pickupWindow?: string | null;
  urgency?: string | null;
  dayType?: string | null;
  waitingMinutes?: number | null;
  dateFlexibility?: {
    flexibleDate?: boolean;
    flexibleTime?: boolean;
    exactTime?: boolean;
    earliestDate?: string | null;
    latestDate?: string | null;
  };
  pickup: unknown;
  destination: unknown;
  additionalStop?: unknown;
  routeIdentity?: string | null;
  distanceMiles?: number | null;
  referenceProfileId?: string | null;
  referenceProfileVersion?: string | null;
  lutonCapacityReferenceId?: string | null;
  lutonCapacityReferenceVersion?: string | null;
  itemMetricDatasetVersion?: string;
  pricingAlgorithmVersion?: string;
  pricingCurveVersion?: string;
  extras?: Record<string, unknown>;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, stableValue(entry)])
  );
}

export function stablePreviewStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

export function canonicalPreviewInventorySignature(
  inventory: readonly CanonicalInventoryInputLine[],
  itemMetricDatasetVersion = ITEM_METRICS_DATASET_VERSION
): string {
  return canonicalInventorySignature(inventory, {
    itemMetricVersion: itemMetricDatasetVersion,
    maxQuantity: 99,
  });
}

export function buildPricePreviewScopeKey(input: PricePreviewScopeInput): string {
  const itemMetricDatasetVersion = input.itemMetricDatasetVersion ?? ITEM_METRICS_DATASET_VERSION;
  const normalizedInventory = normalizeCanonicalInventory(input.inventory, {
    itemMetricVersion: itemMetricDatasetVersion,
    maxQuantity: 99,
  }).lines;
  const customInventory = [...(input.customInventory ?? [])]
    .filter((item) => item.quantity > 0 && item.name.trim())
    .map((item) => ({
      name: item.name.trim(),
      quantity: Math.floor(item.quantity),
      room: item.room,
    }))
    .sort((a, b) => (
      a.name.localeCompare(b.name) ||
      a.room.localeCompare(b.room) ||
      a.quantity - b.quantity
    ));

  return stablePreviewStringify({
    scopeVersion: PRICE_PREVIEW_SCOPE_VERSION,
    pricingAlgorithmVersion: input.pricingAlgorithmVersion ?? PRICING_ALGORITHM_VERSION,
    itemMetricDatasetVersion,
    inventorySignature: normalizedInventory
      .map((item) => `${item.itemId}:${item.room ?? ""}:${item.quantity}:${item.itemMetricVersion}`)
      .join("|"),
    inventory: normalizedInventory,
    itemIds: normalizedInventory.map((item) => item.itemId),
    itemQuantities: Object.fromEntries(
      normalizedInventory.map((item) => [`${item.itemId}:${item.room ?? ""}`, item.quantity])
    ),
    customInventory,
    moveType: input.moveType,
    pricingClassification: input.pricingClassification ?? null,
    propertySize: input.propertySize ?? null,
    packingIncluded: input.packingIncluded,
    serviceLevel: input.serviceLevel,
    crew: input.crew,
    pickupWindow: input.pickupWindow ?? null,
    urgency: input.urgency ?? null,
    dayType: input.dayType ?? null,
    waitingMinutes: input.waitingMinutes ?? null,
    dateFlexibility: input.dateFlexibility ?? {},
    pickup: input.pickup,
    destination: input.destination,
    additionalStop: input.additionalStop ?? null,
    routeIdentity: input.routeIdentity ?? null,
    distanceMiles: input.distanceMiles ?? null,
    referenceProfileId: input.referenceProfileId ?? null,
    referenceProfileVersion: input.referenceProfileVersion ?? null,
    lutonCapacityReferenceId: input.lutonCapacityReferenceId ?? null,
    lutonCapacityReferenceVersion: input.lutonCapacityReferenceVersion ?? null,
    pricingCurveVersion: input.pricingCurveVersion ?? null,
    extras: input.extras ?? {},
  });
}

export function attachPricePreviewScope<T extends { pricingScopeKey?: string | null }>(
  preview: T[],
  pricingScopeKey: string
): T[];
export function attachPricePreviewScope<T extends { pricingScopeKey?: string | null }>(
  preview: T,
  pricingScopeKey: string
): T;
export function attachPricePreviewScope<T extends { pricingScopeKey?: string | null }>(
  preview: T | T[],
  pricingScopeKey: string
): T | T[] {
  if (Array.isArray(preview)) {
    return preview.map((entry) => ({ ...entry, pricingScopeKey }));
  }
  return { ...preview, pricingScopeKey };
}

export function mergePricePreviewRecords<T extends { key: string; pricingScopeKey?: string | null }>(
  current: Record<string, T>,
  previews: T[],
  pricingScopeKey: string
): Record<string, T> {
  const next = { ...current };
  for (const preview of attachPricePreviewScope(previews, pricingScopeKey)) {
    next[preview.key] = preview;
  }
  return next;
}

export function buildPricePreviewChunks<T>(
  dates: readonly string[],
  movers: readonly number[],
  buildQuote: (date: string, movers: number) => T,
  maxQuotesPerRequest = PRICE_PREVIEW_MAX_QUOTES_PER_REQUEST
): Array<{ index: number; dates: string[]; quotes: T[] }> {
  const uniqueDates = Array.from(new Set(dates.filter(Boolean))).sort();
  const quoteEntries = uniqueDates.flatMap((date) => (
    movers.map((moverCount) => ({
      date,
      quote: buildQuote(date, moverCount),
    }))
  ));

  const chunks: Array<{ index: number; dates: string[]; quotes: T[] }> = [];
  for (let start = 0; start < quoteEntries.length; start += maxQuotesPerRequest) {
    const entries = quoteEntries.slice(start, start + maxQuotesPerRequest);
    chunks.push({
      index: chunks.length,
      dates: Array.from(new Set(entries.map((entry) => entry.date))).sort(),
      quotes: entries.map((entry) => entry.quote),
    });
  }
  return chunks;
}

export function filterPricePreviewsByScope<T extends { pricingScopeKey?: string | null }>(
  previews: Record<string, T>,
  pricingScopeKey: string
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(previews).filter(([, preview]) => preview.pricingScopeKey === pricingScopeKey)
  );
}

export function shouldAcceptPricePreviewResponse(params: {
  requestId?: number;
  responseRequestId?: number;
  activeRequestId: number;
  requestAborted?: boolean;
  responsePricingScopeKey?: string | null;
  activePricingScopeKey: string;
}): boolean {
  return (
    !params.requestAborted &&
    (params.requestId ?? params.responseRequestId) === params.activeRequestId &&
    params.responsePricingScopeKey === params.activePricingScopeKey
  );
}

export function canonicalBenchmarkSavingPercent(preview: {
  status?: string | null;
  totalPence?: number | null;
  benchmarkPricePence?: number | null;
  competitorBenchmarkId?: string | null;
} | null | undefined): number | null {
  if (
    preview?.status !== "AUTO_QUOTE" ||
    !preview.competitorBenchmarkId ||
    typeof preview.totalPence !== "number" ||
    typeof preview.benchmarkPricePence !== "number" ||
    !Number.isFinite(preview.totalPence) ||
    !Number.isFinite(preview.benchmarkPricePence) ||
    preview.benchmarkPricePence <= 0
  ) {
    return null;
  }

  const savingPercent = Math.round(
    ((preview.benchmarkPricePence - preview.totalPence) / preview.benchmarkPricePence) * 100
  );
  return Math.max(0, savingPercent);
}

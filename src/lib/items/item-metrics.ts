import itemMetricsDataset from "@/lib/items/item-metrics-v2.json";
import { ITEM_METRICS_DATASET_VERSION as EXPECTED_ITEM_METRICS_DATASET_VERSION } from "@/lib/items/item-metrics-version";

export type ItemMetricConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface ItemMetricV2 {
  slug: string;
  name: string;
  category: string;
  categoryName: string;
  imagePath: string;
  transportedLengthM: number;
  transportedWidthM: number;
  transportedHeightM: number;
  estimatedVolumeM3: number;
  estimatedWeightKg: number;
  handlingMinutes: number;
  bulky: boolean;
  requiresTwoPeople: boolean;
  heavy: boolean;
  specialist: boolean;
  minimumCrew: number;
  confidence: ItemMetricConfidence;
  rationale: string;
}

export interface ItemMetricsDatasetV2 {
  datasetVersion: string;
  generatedFrom: string;
  itemCount: number;
  confidenceCounts: Record<ItemMetricConfidence, number>;
  notes: string[];
  items: ItemMetricV2[];
}

export const ITEM_METRICS_DATASET = itemMetricsDataset as ItemMetricsDatasetV2;
if (ITEM_METRICS_DATASET.datasetVersion !== EXPECTED_ITEM_METRICS_DATASET_VERSION) {
  throw new Error(
    `Unexpected item metrics dataset version: ${ITEM_METRICS_DATASET.datasetVersion}`
  );
}
export const ITEM_METRICS_DATASET_VERSION = EXPECTED_ITEM_METRICS_DATASET_VERSION;

const IMPOSSIBLE_VOLUME_M3 = 20;
const IMPOSSIBLE_WEIGHT_KG = 2_000;
const IMPOSSIBLE_HANDLING_MINUTES = 480;

function assertFiniteRange(
  metric: ItemMetricV2,
  key: keyof Pick<
    ItemMetricV2,
    | "transportedLengthM"
    | "transportedWidthM"
    | "transportedHeightM"
    | "estimatedVolumeM3"
    | "estimatedWeightKg"
    | "handlingMinutes"
    | "minimumCrew"
  >,
  min: number,
  max: number
) {
  const value = metric[key];
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Invalid ${ITEM_METRICS_DATASET_VERSION} metric ${metric.slug}.${key}: ${value}`);
  }
}

export function validateItemMetric(metric: ItemMetricV2): void {
  if (!metric.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metric.slug)) {
    throw new Error(`Invalid ${ITEM_METRICS_DATASET_VERSION} metric slug: ${metric.slug}`);
  }
  if (!metric.name.trim()) throw new Error(`Invalid ${ITEM_METRICS_DATASET_VERSION} item name for ${metric.slug}`);
  if (!["HIGH", "MEDIUM", "LOW"].includes(metric.confidence)) {
    throw new Error(`Invalid ${ITEM_METRICS_DATASET_VERSION} confidence for ${metric.slug}: ${metric.confidence}`);
  }

  assertFiniteRange(metric, "transportedLengthM", 0.01, 5);
  assertFiniteRange(metric, "transportedWidthM", 0.01, 3);
  assertFiniteRange(metric, "transportedHeightM", 0.01, 3);
  assertFiniteRange(metric, "estimatedVolumeM3", 0.005, IMPOSSIBLE_VOLUME_M3);
  assertFiniteRange(metric, "estimatedWeightKg", 0.1, IMPOSSIBLE_WEIGHT_KG);
  assertFiniteRange(metric, "handlingMinutes", 1, IMPOSSIBLE_HANDLING_MINUTES);
  assertFiniteRange(metric, "minimumCrew", 1, 6);

  const calculatedVolume = Math.round(
    metric.transportedLengthM * metric.transportedWidthM * metric.transportedHeightM * 1_000
  ) / 1_000;
  if (Math.abs(calculatedVolume - metric.estimatedVolumeM3) > 0.001) {
    throw new Error(
      `Invalid ${ITEM_METRICS_DATASET_VERSION} volume for ${metric.slug}: ` +
      `${metric.estimatedVolumeM3} does not match ${calculatedVolume}`
    );
  }

  if (metric.requiresTwoPeople && metric.minimumCrew < 2) {
    throw new Error(`Invalid ${ITEM_METRICS_DATASET_VERSION} minimum crew for ${metric.slug}`);
  }
}

export function validateItemMetricsDataset(dataset = ITEM_METRICS_DATASET): ItemMetricsDatasetV2 {
  const seenSlugs = new Set<string>();
  for (const metric of dataset.items) {
    validateItemMetric(metric);
    if (seenSlugs.has(metric.slug)) {
      throw new Error(`Duplicate ${dataset.datasetVersion} metric slug: ${metric.slug}`);
    }
    seenSlugs.add(metric.slug);
  }
  if (seenSlugs.size !== dataset.itemCount) {
    throw new Error(`${dataset.datasetVersion} expected ${dataset.itemCount} items, found ${seenSlugs.size}`);
  }
  return dataset;
}

validateItemMetricsDataset();

export const ITEM_METRICS_BY_SLUG = new Map(
  ITEM_METRICS_DATASET.items.map((metric) => [metric.slug, metric] as const)
);

export function getItemMetricBySlug(slug: string | null | undefined): ItemMetricV2 | null {
  if (!slug) return null;
  return ITEM_METRICS_BY_SLUG.get(slug) ?? null;
}

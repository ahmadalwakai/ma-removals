import { db } from "@/lib/db";
import {
  getFallbackItemCategories,
  type FallbackApiCategory,
  type FallbackApiItem,
} from "@/lib/item-catalog-fallback";
import {
  ITEM_METRICS_BY_SLUG,
  type ItemMetricV2,
} from "@/lib/items/item-metrics";

export type InventoryCatalogSource = "database" | "fallback";

export class CatalogUnavailableError extends Error {
  code = "CATALOG_UNAVAILABLE" as const;
  status = 503;

  constructor(message: string, readonly reason: string) {
    super(message);
    this.name = "CatalogUnavailableError";
  }
}

export type CanonicalApiItem = FallbackApiItem;
export type CanonicalApiCategory = FallbackApiCategory;

export interface CanonicalInventoryRecord {
  id: string;
  slug: string;
  name: string;
  imagePath: string | null;
  weight: string;
  size: string;
  estimatedVolumeM3: number | null;
  estimatedWeightKg: number | null;
  handlingMinutes: number | null;
  requiresTwoPeople: boolean;
  fragile: boolean;
  heavy: boolean;
  specialist: boolean;
  minimumCrew: number | null;
  isActive: boolean;
  category: {
    name: string;
    type: string;
  } | null;
}

interface DatabaseItem {
  id: string;
  name: string;
  slug: string;
  imagePath: string;
  weight: string;
  size: string;
  sortOrder: number;
  estimatedVolumeM3: number | null;
  estimatedWeightKg: number | null;
  handlingMinutes: number | null;
  requiresTwoPeople: boolean;
  fragile: boolean;
  heavy: boolean;
  specialist: boolean;
  minimumCrew: number | null;
  isActive: boolean;
}

interface DatabaseCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  type: string;
  sortOrder: number;
  items: DatabaseItem[];
}

const typeFilters: Record<string, string[]> = {
  residential: ["residential", "both"],
  business: ["business", "both"],
};

function filterForType(type: string | null): string[] {
  return typeFilters[type ?? ""] ?? ["residential", "business", "both"];
}

function metricForCanonicalId(itemId: string): ItemMetricV2 {
  const metric = ITEM_METRICS_BY_SLUG.get(itemId);
  if (!metric) {
    throw new CatalogUnavailableError(
      `Inventory catalog item ${itemId} has no metric record`,
      "MISSING_METRIC"
    );
  }
  return metric;
}

function assertPositiveMetric(metric: ItemMetricV2): void {
  if (
    !Number.isFinite(metric.estimatedVolumeM3) ||
    metric.estimatedVolumeM3 <= 0 ||
    !Number.isFinite(metric.estimatedWeightKg) ||
    metric.estimatedWeightKg <= 0 ||
    !Number.isFinite(metric.handlingMinutes) ||
    metric.handlingMinutes <= 0
  ) {
    throw new CatalogUnavailableError(
      `Inventory catalog metric ${metric.slug} is not priceable`,
      "INVALID_METRIC"
    );
  }
}

function flattenFallbackCategories(categories: readonly CanonicalApiCategory[]): CanonicalApiItem[] {
  return categories.flatMap((category) => category.items);
}

function assertUniqueCanonicalItems(items: readonly { id: string; slug: string }[], source: InventoryCatalogSource): void {
  const ids = new Set<string>();
  const slugs = new Set<string>();

  for (const item of items) {
    if (!item.id || item.id !== item.slug) {
      throw new CatalogUnavailableError(
        `Inventory ${source} catalog has a non-canonical item identity`,
        "NON_CANONICAL_ID"
      );
    }
    if (ids.has(item.id)) {
      throw new CatalogUnavailableError(
        `Inventory ${source} catalog has duplicate item id ${item.id}`,
        "DUPLICATE_ID"
      );
    }
    if (slugs.has(item.slug)) {
      throw new CatalogUnavailableError(
        `Inventory ${source} catalog has duplicate item slug ${item.slug}`,
        "DUPLICATE_SLUG"
      );
    }
    ids.add(item.id);
    slugs.add(item.slug);
  }
}

function assertFallbackCatalog(categories: readonly CanonicalApiCategory[]): void {
  const items = flattenFallbackCategories(categories);
  assertUniqueCanonicalItems(items, "fallback");

  for (const item of items) {
    assertPositiveMetric(metricForCanonicalId(item.id));
  }
}

async function validatedFallbackCategories(type: string | null): Promise<CanonicalApiCategory[]> {
  const allCategories = await getFallbackItemCategories(null);
  assertFallbackCatalog(allCategories);
  const filters = filterForType(type);
  return allCategories.filter((category) => filters.includes(category.type));
}

function canonicalApiItemFromDatabase(item: DatabaseItem): CanonicalApiItem {
  return {
    id: item.slug,
    name: item.name,
    slug: item.slug,
    imagePath: item.imagePath,
    weight: item.weight,
    size: item.size,
    sortOrder: item.sortOrder,
  };
}

function canonicalRecordFromDatabase(item: DatabaseItem, category: DatabaseCategory): CanonicalInventoryRecord {
  return {
    id: item.slug,
    slug: item.slug,
    name: item.name,
    imagePath: item.imagePath,
    weight: item.weight,
    size: item.size,
    estimatedVolumeM3: item.estimatedVolumeM3,
    estimatedWeightKg: item.estimatedWeightKg,
    handlingMinutes: item.handlingMinutes,
    requiresTwoPeople: item.requiresTwoPeople,
    fragile: item.fragile,
    heavy: item.heavy,
    specialist: item.specialist,
    minimumCrew: item.minimumCrew,
    isActive: item.isActive,
    category: {
      name: category.name,
      type: category.type,
    },
  };
}

function canonicalRecordFromFallbackItem(
  item: CanonicalApiItem,
  category: CanonicalApiCategory
): CanonicalInventoryRecord {
  const metric = metricForCanonicalId(item.id);
  assertPositiveMetric(metric);

  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    imagePath: item.imagePath,
    weight: item.weight,
    size: item.size,
    estimatedVolumeM3: null,
    estimatedWeightKg: null,
    handlingMinutes: null,
    requiresTwoPeople: metric.requiresTwoPeople,
    fragile: false,
    heavy: metric.heavy,
    specialist: metric.specialist,
    minimumCrew: metric.minimumCrew,
    isActive: true,
    category: {
      name: category.name,
      type: category.type,
    },
  };
}

async function loadDatabaseCategories(): Promise<DatabaseCategory[]> {
  return await db.itemCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      items: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          imagePath: true,
          weight: true,
          size: true,
          sortOrder: true,
          estimatedVolumeM3: true,
          estimatedWeightKg: true,
          handlingMinutes: true,
          requiresTwoPeople: true,
          fragile: true,
          heavy: true,
          specialist: true,
          minimumCrew: true,
          isActive: true,
        },
      },
    },
  });
}

function assertDatabaseFallbackParity(
  dbCategories: readonly DatabaseCategory[],
  fallbackCategories: readonly CanonicalApiCategory[]
): void {
  const dbItems = dbCategories.flatMap((category) => category.items.map(canonicalApiItemFromDatabase));
  const fallbackItems = flattenFallbackCategories(fallbackCategories);
  assertUniqueCanonicalItems(dbItems, "database");

  const fallbackSlugs = new Set(fallbackItems.map((item) => item.slug));
  const dbSlugs = new Set(dbItems.map((item) => item.slug));

  for (const item of dbItems) {
    if (!fallbackSlugs.has(item.slug)) {
      throw new CatalogUnavailableError(
        `Database inventory item ${item.slug} is missing from fallback catalog`,
        "DATABASE_FALLBACK_MISMATCH"
      );
    }
    assertPositiveMetric(metricForCanonicalId(item.slug));
  }

  for (const item of fallbackItems) {
    if (!dbSlugs.has(item.slug)) {
      throw new CatalogUnavailableError(
        `Fallback inventory item ${item.slug} is missing from database catalog`,
        "DATABASE_FALLBACK_MISMATCH"
      );
    }
  }
}

function canonicalApiCategoriesFromDatabase(
  dbCategories: readonly DatabaseCategory[],
  type: string | null
): CanonicalApiCategory[] {
  const filters = filterForType(type);
  return dbCategories
    .filter((category) => filters.includes(category.type))
    .map((category) => ({
      id: category.slug,
      name: category.name,
      slug: category.slug,
      icon: category.icon,
      type: category.type,
      sortOrder: category.sortOrder,
      items: category.items.map(canonicalApiItemFromDatabase),
    }))
    .filter((category) => category.items.length > 0);
}

function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function sanitizeCatalogError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const databaseUrl = process.env.DATABASE_URL;
  return databaseUrl?.trim() ? message.replace(databaseUrl, "[redacted-database-url]") : message;
}

export async function listBookableItemCategories(type: string | null): Promise<{
  source: InventoryCatalogSource;
  categories: CanonicalApiCategory[];
}> {
  const fallbackCategories = await getFallbackItemCategories(null);
  assertFallbackCatalog(fallbackCategories);

  if (!isDatabaseConfigured()) {
    return {
      source: "fallback",
      categories: fallbackCategories.filter((category) => filterForType(type).includes(category.type)),
    };
  }

  try {
    const dbCategories = await loadDatabaseCategories();
    assertDatabaseFallbackParity(dbCategories, fallbackCategories);
    return {
      source: "database",
      categories: canonicalApiCategoriesFromDatabase(dbCategories, type),
    };
  } catch (error) {
    if (error instanceof CatalogUnavailableError) throw error;
    console.warn("Inventory catalog database unavailable, using validated fallback:", {
      error: sanitizeCatalogError(error),
    });
    return {
      source: "fallback",
      categories: await validatedFallbackCategories(type),
    };
  }
}

export async function fallbackInventoryRecords(itemIds: readonly string[]): Promise<CanonicalInventoryRecord[]> {
  const wanted = new Set(itemIds);
  const categories = await validatedFallbackCategories(null);
  return categories.flatMap((category) => (
    category.items
      .filter((item) => wanted.has(item.id))
      .map((item) => canonicalRecordFromFallbackItem(item, category))
  ));
}

export async function findCanonicalInventoryItemsForPricing(
  itemIds: readonly string[]
): Promise<CanonicalInventoryRecord[]> {
  const uniqueIds = Array.from(new Set(itemIds.map((itemId) => itemId.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  if (!isDatabaseConfigured()) {
    return await fallbackInventoryRecords(uniqueIds);
  }

  const fallbackCategories = await getFallbackItemCategories(null);
  assertFallbackCatalog(fallbackCategories);

  try {
    const dbCategories = await loadDatabaseCategories();
    assertDatabaseFallbackParity(dbCategories, fallbackCategories);
    const wanted = new Set(uniqueIds);
    return dbCategories.flatMap((category) => (
      category.items
        .filter((item) => wanted.has(item.slug))
        .map((item) => canonicalRecordFromDatabase(item, category))
    ));
  } catch (error) {
    if (error instanceof CatalogUnavailableError) throw error;
    console.warn("Inventory pricing catalog database unavailable, using validated fallback:", {
      itemIds: uniqueIds,
      error: sanitizeCatalogError(error),
    });
    return await fallbackInventoryRecords(uniqueIds);
  }
}

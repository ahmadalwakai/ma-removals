import { NextResponse } from "next/server";
import {
  CatalogUnavailableError,
  listBookableItemCategories,
  type CanonicalApiCategory,
  type InventoryCatalogSource,
} from "@/lib/items/catalog";

const ITEM_CACHE_TTL_MS = 5 * 60 * 1000;
const ITEM_CACHE_MAX_ENTRIES = 16;
const CATALOG_RESPONSE_BUDGET_MS = 3_000;

type ItemApiCategory = CanonicalApiCategory;

const itemResponseCache = new Map<string, {
  expiresAt: number;
  categories: ItemApiCategory[];
  source: InventoryCatalogSource;
}>();

function cacheKey(type: string | null) {
  return type ?? "all";
}

function pruneItemCache(now = Date.now()) {
  for (const [key, cached] of itemResponseCache) {
    if (cached.expiresAt <= now) itemResponseCache.delete(key);
  }

  while (itemResponseCache.size >= ITEM_CACHE_MAX_ENTRIES) {
    const oldestKey = itemResponseCache.keys().next().value;
    if (!oldestKey) break;
    itemResponseCache.delete(oldestKey);
  }
}

function cacheCatalogResponse(
  key: string,
  categories: ItemApiCategory[],
  source: InventoryCatalogSource
) {
  pruneItemCache();
  itemResponseCache.set(key, {
    categories,
    source,
    expiresAt: Date.now() + ITEM_CACHE_TTL_MS,
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  promise.catch(() => undefined);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new CatalogUnavailableError("Item catalogue timeout", "TIMEOUT")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function unavailableResponse(error: unknown) {
  const reason = error instanceof CatalogUnavailableError ? error.reason : "UNKNOWN";
  console.warn("Item catalogue unavailable:", { reason });
  return NextResponse.json(
    {
      code: "CATALOG_UNAVAILABLE",
      error: "Inventory catalogue is temporarily unavailable.",
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Items-Source": "unavailable",
        "X-Items-Error": "CATALOG_UNAVAILABLE",
      },
    }
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const key = cacheKey(type);
  pruneItemCache();
  const cached = itemResponseCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.categories, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
        "X-Items-Source": cached.source,
      },
    });
  }

  try {
    const { categories, source } = await withTimeout(
      listBookableItemCategories(type),
      CATALOG_RESPONSE_BUDGET_MS
    );
    cacheCatalogResponse(key, categories, source);

    return NextResponse.json(categories, {
      headers: {
        "Cache-Control": source === "database"
          ? "public, s-maxage=3600, stale-while-revalidate=86400"
          : "public, s-maxage=300, stale-while-revalidate=3600",
        "X-Items-Source": source,
      },
    });
  } catch (error) {
    return unavailableResponse(error);
  }
}

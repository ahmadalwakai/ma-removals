import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getFallbackItemCategories, type FallbackApiCategory } from "@/lib/item-catalog-fallback";

const ITEM_CACHE_TTL_MS = 5 * 60 * 1000;
const DB_RESPONSE_BUDGET_MS = 1000;

type ItemApiCategory = FallbackApiCategory;

const itemResponseCache = new Map<string, {
  expiresAt: number;
  categories: ItemApiCategory[];
  source: "database" | "fallback";
}>();

function cacheKey(type: string | null) {
  return type ?? "all";
}

function cacheResponse(key: string, categories: ItemApiCategory[], source: "database" | "fallback") {
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
        timeout = setTimeout(() => reject(new Error("Item catalogue database timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // residential | business | both | null (all)
  const key = cacheKey(type);
  const cached = itemResponseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.categories, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
        "X-Items-Source": cached.source,
      },
    });
  }

  // Determine which category types to include
  const typeFilter: string[] =
    type === "residential" ? ["residential", "both"] :
    type === "business"    ? ["business",    "both"] :
    ["residential", "business", "both"];

  const dbRequest = db.itemCategory.findMany({
    where: { type: { in: typeFilter } },
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
        },
      },
    },
  });
  dbRequest
    .then((categories) => cacheResponse(key, categories, "database"))
    .catch(() => undefined);

  try {
    const categories = await withTimeout(dbRequest, DB_RESPONSE_BUDGET_MS);
    cacheResponse(key, categories, "database");

    return NextResponse.json(categories, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        "X-Items-Source": "database",
      },
    });
  } catch {
    const categories = await getFallbackItemCategories(type);
    cacheResponse(key, categories, "fallback");

    return NextResponse.json(categories, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        "X-Items-Source": "fallback",
      },
    });
  }
}

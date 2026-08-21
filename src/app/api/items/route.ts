import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getFallbackItemCategories, type FallbackApiCategory } from "@/lib/item-catalog-fallback";

const ITEM_CACHE_TTL_MS = 5 * 60 * 1000;
const ITEM_CACHE_MAX_ENTRIES = 16;
const DB_RESPONSE_BUDGET_MS = 3_000;

type ItemApiCategory = FallbackApiCategory;
type ItemDatabaseStatus = "database" | "missing" | "unreachable" | "rejected" | "incompatible" | "unknown";

const itemResponseCache = new Map<string, {
  expiresAt: number;
  categories: ItemApiCategory[];
  source: "database" | "fallback";
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

function cacheDatabaseResponse(key: string, categories: ItemApiCategory[]) {
  pruneItemCache();
  itemResponseCache.set(key, {
    categories,
    source: "database",
    expiresAt: Date.now() + ITEM_CACHE_TTL_MS,
  });
}

function developmentDatabaseHeaders(status: ItemDatabaseStatus): Record<string, string> {
  return process.env.NODE_ENV === "development"
    ? { "X-Items-Database-Status": status }
    : {};
}

function sanitizeDatabaseError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const databaseUrl = process.env.DATABASE_URL;
  const withoutConfiguredUrl = databaseUrl?.trim()
    ? message.replace(databaseUrl, "[redacted-database-url]")
    : message;
  return withoutConfiguredUrl
    .replace(/postgres(?:ql)?:\/\/[^\s@]+@[^\s]+/gi, "postgresql://[redacted]")
    .replace(/password\s*=\s*[^,\s)]+/gi, "password=[redacted]");
}

function classifyDatabaseError(error: unknown): ItemDatabaseStatus {
  if (!process.env.DATABASE_URL?.trim()) return "missing";
  const message = sanitizeDatabaseError(error).toLowerCase();
  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("could not connect") ||
    message.includes("can't reach database server")
  ) {
    return "unreachable";
  }
  if (
    message.includes("authentication failed") ||
    message.includes("password authentication failed") ||
    message.includes("permission denied") ||
    message.includes("access denied")
  ) {
    return "rejected";
  }
  if (
    message.includes("does not exist") ||
    message.includes("unknown column") ||
    message.includes("relation") ||
    message.includes("prisma client") ||
    message.includes("inconsistent column data")
  ) {
    return "incompatible";
  }
  return "unknown";
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

  // Determine which category types to include
  const typeFilter: string[] =
    type === "residential" ? ["residential", "both"] :
    type === "business"    ? ["business",    "both"] :
    ["residential", "business", "both"];

  if (!process.env.DATABASE_URL?.trim()) {
    const categories = await getFallbackItemCategories(type);
    return NextResponse.json(categories, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        "X-Items-Source": "fallback",
        ...developmentDatabaseHeaders("missing"),
      },
    });
  }

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
    .then((categories) => cacheDatabaseResponse(key, categories))
    .catch((error) => {
      console.warn("Item catalogue background database refresh failed:", {
        status: classifyDatabaseError(error),
        error: sanitizeDatabaseError(error),
      });
    });

  try {
    const categories = await withTimeout(dbRequest, DB_RESPONSE_BUDGET_MS);
    cacheDatabaseResponse(key, categories);

    return NextResponse.json(categories, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        "X-Items-Source": "database",
      },
    });
  } catch (error) {
    const databaseStatus = classifyDatabaseError(error);
    const databaseError = sanitizeDatabaseError(error);
    console.warn("Item catalogue database fallback:", {
      status: databaseStatus,
      error: databaseError,
    });
    const categories = await getFallbackItemCategories(type);

    return NextResponse.json(categories, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        "X-Items-Source": "fallback",
        ...developmentDatabaseHeaders(databaseStatus),
      },
    });
  }
}

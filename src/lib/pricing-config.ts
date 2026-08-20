import { db } from "@/lib/db";

// In-memory cache for serverless (resets per cold start, good enough)
let cachedConfig: Record<string, number> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getPricingConfig(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cachedConfig && now - cacheTimestamp < CACHE_TTL) {
    return cachedConfig;
  }

  const configs = await db.pricingConfig.findMany({ where: { isActive: true } });

  const map: Record<string, number> = {};
  for (const c of configs) {
    map[c.key] = c.value;
  }

  cachedConfig = map;
  cacheTimestamp = now;
  return map;
}

export function getConfigValue(config: Record<string, number>, key: string, fallback: number): number {
  return config[key] ?? fallback;
}

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPricingConfig, getConfigValue } from "@/lib/pricing-config";
import { calculateServiceAddonCharge } from "@/lib/addon-pricing";
import { calculateItemsCharge, type PriceableItem } from "@/lib/item-pricing";
import { calculateDistanceCharge } from "@/lib/distance-pricing";
import type { MoveComplexity } from "@/types/booking";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

function slugKey(s: string): string {
  return s.replace(/-/g, "_").replace(/\s+/g, "_").replace(/[^a-z0-9_]/gi, "").toLowerCase();
}

const VARIANT_KEY_OVERRIDES: Record<string, string> = {
  "5+ Bed": "variant_5_plus_bed",
  "Restaurant/Café": "variant_restaurant",
};

function variantKey(variant: string): string {
  return VARIANT_KEY_OVERRIDES[variant] ?? `variant_${slugKey(variant)}`;
}

const ALWAYS_FULL_SERVICE = new Set([
  "business_removals",
  "hotel_removals",
  "office_removals",
  "piano_moves",
  "packing_service",
]);

function classifyMoveComplexity(
  serviceSlug: string,
  itemCount: number,
  config: Record<string, number>
): MoveComplexity {
  if (ALWAYS_FULL_SERVICE.has(slugKey(serviceSlug))) return "house_removal";
  if (itemCount === 0) return "house_removal";

  const singleThresh = getConfigValue(config, "single_item_threshold", 1);
  const fewThresh = getConfigValue(config, "few_items_threshold", 5);
  const smallThresh = getConfigValue(config, "small_move_threshold", 10);

  if (itemCount <= singleThresh) return "single_item";
  if (itemCount <= fewThresh) return "few_items";
  if (itemCount <= smallThresh) return "small_move";
  return "house_removal";
}

function getComplexityBaseFee(
  complexity: MoveComplexity,
  serviceSlug: string,
  serviceVariant: string | null | undefined,
  config: Record<string, number>
): number {
  if (complexity === "house_removal") {
    const serviceKey = `base_${slugKey(serviceSlug)}`;
    let base = getConfigValue(config, serviceKey, 35.91);
    if (serviceVariant) {
      const varKey = variantKey(serviceVariant);
      const mul = getConfigValue(config, varKey, 1.0);
      base = Math.round(base * mul * 100) / 100;
    }
    return base;
  }

  const defaults: Record<Exclude<MoveComplexity, "house_removal">, number> = {
    single_item: 23.94,
    few_items: 32.92,
    small_move: 50.87,
  };
  return getConfigValue(config, `${complexity}_base_fee`, defaults[complexity]);
}

function getMinimumTotal(complexity: MoveComplexity, config: Record<string, number>): number {
  if (complexity === "house_removal") return 0;
  const defaults: Record<Exclude<MoveComplexity, "house_removal">, number> = {
    single_item: 26.93,
    few_items: 35.91,
    small_move: 50.87,
  };
  return getConfigValue(config, `${complexity}_minimum_total`, defaults[complexity]);
}

function jsonItemsToPriceable(items: unknown): PriceableItem[] {
  if (!Array.isArray(items)) return [];

  return items.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];

    const record = entry as Record<string, unknown>;
    const quantity = Number(record.quantity ?? record.qty ?? 0);
    if (!Number.isFinite(quantity) || quantity <= 0) return [];

    return [{
      name: typeof record.name === "string" ? record.name : undefined,
      quantity,
      imagePath: typeof record.imagePath === "string" ? record.imagePath : undefined,
      weightKg: typeof record.weightKg === "number" ? record.weightKg : undefined,
    }];
  });
}

/**
 * POST /api/admin/bookings/[id]/recalculate
 * Returns a new price given updated booking fields.
 * Does NOT modify the database.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      bookingItems: {
        include: {
          item: {
            select: {
              name: true,
              imagePath: true,
            },
          },
        },
      },
    },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as {
    serviceSlug?: string;
    serviceVariant?: string | null;
    distanceMiles?: number;
    pickupFloor?: number;
    pickupHasLift?: boolean;
    dropoffFloor?: number;
    dropoffHasLift?: boolean;
    helpersCount?: number;
    needsPacking?: boolean;
    needsAssembly?: boolean;
    scheduledDate?: string;
  };

  // Merge with existing booking values for any missing fields
  const serviceSlug = body.serviceSlug ?? booking.serviceSlug;
  const serviceVariant = "serviceVariant" in body ? body.serviceVariant : booking.serviceVariant;
  const distanceMiles = body.distanceMiles ?? booking.distanceMiles;
  const pickupFloor = body.pickupFloor ?? booking.pickupFloor;
  const pickupHasLift = body.pickupHasLift ?? booking.pickupHasLift;
  const dropoffFloor = body.dropoffFloor ?? booking.dropoffFloor;
  const dropoffHasLift = body.dropoffHasLift ?? booking.dropoffHasLift;
  const helpersCount = body.helpersCount ?? booking.helpersCount;
  const needsPacking = body.needsPacking ?? booking.needsPacking;
  const needsAssembly = body.needsAssembly ?? booking.needsAssembly;
  const scheduledDate = body.scheduledDate ? new Date(body.scheduledDate) : booking.scheduledDate;

  const config = await getPricingConfig();
  const relationItems: PriceableItem[] = booking.bookingItems.map((bookingItem) => ({
    name: bookingItem.item.name,
    imagePath: bookingItem.item.imagePath,
    quantity: bookingItem.quantity,
  }));
  const items = relationItems.length > 0 ? relationItems : jsonItemsToPriceable(booking.items);

  const totalItemUnits = items.reduce(
    (sum, item) => sum + Math.max(0, Math.floor(item.quantity ?? 0)),
    0
  );
  const complexity = classifyMoveComplexity(serviceSlug, totalItemUnits, config);

  // 1. Base price
  const basePrice = getComplexityBaseFee(complexity, serviceSlug, serviceVariant, config);

  // 3. Distance surcharge
  const distanceCharge = calculateDistanceCharge(distanceMiles, config);
  const distanceSurcharge = distanceCharge.total;

  // 4. Floor surcharge
  const floorRate = getConfigValue(config, "floor_surcharge_per_floor", 9.58);
  const noLiftRate = getConfigValue(config, "no_lift_surcharge", 14.36);
  let floorSurcharge = 0;
  floorSurcharge += pickupFloor * floorRate;
  floorSurcharge += dropoffFloor * floorRate;
  if (pickupFloor > 0 && !pickupHasLift) floorSurcharge += noLiftRate;
  if (dropoffFloor > 0 && !dropoffHasLift) floorSurcharge += noLiftRate;

  // 5. Helpers & add-ons
  const helperPrice = getConfigValue(config, "helper_price", 21.55);
  const helpersSurcharge = helpersCount * helperPrice;
  const packingCharge = needsPacking
    ? calculateServiceAddonCharge("packing", {
        config,
        items,
        serviceType: serviceSlug,
        serviceVariant,
      })
    : null;
  const assemblyCharge = needsAssembly
    ? calculateServiceAddonCharge("assembly", {
        config,
        items,
        serviceType: serviceSlug,
        serviceVariant,
      })
    : null;
  const packingSurcharge = packingCharge?.total ?? 0;
  const assemblySurcharge = assemblyCharge?.total ?? 0;

  const itemPerKg = getConfigValue(config, "item_price_per_kg", 0.24);
  const itemMin = getConfigValue(config, "item_min_charge", 3.83);
  const itemsCharge = calculateItemsCharge(items, { perKg: itemPerKg, minPerItem: itemMin });

  const rawSubtotal =
    basePrice +
    distanceSurcharge +
    floorSurcharge +
    helpersSurcharge +
    packingSurcharge +
    assemblySurcharge +
    itemsCharge.total;
  const minimumAdjust = Math.max(0, Math.ceil(getMinimumTotal(complexity, config) - rawSubtotal));
  const staticSubtotal = Math.round((rawSubtotal + minimumAdjust) * 100) / 100;

  // 6. Date multipliers
  const now = new Date();
  const daysUntil = Math.floor((scheduledDate.getTime() - now.getTime()) / 86400000);
  const urgencyToday = getConfigValue(config, "urgency_today", 1.40);
  const urgencyTomorrow = getConfigValue(config, "urgency_tomorrow", 1.20);
  const urgency2Days = getConfigValue(config, "urgency_2_days", 1.10);
  const weekendMul = getConfigValue(config, "weekend_multiplier", 1.15);
  const peakMul = getConfigValue(config, "peak_month_multiplier", 1.10);

  let urgMul = 1.0;
  if (daysUntil <= 0) urgMul = urgencyToday;
  else if (daysUntil === 1) urgMul = urgencyTomorrow;
  else if (daysUntil === 2) urgMul = urgency2Days;

  const dayOfWeek = scheduledDate.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const monthIdx = scheduledDate.getMonth();
  const isPeak = [5, 6, 7].includes(monthIdx);

  let calMul = 1.0;
  if (isWeekend) calMul *= weekendMul;
  if (isPeak) calMul *= peakMul;

  const newPrice = Math.round(staticSubtotal * urgMul * calMul);

  return NextResponse.json({
    newPrice,
    originalPrice: booking.quotedPrice,
    totalPaid: booking.totalPaid,
    breakdown: {
      basePrice,
      moveComplexity: complexity,
      distanceSurcharge,
      floorSurcharge,
      helpersSurcharge,
      packingSurcharge,
      assemblySurcharge,
      packingItems: packingCharge?.totalUnits ?? 0,
      assemblyItems: assemblyCharge?.totalUnits ?? 0,
      itemsSurcharge: itemsCharge.total,
      itemUnits: itemsCharge.totalUnits,
      itemKg: itemsCharge.totalKg,
      minimumAdjust,
      staticSubtotal,
      urgencyMultiplier: urgMul,
      calendarMultiplier: calMul,
    },
  });
}

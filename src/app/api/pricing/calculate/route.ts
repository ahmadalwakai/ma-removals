import { type NextRequest, NextResponse } from "next/server";
import { getPricingConfig, getConfigValue } from "@/lib/pricing-config";
import { getWeatherForecast, getWeatherSurchargeKey } from "@/lib/weather";
import { calculateItemsCharge, type PriceableItem } from "@/lib/item-pricing";
import { calculateServiceAddonCharge, formatAddonChargeLabel } from "@/lib/addon-pricing";
import { calculateDistanceCharge } from "@/lib/distance-pricing";
import {
  isScotlandAddress,
  SCOTLAND_PICKUP_MESSAGE,
} from "@/lib/service-area";
import { addDays, format, isWeekend, getMonth, getDaysInMonth, getDate } from "date-fns";
import type { DayAdjustment, DayPrice, MoveComplexity, PricingLineItem } from "@/types/booking";

interface PriceRequest {
  serviceType: string;
  serviceVariant?: string | null;
  distanceMiles: number;
  pickupFloor: number;
  pickupHasLift: boolean;
  dropoffFloor: number;
  dropoffHasLift: boolean;
  helpersCount: number;
  needsPacking: boolean;
  needsAssembly: boolean;
  pickupLat: number;
  pickupLng: number;
  pickupPostcode?: string;
  pickupRegion?: string;
  pickupCountry?: string;
  pickupFullAddress?: string;
  moveDateFlexible?: boolean;
  items?: PriceableItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function fmtServiceName(slug: string): string {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// ---------------------------------------------------------------------------
// Move complexity classifier
// ---------------------------------------------------------------------------

/**
 * Services where item count does NOT drive the base price. A normal house move
 * is intentionally not in this list: if the customer adds only a few items from
 * a house, price it as a few-item move instead of a full property removal.
 */
const FULL_HOUSE_SERVICES = new Set([
  "business_removals",
  "hotel_removals",
  "office_removals",
  "piano_moves",   // always specialist regardless of item count
  "packing_service",
]);

const COMPLEXITY_LABELS: Record<MoveComplexity, string> = {
  single_item:   "Single item move",
  few_items:     "Few items move",
  small_move:    "Small move",
  house_removal: "House removal",
};

function classifyMoveComplexity(
  serviceSlug: string,
  itemCount: number,
  config: Record<string, number>
): MoveComplexity {
  // Services that are full-house by nature bypass classifier.
  if (FULL_HOUSE_SERVICES.has(slugKey(serviceSlug))) return "house_removal";

  // No items declared → unknown load; keep full service price for safety.
  if (itemCount === 0) return "house_removal";

  const singleThresh = getConfigValue(config, "single_item_threshold", 1);
  const fewThresh    = getConfigValue(config, "few_items_threshold",    5);
  const smallThresh  = getConfigValue(config, "small_move_threshold",   10);

  if (itemCount <= singleThresh) return "single_item";
  if (itemCount <= fewThresh)    return "few_items";
  if (itemCount <= smallThresh)  return "small_move";
  return "house_removal";
}

function getComplexityBaseFee(
  complexity: MoveComplexity,
  serviceSlug: string,
  serviceVariant: string | null | undefined,
  config: Record<string, number>
): number {
  if (complexity === "house_removal") {
    // Use the service-specific base price with optional variant multiplier.
    const serviceKey = `base_${slugKey(serviceSlug)}`;
    let base = getConfigValue(config, serviceKey, 53.87);
    if (serviceVariant) {
      const mul = getConfigValue(config, variantKey(serviceVariant), 1.0);
      base = Math.round(base * mul * 100) / 100;
    }
    return base;
  }

  const defaults: Record<Exclude<MoveComplexity, "house_removal">, number> = {
    single_item: 23.94,
    few_items:   32.92,
    small_move:  50.87,
  };
  return getConfigValue(config, `${complexity}_base_fee`, defaults[complexity]);
}

function getMinimumTotal(complexity: MoveComplexity, config: Record<string, number>): number {
  if (complexity === "house_removal") return 0;
  const defaults: Record<Exclude<MoveComplexity, "house_removal">, number> = {
    single_item: 26.93,
    few_items:   35.91,
    small_move:  50.87,
  };
  return getConfigValue(config, `${complexity}_minimum_total`, defaults[complexity]);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body: PriceRequest = await req.json();

    if (!isScotlandAddress({
      postcode: body.pickupPostcode,
      region: body.pickupRegion,
      country: body.pickupCountry,
      fullAddress: body.pickupFullAddress,
      lat: body.pickupLat,
      lng: body.pickupLng,
    })) {
      return NextResponse.json(
        { success: false, error: SCOTLAND_PICKUP_MESSAGE },
        { status: 422 }
      );
    }

    const config = await getPricingConfig();

    // 1. Real item count — sum of all quantities, not just row count.
    const items = body.items ?? [];
    const totalItemUnits = items.reduce(
      (s, i) => s + Math.max(0, Math.floor(i.quantity ?? 0)),
      0
    );

    // 2. Classify move complexity.
    const complexity = classifyMoveComplexity(body.serviceType, totalItemUnits, config);
    const complexityLabel = COMPLEXITY_LABELS[complexity];

    // 3. Base fee driven by complexity, not raw service×variant for small moves.
    const baseFee = getComplexityBaseFee(
      complexity,
      body.serviceType,
      body.serviceVariant,
      config
    );

    // 4. Distance surcharge.
    const distanceCharge = calculateDistanceCharge(body.distanceMiles, config);
    const distanceSurcharge = distanceCharge.total;

    // 5. Floor / no-lift surcharge.
    const floorRate  = getConfigValue(config, "floor_surcharge_per_floor", 9.58);
    const noLiftRate = getConfigValue(config, "no_lift_surcharge",         14.36);
    let floorSurcharge = 0;
    floorSurcharge += body.pickupFloor  * floorRate;
    floorSurcharge += body.dropoffFloor * floorRate;
    if (body.pickupFloor  > 0 && !body.pickupHasLift)  floorSurcharge += noLiftRate;
    if (body.dropoffFloor > 0 && !body.dropoffHasLift) floorSurcharge += noLiftRate;

    // 6. Helpers & add-ons.
    const helperPrice      = getConfigValue(config, "helper_price",       21.55);
    const helpersSurcharge = body.helpersCount * helperPrice;
    const packingCharge = body.needsPacking
      ? calculateServiceAddonCharge("packing", {
          config,
          items,
          serviceType: body.serviceType,
          serviceVariant: body.serviceVariant,
        })
      : null;
    const assemblyCharge = body.needsAssembly
      ? calculateServiceAddonCharge("assembly", {
          config,
          items,
          serviceType: body.serviceType,
          serviceVariant: body.serviceVariant,
        })
      : null;
    const packingSurcharge = packingCharge?.total ?? 0;
    const assemblySurcharge = assemblyCharge?.total ?? 0;

    // 7. Weight-based item handling charge.
    const itemPerKg   = getConfigValue(config, "item_price_per_kg", 0.24);
    const itemMin     = getConfigValue(config, "item_min_charge",   3.83);
    const itemsCharge = calculateItemsCharge(items, { perKg: itemPerKg, minPerItem: itemMin });

    // 8. Raw subtotal and minimum-total enforcement.
    const rawSubtotal      = baseFee + distanceSurcharge + floorSurcharge + helpersSurcharge + packingSurcharge + assemblySurcharge + itemsCharge.total;
    const minimumTotal     = getMinimumTotal(complexity, config);
    const minimumAdjust    = Math.max(0, Math.ceil(minimumTotal - rawSubtotal));
    const staticSubtotal   = Math.max(rawSubtotal + minimumAdjust, 0);

    // 9. Build static line items (same for every date).
    const staticLineItems: PricingLineItem[] = [];

    // Move-type badge (info row — no amount rendered).
    staticLineItems.push({ label: `Move type: ${complexityLabel}`, amount: 0, type: "info" });

    // Base fee label differs by complexity.
    if (complexity === "house_removal") {
      const serviceName = fmtServiceName(body.serviceType);
      const variantSuffix = body.serviceVariant ? ` (${body.serviceVariant})` : "";
      staticLineItems.push({ label: `${serviceName}${variantSuffix}`, amount: baseFee, type: "base" });
    } else {
      staticLineItems.push({ label: "Base fee", amount: baseFee, type: "base" });
    }

    if (distanceSurcharge > 0) {
      const distanceLabel =
        distanceCharge.fees.length > 0
          ? `Distance + long-distance operating (${distanceCharge.distanceMiles.toFixed(1)} mi)`
          : `Distance (${distanceCharge.distanceMiles.toFixed(1)} mi)`;
      staticLineItems.push({ label: distanceLabel, amount: distanceSurcharge, type: "surcharge" });
    }
    if (floorSurcharge > 0)
      staticLineItems.push({ label: "Floor / no lift", amount: floorSurcharge, type: "surcharge" });
    if (helpersSurcharge > 0)
      staticLineItems.push({ label: `${body.helpersCount} helper${body.helpersCount > 1 ? "s" : ""}`, amount: helpersSurcharge, type: "surcharge" });
    if (packingCharge && packingSurcharge > 0)
      staticLineItems.push({
        label: formatAddonChargeLabel("Packing service", packingCharge),
        amount: packingSurcharge,
        type: "surcharge",
      });
    if (assemblyCharge && assemblySurcharge > 0)
      staticLineItems.push({
        label: formatAddonChargeLabel("Dismantling / reassembly", assemblyCharge),
        amount: assemblySurcharge,
        type: "surcharge",
      });
    if (itemsCharge.total > 0)
      staticLineItems.push({
        label: `Items (${itemsCharge.totalUnits} item${itemsCharge.totalUnits > 1 ? "s" : ""} · ${itemsCharge.totalKg} kg)`,
        amount: itemsCharge.total,
        type: "surcharge",
      });
    if (minimumAdjust > 0)
      staticLineItems.push({ label: "Minimum price adjustment", amount: minimumAdjust, type: "surcharge" });

    // 10. Calendar / urgency multiplier config.
    const weekendMul      = getConfigValue(config, "weekend_multiplier",      1.15);
    const peakMul         = getConfigValue(config, "peak_month_multiplier",   1.10);
    const eomMul          = getConfigValue(config, "end_of_month_multiplier", 1.08);
    const urgencyToday    = getConfigValue(config, "urgency_today",           1.40);
    const urgencyTomorrow = getConfigValue(config, "urgency_tomorrow",        1.20);
    const urgency2Days    = getConfigValue(config, "urgency_2_days",          1.10);
    const morningMul      = getConfigValue(config, "timeslot_morning",        1.05);
    const afternoonMul    = getConfigValue(config, "timeslot_afternoon",      1.00);
    const eveningMul      = getConfigValue(config, "timeslot_evening",        1.10);
    const maxCombinedMul  = getConfigValue(config, "max_combined_multiplier", 1.80);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: DayPrice[] = [];
    const startDayOffset = body.moveDateFlexible ? 3 : 0;

    for (let i = 0; i < 14; i++) {
      const dayOffset = startDayOffset + i;
      const date     = addDays(today, dayOffset);
      const dateStr  = format(date, "yyyy-MM-dd");
      const dayName  = format(date, "EEE");
      const dayNum   = getDate(date);
      const month    = format(date, "MMM");
      const wkend    = isWeekend(date);
      const monthIdx = getMonth(date); // 0-indexed
      const isPeak   = [5, 6, 7].includes(monthIdx);
      const isEOM    = dayNum > getDaysInMonth(date) - 3;

      // Urgency multiplier.
      let urgMul = 1.0;
      if (dayOffset === 0)      urgMul = urgencyToday;
      else if (dayOffset === 1) urgMul = urgencyTomorrow;
      else if (dayOffset === 2) urgMul = urgency2Days;

      // Calendar compound.
      let calMul = 1.0;
      if (wkend)  calMul *= weekendMul;
      if (isPeak) calMul *= peakMul;
      if (isEOM)  calMul *= eomMul;

      const rawCombined = urgMul * calMul;
      const combinedMul = Math.min(rawCombined, maxCombinedMul);
      const wasCapped   = combinedMul < rawCombined;

      // Weather surcharge — flat addition after multipliers.
      const weather        = await getWeatherForecast(body.pickupLat, body.pickupLng, date);
      const wKey           = getWeatherSurchargeKey(weather.condition);
      const weatherSurcharge = wKey ? getConfigValue(config, wKey, 0) : 0;

      const preMul = staticSubtotal * combinedMul + weatherSurcharge;
      const prices = {
        morning:   Math.max(0, Math.round(preMul * morningMul)),
        afternoon: Math.max(0, Math.round(preMul * afternoonMul)),
        evening:   Math.max(0, Math.round(preMul * eveningMul)),
      };
      const cheapest = Math.min(prices.morning, prices.afternoon, prices.evening);

      // Build day-level adjustment lines for the breakdown UI.
      // Amounts are informational (based on staticSubtotal × individual factor);
      // they do not need to sum exactly — `prices[slot]` is always authoritative.
      const dayAdjustments: DayAdjustment[] = [];

      if (urgMul > 1) {
        const urgLabel =
          i === 0 ? "Same-day surcharge" :
          i === 1 ? "Next-day surcharge" :
                    "Short-notice surcharge";
        dayAdjustments.push({
          label:  urgLabel,
          amount: Math.round(staticSubtotal * (urgMul - 1)),
          type:   "surcharge",
        });
      }
      if (wkend) {
        dayAdjustments.push({
          label:  "Weekend rate",
          amount: Math.round(staticSubtotal * (weekendMul - 1)),
          type:   "surcharge",
        });
      }
      if (isPeak) {
        dayAdjustments.push({
          label:  "Summer peak rate",
          amount: Math.round(staticSubtotal * (peakMul - 1)),
          type:   "surcharge",
        });
      }
      if (isEOM) {
        dayAdjustments.push({
          label:  "End of month rate",
          amount: Math.round(staticSubtotal * (eomMul - 1)),
          type:   "surcharge",
        });
      }
      if (wasCapped) {
        const savedAmount = Math.round(staticSubtotal * (rawCombined - combinedMul));
        dayAdjustments.push({
          label:  "Price cap saving",
          amount: -savedAmount,
          type:   "discount",
        });
      }
      if (weatherSurcharge > 0) {
        dayAdjustments.push({
          label:  `Weather (${weather.description})`,
          amount: weatherSurcharge,
          type:   "surcharge",
        });
      }

      days.push({
        date: dateStr,
        dayName,
        dayNumber: dayNum,
        month,
        prices,
        cheapest,
        tier: "mid", // recalculated below
        isToday:   dayOffset === 0,
        isTomorrow: dayOffset === 1,
        isWeekend:  wkend,
        weather: {
          condition:   weather.condition,
          description: weather.description,
          icon:        weather.icon,
          surcharge:   weatherSurcharge,
        },
        dayAdjustments,
        multipliers: {
          urgency:  urgMul,
          calendar: calMul,
          combined: combinedMul,
          capped:   wasCapped,
        },
      });
    }

    // Tier bands (tertiles across the 14-day window).
    const sorted = [...days.map((d) => d.cheapest)].sort((a, b) => a - b);
    const t1 = sorted[Math.floor(sorted.length / 3)]!;
    const t2 = sorted[sorted.length - 1 - Math.floor(sorted.length / 3)]!;
    for (const day of days) {
      if (day.cheapest <= t1)      day.tier = "cheap";
      else if (day.cheapest >= t2) day.tier = "expensive";
      else                          day.tier = "mid";
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          days,
          staticLineItems,
          staticSubtotal,
          moveComplexity: complexity,
          moveComplexityLabel: complexityLabel,
          currency: "GBP",
          symbol: "£",
        },
      },
      { headers: { "Cache-Control": "private, max-age=60" } }
    );
  } catch (err) {
    console.error("Pricing calculation error:", err);
    return NextResponse.json({ success: false, error: "Failed to calculate pricing" }, { status: 500 });
  }
}

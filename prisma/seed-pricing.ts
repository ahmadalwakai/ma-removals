import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const db = new PrismaClient({ adapter });

const pricingDefaults = [
  // -------------------------------------------------------------------------
  // Move-complexity base fees (used instead of service base for small moves)
  // -------------------------------------------------------------------------
  { key: "single_item_base_fee",   value: 23.94, category: "complexity", description: "Base fee for a single-item move" },
  { key: "few_items_base_fee",     value: 32.92, category: "complexity", description: "Base fee for 2–5 item moves" },
  { key: "small_move_base_fee",    value: 50.87, category: "complexity", description: "Base fee for 6–10 item moves" },

  // Thresholds (item count) for each complexity band
  { key: "single_item_threshold",  value: 1,    category: "complexity", description: "Max items classified as single-item move" },
  { key: "few_items_threshold",    value: 5,    category: "complexity", description: "Max items classified as few-items move" },
  { key: "small_move_threshold",   value: 10,   category: "complexity", description: "Max items classified as small move" },

  // Minimum total price enforced per complexity
  { key: "single_item_minimum_total", value: 26.93, category: "complexity", description: "Minimum total for single-item moves" },
  { key: "few_items_minimum_total",   value: 35.91, category: "complexity", description: "Minimum total for few-items moves" },
  { key: "small_move_minimum_total",  value: 50.87, category: "complexity", description: "Minimum total for small moves" },

  // -------------------------------------------------------------------------
  // Base prices per service (house-removal / full-service jobs only)
  // -------------------------------------------------------------------------
  { key: "base_house_move",           value: 105.34, category: "base",     description: "Base price for house move" },
  { key: "base_van_with_man",         value: 35.91,  category: "base",     description: "Base price for van with man" },
  { key: "base_furniture_removals",   value: 43.09,  category: "base",     description: "Base price for furniture removals" },
  { key: "base_deliveries",           value: 26.33,  category: "base",     description: "Base price for deliveries" },
  { key: "base_business_removals",    value: 105.34, category: "base",     description: "Base price for business removals" },
  { key: "base_hotel_removals",       value: 62.24,  category: "base",     description: "Base price for hotel removals" },
  { key: "base_office_removals",      value: 95.76,  category: "base",     description: "Base price for office removals" },
  { key: "base_piano_moves",          value: 71.82,  category: "base",     description: "Base price for piano moves" },
  { key: "base_packing_service",      value: 28.73,  category: "base",     description: "Base price for packing service" },
  { key: "base_storage",              value: 17.96,  category: "base",     description: "Base price for storage service" },

  // -------------------------------------------------------------------------
  // Bedroom variant multipliers (applied to house-removal base only)
  // -------------------------------------------------------------------------
  { key: "variant_studio",            value: 0.7,  category: "variant",  description: "Studio multiplier" },
  { key: "variant_1_bed",             value: 1.0,  category: "variant",  description: "1 bed multiplier" },
  { key: "variant_2_bed",             value: 1.3,  category: "variant",  description: "2 bed multiplier" },
  { key: "variant_3_bed",             value: 1.6,  category: "variant",  description: "3 bed multiplier" },
  { key: "variant_4_bed",             value: 2.0,  category: "variant",  description: "4 bed multiplier" },
  { key: "variant_5_plus_bed",        value: 2.5,  category: "variant",  description: "5+ bed multiplier" },

  // Business variant multipliers
  { key: "variant_small_office",      value: 1.0,  category: "variant",  description: "Small office multiplier" },
  { key: "variant_medium_office",     value: 1.5,  category: "variant",  description: "Medium office multiplier" },
  { key: "variant_large_office",      value: 2.2,  category: "variant",  description: "Large office multiplier" },
  { key: "variant_retail_shop",       value: 1.3,  category: "variant",  description: "Retail shop multiplier" },
  { key: "variant_restaurant",        value: 1.8,  category: "variant",  description: "Restaurant/cafe multiplier" },
  { key: "variant_warehouse",         value: 2.5,  category: "variant",  description: "Warehouse multiplier" },

  // -------------------------------------------------------------------------
  // Distance
  // -------------------------------------------------------------------------
  { key: "price_per_mile",            value: 0.96, category: "distance", description: "Price per mile (miles 6–20)" },
  { key: "price_per_mile_after_20",   value: 0.72, category: "distance", description: "Legacy price per mile after 20 miles" },
  { key: "price_per_mile_20_100",     value: 1.05, category: "distance", description: "Price per mile for miles 21-100" },
  { key: "price_per_mile_100_250",    value: 0.93, category: "distance", description: "Price per mile for miles 101-250" },
  { key: "price_per_mile_after_250",  value: 0.81, category: "distance", description: "Price per mile after 250 miles" },
  { key: "free_miles",                value: 5,    category: "distance", description: "First N miles included in base" },
  { key: "long_distance_fee_100",     value: 26.93, category: "distance", description: "Operating fee once route reaches 100 miles" },
  { key: "long_distance_fee_250",     value: 56.86, category: "distance", description: "Additional operating fee once route reaches 250 miles" },
  { key: "long_distance_fee_400",     value: 95.76, category: "distance", description: "Additional operating fee once route reaches 400 miles" },

  // -------------------------------------------------------------------------
  // Floor access
  // -------------------------------------------------------------------------
  { key: "floor_surcharge_per_floor", value: 9.58,  category: "floor",    description: "Surcharge per floor above ground" },
  { key: "no_lift_surcharge",         value: 14.36, category: "floor",    description: "Additional surcharge if no lift" },

  // -------------------------------------------------------------------------
  // Urgency multipliers
  // -------------------------------------------------------------------------
  { key: "urgency_today",             value: 1.25, category: "urgency",  description: "Same-day booking multiplier" },
  { key: "urgency_tomorrow",          value: 1.12, category: "urgency",  description: "Next-day booking multiplier" },
  { key: "urgency_2_days",            value: 1.06, category: "urgency",  description: "2 days out multiplier" },

  // -------------------------------------------------------------------------
  // Time-of-day slot multipliers
  // -------------------------------------------------------------------------
  { key: "timeslot_morning",          value: 1.05, category: "timeslot", description: "Morning slot (8am–12pm) multiplier" },
  { key: "timeslot_afternoon",        value: 1.00, category: "timeslot", description: "Afternoon slot (12pm–4pm) multiplier" },
  { key: "timeslot_evening",          value: 1.10, category: "timeslot", description: "Evening slot (4pm–8pm) multiplier" },

  // -------------------------------------------------------------------------
  // Weather surcharges (flat £ additions)
  // -------------------------------------------------------------------------
  { key: "weather_rain_surcharge",    value: 9.58,  category: "weather",  description: "Light rain surcharge" },
  { key: "weather_heavy_rain",        value: 14.36, category: "weather",  description: "Heavy rain surcharge" },
  { key: "weather_snow_surcharge",    value: 21.55, category: "weather",  description: "Snow surcharge" },
  { key: "weather_storm_surcharge",   value: 26.33, category: "weather",  description: "Storm / severe weather surcharge" },

  // -------------------------------------------------------------------------
  // Helpers & add-ons
  // -------------------------------------------------------------------------
  { key: "helper_price",              value: 21.55, category: "helpers",  description: "Price per additional helper" },

  // -------------------------------------------------------------------------
  // Instant quote operational controls
  // -------------------------------------------------------------------------
  { key: "labour_hourly_rate",         value: 20.95, category: "instant_quote", description: "Hourly labour rate per mover for full-service moves" },
  { key: "inventory_handling_per_minute", value: 0.48, category: "instant_quote", description: "Per handling minute charge for item-led moves where labour is bundled into the base" },
  { key: "access_difficulty_unit",     value: 2.39, category: "instant_quote", description: "Price per access difficulty point" },
  { key: "additional_stop_fee",        value: 14.96, category: "instant_quote", description: "Additional stop charge" },
  { key: "optional_service_unit",      value: 10.77, category: "instant_quote", description: "Small operational charge for selected optional services" },
  { key: "heavy_item_unit",            value: 23.94, category: "instant_quote", description: "Heavy or specialist handling charge per item" },
  { key: "regional_charge",            value: 2.99,  category: "instant_quote", description: "Regional operating adjustment" },
  { key: "parking_or_toll_charge",     value: 7.18,  category: "instant_quote", description: "Parking or toll allowance" },
  { key: "contingency_percent",        value: 0.05, category: "instant_quote", description: "Operational contingency percentage" },
  { key: "permitted_discount",         value: 0,    category: "instant_quote", description: "Default fixed discount applied to quotes" },
  { key: "minimum_booking_amount",     value: 45, category: "instant_quote", description: "Minimum customer booking amount" },
  { key: "rounding_increment",         value: 5,    category: "instant_quote", description: "Customer price rounding increment in pounds" },
  { key: "internal_cost_percent",      value: 0.55, category: "instant_quote", description: "Estimated internal cost percentage for margin protection" },
  { key: "quote_expiry_hours",         value: 24,   category: "instant_quote", description: "Quote validity in hours" },
  { key: "packing_addon_fee",         value: 31.12, category: "addons",   description: "Legacy packing base fee fallback" },
  { key: "assembly_addon_fee",        value: 26.33, category: "addons",   description: "Legacy assembly base fee fallback" },
  { key: "packing_base_fee",          value: 31.12, category: "addons",   description: "Packing service base fee before item scaling" },
  { key: "packing_price_per_item",    value: 8.38,  category: "addons",   description: "Packing service price per selected item unit" },
  { key: "packing_price_per_kg",      value: 0.27,  category: "addons",   description: "Packing service price per kg of selected inventory" },
  { key: "packing_minimum_fee",       value: 44.89, category: "addons",   description: "Minimum packing service charge for item moves" },
  { key: "assembly_base_fee",         value: 26.33, category: "addons",   description: "Dismantling / reassembly base fee before item scaling" },
  { key: "assembly_price_per_item",   value: 13.17, category: "addons",   description: "Dismantling / reassembly price per selected item unit" },
  { key: "assembly_price_per_kg",     value: 0.33,  category: "addons",   description: "Dismantling / reassembly price per kg of selected inventory" },
  { key: "assembly_minimum_fee",      value: 50.87, category: "addons",   description: "Minimum dismantling / reassembly charge for item moves" },
  { key: "home_packing_min_studio",   value: 179.55, category: "addons",   description: "Minimum packing charge for studio house moves" },
  { key: "home_packing_min_1_bed",    value: 219.05, category: "addons",   description: "Minimum packing charge for 1 bed house moves" },
  { key: "home_packing_min_2_bed",    value: 247.18, category: "addons",   description: "Minimum packing charge for 2 bed house moves" },
  { key: "home_packing_min_3_bed",    value: 296.86, category: "addons",   description: "Minimum packing charge for 3 bed house moves" },
  { key: "home_packing_min_4_bed",    value: 382.44, category: "addons",   description: "Minimum packing charge for 4 bed house moves" },
  { key: "home_packing_min_5_plus_bed", value: 395.61, category: "addons", description: "Minimum packing charge for 5+ bed house moves" },
  { key: "home_assembly_min_studio",  value: 53.87,  category: "addons",   description: "Minimum dismantling / reassembly charge for studio moves" },
  { key: "home_assembly_min_1_bed",   value: 71.82,  category: "addons",   description: "Minimum dismantling / reassembly charge for 1 bed moves" },
  { key: "home_assembly_min_2_bed",   value: 95.76,  category: "addons",   description: "Minimum dismantling / reassembly charge for 2 bed moves" },
  { key: "home_assembly_min_3_bed",   value: 131.67, category: "addons",   description: "Minimum dismantling / reassembly charge for 3 bed moves" },
  { key: "home_assembly_min_4_bed",   value: 167.58, category: "addons",   description: "Minimum dismantling / reassembly charge for 4 bed moves" },
  { key: "home_assembly_min_5_plus_bed", value: 203.49, category: "addons", description: "Minimum dismantling / reassembly charge for 5+ bed moves" },

  // -------------------------------------------------------------------------
  // Weight-based item handling
  // -------------------------------------------------------------------------
  { key: "item_price_per_kg",         value: 0.24, category: "items",    description: "Price per kg for item handling" },
  { key: "item_min_charge",           value: 3.83, category: "items",    description: "Minimum handling charge per item line" },
  { key: "full_service_inventory_complexity_per_minute", value: 0, category: "items", description: "Optional extra per handling minute for full-service moves; labour already prices handling time" },
  { key: "extra_inventory_item_unit", value: 6, category: "items", description: "Per extra item charge above the selected full-house baseline" },
  { key: "extra_inventory_volume_m3_unit", value: 3, category: "items", description: "Per m3 charge for extra inventory above the selected full-house baseline" },
  { key: "extra_inventory_weight_kg_unit", value: 0.05, category: "items", description: "Per kg charge for extra inventory above the selected full-house baseline" },
  { key: "extra_inventory_handling_minute_unit", value: 0.25, category: "items", description: "Per handling minute charge for extra inventory above the selected full-house baseline" },
  { key: "additional_vehicle_charge_factor", value: 0.5, category: "vehicles", description: "Fraction of vehicle base charged for each extra capacity unit" },

  // -------------------------------------------------------------------------
  // Calendar multipliers
  // -------------------------------------------------------------------------
  { key: "weekend_multiplier",        value: 1.08, category: "calendar", description: "Sat / Sun multiplier" },
  { key: "peak_month_multiplier",     value: 1.05, category: "calendar", description: "June / July / August multiplier" },
  { key: "end_of_month_multiplier",   value: 1.04, category: "calendar", description: "Last 3 days of the month multiplier" },

  // Hard cap so stacked multipliers never exceed this combined value
  { key: "max_combined_multiplier",   value: 1.35, category: "calendar", description: "Maximum combined urgency × calendar multiplier" },
];

const ANYVAN_BENCHMARK_SOURCE_PREFIX = "AnyVan published 2026 benchmark";
const ANYVAN_BENCHMARK_REGIONS = [
  "Scotland",
  "Glasgow City",
  "City of Edinburgh",
  "Dundee City",
  "Glasgow",
  "Edinburgh",
  "Dundee",
] as const;
const ANYVAN_EFFECTIVE_FROM = new Date("2026-08-16T00:00:00.000Z");
const ANYVAN_HOME_OVERALL_AVERAGE = 516;
const ANYVAN_HOME_DISTANCE_AVERAGES = [
  { label: "0-2 miles", min: 0, max: 2, averagePounds: 374 },
  { label: "2-5 miles", min: 2.001, max: 5, averagePounds: 392 },
  { label: "5-10 miles", min: 5.001, max: 10, averagePounds: 422 },
  { label: "10-20 miles", min: 10.001, max: 20, averagePounds: 453 },
  { label: "20-50 miles", min: 20.001, max: 50, averagePounds: 500 },
  { label: "50-100 miles", min: 50.001, max: 100, averagePounds: 607 },
] as const;
const ANYVAN_HOME_SIZE_AVERAGES = [
  { moveSize: "studio", label: "studio fallback to 1 bedroom", withoutPackingPounds: 405, withPackingPounds: 764 },
  { moveSize: "1-bedroom", label: "1 bedroom", withoutPackingPounds: 405, withPackingPounds: 764 },
  { moveSize: "2-bedrooms", label: "2 bedroom", withoutPackingPounds: 456, withPackingPounds: 854 },
  { moveSize: "3-bedrooms", label: "3 bedroom", withoutPackingPounds: 556, withPackingPounds: 1019 },
  { moveSize: "4-bedrooms", label: "4 bedroom", withoutPackingPounds: 749, withPackingPounds: 1331 },
  { moveSize: "5-plus-bedrooms", label: "5 bedroom+", withoutPackingPounds: 877, withPackingPounds: 1480 },
] as const;
const ANYVAN_MAN_AND_VAN_DISTANCE_AVERAGES = [
  { label: "0-2 miles", min: 0, max: 2, averagePounds: 56 },
  { label: "2-5 miles", min: 2.001, max: 5, averagePounds: 50 },
  { label: "5-10 miles", min: 5.001, max: 10, averagePounds: 56 },
  { label: "10-20 miles", min: 10.001, max: 20, averagePounds: 63 },
  { label: "20-50 miles", min: 20.001, max: 50, averagePounds: 80 },
  { label: "50-100 miles", min: 50.001, max: 100, averagePounds: 112 },
] as const;
const ANYVAN_ITEM_BENCHMARKS = [
  {
    moveTypes: ["house-move", "flat-move"],
    moveSizes: ["single-item", "few-items", "custom-inventory"],
  },
  {
    moveTypes: ["single-item-delivery", "furniture-delivery", "marketplace-collection", "student-move", "other"],
    moveSizes: ["single-item", "few-items", "custom-inventory", "studio", "1-bedroom", "2-bedrooms"],
  },
] as const;

function poundsToPence(value: number): number {
  return Math.round(value * 100);
}

async function seedBeatAnyVanCampaign() {
  const campaign = {
    enabled: true,
    internalName: "Beat AnyVan by 10%",
    competitorLabel: "AnyVan",
    applicableRegions: ["Scotland", "Glasgow City", "City of Edinburgh", "Dundee City", "Glasgow", "Edinburgh", "Dundee"],
    applicableMoveTypes: [],
    applicablePropertySizes: [],
    beatPercentage: 0.1,
    beatFixedAmountPence: null,
    minimumPricePence: null,
    minimumContributionPence: 0,
    minimumMarginPercent: null,
    maximumDiscountPence: null,
    allowZeroMargin: false,
    allowNegativeMargin: true,
    maximumPermittedLossPence: null,
    startsAt: null,
    endsAt: null,
    dailyBookingLimit: null,
    totalCampaignBookingLimit: null,
    autoPause: true,
    pausedAt: null,
    pauseReason: null,
  };
  const existing = await db.beatCompetitorCampaign.findFirst({
    where: {
      internalName: campaign.internalName,
      competitorLabel: campaign.competitorLabel,
    },
  });

  if (existing) {
    await db.beatCompetitorCampaign.update({
      where: { id: existing.id },
      data: campaign,
    });
  } else {
    await db.beatCompetitorCampaign.create({ data: campaign });
  }
  console.log("  ✓ Beat AnyVan by 10% campaign ready");
}

async function seedAnyVanPublishedBenchmarks() {
  await db.competitorBenchmark.deleteMany({
    where: { sourceNote: { startsWith: ANYVAN_BENCHMARK_SOURCE_PREFIX } },
  });

  const rows: Prisma.CompetitorBenchmarkCreateManyInput[] = [];

  for (const region of ANYVAN_BENCHMARK_REGIONS) {
    for (const moveType of ["house-move", "flat-move"] as const) {
      for (const size of ANYVAN_HOME_SIZE_AVERAGES) {
        for (const band of ANYVAN_HOME_DISTANCE_AVERAGES) {
          const distanceIndex = band.averagePounds / ANYVAN_HOME_OVERALL_AVERAGE;

          for (const packingIncluded of [false, true]) {
            const sizeAverage = packingIncluded ? size.withPackingPounds : size.withoutPackingPounds;
            rows.push({
              region,
              moveType,
              propertySize: size.moveSize,
              serviceLevel: "standard",
              packingIncluded,
              distanceBandMinMiles: band.min,
              distanceBandMaxMiles: band.max,
              benchmarkPricePence: poundsToPence(sizeAverage * distanceIndex),
              effectiveFrom: ANYVAN_EFFECTIVE_FROM,
              sourceNote: `${ANYVAN_BENCHMARK_SOURCE_PREFIX}: home-removal ${packingIncluded ? "with packing" : "without packing"} ${size.label}, ${band.label}; derived from AnyVan April 2026 published size and distance averages`,
              active: true,
            });
          }
        }
      }
    }

    for (const group of ANYVAN_ITEM_BENCHMARKS) {
      for (const moveType of group.moveTypes) {
        for (const moveSize of group.moveSizes) {
          for (const band of ANYVAN_MAN_AND_VAN_DISTANCE_AVERAGES) {
            rows.push({
              region,
              moveType,
              propertySize: moveSize,
              serviceLevel: "standard",
              packingIncluded: false,
              distanceBandMinMiles: band.min,
              distanceBandMaxMiles: band.max,
              benchmarkPricePence: poundsToPence(band.averagePounds),
              effectiveFrom: ANYVAN_EFFECTIVE_FROM,
              sourceNote: `${ANYVAN_BENCHMARK_SOURCE_PREFIX}: man-and-van ${moveSize}, ${band.label}; AnyVan March 2026 published distance average`,
              active: true,
            });
          }
        }
      }
    }
  }

  await db.competitorBenchmark.createMany({ data: rows });
  console.log(`  ✓ AnyVan published benchmarks ready (${rows.length} rows)`);
}

async function main() {
  console.log("Seeding pricing config…");
  for (const cfg of pricingDefaults) {
    await db.pricingConfig.upsert({
      where:  { key: cfg.key },
      update: { value: cfg.value, description: cfg.description, category: cfg.category },
      create: { ...cfg, isActive: true },
    });
    console.log(`  ✓ ${cfg.key}: ${cfg.value}`);
  }
  const vehiclePlaceholders = [
    "Small van",
    "Medium van",
    "Large van",
    "Luton van",
    "Flatbed",
  ];
  for (const name of vehiclePlaceholders) {
    await db.vehicleClassConfig.upsert({
      where: { name },
      update: {},
      create: {
        name,
        isActive: false,
        minCrew: 1,
        maxCrew: 2,
      },
    });
  }
  await seedBeatAnyVanCampaign();
  await seedAnyVanPublishedBenchmarks();
  const total = await db.pricingConfig.count();
  console.log(`\nDone! ${total} pricing configs in DB.`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());

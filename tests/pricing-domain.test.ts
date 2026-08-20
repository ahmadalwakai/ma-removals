import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateRemovalQuote,
  normaliseQuoteInputForPricing,
  type PricingVehicleClass,
  type PricingVersionSnapshot,
  type ResolvedInventoryItem,
  type RouteMetrics,
} from "../src/lib/pricing/domain";
import type {
  PromotionCampaignSnapshot,
  PromotionCodeSnapshot,
  PromotionPricingContext,
} from "../src/lib/pricing/promotions";
import type {
  BeatCompetitorCampaignSnapshot,
  CompetitorBenchmarkSnapshot,
  CompetitorPricingContext,
} from "../src/lib/pricing/competitor-benchmarks";
import { applyCustomerRounding, ROUNDING_STRATEGY } from "../src/lib/pricing/rounding";
import { createQuoteRequestSchema, type AdditionalServicesInput, type CreateQuoteRequest } from "../src/lib/quotes/schemas";

const now = new Date("2026-08-05T09:00:00.000Z");
const expiresAt = new Date("2026-08-06T09:00:00.000Z");

function services(overrides: Partial<AdditionalServicesInput> = {}): AdditionalServicesInput {
  return {
    packing: false,
    packingMaterials: false,
    unpacking: false,
    dismantling: false,
    reassembly: false,
    furnitureProtection: false,
    mattressProtection: false,
    tvProtection: false,
    wasteDisposal: false,
    additionalMover: false,
    waitingTime: false,
    heavyItemHandling: false,
    pianoHandling: false,
    ...overrides,
  };
}

function access(overrides: Partial<CreateQuoteRequest["collection"]> = {}): CreateQuoteRequest["collection"] {
  return {
    fullAddress: "10 Union Street, Glasgow G1 3QX",
    postcode: "G1 3QX",
    lat: 55.8609,
    lng: -4.2514,
    city: "Glasgow",
    region: "Scotland",
    country: "United Kingdom",
    propertyType: "Flat",
    floor: 1,
    hasLift: true,
    internalStairs: 0,
    externalStairs: 2,
    parking: "street",
    parkingRestrictions: "",
    carryDistanceMeters: 15,
    narrowRoad: false,
    loadingBayAvailable: false,
    accessRestrictions: "",
    notes: "",
    ...overrides,
  };
}

function input(overrides: Partial<CreateQuoteRequest> = {}): CreateQuoteRequest {
  return {
    idempotencyKey: "test-key-123",
    moveType: "house-move",
    moveSize: "2-bedrooms",
    collection: access(),
    delivery: access({
      fullAddress: "22 Princes Street, Edinburgh EH2 2ER",
      postcode: "EH2 2ER",
      lat: 55.9521,
      lng: -3.1965,
      city: "Edinburgh",
    }),
    additionalStop: null,
    moveDate: "2026-08-10",
    arrivalWindow: "morning",
    flexibleDate: false,
    flexibleTime: false,
    exactTime: false,
    sameDay: false,
    urgent: false,
    inventory: [{ itemId: "sofa", quantity: 1, room: "living-room" }],
    customItems: [],
    services: services(),
    promotionCode: undefined,
    customer: {
      fullName: "Test Customer",
      email: "customer@example.com",
      phone: "07123456789",
      notes: "",
      companyName: "",
      preferredContactMethod: "email",
      marketingConsent: false,
      bookingConsentAccepted: true,
      termsAccepted: true,
    },
    ...overrides,
  };
}

function route(overrides: Partial<RouteMetrics> = {}): RouteMetrics {
  return {
    distanceMiles: 47.4,
    durationMinutes: 72,
    geometry: null,
    calculatedAt: now.toISOString(),
    routeHash: "route-fixture",
    ...overrides,
  };
}

function inventory(overrides: Partial<ResolvedInventoryItem> = {}): ResolvedInventoryItem[] {
  return [{
    id: "sofa",
    category: "Living room",
    name: "Two-seat sofa",
    quantity: 1,
    room: "living-room",
    estimatedVolumeM3: 1.8,
    estimatedWeightKg: 55,
    handlingMinutes: 18,
    requiresTwoPeople: false,
    fragile: false,
    dismantlingAvailable: false,
    assemblyAvailable: false,
    active: true,
    ...overrides,
  }];
}

function settings(overrides: Record<string, number> = {}): Record<string, number> {
  return {
    labour_hourly_rate: 35,
    inventory_handling_per_minute: 0.8,
    access_difficulty_unit: 4,
    additional_stop_fee: 25,
    optional_service_unit: 18,
    heavy_item_unit: 40,
    regional_charge: 5,
    parking_or_toll_charge: 12,
    contingency_percent: 0.1,
    permitted_discount: 0,
    minimum_booking_amount: 80,
    rounding_increment: 5,
    internal_cost_percent: 0.6,
    quote_expiry_hours: 24,
    urgency_today: 1.5,
    urgency_tomorrow: 1.25,
    urgency_2_days: 1.15,
    weekend_multiplier: 1.2,
    base_house_move: 95,
    base_office_removals: 120,
    base_furniture_removals: 65,
    base_piano_moves: 140,
    base_van_with_man: 55,
    single_item_base_fee: 45,
    ...overrides,
  };
}

function vehicle(overrides: Partial<PricingVehicleClass> = {}): PricingVehicleClass {
  return {
    id: "small-van",
    name: "Small van",
    isActive: true,
    maxUsableVolumeM3: 5,
    maxPayloadKg: 600,
    minCrew: 1,
    maxCrew: 3,
    baseFeePence: 5000,
    perMilePence: 175,
    perHourPence: 2200,
    loadingEfficiencyFactor: 1,
    unloadingEfficiencyFactor: 1,
    fleetCount: 1,
    manualReviewThresholdM3: null,
    manualReviewPayloadKg: null,
    ...overrides,
  };
}

function pricingVersion(overrides: Partial<PricingVersionSnapshot> = {}): PricingVersionSnapshot {
  return {
    id: "pricing-v1",
    version: 1,
    status: "ACTIVE",
    settings: settings(),
    vehicleClasses: [
      vehicle(),
      vehicle({
        id: "luton",
        name: "Luton van",
        maxUsableVolumeM3: 25,
        maxPayloadKg: 1200,
        minCrew: 2,
        maxCrew: 4,
        baseFeePence: 9000,
        perMilePence: 240,
        perHourPence: 3200,
      }),
    ],
    ...overrides,
  };
}

function campaign(overrides: Partial<PromotionCampaignSnapshot> = {}): PromotionCampaignSnapshot {
  return {
    id: "campaign-flex",
    type: "OCCUPANCY_FILL",
    internalName: "Flexible day fill",
    customerLabel: "Flexible moving discount",
    active: true,
    startsAt: "2026-08-01T00:00:00.000Z",
    endsAt: "2026-09-01T00:00:00.000Z",
    percentageReduction: null,
    fixedReductionPence: 2000,
    maximumDiscountPence: null,
    maximumDiscountPercent: null,
    hardMinimumPricePence: null,
    hardMinimumContributionPence: null,
    hardMinimumMarginPercent: null,
    allowZeroMargin: false,
    allowNegativeMargin: false,
    maximumPermittedLossPence: null,
    campaignBudgetPence: null,
    dailyBudgetPence: null,
    spentBudgetPence: 0,
    dailySpentBudgetPence: 0,
    maximumRedemptions: null,
    redemptionCount: 0,
    stackable: false,
    pausedAt: null,
    rules: null,
    ...overrides,
  };
}

function code(overrides: Partial<PromotionCodeSnapshot> = {}): PromotionCodeSnapshot {
  return {
    id: "code-save10",
    code: "SAVE10",
    normalizedCode: "SAVE10",
    internalName: "Save 10",
    customerLabel: "10% off today",
    active: true,
    discountType: "PERCENTAGE",
    discountValue: 1000,
    maximumDiscountPence: null,
    minimumSubtotalPence: null,
    maximumSubtotalPence: null,
    startsAt: "2026-08-01T00:00:00.000Z",
    endsAt: "2026-09-01T00:00:00.000Z",
    maximumRedemptions: null,
    maximumRedemptionsPerCustomer: null,
    applicableMoveTypes: [],
    applicableRegions: [],
    applicableWeekdays: [],
    applicableVehicleClasses: [],
    firstBookingOnly: false,
    stackable: false,
    redemptionCount: 0,
    campaignId: null,
    ...overrides,
  };
}

function promotionContext(overrides: Partial<PromotionPricingContext> = {}): PromotionPricingContext {
  return {
    campaigns: [],
    promotionCode: null,
    priorCompletedBookings: 0,
    minimumContributionPence: 0,
    minimumMarginPercent: null,
    allowZeroMargin: false,
    allowNegativeMargin: false,
    ...overrides,
  };
}

function competitorBenchmark(overrides: Partial<CompetitorBenchmarkSnapshot> = {}): CompetitorBenchmarkSnapshot {
  return {
    id: "benchmark-anyvan-glasgow-edinburgh",
    region: "Scotland",
    moveType: "house-move",
    propertySize: "2-bedrooms",
    serviceLevel: "standard",
    packingIncluded: false,
    distanceBandMinMiles: 0,
    distanceBandMaxMiles: 100,
    benchmarkPricePence: 34000,
    effectiveFrom: "2026-08-01T00:00:00.000Z",
    effectiveTo: "2026-09-01T00:00:00.000Z",
    sourceNote: "Admin-entered marketplace comparison",
    active: true,
    ...overrides,
  };
}

function beatCampaign(overrides: Partial<BeatCompetitorCampaignSnapshot> = {}): BeatCompetitorCampaignSnapshot {
  return {
    id: "beat-anyvan",
    enabled: true,
    internalName: "Beat AnyVan",
    competitorLabel: "AnyVan",
    applicableRegions: ["Scotland"],
    applicableMoveTypes: ["house-move"],
    applicablePropertySizes: ["2-bedrooms"],
    beatPercentage: 0.03,
    beatFixedAmountPence: null,
    minimumPricePence: null,
    minimumContributionPence: null,
    minimumMarginPercent: null,
    maximumDiscountPence: 10000,
    allowZeroMargin: false,
    allowNegativeMargin: false,
    maximumPermittedLossPence: null,
    startsAt: "2026-08-01T00:00:00.000Z",
    endsAt: "2026-09-01T00:00:00.000Z",
    dailyBookingLimit: null,
    totalCampaignBookingLimit: null,
    dailyBookingCount: 0,
    dailyBookingDate: null,
    bookingCount: 0,
    pausedAt: null,
    ...overrides,
  };
}

function competitorContext(overrides: Partial<CompetitorPricingContext> = {}): CompetitorPricingContext {
  return {
    benchmark: competitorBenchmark(),
    campaign: beatCampaign(),
    serviceLevel: "standard",
    packingIncluded: false,
    ...overrides,
  };
}

function calculate(params: {
  quoteInput?: CreateQuoteRequest;
  quoteInventory?: ResolvedInventoryItem[];
  quoteRoute?: RouteMetrics | null;
  version?: PricingVersionSnapshot | null;
  quotePromotionContext?: PromotionPricingContext | null;
  quoteCompetitorContext?: CompetitorPricingContext | null;
} = {}) {
  return calculateRemovalQuote({
    input: params.quoteInput ?? input(),
    inventory: params.quoteInventory ?? inventory(),
    route: params.quoteRoute === undefined ? route() : params.quoteRoute,
    pricingVersion: params.version === undefined ? pricingVersion() : params.version,
    promotionContext: params.quotePromotionContext,
    competitorContext: params.quoteCompetitorContext,
    now,
    quoteExpiresAt: expiresAt,
  });
}

function scheduleAmount(result: ReturnType<typeof calculate>): number {
  return result.customerBreakdown.find((line) => line.key === "schedule_surcharge")?.amountPence ?? 0;
}

test("returns a deterministic fixed quote from server-owned pricing inputs", () => {
  const first = calculate();
  const second = calculate();

  assert.equal(first.status, "FIXED");
  assert.equal(first.manualReviewReasons.length, 0);
  assert.ok((first.finalTotalPence ?? 0) > 0);
  assert.equal(first.customerSummary.routeMileage, 47.4);
  assert.equal(first.customerSummary.quoteExpiresAt, expiresAt.toISOString());
  assert.equal(first.vehicleRecommendation.name, "Small van");
  assert.deepEqual(first, second);
});

test("handles zero-distance local moves without trusting client mileage", () => {
  const result = calculate({
    quoteRoute: route({ distanceMiles: 0, durationMinutes: 0, routeHash: "zero-route" }),
  });

  assert.equal(result.status, "FIXED");
  assert.equal(result.customerSummary.routeMileage, 0);
  assert.ok((result.finalTotalPence ?? 0) >= 8000);
});

test("long-distance routes cost more than zero-distance routes with the same version", () => {
  const local = calculate({
    quoteRoute: route({ distanceMiles: 0, durationMinutes: 0, routeHash: "local" }),
  });
  const longDistance = calculate({
    quoteRoute: route({ distanceMiles: 300, durationMinutes: 420, routeHash: "long" }),
  });

  assert.equal(local.status, "FIXED");
  assert.equal(longDistance.status, "FIXED");
  assert.ok((longDistance.finalTotalPence ?? 0) > (local.finalTotalPence ?? 0));
  assert.equal(longDistance.customerBreakdown.find((line) => line.key === "distance_charge")?.amountPence, 13107);
  assert.equal(longDistance.customerBreakdown.some((line) => line.key === "travel_time_charge"), false);
});

test("does not issue a fixed price without an active pricing version", () => {
  const result = calculate({ version: null });

  assert.equal(result.status, "MANUAL_REVIEW");
  assert.equal(result.finalTotalPence, null);
  assert.match(result.manualReviewReasons.join("\n"), /No active pricing version/);
});

test("requires authoritative inventory dimensions and handling data", () => {
  const result = calculate({
    quoteInventory: inventory({ estimatedVolumeM3: null, handlingMinutes: null }),
  });

  assert.equal(result.status, "MANUAL_REVIEW");
  assert.deepEqual(result.customerBreakdown, []);
  assert.match(result.manualReviewReasons.join("\n"), /Missing volume/);
  assert.match(result.manualReviewReasons.join("\n"), /Missing handling time/);
});

test("chooses the smallest configured vehicle that fits volume and payload", () => {
  const result = calculate({
    quoteInventory: inventory({
      name: "Large sideboard",
      estimatedVolumeM3: 8,
      estimatedWeightKg: 500,
      handlingMinutes: 80,
    }),
  });

  assert.equal(result.status, "FIXED");
  assert.equal(result.vehicleRecommendation.name, "Luton van");
  assert.equal(result.vehicleRecommendation.multipleVehiclesRequired, false);
});

test("vehicle selection respects payload even when volume fits a smaller van", () => {
  const result = calculate({
    quoteInventory: inventory({
      name: "Compact machinery",
      estimatedVolumeM3: 2,
      estimatedWeightKg: 800,
      handlingMinutes: 90,
    }),
  });

  assert.equal(result.status, "FIXED");
  assert.equal(result.vehicleRecommendation.name, "Luton van");
});

test("requires more movers for two-person, heavy, and specialist items", () => {
  const result = calculate({
    quoteInventory: inventory({
      name: "Upright piano",
      estimatedVolumeM3: 2.5,
      estimatedWeightKg: 180,
      handlingMinutes: 120,
      requiresTwoPeople: true,
    }),
    quoteInput: input({ moveType: "piano-move", services: services({ pianoHandling: true }) }),
  });
  const keys = result.customerBreakdown.map((line) => line.key);

  assert.equal(result.status, "FIXED");
  assert.ok(result.crewRecommendation.movers >= 2);
  assert.equal(result.inventoryMetrics.heavyOrSpecialItemCount, 1);
  assert.ok(keys.includes("heavy_and_special_item_charge"));
});

test("preferred two-person selection does not become a three-person crew", () => {
  const result = calculate({
    quoteInput: input({ preferredMovers: 2 }),
  });

  assert.equal(result.status, "FIXED");
  assert.equal(result.crewRecommendation.movers, 2);
});

test("customer-selected one-person crew remains available on larger moves", () => {
  const quoteInventory = inventory({
    estimatedVolumeM3: 12,
    estimatedWeightKg: 350,
    handlingMinutes: 120,
  });
  const onePerson = calculate({
    quoteInput: input({ preferredMovers: 1 }),
    quoteInventory,
  });
  const twoPeople = calculate({
    quoteInput: input({ preferredMovers: 2 }),
    quoteInventory,
  });

  assert.equal(onePerson.status, "FIXED");
  assert.equal(twoPeople.status, "FIXED");
  assert.equal(onePerson.vehicleRecommendation.name, "Luton van");
  assert.equal(onePerson.crewRecommendation.movers, 1);
  assert.equal(twoPeople.crewRecommendation.movers, 2);
  assert.ok((twoPeople.finalTotalPence ?? 0) > (onePerson.finalTotalPence ?? 0));
});

test("full-service moves do not double-charge handling or helper labour", () => {
  const result = calculate({
    quoteInput: input({ moveSize: "2-bedrooms", preferredMovers: 2 }),
  });
  const labourLine = result.customerBreakdown.find((line) => line.key === "labour_charge");

  assert.equal(result.status, "FIXED");
  assert.equal(result.customerBreakdown.some((line) => line.key === "inventory_handling_charge"), false);
  assert.equal(labourLine?.amountPence, 7000);
});

test("large house inventories use configured item-count bedroom benchmarks", () => {
  const rawInput = input({ moveType: "house-move", moveSize: "few-items", preferredMovers: 1 });
  const largeInventory = inventory({
    quantity: 26,
    estimatedVolumeM3: 1.115,
    estimatedWeightKg: 25,
    handlingMinutes: 8,
  });
  const pricingInput = normaliseQuoteInputForPricing(rawInput, largeInventory);

  assert.equal(rawInput.moveSize, "few-items");
  assert.equal(pricingInput.moveSize, "1-bedroom");

  const result = calculate({
    quoteInput: pricingInput,
    quoteInventory: largeInventory,
    quoteRoute: route({ distanceMiles: 1.8, durationMinutes: 6 }),
    quoteCompetitorContext: competitorContext({
      benchmark: competitorBenchmark({
        benchmarkPricePence: 33051,
        distanceBandMinMiles: 0,
        distanceBandMaxMiles: 2,
        propertySize: "1-bedroom",
      }),
    }),
  });

  assert.equal(result.status, "FIXED");
  assert.equal(result.competitorSummary.benchmarkPricePence, 33051);
  assert.equal(result.competitorSummary.targetPricePence, 29745);
  assert.equal(result.finalTotalPence, 29745 + scheduleAmount(result));
});

test("selected two-person crew costs more than one-person crew for the same move", () => {
  const quoteInventory = inventory({ handlingMinutes: 180 });
  const onePerson = calculate({
    quoteInput: input({ moveSize: "few-items", preferredMovers: 1 }),
    quoteInventory,
  });
  const twoPeople = calculate({
    quoteInput: input({ moveSize: "few-items", preferredMovers: 2 }),
    quoteInventory,
  });

  assert.equal(onePerson.status, "FIXED");
  assert.equal(twoPeople.status, "FIXED");
  assert.equal(onePerson.crewRecommendation.movers, 1);
  assert.equal(twoPeople.crewRecommendation.movers, 2);
  assert.ok((twoPeople.finalTotalPence ?? 0) > (onePerson.finalTotalPence ?? 0));
});

test("single-item inventory uses item-move base without separate van and labour charges", () => {
  const result = calculate({
    quoteInput: input({ moveSize: "few-items", preferredMovers: 1 }),
  });
  const baseLine = result.customerBreakdown.find((line) => line.key === "base_service_charge");
  const keys = result.customerBreakdown.map((line) => line.key);

  assert.equal(result.status, "FIXED");
  assert.equal(baseLine?.label, "Single item move");
  assert.equal(baseLine?.amountPence, 4500);
  assert.equal(keys.includes("vehicle_charge"), false);
  assert.equal(keys.includes("labour_charge"), false);
});

test("ordinary longer handling time does not default to a three-person crew", () => {
  const result = calculate({
    quoteInventory: inventory({ handlingMinutes: 300 }),
  });

  assert.equal(result.status, "FIXED");
  assert.equal(result.crewRecommendation.movers, 1);
});

test("stairs, no lift, and long carry produce an access charge", () => {
  const result = calculate({
    quoteInput: input({
      collection: access({
        floor: 3,
        hasLift: false,
        internalStairs: 8,
        externalStairs: 12,
        carryDistanceMeters: 120,
        parking: "restricted",
      }),
    }),
  });
  const accessLine = result.customerBreakdown.find((line) => line.key === "access_charge");

  assert.equal(result.status, "FIXED");
  assert.ok((accessLine?.amountPence ?? 0) > 0);
});

test("prices over-capacity moves with additional vehicle capacity", () => {
  const result = calculate({
    quoteInventory: inventory({
      name: "Workshop contents",
      estimatedVolumeM3: 60,
      estimatedWeightKg: 3000,
      handlingMinutes: 360,
    }),
  });

  assert.equal(result.status, "FIXED");
  assert.ok((result.finalTotalPence ?? 0) > 0);
  assert.equal(result.vehicleRecommendation.multipleVehiclesRequired, true);
  assert.equal(result.vehicleRecommendation.multipleTripsLikely, true);
  assert.equal(result.manualReviewReasons.length, 0);
  assert.match(result.customerBreakdown.find((line) => line.key === "vehicle_charge")?.label ?? "", /capacity supplement x2/);
  assert.equal(result.customerBreakdown.find((line) => line.key === "vehicle_charge")?.amountPence, 18000);
});

test("applies stop, services, parking, urgency, and VAT charges when configured", () => {
  const result = calculate({
    quoteInput: input({
      collection: access({ parking: "paid" }),
      additionalStop: access({
        fullAddress: "4 High Street, Stirling FK8 1EA",
        postcode: "FK8 1EA",
        lat: 56.1165,
        lng: -3.9369,
        city: "Stirling",
      }),
      moveDate: "2026-08-05",
      sameDay: true,
      services: services({ packing: true, additionalMover: true }),
    }),
    version: pricingVersion({
      settings: settings({ vat_enabled: 1, vat_rate: 0.2 }),
    }),
  });
  const keys = result.customerBreakdown.map((line) => line.key);
  const scheduleLine = result.customerBreakdown.find((line) => line.key === "schedule_surcharge");

  assert.equal(result.status, "FIXED");
  assert.ok(keys.includes("additional_stop_charge"));
  assert.ok(keys.includes("packing_charge"));
  assert.ok(keys.includes("optional_services_charge"));
  assert.ok(keys.includes("parking_or_toll_charge"));
  assert.ok(keys.includes("schedule_surcharge"));
  assert.equal(scheduleLine?.amountPence, 10000);
  assert.ok(keys.includes("vat"));
  assert.ok(result.crewRecommendation.movers >= 2);
});

test("normal future dates do not receive synthetic availability adjustments", () => {
  const result = calculate({
    quoteInput: input({ moveDate: "2026-08-08" }),
  });
  const scheduleLine = result.customerBreakdown.find((line) => line.key === "schedule_surcharge");

  assert.equal(result.status, "FIXED");
  assert.equal(scheduleLine, undefined);
});

test("short-notice dates use fixed calendar surcharges", () => {
  const today = calculate({ quoteInput: input({ moveDate: "2026-08-05", sameDay: true }) });
  const tomorrow = calculate({ quoteInput: input({ moveDate: "2026-08-06" }) });
  const thirdDay = calculate({ quoteInput: input({ moveDate: "2026-08-07" }) });

  assert.equal(today.customerBreakdown.find((line) => line.key === "schedule_surcharge")?.amountPence, 10000);
  assert.equal(tomorrow.customerBreakdown.find((line) => line.key === "schedule_surcharge")?.amountPence, 7700);
  assert.equal(thirdDay.customerBreakdown.find((line) => line.key === "schedule_surcharge")?.amountPence, 5000);
});

test("configured permitted discounts cannot make the final total negative", () => {
  const result = calculate({
    version: pricingVersion({
      settings: settings({
        permitted_discount: 5000,
        minimum_booking_amount: 80,
      }),
    }),
  });

  assert.equal(result.status, "FIXED");
  assert.ok((result.finalTotalPence ?? 0) >= 8000);
  assert.ok(result.customerBreakdown.some((line) => line.key === "permitted_discounts" && line.amountPence < 0));
});

test("applies percentage promotion codes as basis points after server pricing", () => {
  const baseline = calculate();
  const result = calculate({
    quoteInput: input({ promotionCode: "SAVE10" }),
    quotePromotionContext: promotionContext({ promotionCode: code() }),
  });
  const expectedDiscount = Math.round((baseline.internalSummary.preDiscountTotalPence ?? 0) * 0.1);

  assert.equal(result.status, "FIXED");
  assert.equal(result.promotionSummary.applied[0]?.source, "code");
  assert.equal(result.promotionSummary.discountTotalPence, expectedDiscount);
  assert.equal(result.customerSummary.promotionLabel, "10% off today");
  assert.ok((result.finalTotalPence ?? 0) < (baseline.finalTotalPence ?? 0));
});

test("automatic flexible-date campaigns only apply to flexible quotes", () => {
  const gatedCampaign = campaign({
    rules: { flexibleDateOnly: true },
  });
  const fixedDate = calculate({
    quotePromotionContext: promotionContext({ campaigns: [gatedCampaign] }),
  });
  const flexibleDate = calculate({
    quoteInput: input({
      moveDate: null,
      flexibleDate: true,
      earliestDate: "2026-08-11",
      latestDate: "2026-08-13",
    }),
    quotePromotionContext: promotionContext({ campaigns: [gatedCampaign] }),
  });

  assert.equal(fixedDate.status, "FIXED");
  assert.equal(fixedDate.promotionSummary.discountTotalPence, 0);
  assert.equal(flexibleDate.status, "FIXED");
  assert.equal(flexibleDate.promotionSummary.discountTotalPence, 2000);
  assert.equal(flexibleDate.customerSummary.promotionLabel, "Flexible moving discount");
});

test("margin protection blocks aggressive campaigns that would create a loss", () => {
  const result = calculate({
    quotePromotionContext: promotionContext({
      campaigns: [
        campaign({
          id: "campaign-aggressive-loss",
          type: "AGGRESSIVE",
          customerLabel: "Aggressive fill rate",
          fixedReductionPence: 1_000_000,
          hardMinimumPricePence: 0,
        }),
      ],
    }),
  });

  assert.equal(result.status, "FIXED");
  assert.equal(result.promotionSummary.applied.length, 0);
  assert.equal(result.promotionSummary.discountTotalPence, 0);
});

test("beat competitor mode prices below the configured benchmark without exposing the competitor name to customers", () => {
  const result = calculate({
    quoteCompetitorContext: competitorContext({
      benchmark: competitorBenchmark({ benchmarkPricePence: 24000 }),
    }),
  });
  const competitorLine = result.customerBreakdown.find((line) => line.key === "competitor_benchmark_adjustment");

  assert.equal(result.status, "FIXED");
  assert.equal(result.competitorSummary.applied, true);
  assert.equal(result.competitorSummary.benchmarkPricePence, 24000);
  assert.equal(result.competitorSummary.targetPricePence, 21600);
  assert.ok((result.finalTotalPence ?? 0) <= 21600 + scheduleAmount(result));
  assert.equal(result.customerSummary.discountTotalPence, result.competitorSummary.discountPence);
  assert.equal(competitorLine?.label, "Online booking price");
  assert.equal(result.customerBreakdown.some((line) => /AnyVan/i.test(line.label)), false);
});

test("AnyVan beat mode ignores a lower configured beat and discount cap to preserve the 10 percent target", () => {
  const result = calculate({
    quoteCompetitorContext: competitorContext({
      benchmark: competitorBenchmark({ benchmarkPricePence: 20000 }),
      campaign: beatCampaign({ beatPercentage: 0.03, maximumDiscountPence: 1000 }),
    }),
  });

  assert.equal(result.status, "FIXED");
  assert.equal(result.competitorSummary.applied, true);
  assert.equal(result.competitorSummary.targetPricePence, 18000);
  assert.equal(result.finalTotalPence, 18000 + scheduleAmount(result));
  assert.equal(result.competitorSummary.safeMinimumPricePence, 8000);
  assert.ok(result.competitorSummary.discountPence > 1000);
  assert.equal(result.competitorSummary.unableReason, null);
});

test("AnyVan beat mode bypasses margin safety floors so the 10 percent target is honoured", () => {
  const result = calculate({
    version: pricingVersion({
      settings: settings({ internal_cost_percent: 0.95 }),
    }),
    quoteCompetitorContext: competitorContext({
      benchmark: competitorBenchmark({ benchmarkPricePence: 20000 }),
      campaign: beatCampaign({ minimumMarginPercent: 0.5 }),
    }),
  });

  assert.equal(result.status, "FIXED");
  assert.equal(result.competitorSummary.applied, true);
  assert.equal(result.competitorSummary.targetPricePence, 18000);
  assert.equal(result.finalTotalPence, 18000 + scheduleAmount(result));
  assert.equal(result.competitorSummary.safeMinimumPricePence, 8000);
  assert.equal(result.competitorSummary.unableReason, null);
});

test("AnyVan beat mode applies across non-house move types when a matching benchmark exists", () => {
  const result = calculate({
    quoteInput: input({
      moveType: "furniture-delivery",
      moveSize: "single-item",
      preferredMovers: 1,
    }),
    quoteCompetitorContext: competitorContext({
      benchmark: competitorBenchmark({
        moveType: "furniture-delivery",
        propertySize: "single-item",
        benchmarkPricePence: 10000,
      }),
      campaign: beatCampaign({
        applicableMoveTypes: ["house-move"],
        applicablePropertySizes: ["2-bedrooms"],
      }),
    }),
  });

  assert.equal(result.status, "FIXED");
  assert.equal(result.competitorSummary.applied, true);
  assert.equal(result.competitorSummary.targetPricePence, 9000);
  assert.equal(result.finalTotalPence, 9000 + scheduleAmount(result));
});

test("AnyVan target lock does not add synthetic normal-date adjustments", () => {
  const result = calculate({
    quoteCompetitorContext: competitorContext({
      benchmark: competitorBenchmark({ benchmarkPricePence: 27000 }),
    }),
  });
  const scheduleLine = result.customerBreakdown.find((line) => line.key === "schedule_surcharge");

  assert.equal(result.status, "FIXED");
  assert.equal(result.competitorSummary.enforceExactTarget, true);
  assert.equal(result.competitorSummary.targetPricePence, 24300);
  assert.equal(result.finalTotalPence, 24300);
  assert.equal(scheduleLine, undefined);
  assert.ok(Number.isFinite(result.internalSummary.roundingAdjustmentPence ?? 0));
});

test("AnyVan target lock preserves short-notice calendar price jumps", () => {
  const quoteCompetitorContext = competitorContext({
    benchmark: competitorBenchmark({ benchmarkPricePence: 27000 }),
  });
  const today = calculate({
    quoteInput: input({ moveDate: "2026-08-05", sameDay: true }),
    quoteCompetitorContext,
  });
  const tomorrow = calculate({
    quoteInput: input({ moveDate: "2026-08-06" }),
    quoteCompetitorContext,
  });
  const thirdDay = calculate({
    quoteInput: input({ moveDate: "2026-08-07" }),
    quoteCompetitorContext,
  });
  const normalDay = calculate({
    quoteInput: input({ moveDate: "2026-08-08" }),
    quoteCompetitorContext,
  });

  assert.equal(today.finalTotalPence, 34300);
  assert.equal(tomorrow.finalTotalPence, 32000);
  assert.equal(thirdDay.finalTotalPence, 29300);
  assert.ok((normalDay.finalTotalPence ?? 0) >= 24300);
  assert.ok((normalDay.finalTotalPence ?? 0) <= 25331);
});

test("AnyVan exact target raises naturally cheaper quotes to exactly 10 percent below benchmark", () => {
  const result = calculate({
    quoteInput: input({
      moveType: "furniture-delivery",
      moveSize: "single-item",
      preferredMovers: 1,
    }),
    quoteCompetitorContext: competitorContext({
      benchmark: competitorBenchmark({
        moveType: "furniture-delivery",
        propertySize: "single-item",
        benchmarkPricePence: 30000,
      }),
    }),
  });

  assert.equal(result.status, "FIXED");
  assert.equal(result.competitorSummary.enforceExactTarget, true);
  assert.equal(result.competitorSummary.targetPricePence, 27000);
  assert.equal(result.finalTotalPence, 27000 + scheduleAmount(result));
  assert.equal(result.competitorSummary.discountPence, 0);
});

test("AnyVan exact target does not discount an extra helper into the base benchmark", () => {
  const version = pricingVersion({
    settings: settings({ minimum_booking_amount: 45, helper_price: 21.55 }),
  });
  const quoteCompetitorContext = competitorContext({
    benchmark: competitorBenchmark({
      moveType: "furniture-delivery",
      propertySize: "single-item",
      benchmarkPricePence: 5000,
    }),
  });
  const onePerson = calculate({
    version,
    quoteInput: input({
      moveType: "furniture-delivery",
      moveSize: "single-item",
      preferredMovers: 1,
    }),
    quoteCompetitorContext,
  });
  const twoPeople = calculate({
    version,
    quoteInput: input({
      moveType: "furniture-delivery",
      moveSize: "single-item",
      preferredMovers: 2,
    }),
    quoteCompetitorContext,
  });

  assert.equal(onePerson.status, "FIXED");
  assert.equal(twoPeople.status, "FIXED");
  assert.equal(onePerson.finalTotalPence, 4500 + scheduleAmount(onePerson));
  assert.equal(twoPeople.finalTotalPence, 6655 + scheduleAmount(twoPeople));
  assert.equal(twoPeople.competitorSummary.targetPricePence, 4500);
  assert.equal(twoPeople.customerBreakdown.some((line) => line.key === "additional_helper_charge"), true);
});

test("AnyVan exact target preserves optional service charges above the base benchmark", () => {
  const version = pricingVersion({
    settings: settings({ minimum_booking_amount: 45, optional_service_unit: 18 }),
  });
  const quoteCompetitorContext = competitorContext({
    benchmark: competitorBenchmark({ benchmarkPricePence: 20000 }),
  });
  const base = calculate({ version, quoteCompetitorContext });
  const withWaitingTime = calculate({
    version,
    quoteInput: input({ services: services({ waitingTime: true }) }),
    quoteCompetitorContext,
  });
  const serviceLine = withWaitingTime.customerBreakdown.find((line) => line.key === "optional_services_charge");

  assert.equal(base.status, "FIXED");
  assert.equal(withWaitingTime.status, "FIXED");
  assert.equal(serviceLine?.amountPence, 1800);
  assert.equal(base.finalTotalPence, 18000 + scheduleAmount(base));
  assert.equal(withWaitingTime.finalTotalPence, 18000 + scheduleAmount(withWaitingTime) + 1800);
});

test("AnyVan exact target preserves dynamic packing charges above the base benchmark", () => {
  const version = pricingVersion({
    settings: settings({ minimum_booking_amount: 45 }),
  });
  const quoteCompetitorContext = competitorContext({
    benchmark: competitorBenchmark({ benchmarkPricePence: 20000 }),
  });
  const packingInventory = inventory({ quantity: 25 });
  const oneBedroomBase = calculate({
    version,
    quoteInput: input({ moveSize: "1-bedroom" }),
    quoteInventory: packingInventory,
    quoteCompetitorContext,
  });
  const base = calculate({ version, quoteInventory: packingInventory, quoteCompetitorContext });
  const oneBedroomFullPacking = calculate({
    version,
    quoteInput: input({ moveSize: "1-bedroom", services: services({ packing: true }) }),
    quoteInventory: packingInventory,
    quoteCompetitorContext,
  });
  const withMaterials = calculate({
    version,
    quoteInput: input({ services: services({ packingMaterials: true }) }),
    quoteInventory: packingInventory,
    quoteCompetitorContext,
  });
  const withFullPacking = calculate({
    version,
    quoteInput: input({ services: services({ packing: true }) }),
    quoteInventory: packingInventory,
    quoteCompetitorContext,
  });
  const fourBedroomFullPacking = calculate({
    version,
    quoteInput: input({ moveSize: "4-bedrooms", services: services({ packing: true }) }),
    quoteInventory: packingInventory,
    quoteCompetitorContext,
  });

  assert.equal(oneBedroomBase.status, "FIXED");
  assert.equal(base.status, "FIXED");
  assert.equal(oneBedroomFullPacking.status, "FIXED");
  assert.equal(withMaterials.status, "FIXED");
  assert.equal(withFullPacking.status, "FIXED");
  assert.equal(fourBedroomFullPacking.status, "FIXED");
  const oneBedroomFullPackingCharge =
    oneBedroomFullPacking.customerBreakdown.find((line) => line.key === "packing_charge")?.amountPence ?? 0;
  const materialsCharge = withMaterials.customerBreakdown.find((line) => line.key === "packing_charge")?.amountPence ?? 0;
  const fullPackingCharge =
    withFullPacking.customerBreakdown.find((line) => line.key === "packing_charge")?.amountPence ?? 0;
  const fourBedroomFullPackingCharge =
    fourBedroomFullPacking.customerBreakdown.find((line) => line.key === "packing_charge")?.amountPence ?? 0;

  assert.equal(oneBedroomFullPackingCharge, 14500);
  assert.equal(materialsCharge, 6500);
  assert.equal(fullPackingCharge, 19500);
  assert.equal(fourBedroomFullPackingCharge, 32500);
  assert.ok((oneBedroomFullPacking.finalTotalPence ?? 0) >= (oneBedroomBase.finalTotalPence ?? 0) + oneBedroomFullPackingCharge);
  assert.ok((withMaterials.finalTotalPence ?? 0) >= (base.finalTotalPence ?? 0) + materialsCharge);
  assert.ok((withFullPacking.finalTotalPence ?? 0) >= (base.finalTotalPence ?? 0) + fullPackingCharge);
  assert.ok((fourBedroomFullPacking.finalTotalPence ?? 0) > (withFullPacking.finalTotalPence ?? 0));
});

test("full-house extra items increase AnyVan-locked prices above the bedroom baseline", () => {
  const version = pricingVersion({
    settings: settings({ minimum_booking_amount: 45 }),
  });
  const quoteCompetitorContext = competitorContext({
    benchmark: competitorBenchmark({
      propertySize: "1-bedroom",
      benchmarkPricePence: 20000,
    }),
  });
  const baseInventory = inventory({
    quantity: 35,
    estimatedVolumeM3: 0.18,
    estimatedWeightKg: 5,
    handlingMinutes: 4,
  });
  const extraInventory = inventory({
    quantity: 36,
    estimatedVolumeM3: 0.18,
    estimatedWeightKg: 5,
    handlingMinutes: 4,
  });
  const base = calculate({
    version,
    quoteInput: input({ moveSize: "1-bedroom" }),
    quoteInventory: baseInventory,
    quoteCompetitorContext,
  });
  const withExtra = calculate({
    version,
    quoteInput: input({ moveSize: "1-bedroom" }),
    quoteInventory: extraInventory,
    quoteCompetitorContext,
  });
  const extraLine = withExtra.customerBreakdown.find((line) => line.key === "extra_inventory_charge");

  assert.equal(base.status, "FIXED");
  assert.equal(withExtra.status, "FIXED");
  assert.equal(base.customerBreakdown.some((line) => line.key === "extra_inventory_charge"), false);
  assert.equal(extraLine?.amountPence, 779);
  assert.equal(base.competitorSummary.enforceExactTarget, true);
  assert.equal(withExtra.competitorSummary.enforceExactTarget, true);
  assert.ok((withExtra.finalTotalPence ?? 0) > (base.finalTotalPence ?? 0));
  assert.ok(
    (withExtra.finalTotalPence ?? 0) >=
      (withExtra.competitorSummary.targetPricePence ?? 0) + scheduleAmount(withExtra) + 779
  );
});

test("safe minimum can apply a partial competitor reduction while explaining that the benchmark was not beaten", () => {
  const result = calculate({
    quoteCompetitorContext: competitorContext({
      benchmark: competitorBenchmark({ benchmarkPricePence: 23000 }),
      campaign: beatCampaign({ competitorLabel: "Marketplace Rival", minimumPricePence: 23500 }),
    }),
  });

  assert.equal(result.status, "FIXED");
  assert.equal(result.competitorSummary.applied, true);
  assert.equal(result.competitorSummary.safeMinimumPricePence, 23500);
  assert.equal(result.competitorSummary.finalPricePence, 23500);
  assert.match(result.competitorSummary.unableReason ?? "", /Safe minimum/);
});

test("beat competitor mode does nothing when no benchmark is configured", () => {
  const result = calculate({
    quoteCompetitorContext: competitorContext({ benchmark: null }),
  });

  assert.equal(result.status, "FIXED");
  assert.equal(result.competitorSummary.applied, false);
  assert.equal(result.competitorSummary.discountPence, 0);
  assert.match(result.competitorSummary.unableReason ?? "", /No eligible competitor benchmark/);
});

test("expired competitor benchmarks are ignored", () => {
  const result = calculate({
    quoteCompetitorContext: competitorContext({
      benchmark: competitorBenchmark({ effectiveTo: "2026-08-04T00:00:00.000Z" }),
    }),
  });

  assert.equal(result.status, "FIXED");
  assert.equal(result.competitorSummary.applied, false);
  assert.match(result.competitorSummary.unableReason ?? "", /inactive or expired/);
});

test("beat competitor campaign region rules must match the quote", () => {
  const result = calculate({
    quoteCompetitorContext: competitorContext({
      campaign: beatCampaign({ applicableRegions: ["England"] }),
    }),
  });

  assert.equal(result.status, "FIXED");
  assert.equal(result.competitorSummary.applied, false);
  assert.match(result.competitorSummary.unableReason ?? "", /region/);
});

test("competitor benchmark property size must match the quote", () => {
  const result = calculate({
    quoteCompetitorContext: competitorContext({
      campaign: beatCampaign({ applicablePropertySizes: [] }),
      benchmark: competitorBenchmark({ propertySize: "1-bedroom" }),
    }),
  });

  assert.equal(result.status, "FIXED");
  assert.equal(result.competitorSummary.applied, false);
  assert.match(result.competitorSummary.unableReason ?? "", /property size mismatch/);
});

test("disabled beat competitor campaigns never reduce the price", () => {
  const result = calculate({
    quoteCompetitorContext: competitorContext({
      campaign: beatCampaign({ enabled: false }),
    }),
  });

  assert.equal(result.status, "FIXED");
  assert.equal(result.competitorSummary.applied, false);
  assert.equal(result.competitorSummary.discountPence, 0);
  assert.match(result.competitorSummary.unableReason ?? "", /disabled or paused/);
});

test("maximum discount caps can limit the beat competitor target", () => {
  const result = calculate({
    quoteCompetitorContext: competitorContext({
      benchmark: competitorBenchmark({ benchmarkPricePence: 20000 }),
      campaign: beatCampaign({ competitorLabel: "Marketplace Rival", maximumDiscountPence: 1000 }),
    }),
  });

  assert.equal(result.status, "FIXED");
  assert.equal(result.competitorSummary.applied, true);
  assert.equal(result.competitorSummary.discountPence, 1000);
  assert.match(result.competitorSummary.unableReason ?? "", /Maximum discount cap/);
});

test("minimum margin protection can block a competitor reduction", () => {
  const result = calculate({
    quoteCompetitorContext: competitorContext({
      benchmark: competitorBenchmark({ benchmarkPricePence: 22000 }),
      campaign: beatCampaign({ competitorLabel: "Marketplace Rival", minimumMarginPercent: 0.5 }),
    }),
  });

  assert.equal(result.status, "FIXED");
  assert.equal(result.competitorSummary.applied, false);
  assert.ok((result.competitorSummary.safeMinimumPricePence ?? 0) > (result.competitorSummary.targetPricePence ?? 0));
  assert.match(result.competitorSummary.unableReason ?? "", /Safe minimum/);
});

test("negative-margin beat campaigns only work when explicitly configured with a loss cap", () => {
  const result = calculate({
    version: pricingVersion({
      settings: settings({ internal_cost_percent: 0.9 }),
    }),
    quoteCompetitorContext: competitorContext({
      benchmark: competitorBenchmark({ benchmarkPricePence: 23000 }),
      campaign: beatCampaign({
        competitorLabel: "Marketplace Rival",
        allowNegativeMargin: true,
        maximumPermittedLossPence: 5000,
        minimumPricePence: 20000,
      }),
    }),
  });

  assert.equal(result.status, "FIXED");
  assert.equal(result.competitorSummary.applied, true);
  assert.ok((result.competitorSummary.finalPricePence ?? 0) < result.competitorSummary.normalOperationalPricePence);
  assert.ok((result.competitorSummary.safeMinimumPricePence ?? 0) < result.competitorSummary.normalOperationalPricePence);
});

test("rounding policy never lowers the enforced minimum booking amount", () => {
  const result = calculate({
    version: pricingVersion({
      settings: settings({
        labour_hourly_rate: 0,
        inventory_handling_per_minute: 0,
        access_difficulty_unit: 0,
        additional_stop_fee: 0,
        optional_service_unit: 0,
        heavy_item_unit: 0,
        regional_charge: 0,
        parking_or_toll_charge: 0,
        contingency_percent: 0,
        minimum_booking_amount: 123,
        rounding_increment: 10,
      }),
      vehicleClasses: [vehicle({
        baseFeePence: 0,
        perMilePence: 0,
        perHourPence: 0,
      })],
    }),
  });

  assert.equal(result.status, "FIXED");
  assert.equal(result.finalTotalPence, 13000);
  assert.ok((result.finalTotalPence ?? 0) >= 12300);
});

test("psychological rounding can end in 9 without violating the minimum price", () => {
  assert.equal(applyCustomerRounding({
    valuePence: 35100,
    minimumPence: 8000,
    incrementPence: 100,
    strategy: ROUNDING_STRATEGY.END_IN_9,
  }), 34900);

  assert.equal(applyCustomerRounding({
    valuePence: 28000,
    minimumPence: 28000,
    incrementPence: 100,
    strategy: ROUNDING_STRATEGY.END_IN_9,
  }), 28000);
});

test("engine-level psychological rounding uses the configured strategy", () => {
  const result = calculate({
    version: pricingVersion({
      settings: settings({
        rounding_increment: 1,
        rounding_strategy: ROUNDING_STRATEGY.END_IN_9,
      }),
    }),
  });

  assert.equal(result.status, "FIXED");
  assert.equal(Math.floor((result.finalTotalPence ?? 0) / 100) % 10, 9);
});

test("past move dates are never auto-priced", () => {
  const result = calculate({
    quoteInput: input({ moveDate: "2026-08-04" }),
  });

  assert.equal(result.status, "MANUAL_REVIEW");
  assert.equal(result.finalTotalPence, null);
  assert.match(result.manualReviewReasons.join("\n"), /past or invalid/);
});

test("missing server route forces manual review", () => {
  const result = calculate({ quoteRoute: null });

  assert.equal(result.status, "MANUAL_REVIEW");
  assert.equal(result.finalTotalPence, null);
  assert.match(result.manualReviewReasons.join("\n"), /route calculation is unavailable/);
});

test("inactive or unknown inventory items do not receive a fixed quote", () => {
  const result = calculate({
    quoteInventory: inventory({ active: false, name: "Unknown catalogue item" }),
  });

  assert.equal(result.status, "MANUAL_REVIEW");
  assert.match(result.manualReviewReasons.join("\n"), /Inventory item is inactive/);
});

test("customer quote schema strips forged route, item dimensions, and submitted total", () => {
  const parsed = createQuoteRequestSchema.parse({
    ...input(),
    distanceMiles: 9999,
    finalTotalPence: 1,
    originalTotalPence: 2,
    discountTotalPence: 999999,
    promotionSnapshot: { customerLabel: "Forged" },
    competitorBenchmarkId: "forged-benchmark",
    beatCompetitorCampaignId: "forged-campaign",
    competitorSnapshot: { competitorLabel: "AnyVan", benchmarkPricePence: 1 },
    benchmarkPricePence: 1,
    beatPercentage: 0.99,
    inventory: [{
      itemId: "sofa",
      quantity: 1,
      room: "living-room",
      estimatedVolumeM3: 999,
      estimatedWeightKg: 1,
      price: 1,
    }],
  });
  const parsedAsRecord = parsed as unknown as Record<string, unknown>;
  const itemAsRecord = parsed.inventory[0] as unknown as Record<string, unknown>;

  assert.equal(parsedAsRecord.distanceMiles, undefined);
  assert.equal(parsedAsRecord.finalTotalPence, undefined);
  assert.equal(parsedAsRecord.originalTotalPence, undefined);
  assert.equal(parsedAsRecord.discountTotalPence, undefined);
  assert.equal(parsedAsRecord.promotionSnapshot, undefined);
  assert.equal(parsedAsRecord.competitorBenchmarkId, undefined);
  assert.equal(parsedAsRecord.beatCompetitorCampaignId, undefined);
  assert.equal(parsedAsRecord.competitorSnapshot, undefined);
  assert.equal(parsedAsRecord.benchmarkPricePence, undefined);
  assert.equal(parsedAsRecord.beatPercentage, undefined);
  assert.equal(itemAsRecord.estimatedVolumeM3, undefined);
  assert.equal(itemAsRecord.estimatedWeightKg, undefined);
  assert.equal(itemAsRecord.price, undefined);
});

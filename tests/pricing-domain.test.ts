import assert from "node:assert/strict";
import test from "node:test";
import {
  benchmarkSelectionCriteriaForQuote,
  calculateRemovalQuote,
  classifyQuoteForPricing,
  normaliseQuoteInputForPricing,
  type PricingVersionSnapshot,
  type ResolvedInventoryItem,
  type RouteMetrics,
} from "../src/lib/pricing/domain";
import type {
  BenchmarkSelectionSnapshot,
  CompetitorBenchmarkSnapshot,
  CompetitorPricingContext,
} from "../src/lib/pricing/competitor-benchmarks";
import { buildAuthoritativePreviews, type PreviewDependencies } from "../src/app/api/quotes/preview/route";
import type { CreateQuoteRequest } from "../src/lib/quotes/schemas";

const now = new Date("2026-08-20T12:00:00.000Z");

const settings = {
  labour_hourly_rate: 1,
  helper_price: 1,
  additional_stop_fee: 10,
  access_difficulty_unit: 1,
  optional_service_unit: 10,
  assembly_price_per_item: 10,
  heavy_item_unit: 10,
  minimum_contribution: 0,
  minimum_margin_percent: 0,
  allow_zero_margin: 1,
  allow_negative_margin: 0,
};

const pricingVersion: PricingVersionSnapshot = {
  id: "pricing-v1",
  version: 1,
  status: "ACTIVE",
  settings,
  vehicleClasses: [
    {
      id: "van-1",
      name: "Luton van",
      isActive: true,
      maxUsableVolumeM3: 120,
      maxPayloadKg: 3000,
      minCrew: 1,
      maxCrew: 4,
      baseFeePence: 100,
      perMilePence: 10,
      perHourPence: 100,
      loadingEfficiencyFactor: 1,
      unloadingEfficiencyFactor: 1,
      fleetCount: 1,
      manualReviewThresholdM3: 110,
      manualReviewPayloadKg: 2800,
    },
  ],
};

const route: RouteMetrics = {
  distanceMiles: 10,
  durationMinutes: 30,
  calculatedAt: now.toISOString(),
  routeHash: "route-hash",
};

const services = {
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
};

function access(overrides: Partial<CreateQuoteRequest["collection"]> = {}): CreateQuoteRequest["collection"] {
  return {
    fullAddress: "1 Test Street, Glasgow",
    postcode: "G1 1AA",
    lat: 55.8642,
    lng: -4.2518,
    city: "Glasgow",
    region: "Scotland",
    country: "United Kingdom",
    propertyType: "Flat",
    floor: 0,
    hasLift: false,
    internalStairs: 0,
    externalStairs: 0,
    parking: "on-site",
    parkingRestrictions: "",
    carryDistanceMeters: 0,
    narrowRoad: false,
    loadingBayAvailable: false,
    accessRestrictions: "",
    notes: "",
    ...overrides,
  };
}

function quote(overrides: Partial<CreateQuoteRequest> = {}): CreateQuoteRequest {
  return {
    moveType: "house-move",
    moveSize: "2-bedrooms",
    collection: access(),
    delivery: access({
      fullAddress: "2 Test Street, Edinburgh",
      postcode: "EH1 1AA",
      lat: 55.9533,
      lng: -3.1883,
      city: "Edinburgh",
      propertyType: "House",
    }),
    additionalStop: null,
    moveDate: "2026-09-01",
    earliestDate: null,
    latestDate: null,
    arrivalWindow: "morning",
    flexibleDate: false,
    flexibleTime: false,
    exactTime: false,
    sameDay: false,
    urgent: false,
    inventory: [],
    customItems: [],
    services,
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
    promotionCode: undefined,
    sourceChannel: "test",
    ...overrides,
  };
}

function item(overrides: Partial<ResolvedInventoryItem> = {}): ResolvedInventoryItem {
  return {
    id: "sofa-1",
    category: "Sofa",
    name: "Sofa",
    quantity: 1,
    room: "living-room",
    estimatedVolumeM3: 1.2,
    estimatedWeightKg: 45,
    handlingMinutes: 20,
    requiresTwoPeople: false,
    fragile: false,
    heavy: false,
    specialist: false,
    dismantlingAvailable: false,
    assemblyAvailable: false,
    reassemblyAvailable: false,
    minimumCrew: null,
    vehicleRestrictions: [],
    active: true,
    ...overrides,
  };
}

function benchmark(input: CreateQuoteRequest, inventory: ResolvedInventoryItem[], overrides: Partial<CompetitorBenchmarkSnapshot> = {}): CompetitorBenchmarkSnapshot {
  const criteria = benchmarkSelectionCriteriaForQuote(input, inventory, route.distanceMiles);
  return {
    id: "benchmark-1",
    region: criteria.regionCandidates[0] ?? "Glasgow",
    moveType: input.moveType,
    propertySize: criteria.classification.benchmarkPropertySizes[0] ?? input.moveSize ?? "2-bedrooms",
    serviceLevel: criteria.classification.serviceLevel,
    packingIncluded: criteria.classification.packingIncluded,
    distanceBandMinMiles: 0,
    distanceBandMaxMiles: 20,
    benchmarkPricePence: 100000,
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveTo: null,
    sourceNote: "AnyVan test benchmark",
    active: true,
    ...overrides,
  };
}

function context(input: CreateQuoteRequest, inventory: ResolvedInventoryItem[], overrides: Partial<CompetitorPricingContext> = {}): CompetitorPricingContext {
  const criteria = benchmarkSelectionCriteriaForQuote(input, inventory, route.distanceMiles);
  const selected = overrides.benchmark ?? benchmark(input, inventory);
  const selection: BenchmarkSelectionSnapshot = {
    classificationKind: criteria.classification.kind,
    appliedFactor: criteria.classification.appliedFactor,
    serviceLevel: criteria.classification.serviceLevel,
    packingIncluded: criteria.classification.packingIncluded,
    requestedPropertySize: criteria.classification.requestedMoveSize,
    effectivePropertySize: criteria.classification.effectivePropertySize,
    benchmarkPropertySizes: criteria.classification.benchmarkPropertySizes,
    matchingRegion: selected?.region ?? criteria.regionCandidates[0] ?? null,
    distanceMiles: route.distanceMiles,
    missingBenchmarkDimensions: criteria.classification.missingBenchmarkDimensions,
    errorCode: null,
    errorMessage: null,
    ...(overrides.selection ?? {}),
  };
  return {
    benchmark: selected,
    campaign: null,
    serviceLevel: criteria.classification.serviceLevel,
    packingIncluded: criteria.classification.packingIncluded,
    selection,
    ...overrides,
  };
}

function price(input: CreateQuoteRequest, inventory: ResolvedInventoryItem[] = [], overrides: Partial<CompetitorPricingContext> = {}) {
  const pricingInput = normaliseQuoteInputForPricing(input, inventory);
  return calculateRemovalQuote({
    input: pricingInput,
    inventory,
    route,
    pricingVersion,
    competitorContext: context(pricingInput, inventory, overrides),
    now,
    quoteExpiresAt: new Date("2026-08-21T12:00:00.000Z"),
  });
}

function breakdownTotal(result: ReturnType<typeof price>) {
  return result.customerBreakdown.reduce((sum, line) => sum + line.amountPence, 0);
}

test("full-house benchmarks from studio through 5-plus bedrooms price at floor(benchmark * 0.90)", () => {
  for (const moveSize of ["studio", "1-bedroom", "2-bedrooms", "3-bedrooms", "4-bedrooms", "5-plus-bedrooms"] as const) {
    const input = quote({ moveSize });
    const result = price(input, [], {
      benchmark: benchmark(input, [], { benchmarkPricePence: 123457 }),
    });

    assert.equal(result.status, "FIXED");
    assert.equal(result.finalTotalPence, Math.floor(123457 * 0.9));
    assert.ok((result.finalTotalPence ?? 0) <= 123457 * 0.9);
    assert.equal(breakdownTotal(result), result.finalTotalPence);
  }
});

test("packing requires a like-for-like packing benchmark and is not added twice", () => {
  const input = quote({ services: { ...services, packing: true, packingMaterials: true } });
  const result = price(input, [], {
    benchmark: benchmark(input, [], { packingIncluded: true, benchmarkPricePence: 200000 }),
  });

  assert.equal(result.status, "FIXED");
  assert.equal(result.finalTotalPence, 180000);
  assert.equal(result.customerBreakdown.some((line) => line.key === "packing_charge"), false);
});

test("missing, expired and ambiguous benchmark states block automatic pricing", () => {
  const input = quote();

  const missing = price(input, [], {
    benchmark: null,
    selection: {
      ...context(input, []).selection,
      errorCode: "BENCHMARK_UNAVAILABLE",
      errorMessage: "No benchmark matched",
    },
  });
  assert.equal(missing.status, "MANUAL_REVIEW");
  assert.match(missing.manualReviewReasons.join("\n"), /BENCHMARK_UNAVAILABLE/);

  const expired = price(input, [], {
    benchmark: benchmark(input, [], { effectiveTo: "2026-01-01T00:00:00.000Z" }),
  });
  assert.equal(expired.status, "MANUAL_REVIEW");
  assert.match(expired.manualReviewReasons.join("\n"), /BENCHMARK_EXPIRED/);

  const ambiguous = price(input, [], {
    benchmark: null,
    selection: {
      ...context(input, []).selection,
      errorCode: "BENCHMARK_AMBIGUOUS",
      errorMessage: "Overlapping bands",
    },
  });
  assert.equal(ambiguous.status, "MANUAL_REVIEW");
  assert.match(ambiguous.manualReviewReasons.join("\n"), /BENCHMARK_AMBIGUOUS/);
});

test("item-led single sofa equals the selected item benchmark and never receives the house discount", () => {
  const input = quote({ moveType: "furniture-delivery", moveSize: "single-item", inventory: [{ itemId: "sofa-1", quantity: 1, room: "living-room" }] });
  const inventory = [item()];
  const result = price(input, inventory, {
    benchmark: benchmark(input, inventory, { propertySize: "item:sofa", benchmarkPricePence: 6400 }),
  });

  assert.equal(result.status, "FIXED");
  assert.equal(result.finalTotalPence, 6400);
  assert.equal(result.competitorSummary.appliedRule, "anyvan_item_led_100_percent");
});

test("item identity changes the benchmark class and stale item benchmarks are rejected", () => {
  const input = quote({ moveType: "furniture-delivery", moveSize: "single-item", inventory: [{ itemId: "table-1", quantity: 1, room: "dining-room" }] });
  const inventory = [item({ id: "table-1", category: "Dining", name: "Dining Table" })];
  const result = price(input, inventory, {
    benchmark: benchmark(input, inventory, { propertySize: "item:sofa", benchmarkPricePence: 6400 }),
  });

  assert.equal(result.status, "MANUAL_REVIEW");
  assert.match(result.manualReviewReasons.join("\n"), /property or item class/);
});

test("few-items/custom-inventory remain item-led; a large item-led load does not cliff into full-house pricing", () => {
  const input = quote({
    moveType: "house-move",
    moveSize: "custom-inventory",
    inventory: [
      { itemId: "sofa-1", quantity: 8, room: "living-room" },
      { itemId: "box-1", quantity: 40, room: "other" },
    ],
  });
  const inventory = [
    item({ quantity: 8, estimatedVolumeM3: 1.2, estimatedWeightKg: 45 }),
    item({ id: "box-1", name: "Large Box", category: "Boxes", quantity: 40, estimatedVolumeM3: 0.5, estimatedWeightKg: 12 }),
  ];

  const classification = classifyQuoteForPricing(input, inventory);
  assert.equal(classification.kind, "ITEM_LED");
  assert.match(classification.benchmarkPropertySizes[0] ?? "", /^inventory:/);
});

test("inventory array order normalizes to the same item-led benchmark key", () => {
  const input = quote({ moveType: "house-move", moveSize: "few-items" });
  const first = [
    item({ id: "sofa-1", name: "Sofa", quantity: 1 }),
    item({ id: "chair-1", name: "Armchair", category: "Chair", quantity: 2 }),
  ];
  const second = [...first].reverse();

  assert.equal(
    classifyQuoteForPricing(input, first).benchmarkPropertySizes[0],
    classifyQuoteForPricing(input, second).benchmarkPropertySizes[0],
  );
});

test("large full-house inventories lift the effective property size above a declared studio", () => {
  const input = quote({ moveSize: "studio" });
  const inventory = [item({ quantity: 80, estimatedVolumeM3: 0.8, estimatedWeightKg: 10 })];
  const normalised = normaliseQuoteInputForPricing(input, inventory);

  assert.equal(normalised.moveSize, "4-bedrooms");
});

test("unsafe benchmark prices become manual review instead of being silently raised", () => {
  const unsafeVersion: PricingVersionSnapshot = {
    ...pricingVersion,
    settings: { ...settings, labour_hourly_rate: 1000, allow_zero_margin: 0 },
  };
  const input = quote();
  const result = calculateRemovalQuote({
    input,
    inventory: [],
    route,
    pricingVersion: unsafeVersion,
    competitorContext: context(input, [], { benchmark: benchmark(input, [], { benchmarkPricePence: 1000 }) }),
    now,
    quoteExpiresAt: new Date("2026-08-21T12:00:00.000Z"),
  });

  assert.equal(result.status, "MANUAL_REVIEW");
  assert.equal(result.finalTotalPence, null);
  assert.match(result.manualReviewReasons.join("\n"), /SAFETY_REVIEW_REQUIRED/);
});

test("preview uses the same canonical engine and returns manual review when the route is unavailable", async () => {
  const input = quote();
  const dependencies: PreviewDependencies = {
    getActivePricingVersion: async () => pricingVersion,
    resolveInventoryForQuote: async () => ({ items: [], reasons: [] }),
    calculateServerRoute: async () => ({ route, reasons: [] }),
    getPromotionPricingContext: async () => ({
      invalidPromotionCode: null,
      context: {
        campaigns: [],
        promotionCode: null,
        priorCompletedBookings: 0,
        minimumContributionPence: 0,
        minimumMarginPercent: null,
        allowZeroMargin: true,
        allowNegativeMargin: false,
      },
    }),
    getCompetitorPricingContext: async (quoteInput, _mileage, inventory) => context(quoteInput, inventory),
  };

  const [preview] = await buildAuthoritativePreviews([input], dependencies);
  const direct = price(input);
  assert.equal(preview?.status, "FIXED");
  assert.equal(preview?.totalPence, direct.finalTotalPence);

  const manualDeps: PreviewDependencies = {
    ...dependencies,
    calculateServerRoute: async () => ({ route: null, reasons: ["Mapbox unavailable"] }),
    getCompetitorPricingContext: async (quoteInput, _mileage, inventory) => ({
      ...context(quoteInput, inventory, { benchmark: null }),
      benchmark: null,
      selection: {
        ...context(quoteInput, inventory, { benchmark: null }).selection,
        errorCode: "AUTHORITATIVE_ROUTE_UNAVAILABLE",
        errorMessage: "No route",
      },
    }),
  };
  const [manual] = await buildAuthoritativePreviews([input], manualDeps);
  assert.equal(manual?.status, "MANUAL_REVIEW");
  assert.equal(manual?.totalPence, null);
});

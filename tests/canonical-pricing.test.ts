import assert from "node:assert/strict";
import test, { before } from "node:test";
import type {
  CanonicalPricingDependencies,
  CompetitorBenchmarkForPricing,
  InventoryRecordForPricing,
  VehicleClassConfigForPricing,
} from "../src/lib/quotes/canonical-pricing";
import type { CreateQuoteRequest } from "../src/lib/quotes/schemas";

process.env.DATABASE_URL ??= "postgresql://pricing:test@localhost:5432/pricing_test";

let calculateCanonicalQuotePricing: typeof import("../src/lib/quotes/canonical-pricing").calculateCanonicalQuotePricing;
let canonicalRequestedInventory: typeof import("../src/lib/quotes/canonical-pricing").canonicalRequestedInventory;
let adjustmentBpsForDemand: typeof import("../src/lib/quotes/canonical-pricing").adjustmentBpsForDemand;
let PRICING_ALGORITHM_VERSION: typeof import("../src/lib/quotes/canonical-pricing").PRICING_ALGORITHM_VERSION;
let createQuote: typeof import("../src/lib/quotes/service").createQuote;
let createQuotePreviewPostHandler: typeof import("../src/app/api/quotes/preview/route").createQuotePreviewPostHandler;
let buildPricePreviewScopeKey: typeof import("../src/lib/booking/quote-preview-cache").buildPricePreviewScopeKey;
let buildPricePreviewChunks: typeof import("../src/lib/booking/quote-preview-cache").buildPricePreviewChunks;
let canonicalBenchmarkSavingPercent: typeof import("../src/lib/booking/quote-preview-cache").canonicalBenchmarkSavingPercent;
let canonicalPreviewInventorySignature: typeof import("../src/lib/booking/quote-preview-cache").canonicalPreviewInventorySignature;
let mergePricePreviewRecords: typeof import("../src/lib/booking/quote-preview-cache").mergePricePreviewRecords;
let shouldAcceptPricePreviewResponse: typeof import("../src/lib/booking/quote-preview-cache").shouldAcceptPricePreviewResponse;
let ITEM_METRICS_DATASET: typeof import("../src/lib/items/item-metrics").ITEM_METRICS_DATASET;
let ITEM_METRICS_BY_SLUG: typeof import("../src/lib/items/item-metrics").ITEM_METRICS_BY_SLUG;
let ITEM_METRICS_DATASET_VERSION: typeof import("../src/lib/items/item-metrics").ITEM_METRICS_DATASET_VERSION;
let CLIENT_ITEM_METRICS_DATASET_VERSION: typeof import("../src/lib/items/item-metrics-version").ITEM_METRICS_DATASET_VERSION;
let listDynamicReferenceProfiles: typeof import("../src/lib/quotes/reference-profiles").listDynamicReferenceProfiles;

before(async () => {
  const pricing = await import("../src/lib/quotes/canonical-pricing");
  const service = await import("../src/lib/quotes/service");
  const previewRoute = await import("../src/app/api/quotes/preview/route");
  const previewCache = await import("../src/lib/booking/quote-preview-cache");
  const itemMetrics = await import("../src/lib/items/item-metrics");
  const referenceProfiles = await import("../src/lib/quotes/reference-profiles");
  calculateCanonicalQuotePricing = pricing.calculateCanonicalQuotePricing;
  canonicalRequestedInventory = pricing.canonicalRequestedInventory;
  adjustmentBpsForDemand = pricing.adjustmentBpsForDemand;
  PRICING_ALGORITHM_VERSION = pricing.PRICING_ALGORITHM_VERSION;
  createQuote = service.createQuote;
  createQuotePreviewPostHandler = previewRoute.createQuotePreviewPostHandler;
  buildPricePreviewScopeKey = previewCache.buildPricePreviewScopeKey;
  buildPricePreviewChunks = previewCache.buildPricePreviewChunks;
  canonicalBenchmarkSavingPercent = previewCache.canonicalBenchmarkSavingPercent;
  canonicalPreviewInventorySignature = previewCache.canonicalPreviewInventorySignature;
  mergePricePreviewRecords = previewCache.mergePricePreviewRecords;
  shouldAcceptPricePreviewResponse = previewCache.shouldAcceptPricePreviewResponse;
  ITEM_METRICS_DATASET = itemMetrics.ITEM_METRICS_DATASET;
  ITEM_METRICS_BY_SLUG = itemMetrics.ITEM_METRICS_BY_SLUG;
  ITEM_METRICS_DATASET_VERSION = itemMetrics.ITEM_METRICS_DATASET_VERSION;
  CLIENT_ITEM_METRICS_DATASET_VERSION = (await import("../src/lib/items/item-metrics-version")).ITEM_METRICS_DATASET_VERSION;
  listDynamicReferenceProfiles = referenceProfiles.listDynamicReferenceProfiles;
});

const NOW = new Date("2026-08-21T10:00:00.000Z");
const MOVE_DATE = "2026-09-01";

const BOX = "moving-boxes-uboxes-with-handles-10-premium";
const SOFA_2 = "loveseat-2-seat-fabric-63inch";
const SOFA_3 = "sofa-3-seat-fabric-modern-lestar";
const ARMCHAIR = "armchair-1-seat-accent-chair";
const WASHING_MACHINE = "washing-machine-standard-dimensions";
const OFFICE_DESK = "office-desk-nsdirect-modern-computer-63-inch-large";
const OFFICE_CHAIR = "office-chair-neo-ergonomic-lumbar-support-adjustable-black";
const OFFICE_BOX = BOX;
const OFFICE_STORAGE = "office-storage-simple-ideas-workspace";
const SAFE = "safe-barska-fv-500-fire-vault-ax12674";
const SIDE_TABLE = "side-table-round-2-tier-fantersi";

const LUTON_CONFIG: VehicleClassConfigForPricing = {
  id: "luton-capacity-fixture",
  name: "Luton van",
  isActive: true,
  maxUsableVolumeM3: 18,
  maxPayloadKg: 1000,
  updatedAt: "2026-08-21T00:00:00.000Z",
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

function address(region = "Scotland") {
  return {
    fullAddress: "1 Test Street, Glasgow",
    postcode: "G1 1AA",
    lat: 55.8642,
    lng: -4.2518,
    city: "Glasgow",
    region,
    country: "Scotland",
    propertyType: "House",
    floor: 0,
    hasLift: false,
    internalStairs: 0,
    externalStairs: 0,
    parking: "on-site" as const,
    parkingRestrictions: "",
    carryDistanceMeters: 0,
    narrowRoad: false,
    loadingBayAvailable: true,
    accessRestrictions: "",
    notes: "",
  };
}

function quoteInput(overrides: Partial<CreateQuoteRequest> = {}): CreateQuoteRequest {
  const { services: serviceOverrides, ...rest } = overrides;
  return {
    reference: "MAQ-2026-ABC123",
    moveType: "house-move",
    moveSize: "1-bedroom",
    collection: address(),
    delivery: { ...address(), fullAddress: "2 Test Avenue, Edinburgh", postcode: "EH1 1AA" },
    additionalStop: null,
    moveDate: MOVE_DATE,
    earliestDate: null,
    latestDate: null,
    arrivalWindow: null,
    flexibleDate: false,
    flexibleTime: false,
    exactTime: false,
    sameDay: false,
    urgent: false,
    preferredMovers: 2,
    inventory: [],
    customItems: [],
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
    sourceChannel: "PUBLIC_SELF_BOOKING",
    ...rest,
    services: { ...services, ...(serviceOverrides ?? {}) },
  };
}

function itemRecord(slug: string, overrides: Partial<InventoryRecordForPricing> = {}): InventoryRecordForPricing {
  const metric = ITEM_METRICS_BY_SLUG.get(slug);
  if (!metric) throw new Error(`Missing test metric ${slug}`);
  return {
    id: slug,
    slug,
    name: metric.name,
    imagePath: metric.imagePath,
    weight: metric.heavy ? "heavy" : "medium",
    size: metric.bulky ? "large" : "medium",
    estimatedVolumeM3: null,
    estimatedWeightKg: null,
    handlingMinutes: null,
    requiresTwoPeople: false,
    fragile: false,
    heavy: false,
    specialist: false,
    minimumCrew: null,
    isActive: true,
    category: { name: metric.categoryName, type: "both" },
    ...overrides,
  };
}

function customMetricItemRecord(
  slug: string,
  overrides: {
    name?: string;
    estimatedVolumeM3: number;
    estimatedWeightKg: number;
    handlingMinutes: number;
    requiresTwoPeople?: boolean;
    heavy?: boolean;
    specialist?: boolean;
    minimumCrew?: number | null;
  }
): InventoryRecordForPricing {
  return {
    id: slug,
    slug,
    name: overrides.name ?? slug,
    imagePath: null,
    weight: overrides.heavy ? "heavy" : "medium",
    size: overrides.estimatedVolumeM3 >= 0.85 ? "large" : "medium",
    estimatedVolumeM3: overrides.estimatedVolumeM3,
    estimatedWeightKg: overrides.estimatedWeightKg,
    handlingMinutes: overrides.handlingMinutes,
    requiresTwoPeople: overrides.requiresTwoPeople ?? false,
    fragile: false,
    heavy: overrides.heavy ?? false,
    specialist: overrides.specialist ?? false,
    minimumCrew: overrides.minimumCrew ?? null,
    isActive: true,
    category: { name: "Synthetic test items", type: "both" },
  };
}

function itemsFor(slugs: string[]): InventoryRecordForPricing[] {
  return Array.from(new Set(slugs)).map((slug) => itemRecord(slug));
}

function inventoryLine(slug: string, quantity = 1) {
  return { itemId: slug, quantity, room: "living-room" as const };
}

function profileInventory(profileId: string, moveType = "house-move") {
  const profile = listDynamicReferenceProfiles().find((entry) => entry.profileId === profileId && entry.moveType === moveType);
  if (!profile) throw new Error(`Missing reference profile ${profileId} for ${moveType}`);
  return profile.items.map((item) => inventoryLine(item.slug, item.quantity));
}

function slugsFromInventory(inventory: CreateQuoteRequest["inventory"]) {
  return inventory.map((line) => line.itemId);
}

function benchmark(overrides: Partial<CompetitorBenchmarkForPricing> = {}): CompetitorBenchmarkForPricing {
  return {
    id: "benchmark-full-house",
    region: "Scotland",
    moveType: "house-move",
    propertySize: "1-bedroom",
    serviceLevel: "standard",
    packingIncluded: false,
    distanceBandMinMiles: 0,
    distanceBandMaxMiles: 50,
    benchmarkPricePence: 100_000,
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveTo: null,
    sourceNote: "Competitor snapshot",
    active: true,
    ...overrides,
  };
}

function pricingDeps(options: {
  benchmarks?: CompetitorBenchmarkForPricing[];
  items?: InventoryRecordForPricing[];
  vehicleConfigs?: VehicleClassConfigForPricing[];
  route?: { distanceMiles: number; durationMinutes: number; routeHash: string } | null;
  routeReasons?: string[];
} = {}): CanonicalPricingDependencies {
  const items = options.items ?? [];
  const benchmarks = options.benchmarks ?? [benchmark()];
  const vehicleConfigs = options.vehicleConfigs ?? [LUTON_CONFIG];
  const route = options.route === undefined
    ? { distanceMiles: 12, durationMinutes: 35, routeHash: "route-hash" }
    : options.route;

  return {
    now: NOW,
    findInventoryItems: async (itemIds) => items.filter((item) => itemIds.includes(item.id) || itemIds.includes(item.slug ?? "")),
    findCompetitorBenchmarks: async () => benchmarks,
    findVehicleClassConfigs: async () => vehicleConfigs,
    calculateRoute: async () => ({
      route: route ? { ...route, calculatedAt: NOW.toISOString() } : null,
      reasons: options.routeReasons ?? [],
    }),
  };
}

function quotePersistenceStub() {
  let createData: Record<string, unknown> | null = null;
  const dbClient = {
    quote: {
      findUnique: async () => null,
      create: async (args: unknown) => {
        const data = (args as { data: Record<string, unknown> }).data;
        createData = data;
        return {
          reference: data.reference as string,
          status: data.status as string,
          expiresAt: data.expiresAt as Date,
          routeMetrics: data.routeMetrics,
          estimatedDurationMinutes: data.estimatedDurationMinutes as number | null,
          manualReviewReasons: data.manualReviewReasons as string[],
          competitorBenchmarkId: data.competitorBenchmarkId as string | null,
          competitorSnapshot: data.competitorSnapshot,
          serverInputHash: data.serverInputHash as string,
          finalTotalPence: data.finalTotalPence as number | null,
          originalTotalPence: data.originalTotalPence as number | null,
          discountTotalPence: data.discountTotalPence as number,
          vehicleRecommendation: data.vehicleRecommendation,
          crewRecommendation: data.crewRecommendation,
          inventorySnapshot: data.inventorySnapshot,
          customerBreakdown: data.customerBreakdown,
        };
      },
    },
  };

  return {
    dbClient,
    createdData() {
      if (!createData) throw new Error("Expected quote persistence to be called");
      return createData;
    },
  };
}

test("item metrics v2 covers every manifest item with positive deterministic metrics", () => {
  assert.equal(ITEM_METRICS_DATASET.datasetVersion, ITEM_METRICS_DATASET_VERSION);
  assert.equal(CLIENT_ITEM_METRICS_DATASET_VERSION, ITEM_METRICS_DATASET_VERSION);
  assert.equal(ITEM_METRICS_DATASET.itemCount, 666);
  assert.equal(ITEM_METRICS_DATASET.items.length, 666);
  assert.equal(new Set(ITEM_METRICS_DATASET.items.map((item) => item.slug)).size, 666);
  for (const item of ITEM_METRICS_DATASET.items) {
    assert.ok(item.estimatedVolumeM3 > 0, item.slug);
    assert.ok(item.estimatedWeightKg > 0, item.slug);
    assert.ok(item.handlingMinutes > 0, item.slug);
    const calculatedVolume = Math.round(item.transportedLengthM * item.transportedWidthM * item.transportedHeightM * 1_000) / 1_000;
    assert.equal(item.estimatedVolumeM3, calculatedVolume, item.slug);
  }
});

test("canonical inventory signatures preserve quantities, identities, and deterministic order", () => {
  const one = canonicalPreviewInventorySignature([inventoryLine(BOX, 1)]);
  const five = canonicalPreviewInventorySignature([inventoryLine(BOX, 5)]);
  const ordered = canonicalPreviewInventorySignature([inventoryLine(BOX, 2), inventoryLine(SIDE_TABLE, 1)]);
  const reversed = canonicalPreviewInventorySignature([inventoryLine(SIDE_TABLE, 1), inventoryLine(BOX, 2)]);
  const sameLineCountDifferentQuantities = canonicalPreviewInventorySignature([
    inventoryLine(BOX, 1),
    inventoryLine(SIDE_TABLE, 5),
  ]);
  const sameTotalDifferentIdentities = canonicalPreviewInventorySignature([
    inventoryLine(SOFA_2, 3),
    inventoryLine(SIDE_TABLE, 3),
  ]);
  const sameTotalOtherIdentities = canonicalPreviewInventorySignature([
    inventoryLine(BOX, 3),
    inventoryLine(ARMCHAIR, 3),
  ]);
  const requested = canonicalRequestedInventory(quoteInput({
    inventory: [inventoryLine(BOX, 1), inventoryLine(BOX, 4), inventoryLine(SIDE_TABLE, 0)],
  }));

  assert.match(one, new RegExp(`${BOX}:1:${ITEM_METRICS_DATASET_VERSION}`));
  assert.match(five, new RegExp(`${BOX}:5:${ITEM_METRICS_DATASET_VERSION}`));
  assert.notEqual(one, five);
  assert.equal(ordered, reversed);
  assert.notEqual(ordered, sameLineCountDifferentQuantities);
  assert.notEqual(sameTotalDifferentIdentities, sameTotalOtherIdentities);
  assert.deepEqual(requested.lines, [{ itemId: BOX, quantity: 5 }]);
  assert.equal(requested.invalidQuantity, false);
});

test("LOW-confidence and specialist catalogue items are identifiable for manual review", () => {
  const low = ITEM_METRICS_DATASET.items.filter((item) => item.confidence === "LOW");
  const specialist = ITEM_METRICS_DATASET.items.filter((item) => item.specialist);
  assert.equal(low.length, 40);
  assert.ok(specialist.some((item) => item.slug === SAFE));
});

test("dry-run import source has a stable one-to-one slug mapping", () => {
  const slugs = ITEM_METRICS_DATASET.items.map((item) => item.slug);
  assert.equal(slugs.length, new Set(slugs).size);
  assert.ok(slugs.every((slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)));
});

test("missing and ambiguous Luton capacity references return manual review", async () => {
  const inventory = profileInventory("full-house-1-bedroom-v2");
  const missing = await calculateCanonicalQuotePricing(
    quoteInput({ inventory }),
    pricingDeps({
      items: itemsFor(slugsFromInventory(inventory)),
      benchmarks: [benchmark()],
      vehicleConfigs: [],
    })
  );
  const ambiguous = await calculateCanonicalQuotePricing(
    quoteInput({ inventory }),
    pricingDeps({
      items: itemsFor(slugsFromInventory(inventory)),
      benchmarks: [benchmark()],
      vehicleConfigs: [
        LUTON_CONFIG,
        { ...LUTON_CONFIG, id: "luton-capacity-fixture-2", updatedAt: "2026-08-22T00:00:00.000Z" },
      ],
    })
  );

  assert.equal(missing.status, "MANUAL_REVIEW");
  assert.ok(missing.reasonCodes.includes("LUTON_REFERENCE_CAPACITY_MISSING"));
  assert.equal(missing.totalPence, null);
  assert.equal(ambiguous.status, "MANUAL_REVIEW");
  assert.ok(ambiguous.reasonCodes.includes("AMBIGUOUS_LUTON_REFERENCE_CAPACITY"));
  assert.equal(ambiguous.totalPence, null);
});

test("Luton selling-rate fields do not affect capacity demand, price, or hash", async () => {
  const inventory = profileInventory("full-house-1-bedroom-v2");
  const withCheapRates = await calculateCanonicalQuotePricing(
    quoteInput({ inventory }),
    pricingDeps({
      items: itemsFor(slugsFromInventory(inventory)),
      benchmarks: [benchmark()],
      vehicleConfigs: [{ ...LUTON_CONFIG, baseFeePence: 1, perMilePence: 1, perHourPence: 1, fleetCount: 99 } as VehicleClassConfigForPricing],
    })
  );
  const withExpensiveRates = await calculateCanonicalQuotePricing(
    quoteInput({ inventory }),
    pricingDeps({
      items: itemsFor(slugsFromInventory(inventory)),
      benchmarks: [benchmark()],
      vehicleConfigs: [{ ...LUTON_CONFIG, baseFeePence: 999_999, perMilePence: 999_999, perHourPence: 999_999, fleetCount: 0 } as VehicleClassConfigForPricing],
    })
  );

  assert.equal(withCheapRates.status, "FIXED");
  assert.equal(withExpensiveRates.status, "FIXED");
  assert.equal(withCheapRates.totalPence, withExpensiveRates.totalPence);
  assert.equal(withCheapRates.serverInputHash, withExpensiveRates.serverInputHash);
  assert.deepEqual(withCheapRates.demandRatios, withExpensiveRates.demandRatios);
});

test("Luton capacity formula identifies volume, weight, equal control, and unclamped capacity over 100%", async () => {
  const volumeItem = customMetricItemRecord("synthetic-bulky-light", {
    estimatedVolumeM3: 3.6,
    estimatedWeightKg: 1,
    handlingMinutes: 5,
  });
  const weightItem = customMetricItemRecord("synthetic-compact-heavy", {
    estimatedVolumeM3: 0.1,
    estimatedWeightKg: 250,
    handlingMinutes: 5,
    heavy: true,
  });
  const equalItem = customMetricItemRecord("synthetic-equal-capacity", {
    estimatedVolumeM3: 1.8,
    estimatedWeightKg: 100,
    handlingMinutes: 5,
  });
  const overCapacityItem = customMetricItemRecord("synthetic-over-capacity", {
    estimatedVolumeM3: 27,
    estimatedWeightKg: 100,
    handlingMinutes: 5,
  });
  const deps = pricingDeps({
    items: [volumeItem, weightItem, equalItem, overCapacityItem],
    benchmarks: [benchmark({ id: "student-benchmark", moveType: "student-move", propertySize: "few-items" })],
  });
  const quoteFor = (item: InventoryRecordForPricing) => quoteInput({
    moveType: "student-move",
    moveSize: "few-items",
    inventory: [inventoryLine(item.slug!, 1)],
    preferredMovers: 1,
  });

  const volume = await calculateCanonicalQuotePricing(quoteFor(volumeItem), deps);
  const weight = await calculateCanonicalQuotePricing(quoteFor(weightItem), deps);
  const equal = await calculateCanonicalQuotePricing(quoteFor(equalItem), deps);
  const over = await calculateCanonicalQuotePricing(quoteFor(overCapacityItem), deps);

  assert.equal(volume.status, "FIXED");
  assert.equal(volume.demandRatios.volumeCapacityBps, 2_000);
  assert.equal(volume.demandRatios.controllingCapacityDimension, "VOLUME");
  assert.equal(weight.status, "FIXED");
  assert.equal(weight.demandRatios.weightCapacityBps, 2_500);
  assert.equal(weight.demandRatios.controllingCapacityDimension, "WEIGHT");
  assert.equal(equal.status, "FIXED");
  assert.equal(equal.demandRatios.volumeCapacityBps, equal.demandRatios.weightCapacityBps);
  assert.equal(equal.demandRatios.controllingCapacityDimension, "EQUAL");
  assert.equal(over.status, "MANUAL_REVIEW");
  assert.equal(over.auditSnapshot?.volumeCapacityBps, 15_000);
  assert.ok(over.reasonCodes.includes("DEMAND_EXCEEDS_AUTOMATIC_RANGE"));
});

test("quantity five multiplies aggregate Luton capacity demand inputs by five", async () => {
  const item = customMetricItemRecord("synthetic-quantity-capacity", {
    estimatedVolumeM3: 0.18,
    estimatedWeightKg: 20,
    handlingMinutes: 5,
  });
  const deps = pricingDeps({
    items: [item],
    benchmarks: [benchmark({ id: "student-benchmark", moveType: "student-move", propertySize: "few-items" })],
  });
  const one = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "student-move", moveSize: "few-items", inventory: [inventoryLine(item.slug!, 1)], preferredMovers: 1 }),
    deps
  );
  const five = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "student-move", moveSize: "few-items", inventory: [inventoryLine(item.slug!, 5)], preferredMovers: 1 }),
    deps
  );

  assert.equal(one.status, "FIXED");
  assert.equal(five.status, "FIXED");
  assert.equal(one.inventory.summary.totalVolumeM3, 0.18);
  assert.equal(five.inventory.summary.totalVolumeM3, 0.9);
  assert.equal(one.inventory.summary.totalWeightKg, 20);
  assert.equal(five.inventory.summary.totalWeightKg, 100);
  assert.equal(five.demandRatios.volumeCapacityBps, one.demandRatios.volumeCapacityBps * 5);
  assert.equal(five.demandRatios.weightCapacityBps, one.demandRatios.weightCapacityBps * 5);
  assert.ok(five.totalPence > one.totalPence);
});

test("rational demand curve hits control points and is monotonic", () => {
  assert.equal(adjustmentBpsForDemand(2_500), 7_750);
  assert.equal(adjustmentBpsForDemand(5_000), 8_500);
  assert.equal(adjustmentBpsForDemand(10_000), 10_000);
  assert.equal(adjustmentBpsForDemand(15_000), 14_615);
  assert.equal(adjustmentBpsForDemand(100_000), 46_000);

  let previous = adjustmentBpsForDemand(0);
  for (let demand = 100; demand <= 180_000; demand += 100) {
    const current = adjustmentBpsForDemand(demand);
    assert.ok(current >= previous, `demand ${demand}`);
    assert.ok(current <= 70_000, `demand ${demand}`);
    previous = current;
  }
});

test("reference inventory is exactly 90% of benchmark for every supported service", async () => {
  const cases = [
    { moveType: "house-move", moveSize: "1-bedroom", profileId: "full-house-1-bedroom-v2", benchmark: benchmark() },
    { moveType: "student-move", moveSize: "few-items", profileId: "student-move-few-items-v2", benchmark: benchmark({ id: "student-benchmark", moveType: "student-move", propertySize: "few-items" }) },
    { moveType: "marketplace-collection", moveSize: "few-items", profileId: "man-and-van-normal-load-v2", benchmark: benchmark({ id: "man-van-benchmark", moveType: "marketplace-collection", propertySize: "few-items" }) },
    { moveType: "office-move", moveSize: "office", profileId: "business-removal-office-v2", benchmark: benchmark({ id: "business-benchmark", moveType: "office-move", propertySize: "office" }) },
    { moveType: "furniture-delivery", moveSize: "few-items", profileId: "individual-few-items-v2", benchmark: benchmark({ id: "individual-benchmark", moveType: "furniture-delivery", propertySize: "few-items" }) },
  ] as const;

  for (const scenario of cases) {
    const inventory = profileInventory(scenario.profileId, scenario.moveType);
    const result = await calculateCanonicalQuotePricing(
      quoteInput({
        moveType: scenario.moveType,
        moveSize: scenario.moveSize,
        inventory,
        preferredMovers: 2,
      }),
      pricingDeps({ items: itemsFor(slugsFromInventory(inventory)), benchmarks: [scenario.benchmark] })
    );
    assert.equal(result.status, "FIXED", scenario.profileId);
    assert.equal(result.totalPence, 90_000, scenario.profileId);
    assert.equal(result.baseTargetBps, 9_000, scenario.profileId);
    assert.equal(result.adjustmentBps, 10_000, scenario.profileId);
  }
});

test("FULL_HOUSE reference inventory returns exactly 90% of benchmark", async () => {
  const inventory = profileInventory("full-house-1-bedroom-v2");
  const result = await calculateCanonicalQuotePricing(
    quoteInput({ inventory }),
    pricingDeps({ items: itemsFor(slugsFromInventory(inventory)), benchmarks: [benchmark()] })
  );

  assert.equal(result.status, "FIXED");
  assert.equal(result.totalPence, 90_000);
  assert.equal(result.canonicalInput.classification, "FULL_HOUSE");
  assert.equal(result.referenceProfile.profileId, "full-house-1-bedroom-v2");
  assert.equal(result.demandRatios.inventoryDemandBps, 10_000);
});

test("FULL_HOUSE light inventory is below 90% and heavier supported inventory rises above the reference benchmark", async () => {
  const light = [inventoryLine(BOX, 3)];
  const reference = profileInventory("full-house-1-bedroom-v2");
  const heavy = [...reference, inventoryLine(BOX, 20), inventoryLine(SOFA_3, 1)];
  const deps = pricingDeps({
    items: itemsFor([...slugsFromInventory(light), ...slugsFromInventory(heavy)]),
    benchmarks: [benchmark()],
  });

  const lightResult = await calculateCanonicalQuotePricing(quoteInput({ inventory: light, preferredMovers: 1 }), deps);
  const heavyResult = await calculateCanonicalQuotePricing(quoteInput({ inventory: heavy }), deps);

  assert.equal(lightResult.status, "FIXED");
  assert.equal(heavyResult.status, "FIXED");
  assert.ok(lightResult.totalPence < 90_000);
  assert.ok(heavyResult.totalPence > 90_000);
  assert.ok(heavyResult.totalPence > 100_000);
  assert.ok(heavyResult.totalPence <= 300_000);
  assert.equal(heavyResult.canonicalInput.classification, "FULL_HOUSE");
});

test("FULL_HOUSE inventory does not force item-led classification", async () => {
  const inventory = [inventoryLine(SOFA_2, 1), inventoryLine(BOX, 10)];
  const result = await calculateCanonicalQuotePricing(
    quoteInput({ inventory }),
    pricingDeps({ items: itemsFor(slugsFromInventory(inventory)), benchmarks: [benchmark()] })
  );

  assert.equal(result.status, "FIXED");
  assert.equal(result.canonicalInput.classification, "FULL_HOUSE");
});

test("INDIVIDUAL_ITEMS reference demand returns 90% and lighter demand falls further below benchmark", async () => {
  const reference = profileInventory("individual-few-items-v2", "furniture-delivery");
  const referenceResult = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "furniture-delivery", moveSize: "few-items", inventory: reference, preferredMovers: 2 }),
    pricingDeps({
      items: itemsFor(slugsFromInventory(reference)),
      benchmarks: [benchmark({ id: "individual-benchmark", moveType: "furniture-delivery", propertySize: "few-items" })],
    })
  );
  const lightResult = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "furniture-delivery", moveSize: "few-items", inventory: [inventoryLine(SIDE_TABLE, 1)], preferredMovers: 1 }),
    pricingDeps({
      items: itemsFor([SIDE_TABLE]),
      benchmarks: [benchmark({ id: "individual-benchmark", moveType: "furniture-delivery", propertySize: "few-items" })],
    })
  );

  assert.equal(referenceResult.status, "FIXED");
  assert.equal(referenceResult.totalPence, 90_000);
  assert.equal(referenceResult.canonicalInput.classification, "INDIVIDUAL_ITEMS");
  assert.equal(lightResult.status, "FIXED");
  assert.ok(lightResult.totalPence < 90_000);
});

test("INDIVIDUAL_ITEMS heavier supported demand costs more and can exceed the reference benchmark", async () => {
  const small = [inventoryLine(SIDE_TABLE, 1)];
  const heavy = [inventoryLine(WASHING_MACHINE, 1), inventoryLine(SOFA_3, 1)];
  const deps = pricingDeps({
    items: itemsFor([...slugsFromInventory(small), ...slugsFromInventory(heavy)]),
    benchmarks: [benchmark({ id: "individual-benchmark", moveType: "furniture-delivery", propertySize: "few-items" })],
  });

  const smallResult = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "furniture-delivery", moveSize: "few-items", inventory: small, preferredMovers: 1 }),
    deps
  );
  const heavyResult = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "furniture-delivery", moveSize: "few-items", inventory: heavy, preferredMovers: 2 }),
    deps
  );

  assert.equal(smallResult.status, "FIXED");
  assert.equal(heavyResult.status, "FIXED");
  assert.ok(heavyResult.totalPence > smallResult.totalPence);
  assert.ok(heavyResult.totalPence > 100_000);
  assert.ok(heavyResult.totalPence <= 700_000);
});

test("property size cannot convert explicitly individual item work to FULL_HOUSE", async () => {
  const inventory = [inventoryLine(SOFA_2, 1)];
  const result = await calculateCanonicalQuotePricing(
    quoteInput({
      moveType: "furniture-delivery",
      moveSize: "2-bedrooms",
      inventory,
      preferredMovers: 2,
    }),
    pricingDeps({
      items: itemsFor(slugsFromInventory(inventory)),
      benchmarks: [benchmark({ id: "individual-benchmark", moveType: "furniture-delivery", propertySize: "single-item" })],
    })
  );

  assert.equal(result.status, "FIXED");
  assert.equal(result.canonicalInput.classification, "INDIVIDUAL_ITEMS");
  assert.equal(result.canonicalInput.propertySize, "single-item");
});

test("STUDENT_MOVE uses student profile and benchmark; more boxes increase price", async () => {
  const small = [inventoryLine(BOX, 2)];
  const larger = [inventoryLine(BOX, 12), inventoryLine(SIDE_TABLE, 1)];
  const deps = pricingDeps({
    items: itemsFor([...slugsFromInventory(small), ...slugsFromInventory(larger)]),
    benchmarks: [benchmark({ id: "student-benchmark", moveType: "student-move", propertySize: "few-items" })],
  });
  const smallResult = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "student-move", moveSize: "few-items", inventory: small, preferredMovers: 1 }),
    deps
  );
  const largerResult = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "student-move", moveSize: "few-items", inventory: larger, preferredMovers: 1 }),
    deps
  );

  assert.equal(smallResult.status, "FIXED");
  assert.equal(largerResult.status, "FIXED");
  assert.equal(largerResult.referenceProfile.profileId, "student-move-few-items-v2");
  assert.ok(smallResult.totalPence < largerResult.totalPence);
  assert.notEqual(largerResult.competitorBenchmarkId, "benchmark-full-house");
});

test("MAN_AND_VAN uses marketplace collection profile without borrowing other benchmarks", async () => {
  const small = [inventoryLine(BOX, 1)];
  const larger = [inventoryLine(BOX, 10), inventoryLine(ARMCHAIR, 1)];
  const deps = pricingDeps({
    items: itemsFor([...slugsFromInventory(small), ...slugsFromInventory(larger)]),
    benchmarks: [
      benchmark({ id: "house-benchmark", moveType: "house-move", propertySize: "1-bedroom" }),
      benchmark({ id: "man-van-benchmark", moveType: "marketplace-collection", propertySize: "few-items" }),
    ],
  });
  const smallResult = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "marketplace-collection", moveSize: "few-items", inventory: small, preferredMovers: 1 }),
    deps
  );
  const largerResult = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "marketplace-collection", moveSize: "few-items", inventory: larger, preferredMovers: 1 }),
    deps
  );

  assert.equal(smallResult.status, "FIXED");
  assert.equal(largerResult.status, "FIXED");
  assert.equal(largerResult.canonicalInput.classification, "MAN_AND_VAN");
  assert.equal(largerResult.competitorBenchmarkId, "man-van-benchmark");
  assert.ok(largerResult.totalPence >= smallResult.totalPence);
});

test("BUSINESS_REMOVAL aggregates office inventory and heavier inventory increases price", async () => {
  const standard = [inventoryLine(OFFICE_BOX, 10), inventoryLine(OFFICE_DESK, 2), inventoryLine(OFFICE_CHAIR, 4)];
  const heavier = [...standard, inventoryLine(OFFICE_STORAGE, 3), inventoryLine(OFFICE_DESK, 2)];
  const deps = pricingDeps({
    items: itemsFor([...slugsFromInventory(standard), ...slugsFromInventory(heavier)]),
    benchmarks: [benchmark({ id: "business-benchmark", moveType: "office-move", propertySize: "office" })],
  });
  const standardResult = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "office-move", moveSize: "office", inventory: standard, preferredMovers: 2 }),
    deps
  );
  const heavierResult = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "office-move", moveSize: "office", inventory: heavier, preferredMovers: 2 }),
    deps
  );

  assert.equal(standardResult.status, "FIXED");
  assert.equal(heavierResult.status, "FIXED");
  assert.equal(standardResult.canonicalInput.classification, "BUSINESS_REMOVAL");
  assert.equal(heavierResult.competitorBenchmarkId, "business-benchmark");
  assert.ok(heavierResult.totalPence >= standardResult.totalPence);
});

test("specialist business inventory returns MANUAL_REVIEW", async () => {
  const inventory = [inventoryLine(SAFE, 1)];
  const result = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "office-move", moveSize: "office", inventory, preferredMovers: 2 }),
    pricingDeps({
      items: itemsFor(slugsFromInventory(inventory)),
      benchmarks: [benchmark({ id: "business-benchmark", moveType: "office-move", propertySize: "office" })],
    })
  );

  assert.equal(result.status, "MANUAL_REVIEW");
  assert.ok(result.reasonCodes.includes("ITEM_METRICS_LOW_CONFIDENCE"));
  assert.ok(result.reasonCodes.includes("SPECIALIST_ITEM_REQUIRES_REVIEW"));
});

test("two-person item upgrades required crew and one-person request is not cheaper", async () => {
  const inventory = [inventoryLine(WASHING_MACHINE, 1)];
  const deps = pricingDeps({
    items: itemsFor(slugsFromInventory(inventory)),
    benchmarks: [benchmark({ id: "man-van-benchmark", moveType: "marketplace-collection", propertySize: "few-items" })],
  });
  const oneRequested = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "marketplace-collection", moveSize: "few-items", inventory, preferredMovers: 1 }),
    deps
  );
  const twoRequested = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "marketplace-collection", moveSize: "few-items", inventory, preferredMovers: 2 }),
    deps
  );

  assert.equal(oneRequested.status, "FIXED");
  assert.equal(twoRequested.status, "FIXED");
  assert.equal(oneRequested.requiredCrew, 2);
  assert.equal(twoRequested.requiredCrew, 2);
  assert.ok(oneRequested.totalPence >= twoRequested.totalPence);
});

test("unsupported automatic crew returns MANUAL_REVIEW", async () => {
  const inventory = [inventoryLine(BOX, 1)];
  const result = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "student-move", moveSize: "few-items", inventory, preferredMovers: 3 }),
    pricingDeps({
      items: itemsFor(slugsFromInventory(inventory)),
      benchmarks: [benchmark({ id: "student-benchmark", moveType: "student-move", propertySize: "few-items" })],
    })
  );

  assert.equal(result.status, "MANUAL_REVIEW");
  assert.ok(result.reasonCodes.includes("CREW_REQUIREMENT_UNSUPPORTED"));
});

test("duplicate lines normalize and quantity multiplies volume, weight, and handling", async () => {
  const result = await calculateCanonicalQuotePricing(
    quoteInput({
      moveType: "student-move",
      moveSize: "few-items",
      inventory: [inventoryLine(BOX, 1), inventoryLine(BOX, 2)],
      preferredMovers: 1,
    }),
    pricingDeps({
      items: itemsFor([BOX]),
      benchmarks: [benchmark({ id: "student-benchmark", moveType: "student-move", propertySize: "few-items" })],
    })
  );
  const metric = ITEM_METRICS_BY_SLUG.get(BOX)!;

  assert.equal(result.status, "FIXED");
  assert.equal(result.inventory.lines.length, 1);
  assert.equal(result.inventory.lines[0]?.quantity, 3);
  assert.equal(result.inventory.summary.totalUnits, 3);
  assert.equal(result.inventory.summary.totalWeightKg, Math.round(metric.estimatedWeightKg * 3 * 10) / 10);
  assert.equal(result.inventory.summary.totalHandlingMinutes, metric.handlingMinutes * 3);
});

test("invalid quantities are rejected with a stable manual-review reason", async () => {
  const result = await calculateCanonicalQuotePricing(
    quoteInput({
      moveType: "student-move",
      moveSize: "few-items",
      inventory: [{ itemId: BOX, quantity: -1, room: "living-room" }] as CreateQuoteRequest["inventory"],
      preferredMovers: 1,
    }),
    pricingDeps({
      items: itemsFor([BOX]),
      benchmarks: [benchmark({ id: "student-benchmark", moveType: "student-move", propertySize: "few-items" })],
    })
  );

  assert.equal(result.status, "MANUAL_REVIEW");
  assert.ok(result.reasonCodes.includes("INVALID_ITEM_QUANTITY"));
});

test("missing and inactive items return stable manual-review reasons", async () => {
  const missing = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "student-move", moveSize: "few-items", inventory: [inventoryLine("missing-item", 1)], preferredMovers: 1 }),
    pricingDeps({ items: [], benchmarks: [benchmark({ id: "student-benchmark", moveType: "student-move", propertySize: "few-items" })] })
  );
  const inactive = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "student-move", moveSize: "few-items", inventory: [inventoryLine(BOX, 1)], preferredMovers: 1 }),
    pricingDeps({
      items: [itemRecord(BOX, { isActive: false })],
      benchmarks: [benchmark({ id: "student-benchmark", moveType: "student-move", propertySize: "few-items" })],
    })
  );

  assert.equal(missing.status, "MANUAL_REVIEW");
  assert.ok(missing.reasonCodes.includes("ITEM_NOT_FOUND"));
  assert.equal(inactive.status, "MANUAL_REVIEW");
  assert.ok(inactive.reasonCodes.includes("ITEM_INACTIVE"));
});

test("custom inventory returns MANUAL_REVIEW without an automatic total", async () => {
  const result = await calculateCanonicalQuotePricing(
    quoteInput({
      moveType: "furniture-delivery",
      moveSize: "few-items",
      customItems: [{ name: "Unlisted cabinet", quantity: 1, room: "living-room", notes: "" }],
    }),
    pricingDeps({ benchmarks: [benchmark({ moveType: "furniture-delivery", propertySize: "few-items" })] })
  );

  assert.equal(result.status, "MANUAL_REVIEW");
  assert.equal(result.totalPence, null);
  assert.ok(result.reasonCodes.includes("CUSTOM_INVENTORY"));
  assert.ok(result.reasonCodes.includes("UNSUPPORTED_MOVE_CLASSIFICATION"));
});

test("unsupported classification returns UNSUPPORTED_MOVE_CLASSIFICATION", async () => {
  const result = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "other", moveSize: "office", inventory: [inventoryLine(BOX, 1)] }),
    pricingDeps({ items: itemsFor([BOX]), benchmarks: [benchmark()] })
  );

  assert.equal(result.status, "MANUAL_REVIEW");
  assert.ok(result.reasonCodes.includes("UNSUPPORTED_MOVE_CLASSIFICATION"));
});

test("missing, expired, and ambiguous benchmarks use stable reason codes", async () => {
  const inventory = profileInventory("full-house-1-bedroom-v2");
  const missing = await calculateCanonicalQuotePricing(
    quoteInput({ inventory }),
    pricingDeps({ items: itemsFor(slugsFromInventory(inventory)), benchmarks: [] })
  );
  const expired = await calculateCanonicalQuotePricing(
    quoteInput({ inventory }),
    pricingDeps({ items: itemsFor(slugsFromInventory(inventory)), benchmarks: [benchmark({ effectiveTo: "2026-08-01T00:00:00.000Z" })] })
  );
  const ambiguous = await calculateCanonicalQuotePricing(
    quoteInput({ inventory }),
    pricingDeps({ items: itemsFor(slugsFromInventory(inventory)), benchmarks: [benchmark({ id: "a" }), benchmark({ id: "b" })] })
  );

  assert.equal(missing.status, "MANUAL_REVIEW");
  assert.deepEqual(missing.reasonCodes, ["MISSING_BENCHMARK"]);
  assert.equal(expired.status, "MANUAL_REVIEW");
  assert.deepEqual(expired.reasonCodes, ["EXPIRED_BENCHMARK"]);
  assert.equal(ambiguous.status, "MANUAL_REVIEW");
  assert.deepEqual(ambiguous.reasonCodes, ["AMBIGUOUS_BENCHMARK"]);
});

test("route unavailable and unreliable routes return stable reasons", async () => {
  const inventory = profileInventory("full-house-1-bedroom-v2");
  const unavailable = await calculateCanonicalQuotePricing(
    quoteInput({ inventory }),
    pricingDeps({ items: itemsFor(slugsFromInventory(inventory)), route: null, benchmarks: [benchmark()] })
  );
  const unreliable = await calculateCanonicalQuotePricing(
    quoteInput({ inventory }),
    pricingDeps({ items: itemsFor(slugsFromInventory(inventory)), routeReasons: ["Duplicate route addresses require manual review"], benchmarks: [benchmark()] })
  );

  assert.equal(unavailable.status, "MANUAL_REVIEW");
  assert.ok(unavailable.reasonCodes.includes("ROUTE_UNAVAILABLE"));
  assert.equal(unreliable.status, "MANUAL_REVIEW");
  assert.ok(unreliable.reasonCodes.includes("ROUTE_UNRELIABLE"));
});

test("monotonic: increasing quantity never reduces price", async () => {
  let previous = 0;
  for (let quantity = 1; quantity <= 8; quantity += 1) {
    const inventory = [inventoryLine(BOX, quantity)];
    const result = await calculateCanonicalQuotePricing(
      quoteInput({ moveType: "student-move", moveSize: "few-items", inventory, preferredMovers: 1 }),
      pricingDeps({
        items: itemsFor([BOX]),
        benchmarks: [benchmark({ id: "student-benchmark", moveType: "student-move", propertySize: "few-items" })],
      })
    );
    assert.equal(result.status, "FIXED");
    assert.ok(result.totalPence >= previous, `quantity ${quantity}`);
    previous = result.totalPence;
  }
});

test("direct quantity-1 and quantity-5 preview requests change metrics, demand, hash, and total", async () => {
  const deps = pricingDeps({
    items: itemsFor([SIDE_TABLE]),
    benchmarks: [benchmark({ id: "student-benchmark", moveType: "student-move", propertySize: "few-items" })],
  });
  const oneInput = quoteInput({
    moveType: "student-move",
    moveSize: "few-items",
    inventory: [inventoryLine(SIDE_TABLE, 1)],
    preferredMovers: 1,
  });
  const fiveInput = quoteInput({
    moveType: "student-move",
    moveSize: "few-items",
    inventory: [inventoryLine(SIDE_TABLE, 5)],
    preferredMovers: 1,
  });
  const handler = createQuotePreviewPostHandler(deps);
  const [one, five] = await Promise.all([
    calculateCanonicalQuotePricing(oneInput, deps),
    calculateCanonicalQuotePricing(fiveInput, deps),
  ]);
  const response = await handler(new Request("http://localhost/api/quotes/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quotes: [oneInput, fiveInput] }),
  }));
  const body = await response.json() as {
    previews: Array<{ status: string; totalPence: number | null; serverInputHash: string | null }>;
  };

  assert.equal(one.status, "FIXED");
  assert.equal(five.status, "FIXED");
  assert.equal(response.status, 200);
  assert.deepEqual(one.canonicalInput.inventory.map((item) => `${item.itemSlug}:${item.quantity}:${item.itemMetricVersion}`), [
    `${SIDE_TABLE}:1:${ITEM_METRICS_DATASET_VERSION}`,
  ]);
  assert.deepEqual(five.canonicalInput.inventory.map((item) => `${item.itemSlug}:${item.quantity}:${item.itemMetricVersion}`), [
    `${SIDE_TABLE}:5:${ITEM_METRICS_DATASET_VERSION}`,
  ]);
  assert.ok(five.inventory.summary.totalVolumeM3 > one.inventory.summary.totalVolumeM3);
  assert.ok(five.inventory.summary.totalWeightKg > one.inventory.summary.totalWeightKg);
  assert.ok(five.inventory.summary.totalHandlingMinutes > one.inventory.summary.totalHandlingMinutes);
  assert.ok(five.demandRatios.inventoryDemandBps > one.demandRatios.inventoryDemandBps);
  assert.ok(five.adjustmentBps > one.adjustmentBps);
  assert.ok(five.totalPence > one.totalPence);
  assert.notEqual(one.serverInputHash, five.serverInputHash);
  assert.equal(body.previews[0]?.totalPence, one.totalPence);
  assert.equal(body.previews[1]?.totalPence, five.totalPence);
  assert.equal(body.previews[0]?.serverInputHash, one.serverInputHash);
  assert.equal(body.previews[1]?.serverInputHash, five.serverInputHash);
});

test("changing item order does not change price or hash", async () => {
  const first = [inventoryLine(BOX, 3), inventoryLine(SIDE_TABLE, 1), inventoryLine(ARMCHAIR, 1)];
  const second = [...first].reverse();
  const deps = pricingDeps({
    items: itemsFor(slugsFromInventory(first)),
    benchmarks: [benchmark({ id: "man-van-benchmark", moveType: "marketplace-collection", propertySize: "few-items" })],
  });
  const a = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "marketplace-collection", moveSize: "few-items", inventory: first, preferredMovers: 1 }),
    deps
  );
  const b = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "marketplace-collection", moveSize: "few-items", inventory: second, preferredMovers: 1 }),
    deps
  );

  assert.equal(a.status, "FIXED");
  assert.equal(b.status, "FIXED");
  assert.equal(a.totalPence, b.totalPence);
  assert.equal(a.serverInputHash, b.serverInputHash);
});

test("quantity changes produce different fingerprints and prices", async () => {
  const deps = pricingDeps({
    items: itemsFor([SIDE_TABLE]),
    benchmarks: [benchmark({ id: "student-benchmark", moveType: "student-move", propertySize: "few-items" })],
  });
  const one = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "student-move", moveSize: "few-items", inventory: [inventoryLine(SIDE_TABLE, 1)], preferredMovers: 1 }),
    deps
  );
  const five = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "student-move", moveSize: "few-items", inventory: [inventoryLine(SIDE_TABLE, 5)], preferredMovers: 1 }),
    deps
  );

  assert.equal(one.status, "FIXED");
  assert.equal(five.status, "FIXED");
  assert.notEqual(one.serverInputHash, five.serverInputHash);
  assert.notEqual(one.totalPence, five.totalPence);
});

test("all fixed prices remain integer pence", async () => {
  const inventory = [inventoryLine(BOX, 7)];
  const result = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "student-move", moveSize: "few-items", inventory, preferredMovers: 1 }),
    pricingDeps({
      items: itemsFor(slugsFromInventory(inventory)),
      benchmarks: [benchmark({ id: "student-benchmark", moveType: "student-move", propertySize: "few-items", benchmarkPricePence: 10_001 })],
    })
  );

  assert.equal(result.status, "FIXED");
  assert.equal(Number.isInteger(result.totalPence), true);
});

test("ceiling handling keeps supported prices capped and sends unsupported demand to manual review", async () => {
  const supported = await calculateCanonicalQuotePricing(
    quoteInput({
      moveType: "student-move",
      moveSize: "few-items",
      inventory: [inventoryLine(BOX, 5)],
      preferredMovers: 1,
    }),
    pricingDeps({
      items: itemsFor([BOX]),
      benchmarks: [benchmark({ id: "student-benchmark", moveType: "student-move", propertySize: "few-items" })],
    })
  );
  const unsupported = await calculateCanonicalQuotePricing(
    quoteInput({
      moveType: "student-move",
      moveSize: "few-items",
      inventory: [inventoryLine(BOX, 99)],
      preferredMovers: 1,
    }),
    pricingDeps({
      items: itemsFor([BOX]),
      benchmarks: [benchmark({ id: "student-benchmark", moveType: "student-move", propertySize: "few-items" })],
    })
  );

  assert.equal(supported.status, "FIXED");
  assert.ok(supported.totalPence < supported.benchmarkPricePence);
  assert.equal(unsupported.status, "MANUAL_REVIEW");
  assert.ok(unsupported.reasonCodes.includes("DEMAND_EXCEEDS_AUTOMATIC_RANGE"));
  assert.equal(unsupported.totalPence, null);
});

test("preview route returns canonical v2 pricing and strips browser totals", async () => {
  const inventory = profileInventory("full-house-1-bedroom-v2");
  const handler = createQuotePreviewPostHandler(
    pricingDeps({ items: itemsFor(slugsFromInventory(inventory)), benchmarks: [benchmark({ id: "preview-benchmark", benchmarkPricePence: 100_001 })] })
  );
  const request = new Request("http://localhost/api/quotes/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quotes: [{
        ...quoteInput({ inventory }),
        totalPence: 1,
        originalTotalPence: 1,
        competitorBenchmarkId: "browser-forged-benchmark",
      }],
    }),
  });

  const response = await handler(request);
  const body = await response.json() as {
    previews: Array<{
      status: string;
      totalPence: number | null;
      competitorBenchmarkId: string | null;
      benchmarkPricePence: number | null;
      canonicalClassification: string | null;
      requiredCrew: number | null;
      savingPercent: number | null;
      serverInputHash: string | null;
      pricingAlgorithmVersion: string | null;
    }>;
  };

  assert.equal(response.status, 200);
  assert.equal(body.previews[0]?.status, "FIXED");
  assert.equal(body.previews[0]?.totalPence, 90_001);
  assert.equal(body.previews[0]?.competitorBenchmarkId, "preview-benchmark");
  assert.equal(body.previews[0]?.benchmarkPricePence, 100_001);
  assert.equal(body.previews[0]?.canonicalClassification, "FULL_HOUSE");
  assert.equal(body.previews[0]?.requiredCrew, 2);
  assert.equal(body.previews[0]?.pricingAlgorithmVersion, PRICING_ALGORITHM_VERSION);
  assert.match(body.previews[0]?.serverInputHash ?? "", /^[a-f0-9]{64}$/);
});

test("preview route rejects oversized batches with a stable validation code", async () => {
  const handler = createQuotePreviewPostHandler(pricingDeps());
  const request = new Request("http://localhost/api/quotes/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quotes: Array.from({ length: 33 }, (_, index) => quoteInput({ moveDate: `2026-09-${String(index + 1).padStart(2, "0")}` })),
    }),
  });

  const response = await handler(request);
  const text = await response.text();
  const body = JSON.parse(text) as {
    code: string;
    error: string;
    issues: Array<{ code: string; path: string }>;
  };

  assert.equal(response.status, 400);
  assert.equal(body.code, "TOO_MANY_PREVIEW_QUOTES");
  assert.equal(body.error, "Unable to load prices. Please retry.");
  assert.equal(body.issues[0]?.path, "quotes");
  assert.doesNotMatch(text, /Too big|<=\s*32|expected array/i);
});

test("42 calendar dates are chunked as 32 + 10 for one mover", () => {
  const dates = Array.from({ length: 42 }, (_, index) => `2026-10-${String(index + 1).padStart(2, "0")}`);
  const chunks = buildPricePreviewChunks(dates, [1], (date, movers) => ({ date, movers }));

  assert.deepEqual(chunks.map((chunk) => chunk.quotes.length), [32, 10]);
  assert.ok(chunks.every((chunk) => chunk.quotes.length <= 32));
});

test("preview scope key changes for increment, decrement, add, remove, and same-total redistribution", () => {
  const scope = (inventory: ReturnType<typeof inventoryLine>[]) => buildPricePreviewScopeKey({
    inventory,
    moveType: "student-move",
    propertySize: "few-items",
    pricingClassification: "STUDENT_MOVE",
    packingIncluded: false,
    serviceLevel: "standard",
    crew: [1, 2],
    pickup: address(),
    destination: { ...address(), fullAddress: "2 Test Avenue, Edinburgh", postcode: "EH1 1AA" },
    routeIdentity: "route-hash",
    distanceMiles: 12,
    referenceProfileId: "student-move-few-items-v2",
    referenceProfileVersion: "reference-profiles-v2.0.0",
  });

  const one = scope([inventoryLine(BOX, 1)]);
  const two = scope([inventoryLine(BOX, 2)]);
  const backToOne = scope([inventoryLine(BOX, 1)]);
  const removed = scope([]);
  const added = scope([inventoryLine(BOX, 1), inventoryLine(SIDE_TABLE, 1)]);
  const sameTotalSmall = scope([inventoryLine(BOX, 2)]);
  const sameTotalLarge = scope([inventoryLine(SOFA_2, 1), inventoryLine(SIDE_TABLE, 1)]);
  const capacityA = buildPricePreviewScopeKey({
    inventory: [inventoryLine(BOX, 1)],
    moveType: "student-move",
    propertySize: "few-items",
    pricingClassification: "STUDENT_MOVE",
    packingIncluded: false,
    serviceLevel: "standard",
    crew: [1, 2],
    pickup: address(),
    destination: { ...address(), fullAddress: "2 Test Avenue, Edinburgh", postcode: "EH1 1AA" },
    routeIdentity: "route-hash",
    lutonCapacityReferenceId: "luton-a",
    lutonCapacityReferenceVersion: "2026-08-21T00:00:00.000Z",
  });
  const capacityB = buildPricePreviewScopeKey({
    inventory: [inventoryLine(BOX, 1)],
    moveType: "student-move",
    propertySize: "few-items",
    pricingClassification: "STUDENT_MOVE",
    packingIncluded: false,
    serviceLevel: "standard",
    crew: [1, 2],
    pickup: address(),
    destination: { ...address(), fullAddress: "2 Test Avenue, Edinburgh", postcode: "EH1 1AA" },
    routeIdentity: "route-hash",
    lutonCapacityReferenceId: "luton-b",
    lutonCapacityReferenceVersion: "2026-08-22T00:00:00.000Z",
  });

  assert.notEqual(one, two);
  assert.notEqual(two, backToOne);
  assert.equal(one, backToOne);
  assert.notEqual(one, removed);
  assert.notEqual(one, added);
  assert.notEqual(sameTotalSmall, sameTotalLarge);
  assert.notEqual(capacityA, capacityB);
});

test("preview chunk results merge by key without erasing existing dates", () => {
  type TestPreview = {
    key: string;
    date: string;
    status: "FIXED";
    totalPence: number;
    manualReviewReasons: string[];
    pricingScopeKey?: string | null;
  };
  const first = mergePricePreviewRecords<TestPreview>({}, [
    { key: "2026-10-01::1", date: "2026-10-01", status: "FIXED", totalPence: 10_000, manualReviewReasons: [] },
  ], "scope-a");
  const merged = mergePricePreviewRecords<TestPreview>(first, [
    { key: "2026-10-02::1", date: "2026-10-02", status: "FIXED", totalPence: 11_000, manualReviewReasons: [] },
  ], "scope-a");

  assert.equal(merged["2026-10-01::1"]?.totalPence, 10_000);
  assert.equal(merged["2026-10-02::1"]?.totalPence, 11_000);
  assert.equal(merged["2026-10-01::1"]?.pricingScopeKey, "scope-a");
  assert.equal(merged["2026-10-02::1"]?.pricingScopeKey, "scope-a");
});

test("stale preview responses cannot restore obsolete prices", () => {
  assert.equal(
    shouldAcceptPricePreviewResponse({
      responseRequestId: 1,
      activeRequestId: 2,
      responsePricingScopeKey: "old",
      activePricingScopeKey: "new",
    }),
    false
  );
  assert.equal(
    shouldAcceptPricePreviewResponse({
      responseRequestId: 2,
      activeRequestId: 2,
      responsePricingScopeKey: "old-scope",
      activePricingScopeKey: "current-scope",
    }),
    false
  );
  assert.equal(
    shouldAcceptPricePreviewResponse({
      responseRequestId: 3,
      activeRequestId: 3,
      requestAborted: true,
      responsePricingScopeKey: "current-scope",
      activePricingScopeKey: "current-scope",
    }),
    false
  );
});

test("old chunks with the same date cannot overwrite the current generation", () => {
  type TestPreview = {
    key: string;
    date: string;
    status: "FIXED";
    totalPence: number;
    manualReviewReasons: string[];
    pricingScopeKey?: string | null;
  };
  const oldScope = buildPricePreviewScopeKey({
    inventory: [inventoryLine(BOX, 1)],
    moveType: "student-move",
    propertySize: "few-items",
    pricingClassification: "STUDENT_MOVE",
    packingIncluded: false,
    serviceLevel: "standard",
    crew: 1,
    pickup: address(),
    destination: { ...address(), fullAddress: "2 Test Avenue, Edinburgh", postcode: "EH1 1AA" },
  });
  const currentScope = buildPricePreviewScopeKey({
    inventory: [inventoryLine(BOX, 3)],
    moveType: "student-move",
    propertySize: "few-items",
    pricingClassification: "STUDENT_MOVE",
    packingIncluded: false,
    serviceLevel: "standard",
    crew: 1,
    pickup: address(),
    destination: { ...address(), fullAddress: "2 Test Avenue, Edinburgh", postcode: "EH1 1AA" },
  });
  let records = mergePricePreviewRecords<TestPreview>({}, [
    { key: "2026-10-01::1", date: "2026-10-01", status: "FIXED", totalPence: 30_000, manualReviewReasons: [] },
  ], currentScope);

  if (shouldAcceptPricePreviewResponse({
    responseRequestId: 1,
    activeRequestId: 3,
    responsePricingScopeKey: oldScope,
    activePricingScopeKey: currentScope,
  })) {
    records = mergePricePreviewRecords(records, [
      { key: "2026-10-01::1", date: "2026-10-01", status: "FIXED", totalPence: 10_000, manualReviewReasons: [] },
    ], oldScope);
  }

  assert.equal(records["2026-10-01::1"]?.totalPence, 30_000);
  assert.equal(records["2026-10-01::1"]?.pricingScopeKey, currentScope);
});

test("canonical benchmark saving percent supports fixed and no-price states", () => {
  assert.equal(canonicalBenchmarkSavingPercent({
    status: "FIXED",
    totalPence: 90_000,
    benchmarkPricePence: 100_000,
  }), 10);
  assert.equal(canonicalBenchmarkSavingPercent({
    status: "MANUAL_REVIEW",
    totalPence: null,
    benchmarkPricePence: 100_000,
  }), null);
});

test("preview and createQuote produce identical canonical totals and hashes", async () => {
  const inventory = profileInventory("full-house-1-bedroom-v2");
  const dependencies = pricingDeps({ items: itemsFor(slugsFromInventory(inventory)), benchmarks: [benchmark({ id: "shared-benchmark" })] });
  const handler = createQuotePreviewPostHandler(dependencies);
  const request = new Request("http://localhost/api/quotes/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quotes: [quoteInput({ inventory })] }),
  });
  const previewResponse = await handler(request);
  const previewBody = await previewResponse.json() as {
    previews: Array<{ status: string; serverInputHash: string | null; totalPence: number | null }>;
  };
  const { dbClient, createdData } = quotePersistenceStub();

  const created = await createQuote(quoteInput({ inventory }), {
    dbClient,
    now: NOW,
    notifyManualReview: async () => {},
    pricingDependencies: dependencies,
  });
  const persisted = createdData();

  assert.equal(previewResponse.status, 200);
  assert.equal(previewBody.previews[0]?.status, "FIXED");
  assert.equal(created.status, "FIXED");
  assert.equal(previewBody.previews[0]?.totalPence, created.totalPence);
  assert.equal(previewBody.previews[0]?.serverInputHash, persisted.serverInputHash);
});

test("browser totals, metrics, crew, and benchmark identities are ignored by createQuote persistence", async () => {
  const inventory = profileInventory("full-house-1-bedroom-v2");
  const { dbClient, createdData } = quotePersistenceStub();
  const response = await createQuote(
    {
      ...quoteInput({ inventory, preferredMovers: 1 }),
      totalPence: 1,
      originalTotalPence: 1,
      estimatedVolumeM3: 999,
      competitorBenchmarkId: "browser-forged-benchmark",
      serverInputHash: "browser-forged-hash",
      classification: "INDIVIDUAL_ITEMS",
    } as unknown as CreateQuoteRequest,
    {
      dbClient,
      now: NOW,
      notifyManualReview: async () => {},
      pricingDependencies: pricingDeps({ items: itemsFor(slugsFromInventory(inventory)), benchmarks: [benchmark({ benchmarkPricePence: 100_000 })] }),
    }
  );

  assert.equal(response.status, "FIXED");
  assert.equal(response.totalPence, 90_000);
  assert.equal(response.competitorBenchmarkId, "benchmark-full-house");
  assert.notEqual(response.serverInputHash, "browser-forged-hash");
  const persisted = createdData();
  const competitorSnapshot = persisted.competitorSnapshot as {
    pricingAlgorithmVersion: string;
    benchmark?: { id: string; benchmarkPricePence: number };
    classification: string;
    referenceProfile?: { profileId: string };
    requiredCrew?: number;
  };
  const inventorySnapshot = persisted.inventorySnapshot as { metricDatasetVersion: string; summary: { totalUnits: number } };
  assert.equal(persisted.finalTotalPence, 90_000);
  assert.equal((persisted.vehicleRecommendation as { name?: unknown } | null)?.name, undefined);
  assert.equal(competitorSnapshot.pricingAlgorithmVersion, PRICING_ALGORITHM_VERSION);
  assert.equal(competitorSnapshot.classification, "FULL_HOUSE");
  assert.equal(competitorSnapshot.benchmark?.id, "benchmark-full-house");
  assert.equal(competitorSnapshot.referenceProfile?.profileId, "full-house-1-bedroom-v2");
  assert.equal(competitorSnapshot.requiredCrew, 2);
  assert.equal(inventorySnapshot.metricDatasetVersion, ITEM_METRICS_DATASET_VERSION);
  assert.equal(inventorySnapshot.summary.totalUnits > 0, true);
});

test("manual review persistence has no payable total", async () => {
  const inventory = [inventoryLine(SAFE, 1)];
  const { dbClient, createdData } = quotePersistenceStub();
  const response = await createQuote(quoteInput({ moveType: "office-move", moveSize: "office", inventory, preferredMovers: 2 }), {
    dbClient,
    now: NOW,
    notifyManualReview: async () => {},
    pricingDependencies: pricingDeps({
      items: itemsFor(slugsFromInventory(inventory)),
      benchmarks: [benchmark({ id: "business-benchmark", moveType: "office-move", propertySize: "office" })],
    }),
  });

  assert.equal(response.status, "MANUAL_REVIEW");
  assert.equal(response.totalPence, null);
  const persisted = createdData();
  assert.equal(persisted.finalTotalPence, null);
  assert.equal(persisted.preDiscountTotalPence, null);
  assert.equal(persisted.originalTotalPence, null);
  assert.equal(persisted.roundingAdjustmentPence, null);
  assert.equal(persisted.competitorBenchmarkId, null);
});

test("benchmark storage failure returns quick stable data-unavailable manual review and is not cached", async () => {
  const inventory = profileInventory("full-house-1-bedroom-v2");
  let benchmarkCalls = 0;
  const dependencies: CanonicalPricingDependencies = {
    now: NOW,
    competitorBenchmarksCache: new Map(),
    findInventoryItems: async (itemIds) => itemsFor(slugsFromInventory(inventory)).filter((item) => itemIds.includes(item.id)),
    findVehicleClassConfigs: async () => [LUTON_CONFIG],
    findCompetitorBenchmarks: async () => {
      benchmarkCalls += 1;
      throw new Error("benchmark storage unavailable");
    },
    calculateRoute: async () => ({
      route: { distanceMiles: 12, durationMinutes: 35, routeHash: "route-hash", calculatedAt: NOW.toISOString() },
      reasons: [],
    }),
  };

  const first = await calculateCanonicalQuotePricing(quoteInput({ inventory }), dependencies);
  const second = await calculateCanonicalQuotePricing(quoteInput({ inventory }), dependencies);

  assert.equal(first.status, "MANUAL_REVIEW");
  assert.equal(second.status, "MANUAL_REVIEW");
  assert.deepEqual(first.reasonCodes, ["DATA_UNAVAILABLE"]);
  assert.deepEqual(second.reasonCodes, ["DATA_UNAVAILABLE"]);
  assert.equal(benchmarkCalls, 2);
});

test("no runtime result exposes a vehicle class", async () => {
  const inventory = profileInventory("full-house-1-bedroom-v2");
  const result = await calculateCanonicalQuotePricing(
    quoteInput({ inventory }),
    pricingDeps({ items: itemsFor(slugsFromInventory(inventory)), benchmarks: [benchmark()] })
  );

  assert.equal(result.status, "FIXED");
  assert.equal("vehicleRecommendation" in result, false);
  assert.doesNotMatch(result.explanation, /van|vehicle|smallest/i);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { before } from "node:test";
import type {
  AutoQuoteCanonicalPricingResult,
  CanonicalPricingDependencies,
  CanonicalPricingResult,
  CompetitorBenchmarkForPricing,
  InventoryRecordForPricing,
  VehicleClassConfigForPricing,
} from "../src/lib/quotes/canonical-pricing";
import type { CreateQuoteRequest } from "../src/lib/quotes/schemas";
import type Stripe from "stripe";

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
let reconcilePaidCheckoutSession: typeof import("../src/lib/booking/payment-fulfillment").reconcilePaidCheckoutSession;
let stripeMetadataForQuote: typeof import("../src/lib/booking/payment-fulfillment").stripeMetadataForQuote;
let checkoutSessionExpiryForQuote: typeof import("../src/lib/booking/payment-fulfillment").checkoutSessionExpiryForQuote;
let stripeEventModeMatchesKey: typeof import("../src/lib/booking/payment-fulfillment").stripeEventModeMatchesKey;
let checkoutAttemptIdempotencyKey: typeof import("../src/lib/booking/payment-fulfillment").checkoutAttemptIdempotencyKey;
let CHECKOUT_PAYMENT_METHOD_TYPES: typeof import("../src/lib/booking/payment-fulfillment").CHECKOUT_PAYMENT_METHOD_TYPES;
let createQuoteCheckoutSessionSchema: typeof import("../src/lib/quotes/schemas").createQuoteCheckoutSessionSchema;
let ITEM_METRICS_DATASET: typeof import("../src/lib/items/item-metrics").ITEM_METRICS_DATASET;
let ITEM_METRICS_BY_SLUG: typeof import("../src/lib/items/item-metrics").ITEM_METRICS_BY_SLUG;
let ITEM_METRICS_DATASET_VERSION: typeof import("../src/lib/items/item-metrics").ITEM_METRICS_DATASET_VERSION;
let CLIENT_ITEM_METRICS_DATASET_VERSION: typeof import("../src/lib/items/item-metrics-version").ITEM_METRICS_DATASET_VERSION;
let listDynamicReferenceProfiles: typeof import("../src/lib/quotes/reference-profiles").listDynamicReferenceProfiles;
let listBookableItemCategories: typeof import("../src/lib/items/catalog").listBookableItemCategories;
let getFallbackItemCategories: typeof import("../src/lib/item-catalog-fallback").getFallbackItemCategories;

before(async () => {
  const pricing = await import("../src/lib/quotes/canonical-pricing");
  const service = await import("../src/lib/quotes/service");
  const previewRoute = await import("../src/app/api/quotes/preview/route");
  const previewCache = await import("../src/lib/booking/quote-preview-cache");
  const paymentFulfillment = await import("../src/lib/booking/payment-fulfillment");
  const schemas = await import("../src/lib/quotes/schemas");
  const itemMetrics = await import("../src/lib/items/item-metrics");
  const referenceProfiles = await import("../src/lib/quotes/reference-profiles");
  const catalog = await import("../src/lib/items/catalog");
  const fallbackCatalog = await import("../src/lib/item-catalog-fallback");
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
  reconcilePaidCheckoutSession = paymentFulfillment.reconcilePaidCheckoutSession;
  stripeMetadataForQuote = paymentFulfillment.stripeMetadataForQuote;
  checkoutSessionExpiryForQuote = paymentFulfillment.checkoutSessionExpiryForQuote;
  stripeEventModeMatchesKey = paymentFulfillment.stripeEventModeMatchesKey;
  checkoutAttemptIdempotencyKey = paymentFulfillment.checkoutAttemptIdempotencyKey;
  CHECKOUT_PAYMENT_METHOD_TYPES = paymentFulfillment.CHECKOUT_PAYMENT_METHOD_TYPES;
  createQuoteCheckoutSessionSchema = schemas.createQuoteCheckoutSessionSchema;
  ITEM_METRICS_DATASET = itemMetrics.ITEM_METRICS_DATASET;
  ITEM_METRICS_BY_SLUG = itemMetrics.ITEM_METRICS_BY_SLUG;
  ITEM_METRICS_DATASET_VERSION = itemMetrics.ITEM_METRICS_DATASET_VERSION;
  CLIENT_ITEM_METRICS_DATASET_VERSION = (await import("../src/lib/items/item-metrics-version")).ITEM_METRICS_DATASET_VERSION;
  listDynamicReferenceProfiles = referenceProfiles.listDynamicReferenceProfiles;
  listBookableItemCategories = catalog.listBookableItemCategories;
  getFallbackItemCategories = fallbackCatalog.getFallbackItemCategories;
});

const NOW = new Date("2026-08-21T10:00:00.000Z");
const MOVE_DATE = "2026-09-01";

const BOX = "moving-boxes-uboxes-with-handles-10-premium";
const SOFA_2 = "loveseat-2-seat-fabric-63inch";
const SOFA_3 = "sofa-3-seat-fabric-modern-lestar";
const ARMCHAIR = "armchair-1-seat-accent-chair";
const WASHING_MACHINE = "washing-machine-standard-dimensions";
const DISHWASHER = "dishwasher-portable-vs-builtin";
const SINGLE_BED = "single-bed-frame-sussex-white";
const DOUBLE_BED = "double-bed-frame-harper-storage-mattress";
const MINI_FRIDGE = "mini-fridge-compact-single-door";
const FRIDGE_FREEZER = "refrigerator-top-freezer-7-5cuft";
const DINING_CHAIRS = "dining-chairs-mid-century-set6";
const SINGLE_WARDROBE = "wardrobe-single-door-personal-laminate-cabinet";
const DOUBLE_WARDROBE = "wardrobe-double-door-harmony-wood-better-home";
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
    findInventoryItems: async (itemIds) => items.filter((item) => itemIds.includes(item.id)),
    findCompetitorBenchmarks: async (criteria) => benchmarks
      .filter((entry) => (
        entry.region === criteria.region &&
        entry.moveType === criteria.moveType &&
        (criteria.propertySize === null || entry.propertySize === criteria.propertySize)
      ))
      .map((entry) => ({
        ...entry,
        region: criteria.region,
        moveType: criteria.moveType,
        propertySize: criteria.propertySize ?? entry.propertySize,
        serviceLevel: criteria.serviceLevel,
        packingIncluded: criteria.packingIncluded,
      })),
    findVehicleClassConfigs: async () => vehicleConfigs,
    calculateRoute: async () => ({
      route: route ? { ...route, calculatedAt: NOW.toISOString() } : null,
      reasons: options.routeReasons ?? [],
    }),
  };
}

function assertAutoQuote(
  result: CanonicalPricingResult,
  context = "quote"
): asserts result is AutoQuoteCanonicalPricingResult {
  if (result.status === "MANUAL_REVIEW") {
    assert.fail(`${context} returned MANUAL_REVIEW: ${result.reasonCodes.join(", ")}`);
  }
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

function paidQuoteForStripe(overrides: Partial<{
  id: string;
  reference: string;
  status: string;
  expiresAt: Date;
  finalTotalPence: number | null;
  serverInputHash: string;
  competitorSnapshot: unknown;
}> = {}) {
  return {
    id: "quote-id-pay",
    reference: "MAQ-2026-PAY123",
    status: "ACCEPTED",
    expiresAt: new Date("2026-09-02T12:00:00.000Z"),
    finalTotalPence: 44_500,
    serverInputHash: "hash-pay-123",
    competitorSnapshot: { pricingAlgorithmVersion: PRICING_ALGORITHM_VERSION },
    ...overrides,
  };
}

function stripePaymentIntent(
  quote = paidQuoteForStripe(),
  overrides: Partial<Stripe.PaymentIntent> = {}
): Stripe.PaymentIntent {
  return {
    id: "pi_test_authoritative",
    object: "payment_intent",
    amount: quote.finalTotalPence ?? 0,
    amount_received: quote.finalTotalPence ?? 0,
    currency: "gbp",
    status: "succeeded",
    metadata: stripeMetadataForQuote(quote),
    latest_charge: "ch_test_authoritative",
    ...overrides,
  } as Stripe.PaymentIntent;
}

function stripeCheckoutSession(
  quote = paidQuoteForStripe(),
  paymentIntent = stripePaymentIntent(quote),
  overrides: Partial<Stripe.Checkout.Session> = {}
): Stripe.Checkout.Session {
  return {
    id: "cs_test_authoritative",
    object: "checkout.session",
    amount_total: quote.finalTotalPence,
    currency: "gbp",
    payment_status: "paid",
    status: "complete",
    created: Math.floor(NOW.getTime() / 1000),
    expires_at: Math.floor(new Date("2026-08-22T10:00:00.000Z").getTime() / 1000),
    metadata: stripeMetadataForQuote(quote),
    payment_intent: paymentIntent,
    ...overrides,
  } as Stripe.Checkout.Session;
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

  assert.match(one, new RegExp(`${BOX}:living-room:1:${ITEM_METRICS_DATASET_VERSION}`));
  assert.match(five, new RegExp(`${BOX}:living-room:5:${ITEM_METRICS_DATASET_VERSION}`));
  assert.notEqual(one, five);
  assert.equal(ordered, reversed);
  assert.notEqual(ordered, sameLineCountDifferentQuantities);
  assert.notEqual(sameTotalDifferentIdentities, sameTotalOtherIdentities);
  assert.deepEqual(requested.lines, [{ itemId: BOX, quantity: 5, room: "living-room" }]);
  assert.equal(requested.invalidQuantity, false);
});

test("room is part of the inventory fingerprint without changing item identity", () => {
  const living = canonicalPreviewInventorySignature([{ itemId: BOX, quantity: 1, room: "living-room" }]);
  const bedroom = canonicalPreviewInventorySignature([{ itemId: BOX, quantity: 1, room: "bedroom" }]);
  const requested = canonicalRequestedInventory(quoteInput({
    inventory: [
      { itemId: BOX, quantity: 1, room: "living-room" },
      { itemId: BOX, quantity: 1, room: "bedroom" },
    ],
  }));

  assert.notEqual(living, bedroom);
  assert.deepEqual(requested.lines, [
    { itemId: BOX, quantity: 1, room: "bedroom" },
    { itemId: BOX, quantity: 1, room: "living-room" },
  ]);
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

test("canonical fallback catalog has one priceable metric per displayed item", async () => {
  const categories = await getFallbackItemCategories(null);
  const items = categories.flatMap((category) => category.items.map((item) => ({ ...item, category: category.name })));
  const ids = items.map((item) => item.id);
  const slugs = items.map((item) => item.slug);

  assert.equal(items.length, ITEM_METRICS_DATASET.items.length);
  assert.equal(ids.length, new Set(ids).size);
  assert.equal(slugs.length, new Set(slugs).size);

  for (const item of items) {
    assert.equal(item.id, item.slug, item.slug);
    const metric = ITEM_METRICS_BY_SLUG.get(item.id);
    assert.ok(metric, item.id);
    assert.ok(metric.estimatedVolumeM3 > 0, item.id);
    assert.ok(metric.estimatedWeightKg > 0, item.id);
    assert.ok(metric.handlingMinutes > 0, item.id);
  }
});

test("bookable API catalog exposes canonical item ids that match slugs", async () => {
  const { categories } = await listBookableItemCategories("residential");
  const items = categories.flatMap((category) => category.items);

  assert.ok(items.length > 0);
  for (const item of items) {
    assert.equal(item.id, item.slug, item.name);
    assert.ok(ITEM_METRICS_BY_SLUG.has(item.id), item.id);
  }
});

test("curated booking display order references existing canonical ids only", async () => {
  const source = readFileSync(new URL("../src/components/booking/InstantQuotePage.tsx", import.meta.url), "utf-8");
  const itemIds = Array.from(source.matchAll(/itemId: "([^"]+)"/g), (match) => match[1]!);
  const catalog = await getFallbackItemCategories("residential");
  const catalogIds = new Set(catalog.flatMap((category) => category.items.map((item) => item.id)));

  assert.equal(itemIds.length, 57);
  for (const itemId of itemIds) {
    assert.ok(catalogIds.has(itemId), itemId);
  }
});

test("frontend active path has no override or keyword inventory matcher", () => {
  const source = readFileSync(new URL("../src/components/booking/InstantQuotePage.tsx", import.meta.url), "utf-8");

  assert.doesNotMatch(source, /ITEM_ID_OVERRIDES/);
  assert.doesNotMatch(source, /ITEM_MATCH_KEYWORDS/);
  assert.doesNotMatch(source, /ITEM_KEYWORD_GROUP_OVERRIDES/);
  assert.doesNotMatch(source, /resolveInventoryPayloadItemId/);
  assert.doesNotMatch(source, /findUnusedItemByKeywords/);
  assert.doesNotMatch(source, /ITEM_LED_PROPERTY_MAX_UNITS/);
  assert.doesNotMatch(source, /moveTypeForSelectedInventory/);
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
  assert.ok(missing.reasonCodes.includes("CAPACITY_REVIEW"));
  assert.equal(missing.totalPence, null);
  assert.equal(ambiguous.status, "MANUAL_REVIEW");
  assert.ok(ambiguous.reasonCodes.includes("CAPACITY_REVIEW"));
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

  assert.equal(withCheapRates.status, "AUTO_QUOTE");
  assert.equal(withExpensiveRates.status, "AUTO_QUOTE");
  assert.equal(withCheapRates.totalPence, withExpensiveRates.totalPence);
  assert.equal(withCheapRates.serverInputHash, withExpensiveRates.serverInputHash);
  assert.deepEqual(withCheapRates.demandRatios, withExpensiveRates.demandRatios);
});

test("Luton capacity formula identifies volume, weight, equal control, and unclamped capacity over 100%", async () => {
  const volumeItem = itemRecord(SOFA_3);
  const weightItem = itemRecord(WASHING_MACHINE);
  const equalItem = itemRecord(BOX);
  const deps = pricingDeps({
    items: [volumeItem, weightItem, equalItem],
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
  const equal = await calculateCanonicalQuotePricing(
    quoteFor(equalItem),
    pricingDeps({
      items: [equalItem],
      benchmarks: [benchmark({ id: "student-benchmark", moveType: "student-move", propertySize: "few-items" })],
      vehicleConfigs: [{ ...LUTON_CONFIG, maxUsableVolumeM3: 1.1, maxPayloadKg: 300 }],
    })
  );
  const over = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "student-move", moveSize: "few-items", inventory: [inventoryLine(SOFA_3, 99)], preferredMovers: 1 }),
    pricingDeps({
      items: [volumeItem],
      benchmarks: [benchmark({ id: "student-benchmark", moveType: "student-move", propertySize: "few-items" })],
    })
  );

  assert.equal(volume.status, "AUTO_QUOTE");
  assert.equal(volume.demandRatios.controllingCapacityDimension, "VOLUME");
  assert.equal(weight.status, "AUTO_QUOTE");
  assert.equal(weight.demandRatios.controllingCapacityDimension, "WEIGHT");
  assert.equal(equal.status, "AUTO_QUOTE");
  assert.equal(equal.demandRatios.volumeCapacityBps, equal.demandRatios.weightCapacityBps);
  assert.equal(equal.demandRatios.controllingCapacityDimension, "EQUAL");
  assert.equal(over.status, "MANUAL_REVIEW");
  assert.ok((over.auditSnapshot?.volumeCapacityBps ?? 0) > 15_000);
  assert.ok(over.reasonCodes.includes("CAPACITY_REVIEW"));
});

test("quantity five multiplies aggregate Luton capacity demand inputs by five", async () => {
  const item = itemRecord(BOX);
  const metric = ITEM_METRICS_BY_SLUG.get(BOX)!;
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

  assert.equal(one.status, "AUTO_QUOTE");
  assert.equal(five.status, "AUTO_QUOTE");
  assert.equal(one.inventory.summary.totalVolumeM3, metric.estimatedVolumeM3);
  assert.equal(five.inventory.summary.totalVolumeM3, Math.round(metric.estimatedVolumeM3 * 5 * 1_000) / 1_000);
  assert.equal(one.inventory.summary.totalWeightKg, metric.estimatedWeightKg);
  assert.equal(five.inventory.summary.totalWeightKg, Math.round(metric.estimatedWeightKg * 5 * 10) / 10);
  assert.ok(five.demandRatios.volumeCapacityBps > one.demandRatios.volumeCapacityBps);
  assert.ok(five.demandRatios.weightCapacityBps > one.demandRatios.weightCapacityBps);
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

test("reference inventory returns a market-target auto quote for every supported service", async () => {
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
    assertAutoQuote(result, scenario.profileId);
    assert.ok(result.totalPence > 0, scenario.profileId);
    assert.equal(result.totalPence, result.finalPricePence, scenario.profileId);
    assert.equal(result.finalPricePence, result.roundedTargetPence, scenario.profileId);
    assert.equal(result.finalPricePence % 500, 0, scenario.profileId);
    assert.ok(result.finalPricePence <= result.marketTargetPence, scenario.profileId);
    assert.ok(result.finalPricePence >= result.costFloorPence, scenario.profileId);
    assert.equal(result.baseTargetBps, 9_000, scenario.profileId);
    assert.equal(result.adjustmentBps, 10_000, scenario.profileId);
  }
});

test("individual and few-item flows do not add hidden reference inventory", async () => {
  const singleInventory = [inventoryLine(SOFA_2, 1)];
  const fewInventory = [inventoryLine(SOFA_2, 1), inventoryLine(SIDE_TABLE, 1)];
  const single = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "furniture-delivery", moveSize: "single-item", inventory: singleInventory, preferredMovers: 2 }),
    pricingDeps({
      items: itemsFor(slugsFromInventory(singleInventory)),
      benchmarks: [benchmark({ id: "single-item-benchmark", moveType: "furniture-delivery", propertySize: "single-item" })],
    })
  );
  const few = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "furniture-delivery", moveSize: "few-items", inventory: fewInventory, preferredMovers: 2 }),
    pricingDeps({
      items: itemsFor(slugsFromInventory(fewInventory)),
      benchmarks: [benchmark({ id: "few-item-benchmark", moveType: "furniture-delivery", propertySize: "few-items" })],
    })
  );

  assert.deepEqual(single.inventory.lines.map((item) => item.itemId), [SOFA_2]);
  assert.equal(single.inventory.summary.totalUnits, 1);
  assert.deepEqual(few.inventory.lines.map((item) => item.itemId).sort(), [SIDE_TABLE, SOFA_2].sort());
  assert.equal(few.inventory.summary.totalUnits, 2);
});

test("single selected item in a property move uses the single-item market segment", async () => {
  const inventory = [inventoryLine(SINGLE_BED, 1)];
  const result = await calculateCanonicalQuotePricing(
    quoteInput({
      moveType: "house-move",
      moveSize: "1-bedroom",
      inventory,
      preferredMovers: 1,
    }),
    pricingDeps({
      items: itemsFor(slugsFromInventory(inventory)),
      benchmarks: [benchmark({
        id: "single-item-benchmark",
        moveType: "single-item-delivery",
        propertySize: "single-item",
        benchmarkPricePence: 6_300,
      })],
    })
  );

  assertAutoQuote(result);
  assert.equal(result.canonicalInput.classification, "INDIVIDUAL_ITEMS");
  assert.equal(result.canonicalInput.moveType, "single-item-delivery");
  assert.equal(result.canonicalInput.propertySize, "single-item");
  assert.equal(result.referenceProfile.profileId, "individual-single-item-v2");
  assert.equal(result.competitorBenchmarkId, "single-item-benchmark");
  assert.equal(result.marketBenchmarkPence, 6_300);
  assert.equal(result.marketTargetPence, 5_670);
  assert.equal(result.finalPricePence, 5_500);
  assert.ok(result.finalPricePence >= result.costFloorPence);
});

test("same-day single selected item in a property move stays auto-quotable against same-day market", async () => {
  const inventory = [inventoryLine(SINGLE_BED, 1)];
  const result = await calculateCanonicalQuotePricing(
    quoteInput({
      moveType: "house-move",
      moveSize: "1-bedroom",
      inventory,
      moveDate: "2026-08-22",
      sameDay: true,
      preferredMovers: 2,
    }),
    pricingDeps({
      items: [itemRecord(SINGLE_BED, { requiresTwoPeople: true, minimumCrew: 2 })],
      benchmarks: [benchmark({
        id: "single-item-same-day-benchmark",
        moveType: "single-item-delivery",
        propertySize: "single-item",
        benchmarkPricePence: 6_300,
      })],
    })
  );

  assertAutoQuote(result);
  assert.equal(result.canonicalInput.classification, "INDIVIDUAL_ITEMS");
  assert.equal(result.canonicalInput.moveType, "single-item-delivery");
  assert.equal(result.requiredCrew, 2);
  assert.equal(result.competitorBenchmarkId, "single-item-same-day-benchmark");
  assert.equal(result.marketBenchmarkPence, 16_339);
  assert.equal(result.marketTargetPence, 5_670);
  assert.equal(result.roundedTargetPence, 15_539);
  assert.equal(result.finalPricePence, 15_539);
  assert.equal(result.auditSnapshot?.dateSurchargePence, 10_039);
  assert.ok(result.finalPricePence >= result.costFloorPence);
});

test("early move dates add the configured short-notice premium and later dates stay normal", async () => {
  const inventory = [inventoryLine(SINGLE_BED, 1)];
  const dependencies = pricingDeps({
    items: itemsFor(slugsFromInventory(inventory)),
    benchmarks: [benchmark({
      id: "single-item-date-premium-benchmark",
      moveType: "single-item-delivery",
      propertySize: "single-item",
      benchmarkPricePence: 6_300,
    })],
  });
  const expectations = [
    ["2026-08-21", 10_039, 15_539],
    ["2026-08-22", 7_151, 12_651],
    ["2026-08-23", 5_021, 10_521],
    ["2026-08-24", 2_073, 7_573],
    ["2026-08-25", 1_033, 6_533],
    ["2026-08-26", 596, 6_096],
    ["2026-08-27", 0, 5_500],
  ] as const;

  for (const [moveDate, expectedSurcharge, expectedTotal] of expectations) {
    const result = await calculateCanonicalQuotePricing(
      quoteInput({
        moveType: "house-move",
        moveSize: "1-bedroom",
        inventory,
        moveDate,
        sameDay: moveDate === "2026-08-21",
        preferredMovers: 1,
      }),
      dependencies
    );

    assertAutoQuote(result, moveDate);
    assert.equal(result.auditSnapshot?.dateSurchargePence ?? 0, expectedSurcharge, moveDate);
    assert.equal(result.finalPricePence, expectedTotal, moveDate);
  }
});

test("property selection is context: no inventory stays full-house, light inventory becomes partial", async () => {
  const noInventory = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "house-move", moveSize: "1-bedroom", inventory: [] }),
    pricingDeps({ items: [], benchmarks: [benchmark()] })
  );
  const selectedInventory = [inventoryLine(BOX, 3)];
  const explicit = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "house-move", moveSize: "1-bedroom", inventory: selectedInventory }),
    pricingDeps({
      items: itemsFor(slugsFromInventory(selectedInventory)),
      benchmarks: [
        benchmark(),
        benchmark({ id: "partial-property-benchmark", moveType: "furniture-delivery", propertySize: "few-items" }),
      ],
    })
  );

  assert.equal(noInventory.status, "AUTO_QUOTE");
  assert.equal(explicit.status, "AUTO_QUOTE");
  assert.equal(noInventory.auditSnapshot?.referenceProfile?.profileId, "full-house-1-bedroom-v2");
  assert.equal(noInventory.resolvedMoveScope, "FULL_PROPERTY_MOVE");
  assert.equal(noInventory.inventory.summary.totalUnits, 0);
  assert.equal(noInventory.demandRatios.inventoryDemandBps, 10_000);
  assert.equal(explicit.canonicalInput.classification, "INDIVIDUAL_ITEMS");
  assert.equal(explicit.canonicalInput.moveType, "furniture-delivery");
  assert.equal(explicit.resolvedMoveScope, "PARTIAL_PROPERTY_MOVE");
  assert.equal(explicit.auditSnapshot?.referenceProfile?.profileId, "individual-few-items-v2");
  assert.deepEqual(explicit.inventory.lines.map((item) => item.itemId), [BOX]);
  assert.equal(explicit.inventory.summary.totalUnits, 3);
});

test("FULL_HOUSE reference inventory returns the rounded market target with a verified benchmark claim", async () => {
  const inventory = profileInventory("full-house-1-bedroom-v2");
  const result = await calculateCanonicalQuotePricing(
    quoteInput({ inventory }),
    pricingDeps({ items: itemsFor(slugsFromInventory(inventory)), benchmarks: [benchmark()] })
  );

  assertAutoQuote(result);
  assert.equal(result.totalPence, result.finalPricePence);
  assert.equal(result.finalPricePence, result.roundedTargetPence);
  assert.equal(result.finalPricePence, 90_000);
  assert.ok(result.finalPricePence >= result.costFloorPence);
  assert.equal(result.canonicalInput.classification, "FULL_HOUSE");
  assert.equal(result.competitorBenchmarkId, "benchmark-full-house");
  assert.equal(result.benchmarkPricePence, 100_000);
  assert.equal(result.savingPercent, 10);
  assert.equal(result.referenceProfile.profileId, "full-house-1-bedroom-v2");
  assert.equal(result.demandRatios.inventoryDemandBps, 10_000);
});

test("partial property inventory is below full reference and heavier supported inventory rises", async () => {
  const light = [inventoryLine(BOX, 3)];
  const reference = profileInventory("full-house-1-bedroom-v2");
  const heavy = [...reference, inventoryLine(BOX, 20), inventoryLine(SOFA_3, 1)];
  const deps = pricingDeps({
    items: itemsFor([...slugsFromInventory(light), ...slugsFromInventory(heavy)]),
    benchmarks: [
      benchmark(),
      benchmark({ id: "partial-property-benchmark", moveType: "furniture-delivery", propertySize: "few-items" }),
    ],
  });

  const lightResult = await calculateCanonicalQuotePricing(quoteInput({ inventory: light, preferredMovers: 1 }), deps);
  const heavyResult = await calculateCanonicalQuotePricing(quoteInput({ inventory: heavy }), deps);

  assert.equal(lightResult.status, "AUTO_QUOTE");
  assert.equal(heavyResult.status, "AUTO_QUOTE");
  assert.equal(lightResult.canonicalInput.classification, "INDIVIDUAL_ITEMS");
  assert.equal(lightResult.resolvedMoveScope, "PARTIAL_PROPERTY_MOVE");
  assert.ok(lightResult.totalPence < heavyResult.totalPence);
  assert.ok(heavyResult.totalPence > (lightResult.totalPence ?? 0));
  assert.ok(heavyResult.totalPence <= 300_000);
  assert.equal(heavyResult.canonicalInput.classification, "FULL_HOUSE");
  assert.equal(heavyResult.resolvedMoveScope, "FULL_PROPERTY_MOVE");
});

test("full-property inventory does not force item-led classification", async () => {
  const inventory = profileInventory("full-house-1-bedroom-v2");
  const result = await calculateCanonicalQuotePricing(
    quoteInput({ inventory }),
    pricingDeps({ items: itemsFor(slugsFromInventory(inventory)), benchmarks: [benchmark()] })
  );

  assert.equal(result.status, "AUTO_QUOTE");
  assert.equal(result.canonicalInput.classification, "FULL_HOUSE");
  assert.equal(result.resolvedMoveScope, "FULL_PROPERTY_MOVE");
});

test("one-bedroom property with sofa and table resolves as partial property move", async () => {
  const inventory = [inventoryLine(SOFA_2, 1), inventoryLine(SIDE_TABLE, 1)];
  const result = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "house-move", moveSize: "1-bedroom", inventory, preferredMovers: 2 }),
    pricingDeps({
      items: itemsFor(slugsFromInventory(inventory)),
      benchmarks: [benchmark({ id: "partial-property-benchmark", moveType: "furniture-delivery", propertySize: "few-items" })],
    })
  );

  assertAutoQuote(result);
  assert.equal(result.canonicalInput.classification, "INDIVIDUAL_ITEMS");
  assert.equal(result.canonicalInput.moveType, "furniture-delivery");
  assert.equal(result.canonicalInput.propertySize, "few-items");
  assert.equal(result.resolvedMoveScope, "PARTIAL_PROPERTY_MOVE");
  assert.equal(result.moveScopeConfidence, "HIGH");
  assert.ok(result.canonicalInput.moveScopeConfirmationRecommended);
  assert.ok((result.canonicalInput.propertyCoverageBps ?? 0) < 5_500);
});

test("ten and eleven small boxes stay partial with no count-threshold classification cliff", async () => {
  const deps = pricingDeps({
    items: itemsFor([BOX]),
    benchmarks: [benchmark({ id: "partial-property-benchmark", moveType: "furniture-delivery", propertySize: "few-items" })],
  });
  const ten = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "house-move", moveSize: "1-bedroom", inventory: [inventoryLine(BOX, 10)], preferredMovers: 1 }),
    deps
  );
  const eleven = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "house-move", moveSize: "1-bedroom", inventory: [inventoryLine(BOX, 11)], preferredMovers: 1 }),
    deps
  );

  assertAutoQuote(ten, "10 boxes");
  assertAutoQuote(eleven, "11 boxes");
  assert.equal(ten.resolvedMoveScope, "PARTIAL_PROPERTY_MOVE");
  assert.equal(eleven.resolvedMoveScope, "PARTIAL_PROPERTY_MOVE");
  assert.equal(ten.canonicalInput.classification, "INDIVIDUAL_ITEMS");
  assert.equal(eleven.canonicalInput.classification, "INDIVIDUAL_ITEMS");
  assert.deepEqual(eleven.moveScopeReasonCodes, ten.moveScopeReasonCodes);
  assert.equal(eleven.resourcePlan.vehicle.name, ten.resourcePlan.vehicle.name);
  assert.equal(eleven.resourcePlan.vehicle.multipleTripsLikely, false);
  assert.ok(eleven.demandRatios.inventoryDemandBps > ten.demandRatios.inventoryDemandBps);
  assert.notEqual(eleven.serverInputHash, ten.serverInputHash);
  assert.ok(eleven.totalPence > ten.totalPence);
  assert.ok(eleven.demandRatios.inventoryDemandBps - ten.demandRatios.inventoryDemandBps < 2_000);
});

test("one inventory row with quantity ten is ten physical units and remains partial", async () => {
  const result = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "house-move", moveSize: "1-bedroom", inventory: [inventoryLine(BOX, 10)], preferredMovers: 1 }),
    pricingDeps({
      items: itemsFor([BOX]),
      benchmarks: [benchmark({ id: "partial-property-benchmark", moveType: "furniture-delivery", propertySize: "few-items" })],
    })
  );

  assertAutoQuote(result);
  assert.equal(result.inventory.summary.totalUnits, 10);
  assert.equal(result.inventoryFacts.totalPhysicalUnits, 10);
  assert.equal(result.resolvedMoveScope, "PARTIAL_PROPERTY_MOVE");
});

test("heavy special single item keeps single-item scope and requires review for specialist handling", async () => {
  const inventory = [inventoryLine(SAFE, 1)];
  const result = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "house-move", moveSize: "1-bedroom", inventory, preferredMovers: 2 }),
    pricingDeps({
      items: itemsFor(slugsFromInventory(inventory)),
      benchmarks: [benchmark({ id: "single-item-benchmark", moveType: "single-item-delivery", propertySize: "single-item" })],
    })
  );

  assert.equal(result.status, "MANUAL_REVIEW");
  assert.equal(result.canonicalInput?.classification, "INDIVIDUAL_ITEMS");
  assert.equal(result.resolvedMoveScope, "SINGLE_ITEM_MOVE");
  assert.equal(result.inventoryFacts.totalPhysicalUnits, 1);
  assert.equal(result.inventoryFacts.specialUnitCount, 1);
  assert.ok(result.reasonCodes.includes("SPECIALIST_REVIEW"));
});

test("two bulky wardrobes can demand more resource than eleven small boxes without becoming full-house", async () => {
  const boxes = [inventoryLine(BOX, 11)];
  const wardrobes = [inventoryLine(DOUBLE_WARDROBE, 2)];
  const deps = pricingDeps({
    items: itemsFor([...slugsFromInventory(boxes), ...slugsFromInventory(wardrobes)]),
    benchmarks: [benchmark({ id: "partial-property-benchmark", moveType: "furniture-delivery", propertySize: "few-items", benchmarkPricePence: 180_000 })],
  });
  const boxResult = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "house-move", moveSize: "1-bedroom", inventory: boxes, preferredMovers: 1 }),
    deps
  );
  const wardrobeResult = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "house-move", moveSize: "1-bedroom", inventory: wardrobes, preferredMovers: 2 }),
    deps
  );

  assertAutoQuote(boxResult, "boxes");
  assertAutoQuote(wardrobeResult, "wardrobes");
  assert.equal(boxResult.resolvedMoveScope, "PARTIAL_PROPERTY_MOVE");
  assert.equal(wardrobeResult.resolvedMoveScope, "PARTIAL_PROPERTY_MOVE");
  assert.ok(wardrobeResult.inventoryFacts.bulkyUnitCount > boxResult.inventoryFacts.bulkyUnitCount);
  assert.ok(wardrobeResult.inventoryFacts.totalHandlingMinutes > boxResult.inventoryFacts.totalHandlingMinutes);
  assert.ok(wardrobeResult.totalPence > boxResult.totalPence);
});

test("INDIVIDUAL_ITEMS reference demand prices above lighter demand without requiring a competitor claim", async () => {
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

  assert.equal(referenceResult.status, "AUTO_QUOTE");
  assert.ok(referenceResult.totalPence > 0);
  assert.equal(referenceResult.canonicalInput.classification, "INDIVIDUAL_ITEMS");
  assert.equal(lightResult.status, "AUTO_QUOTE");
  assert.ok(lightResult.totalPence < referenceResult.totalPence);
});

test("INDIVIDUAL_ITEMS heavier supported demand costs more than a small item", async () => {
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

  assert.equal(smallResult.status, "AUTO_QUOTE");
  assert.equal(heavyResult.status, "AUTO_QUOTE");
  assert.ok(heavyResult.totalPence > smallResult.totalPence);
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

  assert.equal(result.status, "AUTO_QUOTE");
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

  assert.equal(smallResult.status, "AUTO_QUOTE");
  assert.equal(largerResult.status, "AUTO_QUOTE");
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
        benchmark({ id: "man-van-benchmark", moveType: "marketplace-collection", propertySize: "few-items", benchmarkPricePence: 100_000 }),
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

  assert.equal(smallResult.status, "AUTO_QUOTE");
  assert.equal(largerResult.status, "AUTO_QUOTE");
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

  assert.equal(standardResult.status, "AUTO_QUOTE");
  assert.equal(heavierResult.status, "AUTO_QUOTE");
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
  assert.ok(result.reasonCodes.includes("INVENTORY_REQUIRED"));
  assert.ok(result.reasonCodes.includes("SPECIALIST_REVIEW"));
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

  assert.equal(oneRequested.status, "AUTO_QUOTE");
  assert.equal(twoRequested.status, "AUTO_QUOTE");
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
  assert.ok(result.reasonCodes.includes("CREW_UNSAFE"));
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
      benchmarks: [benchmark({ id: "student-benchmark", moveType: "student-move", propertySize: "few-items", benchmarkPricePence: 25_000 })],
    })
  );
  const metric = ITEM_METRICS_BY_SLUG.get(BOX)!;

  assert.equal(result.status, "AUTO_QUOTE");
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
  assert.ok(result.reasonCodes.includes("INVENTORY_REQUIRED"));
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
  assert.ok(missing.reasonCodes.includes("INVENTORY_REQUIRED"));
  assert.equal(inactive.status, "MANUAL_REVIEW");
  assert.ok(inactive.reasonCodes.includes("INVENTORY_REQUIRED"));
});

test("missing metrics and ambiguous item records fail closed", async () => {
  const missingMetricItem = itemRecord(BOX, {
    id: "catalog-item-without-metric",
    slug: "catalog-item-without-metric",
  });
  const missingMetric = await calculateCanonicalQuotePricing(
    quoteInput({
      moveType: "student-move",
      moveSize: "few-items",
      inventory: [inventoryLine("catalog-item-without-metric", 1)],
      preferredMovers: 1,
    }),
    pricingDeps({
      items: [missingMetricItem],
      benchmarks: [benchmark({ id: "student-benchmark", moveType: "student-move", propertySize: "few-items" })],
    })
  );
  const ambiguous = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "student-move", moveSize: "few-items", inventory: [inventoryLine(BOX, 1)], preferredMovers: 1 }),
    {
      ...pricingDeps({
        benchmarks: [benchmark({ id: "student-benchmark", moveType: "student-move", propertySize: "few-items" })],
      }),
      findInventoryItems: async () => [
        itemRecord(BOX),
        itemRecord(BOX, { id: "duplicate-canonical-record", slug: BOX }),
      ],
    }
  );

  assert.equal(missingMetric.status, "MANUAL_REVIEW");
  assert.ok(missingMetric.reasonCodes.includes("INVENTORY_REQUIRED"));
  assert.equal(ambiguous.status, "MANUAL_REVIEW");
  assert.ok(ambiguous.reasonCodes.includes("PRICING_INPUT_INVALID"));
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
  assert.ok(result.reasonCodes.includes("INVENTORY_REQUIRED"));
  assert.ok(result.reasonCodes.includes("PRICING_INPUT_INVALID"));
});

test("unsupported classification returns UNSUPPORTED_MOVE_CLASSIFICATION", async () => {
  const result = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "other", moveSize: "office", inventory: [inventoryLine(BOX, 1)] }),
    pricingDeps({ items: itemsFor([BOX]), benchmarks: [benchmark()] })
  );

  assert.equal(result.status, "MANUAL_REVIEW");
  assert.ok(result.reasonCodes.includes("PRICING_INPUT_INVALID"));
});

test("missing, expired, and ambiguous benchmarks do not attach competitor claims", async () => {
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
  assert.equal(missing.totalPence, null);
  assert.ok(missing.reasonCodes.includes("PRICING_INPUT_INVALID"));
  assert.equal(expired.status, "MANUAL_REVIEW");
  assert.equal(expired.totalPence, null);
  assert.ok(expired.reasonCodes.includes("PRICING_INPUT_INVALID"));
  assert.equal(ambiguous.status, "MANUAL_REVIEW");
  assert.equal(ambiguous.totalPence, null);
  assert.ok(ambiguous.reasonCodes.includes("PRICING_INPUT_INVALID"));
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
  assert.ok(unavailable.reasonCodes.includes("DISTANCE_OUT_OF_RANGE"));
  assert.equal(unreliable.status, "MANUAL_REVIEW");
  assert.ok(unreliable.reasonCodes.includes("DISTANCE_OUT_OF_RANGE"));
});

test("same inventory is non-decreasing from 1 to 250 miles with a benchmark", async () => {
  const inventory = profileInventory("full-house-1-bedroom-v2");
  const distances = [1, 5, 10, 15, ...Array.from({ length: 47 }, (_, index) => 20 + index * 5)];
  let previous = 0;

  for (const distanceMiles of distances) {
    const result = await calculateCanonicalQuotePricing(
      quoteInput({ inventory }),
      pricingDeps({
        items: itemsFor(slugsFromInventory(inventory)),
        benchmarks: [benchmark({ benchmarkPricePence: 250_000, distanceBandMaxMiles: null })],
        route: {
          distanceMiles,
          durationMinutes: Math.max(12, Math.ceil(distanceMiles * 2)),
          routeHash: `distance-${distanceMiles}`,
        },
      })
    );

    assertAutoQuote(result, `${distanceMiles} miles`);
    assert.equal(result.competitorBenchmarkId, "benchmark-full-house", `${distanceMiles} miles`);
    assert.ok(result.totalPence >= previous, `${distanceMiles} miles`);
    previous = result.totalPence;
  }
});

test("distance band boundaries do not create unexplained price drops or cliffs", async () => {
  const inventory = [inventoryLine(SOFA_2, 1)];
  const distances = [1.9, 2, 2.1, 4.9, 5, 5.1, 9.9, 10, 10.1, 19.9, 20, 20.1, 49.9, 50, 50.1, 99.9, 100, 100.1, 199.9, 200, 200.1];
  let previous = 0;
  let previousDistance = 0;

  for (const distanceMiles of distances) {
    const result = await calculateCanonicalQuotePricing(
      quoteInput({ moveType: "furniture-delivery", moveSize: "single-item", inventory, preferredMovers: 2 }),
      pricingDeps({
        items: itemsFor(slugsFromInventory(inventory)),
        benchmarks: [benchmark({
          id: "single-item-benchmark",
          moveType: "furniture-delivery",
          propertySize: "single-item",
          benchmarkPricePence: 250_000,
          distanceBandMaxMiles: null,
        })],
        route: {
          distanceMiles,
          durationMinutes: Math.max(10, Math.ceil(distanceMiles * 1.8)),
          routeHash: `boundary-${distanceMiles}`,
        },
      })
    );

    assertAutoQuote(result, `${distanceMiles} miles`);
    assert.ok(result.totalPence >= previous, `${distanceMiles} miles`);
    if (previous > 0 && distanceMiles - previousDistance <= 0.3) {
      assert.ok(result.totalPence - previous <= 2_000, `${distanceMiles} miles`);
    }
    previous = result.totalPence;
    previousDistance = distanceMiles;
  }
});

test("valid low competitor targets cannot push a quote below the cost-safe floor or render a claim", async () => {
  const inventory = profileInventory("full-house-1-bedroom-v2");
  const result = await calculateCanonicalQuotePricing(
    quoteInput({ inventory }),
    pricingDeps({
      items: itemsFor(slugsFromInventory(inventory)),
      benchmarks: [benchmark({ benchmarkPricePence: 10_000 })],
    })
  );

  assert.equal(result.status, "MANUAL_REVIEW");
  assert.equal(result.totalPence, null);
  assert.ok(result.reasonCodes.includes("COST_FLOOR_CONFLICT"));
  assert.ok((result.auditSnapshot?.roundedTargetPence ?? 0) < (result.costFloorPence ?? 0));
});

test("access and packing changes alter the server fingerprint and cost floor", async () => {
  const inventory = [inventoryLine(SOFA_2, 1)];
  const base = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "furniture-delivery", moveSize: "single-item", inventory, preferredMovers: 2 }),
    pricingDeps({
      items: itemsFor(slugsFromInventory(inventory)),
      benchmarks: [benchmark({ id: "single-item-benchmark", moveType: "furniture-delivery", propertySize: "single-item", benchmarkPricePence: 150_000 })],
    })
  );
  const stairsAndPacking = await calculateCanonicalQuotePricing(
    quoteInput({
      moveType: "furniture-delivery",
      moveSize: "single-item",
      inventory,
      preferredMovers: 2,
      collection: { ...address(), floor: 3, hasLift: false, internalStairs: 2, carryDistanceMeters: 35, parking: "restricted" },
      services: { ...services, packing: true },
    }),
    pricingDeps({
      items: itemsFor(slugsFromInventory(inventory)),
      benchmarks: [benchmark({ id: "single-item-benchmark", moveType: "furniture-delivery", propertySize: "single-item", benchmarkPricePence: 150_000 })],
    })
  );

  assertAutoQuote(base, "base access");
  assertAutoQuote(stairsAndPacking, "stairs and packing");
  assert.ok(stairsAndPacking.costFloorPence > base.costFloorPence);
  assert.equal(stairsAndPacking.totalPence, base.totalPence);
  assert.notEqual(stairsAndPacking.serverInputHash, base.serverInputHash);
});

test("worsening stairs, lift, carry distance, and parking severity cannot reduce price", async () => {
  const inventory = profileInventory("full-house-1-bedroom-v2");
  const easy = await calculateCanonicalQuotePricing(
    quoteInput({ inventory }),
    pricingDeps({ items: itemsFor(slugsFromInventory(inventory)), benchmarks: [benchmark({ benchmarkPricePence: 200_000 })] })
  );
  const difficult = await calculateCanonicalQuotePricing(
    quoteInput({
      inventory,
      collection: {
        ...address(),
        floor: 4,
        hasLift: false,
        internalStairs: 4,
        externalStairs: 12,
        carryDistanceMeters: 95,
        parking: "restricted",
        narrowRoad: true,
        loadingBayAvailable: false,
      },
      delivery: {
        ...address(),
        floor: 2,
        hasLift: false,
        internalStairs: 2,
        externalStairs: 6,
        carryDistanceMeters: 60,
        parking: "paid",
        narrowRoad: true,
        loadingBayAvailable: false,
      },
    }),
    pricingDeps({ items: itemsFor(slugsFromInventory(inventory)), benchmarks: [benchmark({ benchmarkPricePence: 200_000 })] })
  );

  assertAutoQuote(easy, "easy access");
  assertAutoQuote(difficult, "difficult access");
  assert.ok(difficult.totalPence >= easy.totalPence);
  assert.ok(difficult.costFloorPence > easy.costFloorPence);
  assert.notEqual(difficult.serverInputHash, easy.serverInputHash);
});

test("adding and removing paid services changes the cost floor in the expected direction", async () => {
  const inventory = profileInventory("full-house-1-bedroom-v2");
  const base = await calculateCanonicalQuotePricing(
    quoteInput({ inventory }),
    pricingDeps({ items: itemsFor(slugsFromInventory(inventory)), benchmarks: [benchmark({ benchmarkPricePence: 200_000 })] })
  );
  const addedServices = await calculateCanonicalQuotePricing(
    quoteInput({
      inventory,
      services: {
        ...services,
        packing: true,
        packingMaterials: true,
        dismantling: true,
        reassembly: true,
        furnitureProtection: true,
        mattressProtection: true,
        dismantlingItems: 2,
        reassemblyItems: 2,
      },
    }),
    pricingDeps({ items: itemsFor(slugsFromInventory(inventory)), benchmarks: [benchmark({ benchmarkPricePence: 200_000 })] })
  );
  const removedAgain = await calculateCanonicalQuotePricing(
    quoteInput({ inventory }),
    pricingDeps({ items: itemsFor(slugsFromInventory(inventory)), benchmarks: [benchmark({ benchmarkPricePence: 200_000 })] })
  );

  assertAutoQuote(base, "base services");
  assertAutoQuote(addedServices, "added services");
  assertAutoQuote(removedAgain, "removed services");
  assert.ok(addedServices.totalPence >= base.totalPence);
  assert.ok(addedServices.costFloorPence > base.costFloorPence);
  assert.equal(removedAgain.totalPence, base.totalPence);
  assert.equal(removedAgain.costFloorPence, base.costFloorPence);
  assert.equal(removedAgain.serverInputHash, base.serverInputHash);
});

test("full-house property-size presets are monotonic under identical route and access", async () => {
  const scenarios = [
    ["1-bedroom", "full-house-1-bedroom-v2", 100_000],
    ["2-bedrooms", "full-house-2-bedrooms-v2", 140_000],
    ["3-bedrooms", "full-house-3-bedrooms-v2", 190_000],
    ["4-bedrooms", "full-house-4-bedrooms-v2", 250_000],
    ["5-plus-bedrooms", "full-house-5-plus-bedrooms-v2", 325_000],
  ] as const;
  let previous = 0;

  for (const [moveSize, profileId, benchmarkPricePence] of scenarios) {
    const inventory = profileInventory(profileId);
    const result = await calculateCanonicalQuotePricing(
      quoteInput({ moveSize, inventory }),
      pricingDeps({
        items: itemsFor(slugsFromInventory(inventory)),
        benchmarks: [benchmark({ propertySize: moveSize, benchmarkPricePence, distanceBandMaxMiles: null })],
      })
    );

    assertAutoQuote(result, moveSize);
    assert.ok(result.totalPence > previous, moveSize);
    previous = result.totalPence;
  }
});

test("monotonic: identical item quantities 1 through 12 never reduce price", async () => {
  let previous = 0;
  for (let quantity = 1; quantity <= 12; quantity += 1) {
    const inventory = [inventoryLine(BOX, quantity)];
    const result = await calculateCanonicalQuotePricing(
      quoteInput({ moveType: "student-move", moveSize: "few-items", inventory, preferredMovers: 1 }),
      pricingDeps({
        items: itemsFor([BOX]),
        benchmarks: [benchmark({ id: "student-benchmark", moveType: "student-move", propertySize: "few-items" })],
      })
    );
    assert.equal(result.status, "AUTO_QUOTE");
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

  assert.equal(one.status, "AUTO_QUOTE");
  assert.equal(five.status, "AUTO_QUOTE");
  assert.equal(response.status, 200);
  assert.deepEqual(one.canonicalInput.inventory.map((item) => `${item.itemSlug}:${item.room}:${item.quantity}:${item.itemMetricVersion}`), [
    `${SIDE_TABLE}:living-room:1:${ITEM_METRICS_DATASET_VERSION}`,
  ]);
  assert.deepEqual(five.canonicalInput.inventory.map((item) => `${item.itemSlug}:${item.room}:${item.quantity}:${item.itemMetricVersion}`), [
    `${SIDE_TABLE}:living-room:5:${ITEM_METRICS_DATASET_VERSION}`,
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

  assert.equal(a.status, "AUTO_QUOTE");
  assert.equal(b.status, "AUTO_QUOTE");
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

  assert.equal(one.status, "AUTO_QUOTE");
  assert.equal(five.status, "AUTO_QUOTE");
  assert.notEqual(one.serverInputHash, five.serverInputHash);
  assert.notEqual(one.totalPence, five.totalPence);
});

test("similar item names resolve as distinct canonical inventory lines", async () => {
  const pairs = [
    [ARMCHAIR, DINING_CHAIRS],
    [SOFA_2, SOFA_3],
    [SINGLE_BED, DOUBLE_BED],
    [MINI_FRIDGE, FRIDGE_FREEZER],
    [WASHING_MACHINE, DISHWASHER],
    [SINGLE_WARDROBE, DOUBLE_WARDROBE],
  ] as const;

  for (const [left, right] of pairs) {
    const result = await calculateCanonicalQuotePricing(
      quoteInput({
        moveType: "furniture-delivery",
        moveSize: "few-items",
        inventory: [inventoryLine(left, 1), inventoryLine(right, 1)],
        preferredMovers: 2,
      }),
      pricingDeps({
        items: itemsFor([left, right]),
        benchmarks: [benchmark({ id: `benchmark-${left}`, moveType: "furniture-delivery", propertySize: "few-items" })],
      })
    );

    assert.deepEqual(result.inventory.lines.map((item) => item.itemId).sort(), [left, right].sort());
    assert.notEqual(result.inventory.lines[0]?.itemId, result.inventory.lines[1]?.itemId);
  }
});

test("all auto-quote prices remain integer pence", async () => {
  const inventory = [inventoryLine(BOX, 7)];
  const result = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "student-move", moveSize: "few-items", inventory, preferredMovers: 1 }),
    pricingDeps({
      items: itemsFor(slugsFromInventory(inventory)),
      benchmarks: [benchmark({ id: "student-benchmark", moveType: "student-move", propertySize: "few-items", benchmarkPricePence: 100_001 })],
    })
  );

  assertAutoQuote(result);
  assert.equal(Number.isInteger(result.totalPence), true);
  assert.equal(Number.isInteger(result.finalPricePence), true);
});

test("ceiling handling keeps supported prices auto-quoted and sends unsupported demand to manual review", async () => {
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

  assertAutoQuote(supported, "supported demand");
  assert.equal(supported.totalPence, supported.roundedTargetPence);
  assert.ok(supported.finalPricePence >= supported.costFloorPence);
  assert.equal(supported.competitorBenchmarkId, "student-benchmark");
  assert.equal(unsupported.status, "MANUAL_REVIEW");
  assert.ok(unsupported.reasonCodes.includes("CAPACITY_REVIEW"));
  assert.equal(unsupported.totalPence, null);
});

test("preview route returns canonical market-target pricing and strips browser totals", async () => {
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
  assert.equal(body.previews[0]?.status, "AUTO_QUOTE");
  assert.equal(body.previews[0]?.totalPence, 90_000);
  assert.equal(body.previews[0]?.competitorBenchmarkId, "preview-benchmark");
  assert.equal(body.previews[0]?.benchmarkPricePence, 100_001);
  assert.equal(body.previews[0]?.canonicalClassification, "FULL_HOUSE");
  assert.equal(body.previews[0]?.requiredCrew, 2);
  assert.equal(body.previews[0]?.pricingAlgorithmVersion, PRICING_ALGORITHM_VERSION);
  assert.match(body.previews[0]?.serverInputHash ?? "", /^[a-f0-9]{64}$/);
});

test("preview route ignores tampered client inventory metrics", async () => {
  const cleanInput = quoteInput({
    moveType: "house-move",
    moveSize: "1-bedroom",
    inventory: [inventoryLine(BOX, 10)],
    preferredMovers: 1,
  });
  const forgedInput = {
    ...cleanInput,
    inventory: [{
      ...inventoryLine(BOX, 10),
      estimatedVolumeM3: 999,
      estimatedWeightKg: 99999,
      handlingMinutes: 9999,
      requiredCrew: 12,
      loadRatioBps: 999999,
    }],
  };
  const handler = createQuotePreviewPostHandler(
    pricingDeps({
      items: itemsFor([BOX]),
      benchmarks: [benchmark({ id: "partial-property-benchmark", moveType: "furniture-delivery", propertySize: "few-items" })],
    })
  );
  const response = await handler(new Request("http://localhost/api/quotes/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quotes: [cleanInput, forgedInput] }),
  }));
  const body = await response.json() as {
    previews: Array<{
      status: string;
      totalPence: number | null;
      serverInputHash: string | null;
      inventory: { totalVolumeM3: number; totalWeightKg: number; itemUnits: number };
      inventoryFacts: { totalVolumeM3: number; totalWeightKg: number; totalPhysicalUnits: number };
      resolvedMoveScope: string | null;
    }>;
  };

  assert.equal(response.status, 200);
  assert.equal(body.previews[0]?.status, "AUTO_QUOTE");
  assert.equal(body.previews[1]?.status, "AUTO_QUOTE");
  assert.equal(body.previews[1]?.totalPence, body.previews[0]?.totalPence);
  assert.equal(body.previews[1]?.serverInputHash, body.previews[0]?.serverInputHash);
  assert.deepEqual(body.previews[1]?.inventory, body.previews[0]?.inventory);
  assert.deepEqual(body.previews[1]?.inventoryFacts, body.previews[0]?.inventoryFacts);
  assert.equal(body.previews[1]?.resolvedMoveScope, "PARTIAL_PROPERTY_MOVE");
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
    status: "AUTO_QUOTE";
    totalPence: number;
    manualReviewReasons: string[];
    pricingScopeKey?: string | null;
  };
  const first = mergePricePreviewRecords<TestPreview>({}, [
    { key: "2026-10-01::1", date: "2026-10-01", status: "AUTO_QUOTE", totalPence: 10_000, manualReviewReasons: [] },
  ], "scope-a");
  const merged = mergePricePreviewRecords<TestPreview>(first, [
    { key: "2026-10-02::1", date: "2026-10-02", status: "AUTO_QUOTE", totalPence: 11_000, manualReviewReasons: [] },
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
    status: "AUTO_QUOTE";
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
    { key: "2026-10-01::1", date: "2026-10-01", status: "AUTO_QUOTE", totalPence: 30_000, manualReviewReasons: [] },
  ], currentScope);

  if (shouldAcceptPricePreviewResponse({
    responseRequestId: 1,
    activeRequestId: 3,
    responsePricingScopeKey: oldScope,
    activePricingScopeKey: currentScope,
  })) {
    records = mergePricePreviewRecords(records, [
      { key: "2026-10-01::1", date: "2026-10-01", status: "AUTO_QUOTE", totalPence: 10_000, manualReviewReasons: [] },
    ], oldScope);
  }

  assert.equal(records["2026-10-01::1"]?.totalPence, 30_000);
  assert.equal(records["2026-10-01::1"]?.pricingScopeKey, currentScope);
});

test("canonical benchmark saving percent supports fixed and no-price states", () => {
  assert.equal(canonicalBenchmarkSavingPercent({
    status: "AUTO_QUOTE",
    totalPence: 90_000,
    benchmarkPricePence: 100_000,
    competitorBenchmarkId: "benchmark",
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
  assert.equal(previewBody.previews[0]?.status, "AUTO_QUOTE");
  assert.equal(created.status, "AUTO_QUOTE");
  assert.equal(previewBody.previews[0]?.totalPence, created.totalPence);
  assert.equal(previewBody.previews[0]?.serverInputHash, persisted.serverInputHash);
});

test("api catalog id is preserved through preview, canonical input, and persisted quote inventory", async () => {
  const { categories } = await listBookableItemCategories("residential");
  const catalogItem = categories.flatMap((category) => category.items).find((item) => item.id === BOX);
  assert.ok(catalogItem);
  assert.equal(catalogItem.id, catalogItem.slug);

  const inventory = [{ itemId: catalogItem.id, quantity: 2, room: "living-room" as const }];
  const dependencies = pricingDeps({
    items: itemsFor([catalogItem.id]),
    benchmarks: [benchmark({ id: "identity-benchmark", moveType: "student-move", propertySize: "few-items" })],
  });
  const preview = await calculateCanonicalQuotePricing(
    quoteInput({ moveType: "student-move", moveSize: "few-items", inventory, preferredMovers: 1 }),
    dependencies
  );
  const { dbClient, createdData } = quotePersistenceStub();
  const created = await createQuote(
    quoteInput({ moveType: "student-move", moveSize: "few-items", inventory, preferredMovers: 1 }),
    {
      dbClient,
      now: NOW,
      notifyManualReview: async () => {},
      pricingDependencies: dependencies,
    }
  );
  const persisted = createdData();
  const normalisedInput = persisted.normalisedInput as {
    inventory: Array<{ itemId: string; quantity: number; room: string }>;
    canonicalPricingInput: { inventory: Array<{ itemId: string; quantity: number; room: string }> };
  };

  assert.equal(preview.status, "AUTO_QUOTE");
  assert.equal(created.status, "AUTO_QUOTE");
  assert.deepEqual(preview.canonicalInput.inventory.map((item) => item.itemId), [catalogItem.id]);
  assert.deepEqual(normalisedInput.inventory, [{ itemId: catalogItem.id, quantity: 2, room: "living-room" }]);
  assert.deepEqual(normalisedInput.canonicalPricingInput.inventory.map((item) => item.itemId), [catalogItem.id]);
  assert.equal(created.serverInputHash, preview.serverInputHash);
});

test("checkout session schema rejects client supplied amounts", () => {
  const parsed = createQuoteCheckoutSessionSchema.safeParse({
    quoteReference: "MAQ-2026-PAY123",
    idempotencyKey: "checkout-key-123",
    amount: 1,
    currency: "gbp",
  });

  assert.equal(parsed.success, false);
});

test("Stripe Checkout launch is explicitly card-only", () => {
  assert.deepEqual([...CHECKOUT_PAYMENT_METHOD_TYPES], ["card"]);
});

test("Checkout attempt idempotency is stable until a persisted Session advances it", () => {
  const initial = checkoutAttemptIdempotencyKey({
    quoteReference: "MAQ-2026-PAY123",
    serverInputHash: "server-hash",
  });
  const initialRetry = checkoutAttemptIdempotencyKey({
    quoteReference: "MAQ-2026-PAY123",
    serverInputHash: "server-hash",
    previousCheckoutSessionId: null,
  });
  const afterFirstSession = checkoutAttemptIdempotencyKey({
    quoteReference: "MAQ-2026-PAY123",
    serverInputHash: "server-hash",
    previousCheckoutSessionId: "cs_test_first",
  });
  const afterFirstSessionRetry = checkoutAttemptIdempotencyKey({
    quoteReference: "MAQ-2026-PAY123",
    serverInputHash: "server-hash",
    previousCheckoutSessionId: "cs_test_first",
  });
  const afterSecondSession = checkoutAttemptIdempotencyKey({
    quoteReference: "MAQ-2026-PAY123",
    serverInputHash: "server-hash",
    previousCheckoutSessionId: "cs_test_second",
  });

  assert.equal(initial, "checkout:MAQ-2026-PAY123:server-hash:initial");
  assert.equal(initialRetry, initial);
  assert.equal(afterFirstSessionRetry, afterFirstSession);
  assert.notEqual(afterFirstSession, initial);
  assert.notEqual(afterSecondSession, afterFirstSession);
  assert.doesNotMatch(initial, /@|customer|email/i);
});

test("Stripe webhook livemode must match the configured secret key mode", () => {
  assert.deepEqual(
    stripeEventModeMatchesKey({ eventLivemode: false, secretKey: "sk_test_123" }),
    { ok: true, mode: "test" }
  );
  assert.deepEqual(
    stripeEventModeMatchesKey({ eventLivemode: true, secretKey: "rk_live_123" }),
    { ok: true, mode: "live" }
  );
  assert.deepEqual(
    stripeEventModeMatchesKey({ eventLivemode: true, secretKey: "sk_test_123" }),
    { ok: false, code: "STRIPE_WEBHOOK_MODE_MISMATCH" }
  );
  assert.deepEqual(
    stripeEventModeMatchesKey({ eventLivemode: false, secretKey: "" }),
    { ok: false, code: "STRIPE_SECRET_KEY_MODE_UNKNOWN" }
  );
});

test("Checkout Session expiry is bounded by quote validity and Stripe limits", () => {
  const oneHourQuoteExpiry = new Date(NOW.getTime() + 60 * 60 * 1000);
  const oneHour = checkoutSessionExpiryForQuote({ now: NOW, quoteExpiresAt: oneHourQuoteExpiry });
  assert.equal(oneHour.ok, true);
  assert.equal(oneHour.ok && oneHour.expiresAt.toISOString(), oneHourQuoteExpiry.toISOString());

  const sevenDayQuoteExpiry = new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000);
  const capped = checkoutSessionExpiryForQuote({ now: NOW, quoteExpiresAt: sevenDayQuoteExpiry });
  assert.equal(capped.ok, true);
  assert.equal(capped.ok && capped.expiresAt.toISOString(), "2026-08-22T10:00:00.000Z");

  const tooShort = checkoutSessionExpiryForQuote({
    now: NOW,
    quoteExpiresAt: new Date(NOW.getTime() + 20 * 60 * 1000),
  });
  assert.equal(tooShort.ok, false);
  assert.equal(!tooShort.ok && tooShort.code, "QUOTE_REFRESH_REQUIRED");
});

test("Stripe reconciliation accepts only the persisted quote total and stores PaymentIntent semantics", () => {
  const quote = paidQuoteForStripe();
  const paymentIntent = stripePaymentIntent(quote);
  const session = stripeCheckoutSession(quote, paymentIntent);
  const result = reconcilePaidCheckoutSession({ session, paymentIntent, quote, now: NOW });

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.totalPence, quote.finalTotalPence);
  assert.equal(result.ok && result.currency, "gbp");
  assert.equal(result.ok && result.paymentIntentId, "pi_test_authoritative");
  assert.match(result.ok ? result.paymentIntentId : "", /^pi_/);
  assert.doesNotMatch(result.ok ? result.paymentIntentId : "", /^cs_/);
});

test("Stripe reconciliation rejects amount, currency, and metadata mismatches", () => {
  const quote = paidQuoteForStripe();
  const paymentIntent = stripePaymentIntent(quote);

  const amountMismatch = reconcilePaidCheckoutSession({
    quote,
    paymentIntent,
    session: stripeCheckoutSession(quote, paymentIntent, { amount_total: quote.finalTotalPence! + 100 }),
    now: NOW,
  });
  assert.equal(amountMismatch.ok, false);
  assert.ok(!amountMismatch.ok && amountMismatch.reasons.includes("SESSION_AMOUNT_MISMATCH"));

  const currencyMismatch = reconcilePaidCheckoutSession({
    quote,
    paymentIntent: stripePaymentIntent(quote, { currency: "usd" }),
    session: stripeCheckoutSession(quote, paymentIntent, { currency: "usd" }),
    now: NOW,
  });
  assert.equal(currencyMismatch.ok, false);
  assert.ok(!currencyMismatch.ok && currencyMismatch.reasons.includes("SESSION_CURRENCY_MISMATCH"));
  assert.ok(!currencyMismatch.ok && currencyMismatch.reasons.includes("PAYMENT_INTENT_CURRENCY_MISMATCH"));

  const metadataMismatchIntent = stripePaymentIntent(quote, {
    metadata: { ...stripeMetadataForQuote(quote), quoteReference: "MAQ-2026-OTHER1" },
  });
  const metadataMismatch = reconcilePaidCheckoutSession({
    quote,
    paymentIntent: metadataMismatchIntent,
    session: stripeCheckoutSession(quote, metadataMismatchIntent, {
      metadata: { ...stripeMetadataForQuote(quote), serverInputHash: "different-hash" },
    }),
    now: NOW,
  });
  assert.equal(metadataMismatch.ok, false);
  assert.ok(!metadataMismatch.ok && metadataMismatch.reasons.includes("QUOTE_REFERENCE_METADATA_MISMATCH"));
  assert.ok(!metadataMismatch.ok && metadataMismatch.reasons.includes("SERVER_INPUT_HASH_METADATA_MISMATCH"));
});

test("Stripe reconciliation rejects direct completion states without a paid succeeded intent", () => {
  const quote = paidQuoteForStripe();
  const pendingIntent = stripePaymentIntent(quote, {
    status: "requires_payment_method",
    amount_received: 0,
  });
  const pendingSession = stripeCheckoutSession(quote, pendingIntent, {
    payment_status: "unpaid",
    status: "open",
  });
  const result = reconcilePaidCheckoutSession({
    quote,
    paymentIntent: pendingIntent,
    session: pendingSession,
    now: NOW,
  });

  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.reasons.includes("SESSION_NOT_PAID"));
  assert.ok(!result.ok && result.reasons.includes("PAYMENT_INTENT_NOT_SUCCEEDED"));
});

test("Stripe reconciliation allows late webhook delivery for a paid Session bounded by quote expiry", () => {
  const quote = paidQuoteForStripe({
    expiresAt: new Date("2026-08-21T10:30:00.000Z"),
  });
  const paymentIntent = stripePaymentIntent(quote);
  const session = stripeCheckoutSession(quote, paymentIntent, {
    created: Math.floor(new Date("2026-08-21T10:00:00.000Z").getTime() / 1000),
    expires_at: Math.floor(new Date("2026-08-21T10:30:00.000Z").getTime() / 1000),
  });
  const result = reconcilePaidCheckoutSession({
    quote,
    paymentIntent,
    session,
    now: new Date("2026-08-21T10:31:00.000Z"),
  });

  assert.equal(result.ok, true);
});

test("Stripe reconciliation rejects expired or overlong Checkout Sessions", () => {
  const quote = paidQuoteForStripe({
    expiresAt: new Date("2026-08-21T10:30:00.000Z"),
  });
  const paymentIntent = stripePaymentIntent(quote);
  const overlong = reconcilePaidCheckoutSession({
    quote,
    paymentIntent,
    session: stripeCheckoutSession(quote, paymentIntent, {
      created: Math.floor(new Date("2026-08-21T10:00:00.000Z").getTime() / 1000),
      expires_at: Math.floor(new Date("2026-08-21T11:00:00.000Z").getTime() / 1000),
    }),
    now: new Date("2026-08-21T10:10:00.000Z"),
  });
  assert.equal(overlong.ok, false);
  assert.ok(!overlong.ok && overlong.reasons.includes("SESSION_EXPIRES_AFTER_QUOTE"));

  const expired = reconcilePaidCheckoutSession({
    quote,
    paymentIntent,
    session: stripeCheckoutSession(quote, paymentIntent, { status: "expired" }),
    now: new Date("2026-08-21T10:10:00.000Z"),
  });
  assert.equal(expired.ok, false);
  assert.ok(!expired.ok && expired.reasons.includes("SESSION_EXPIRED"));
});

test("accepted paid quote reconciliation is based on the immutable persisted total", () => {
  const quote = paidQuoteForStripe({ finalTotalPence: 44_500 });
  const paymentIntent = stripePaymentIntent(quote);
  const session = stripeCheckoutSession(quote, paymentIntent);
  const result = reconcilePaidCheckoutSession({ session, paymentIntent, quote, now: NOW });

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.totalPence, 44_500);
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

  assert.equal(response.status, "AUTO_QUOTE");
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
  const normalisedInput = persisted.normalisedInput as {
    stops?: Array<{ role: string }>;
    inventory?: Array<{ itemId: string; quantity: number; room: string }>;
    canonicalPricingInput?: { classification?: string };
  };
  assert.equal(persisted.finalTotalPence, 90_000);
  assert.deepEqual(
    persisted.vehicleRecommendation,
    {
      name: "Luton van",
      multipleVehiclesRequired: false,
      multipleTripsLikely: false,
      loadRatioBps: 6100,
      trips: 1,
    }
  );
  assert.equal(competitorSnapshot.pricingAlgorithmVersion, PRICING_ALGORITHM_VERSION);
  assert.equal(competitorSnapshot.classification, "FULL_HOUSE");
  assert.equal(competitorSnapshot.benchmark?.id, "benchmark-full-house");
  assert.equal(competitorSnapshot.referenceProfile?.profileId, "full-house-1-bedroom-v2");
  assert.equal(competitorSnapshot.requiredCrew, 2);
  assert.equal(inventorySnapshot.metricDatasetVersion, ITEM_METRICS_DATASET_VERSION);
  assert.equal(inventorySnapshot.summary.totalUnits > 0, true);
  assert.deepEqual(normalisedInput.stops?.map((stop) => stop.role), ["collection", "delivery"]);
  assert.equal(normalisedInput.inventory?.length, inventory.length);
  assert.equal(normalisedInput.canonicalPricingInput?.classification, "FULL_HOUSE");
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

test("benchmark storage failure returns manual review and is not cached", async () => {
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
  assert.deepEqual(first.reasonCodes, ["PRICING_INPUT_INVALID"]);
  assert.deepEqual(second.reasonCodes, ["PRICING_INPUT_INVALID"]);
  assert.equal(first.totalPence, null);
  assert.equal(second.totalPence, null);
  assert.equal(benchmarkCalls, 2);
});

test("no runtime result exposes a vehicle class", async () => {
  const inventory = profileInventory("full-house-1-bedroom-v2");
  const result = await calculateCanonicalQuotePricing(
    quoteInput({ inventory }),
    pricingDeps({ items: itemsFor(slugsFromInventory(inventory)), benchmarks: [benchmark()] })
  );

  assert.equal(result.status, "AUTO_QUOTE");
  assert.equal("vehicleRecommendation" in result, false);
  assert.doesNotMatch(result.explanation, /van|vehicle|smallest/i);
});

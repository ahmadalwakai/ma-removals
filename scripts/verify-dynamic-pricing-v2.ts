import "dotenv/config";
import { performance } from "node:perf_hooks";
import { db } from "../src/lib/db";
import { buildQuotePricePreview } from "../src/app/api/quotes/preview/route";
import type { CreateQuoteRequest } from "../src/lib/quotes/schemas";

const NOW = new Date("2026-08-21T10:00:00.000Z");

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

function quote(overrides: Partial<CreateQuoteRequest>): CreateQuoteRequest {
  return {
    moveType: "house-move",
    moveSize: "1-bedroom",
    collection: address(),
    delivery: { ...address(), fullAddress: "2 Test Avenue, Edinburgh", postcode: "EH1 1AA" },
    additionalStop: null,
    moveDate: "2026-09-01",
    earliestDate: null,
    latestDate: null,
    arrivalWindow: null,
    flexibleDate: false,
    flexibleTime: false,
    exactTime: false,
    sameDay: false,
    urgent: false,
    preferredMovers: 1,
    inventory: [],
    customItems: [],
    customer: {
      fullName: "Verification Customer",
      email: "verify@example.com",
      phone: "07123456789",
      notes: "",
      companyName: "",
      preferredContactMethod: "email",
      marketingConsent: false,
      bookingConsentAccepted: true,
      termsAccepted: true,
    },
    sourceChannel: "PUBLIC_SELF_BOOKING",
    ...overrides,
    services: { ...services, ...(overrides.services ?? {}) },
  };
}

const scenarios = [
  {
    name: "individual item quantity 1",
    quote: quote({ moveType: "furniture-delivery", moveSize: "few-items", inventory: [{ itemId: "side-table-round-2-tier-fantersi", quantity: 1, room: "living-room" }] }),
  },
  {
    name: "individual item quantity 5",
    quote: quote({ moveType: "furniture-delivery", moveSize: "few-items", inventory: [{ itemId: "side-table-round-2-tier-fantersi", quantity: 5, room: "living-room" }] }),
  },
  {
    name: "small light item",
    quote: quote({ moveType: "furniture-delivery", moveSize: "single-item", inventory: [{ itemId: "side-table-round-2-tier-fantersi", quantity: 1, room: "living-room" }] }),
  },
  {
    name: "large heavy item",
    quote: quote({ moveType: "furniture-delivery", moveSize: "single-item", inventory: [{ itemId: "washing-machine-standard-dimensions", quantity: 1, room: "kitchen" }] }),
  },
  {
    name: "one-person inventory",
    quote: quote({ moveType: "marketplace-collection", moveSize: "few-items", preferredMovers: 1, inventory: [{ itemId: "moving-boxes-uboxes-with-handles-10-premium", quantity: 3, room: "other" }] }),
  },
  {
    name: "two-person heavy item",
    quote: quote({ moveType: "marketplace-collection", moveSize: "few-items", preferredMovers: 1, inventory: [{ itemId: "washing-machine-standard-dimensions", quantity: 1, room: "kitchen" }] }),
  },
  {
    name: "light 1-bedroom inventory",
    quote: quote({ moveType: "house-move", moveSize: "1-bedroom", preferredMovers: 1, inventory: [{ itemId: "moving-boxes-uboxes-with-handles-10-premium", quantity: 6, room: "other" }] }),
  },
  {
    name: "reference 1-bedroom inventory",
    quote: quote({ moveType: "house-move", moveSize: "1-bedroom", preferredMovers: 2, inventory: [
      { itemId: "moving-boxes-uboxes-with-handles-10-premium", quantity: 18, room: "other" },
      { itemId: "suitcase-luggage-zimtown-3-piece-nested-spinner-tsa-lock-pink", quantity: 2, room: "other" },
      { itemId: "double-bed-frame-cavill-fabric-grey", quantity: 1, room: "bedroom" },
      { itemId: "wardrobe-single-door-space-saving-bedroom-storage-unit", quantity: 1, room: "bedroom" },
      { itemId: "loveseat-2-seat-fabric-63inch", quantity: 1, room: "living-room" },
      { itemId: "armchair-1-seat-accent-chair", quantity: 1, room: "living-room" },
      { itemId: "coffee-table-modern-povison-living-room", quantity: 1, room: "living-room" },
      { itemId: "tv-stand-65inch-enhomee-large", quantity: 1, room: "living-room" },
      { itemId: "television-55inch-lg-oled-c4", quantity: 1, room: "living-room" },
      { itemId: "washing-machine-standard-dimensions", quantity: 1, room: "kitchen" },
    ] }),
  },
  {
    name: "small student move",
    quote: quote({ moveType: "student-move", moveSize: "few-items", inventory: [{ itemId: "moving-boxes-uboxes-with-handles-10-premium", quantity: 2, room: "other" }] }),
  },
  {
    name: "larger student move",
    quote: quote({ moveType: "student-move", moveSize: "few-items", inventory: [{ itemId: "moving-boxes-uboxes-with-handles-10-premium", quantity: 12, room: "other" }, { itemId: "side-table-round-2-tier-fantersi", quantity: 1, room: "bedroom" }] }),
  },
  {
    name: "small man-and-van inventory",
    quote: quote({ moveType: "marketplace-collection", moveSize: "few-items", inventory: [{ itemId: "moving-boxes-uboxes-with-handles-10-premium", quantity: 2, room: "other" }] }),
  },
  {
    name: "larger man-and-van inventory",
    quote: quote({ moveType: "marketplace-collection", moveSize: "few-items", inventory: [{ itemId: "moving-boxes-uboxes-with-handles-10-premium", quantity: 8, room: "other" }, { itemId: "armchair-1-seat-accent-chair", quantity: 1, room: "living-room" }] }),
  },
  {
    name: "standard business inventory",
    quote: quote({ moveType: "office-move", moveSize: "office", preferredMovers: 2, inventory: [
      { itemId: "moving-boxes-uboxes-with-handles-10-premium", quantity: 10, room: "office" },
      { itemId: "office-desk-nsdirect-modern-computer-63-inch-large", quantity: 2, room: "office" },
      { itemId: "office-chair-neo-ergonomic-lumbar-support-adjustable-black", quantity: 4, room: "office" },
    ] }),
  },
  {
    name: "heavier business inventory",
    quote: quote({ moveType: "office-move", moveSize: "office", preferredMovers: 2, inventory: [
      { itemId: "moving-boxes-uboxes-with-handles-10-premium", quantity: 16, room: "office" },
      { itemId: "office-desk-nsdirect-modern-computer-63-inch-large", quantity: 4, room: "office" },
      { itemId: "office-chair-neo-ergonomic-lumbar-support-adjustable-black", quantity: 8, room: "office" },
      { itemId: "office-storage-simple-ideas-workspace", quantity: 2, room: "office" },
    ] }),
  },
];

async function main() {
  const itemCount = await db.item.count();
  const benchmarkCount = await db.competitorBenchmark.count({ where: { active: true } });
  console.log(`Configured DB reachable. Items: ${itemCount}. Active benchmarks: ${benchmarkCount}.`);

  for (const scenario of scenarios) {
    const start = performance.now();
    const preview = await buildQuotePricePreview(scenario.quote, {
      now: NOW,
      calculateRoute: async () => ({
        route: {
          distanceMiles: 12,
          durationMinutes: 35,
          routeHash: "verification-route-12mi",
          calculatedAt: NOW.toISOString(),
        },
        reasons: [],
      }),
    });
    const durationMs = Math.round((performance.now() - start) * 10) / 10;
    const demand = ("demandRatios" in preview ? preview.demandRatios : null) as {
      controllingDemandDimension?: string;
      inventoryDemandBps?: number;
    } | null | undefined;
    const adjustmentBps = "adjustmentBps" in preview ? preview.adjustmentBps : null;
    console.log(JSON.stringify({
      scenario: scenario.name,
      apiStatus: 200,
      durationMs,
      status: preview.status,
      classification: preview.canonicalClassification,
      benchmarkId: preview.competitorBenchmarkId,
      referenceProfileId: preview.referenceProfileId,
      resolvedItems: scenario.quote.inventory.map((item) => ({ itemId: item.itemId, quantity: item.quantity })),
      totalUnits: preview.inventory.totalUnits ?? preview.inventory.itemUnits,
      totalVolumeM3: preview.inventory.totalVolumeM3,
      totalWeightKg: preview.inventory.totalWeightKg,
      handlingMinutes: preview.inventory.totalHandlingMinutes,
      requiredCrew: preview.requiredCrew,
      controllingDemandDimension: demand?.controllingDemandDimension ?? null,
      inventoryDemandBps: demand?.inventoryDemandBps ?? null,
      adjustmentPercent: typeof adjustmentBps === "number" ? adjustmentBps / 100 : null,
      benchmarkPricePence: preview.benchmarkPricePence,
      finalPricePence: preview.totalPence,
      savingPercent: preview.savingPercent,
      manualReviewReasons: preview.manualReviewReasons,
    }));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

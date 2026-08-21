import {
  ITEM_METRICS_DATASET_VERSION,
  getItemMetricBySlug,
  type ItemMetricV2,
} from "@/lib/items/item-metrics";

export type DynamicPricingClassification =
  | "FULL_HOUSE"
  | "INDIVIDUAL_ITEMS"
  | "STUDENT_MOVE"
  | "MAN_AND_VAN"
  | "BUSINESS_REMOVAL";

export interface ReferenceProfileItem {
  slug: string;
  quantity: number;
}

interface ReferenceProfileDefinition {
  profileId: string;
  profileVersion: string;
  classification: DynamicPricingClassification;
  moveTypes: string[];
  propertySize: string | null;
  referenceCrew: number;
  rationale: string;
  items: ReferenceProfileItem[];
}

export interface ReferenceProfileResolvedItem extends ReferenceProfileItem {
  metric: ItemMetricV2;
}

export interface DynamicReferenceProfile {
  profileId: string;
  profileVersion: string;
  classification: DynamicPricingClassification;
  moveType: string;
  propertySize: string | null;
  metricDatasetVersion: string;
  referenceUnits: number;
  referenceVolumeM3: number;
  referenceWeightKg: number;
  referenceHandlingMinutes: number;
  referenceCrew: number;
  items: ReferenceProfileResolvedItem[];
  rationale: string;
}

export const REFERENCE_PROFILE_VERSION = "reference-profiles-v2.0.0";

const BOX = "moving-boxes-uboxes-with-handles-10-premium";
const LARGE_BOX = "moving-boxes-uboxes-1-room-economy-kit-15-boxes";
const SUITCASE = "suitcase-luggage-zimtown-3-piece-nested-spinner-tsa-lock-pink";
const TRAVEL_BAG = "travel-bag-litvyak-duffle-50l-canvas";
const SINGLE_BED = "single-bed-frame-wooden-3ft-white";
const DOUBLE_BED = "double-bed-frame-cavill-fabric-grey";
const KING_BED = "king-bed-frame-cavill-fabric-grey";
const SINGLE_WARDROBE = "wardrobe-single-door-space-saving-bedroom-storage-unit";
const DOUBLE_WARDROBE = "wardrobe-double-door-harmony-wood-better-home";
const SOFA_2 = "loveseat-2-seat-fabric-63inch";
const SOFA_3 = "sofa-3-seat-fabric-modern-lestar";
const ARMCHAIR = "armchair-1-seat-accent-chair";
const COFFEE_TABLE = "coffee-table-modern-povison-living-room";
const TV_STAND = "tv-stand-65inch-enhomee-large";
const TV_55 = "television-55inch-lg-oled-c4";
const WASHING_MACHINE = "washing-machine-standard-dimensions";
const FRIDGE_FREEZER = "refrigerator-top-freezer-7-5cuft";
const DINING_TABLE = "dining-table-extendable-55inch";
const DINING_CHAIRS = "dining-chairs-faux-leather-set";
const OFFICE_CHAIR = "office-chair-neo-ergonomic-lumbar-support-adjustable-black";
const OFFICE_DESK = "office-desk-nsdirect-modern-computer-63-inch-large";
const FILING_CABINET = "filing-cabinet-devaise-3-drawer-home-office";
const OFFICE_BOOKSHELF = "office-bookshelf-stylish-shelving-home-offices";
const OFFICE_STORAGE = "office-storage-simple-ideas-workspace";
const MONITOR = "computer-monitor-27inch-hp";
const DESKTOP = "desktop-computer-hp-tower";
const PRINTER = "printer-all-in-one-best-2025";
const SMALL_TABLE = "side-table-round-2-tier-fantersi";

const PROFILE_DEFINITIONS: ReferenceProfileDefinition[] = [
  {
    profileId: "full-house-studio-v2",
    profileVersion: REFERENCE_PROFILE_VERSION,
    classification: "FULL_HOUSE",
    moveTypes: ["house-move", "flat-move"],
    propertySize: "studio",
    referenceCrew: 2,
    rationale: "Normal studio move: boxes, one bed, compact living furniture, and a small appliance load.",
    items: [
      { slug: BOX, quantity: 12 },
      { slug: SUITCASE, quantity: 2 },
      { slug: SINGLE_BED, quantity: 1 },
      { slug: SINGLE_WARDROBE, quantity: 1 },
      { slug: SOFA_2, quantity: 1 },
      { slug: COFFEE_TABLE, quantity: 1 },
      { slug: TV_55, quantity: 1 },
    ],
  },
  {
    profileId: "full-house-1-bedroom-v2",
    profileVersion: REFERENCE_PROFILE_VERSION,
    classification: "FULL_HOUSE",
    moveTypes: ["house-move", "flat-move"],
    propertySize: "1-bedroom",
    referenceCrew: 2,
    rationale: "Normal one-bedroom home: boxed contents plus one bedroom, living room, and core appliances.",
    items: [
      { slug: BOX, quantity: 18 },
      { slug: SUITCASE, quantity: 2 },
      { slug: DOUBLE_BED, quantity: 1 },
      { slug: SINGLE_WARDROBE, quantity: 1 },
      { slug: SOFA_2, quantity: 1 },
      { slug: ARMCHAIR, quantity: 1 },
      { slug: COFFEE_TABLE, quantity: 1 },
      { slug: TV_STAND, quantity: 1 },
      { slug: TV_55, quantity: 1 },
      { slug: WASHING_MACHINE, quantity: 1 },
    ],
  },
  {
    profileId: "full-house-2-bedrooms-v2",
    profileVersion: REFERENCE_PROFILE_VERSION,
    classification: "FULL_HOUSE",
    moveTypes: ["house-move", "flat-move"],
    propertySize: "2-bedrooms",
    referenceCrew: 2,
    rationale: "Normal two-bedroom home: two bedrooms, living room, dining basics, appliances, and boxed contents.",
    items: [
      { slug: BOX, quantity: 28 },
      { slug: SUITCASE, quantity: 3 },
      { slug: DOUBLE_BED, quantity: 1 },
      { slug: SINGLE_BED, quantity: 1 },
      { slug: DOUBLE_WARDROBE, quantity: 1 },
      { slug: SINGLE_WARDROBE, quantity: 1 },
      { slug: SOFA_3, quantity: 1 },
      { slug: ARMCHAIR, quantity: 1 },
      { slug: COFFEE_TABLE, quantity: 1 },
      { slug: TV_STAND, quantity: 1 },
      { slug: TV_55, quantity: 1 },
      { slug: DINING_TABLE, quantity: 1 },
      { slug: DINING_CHAIRS, quantity: 1 },
      { slug: WASHING_MACHINE, quantity: 1 },
      { slug: FRIDGE_FREEZER, quantity: 1 },
    ],
  },
  {
    profileId: "full-house-3-bedrooms-v2",
    profileVersion: REFERENCE_PROFILE_VERSION,
    classification: "FULL_HOUSE",
    moveTypes: ["house-move", "flat-move"],
    propertySize: "3-bedrooms",
    referenceCrew: 2,
    rationale: "Normal three-bedroom family home with larger furniture mix and more boxed contents.",
    items: [
      { slug: BOX, quantity: 42 },
      { slug: LARGE_BOX, quantity: 4 },
      { slug: SUITCASE, quantity: 4 },
      { slug: KING_BED, quantity: 1 },
      { slug: DOUBLE_BED, quantity: 1 },
      { slug: SINGLE_BED, quantity: 1 },
      { slug: DOUBLE_WARDROBE, quantity: 2 },
      { slug: SINGLE_WARDROBE, quantity: 1 },
      { slug: SOFA_3, quantity: 1 },
      { slug: SOFA_2, quantity: 1 },
      { slug: ARMCHAIR, quantity: 2 },
      { slug: COFFEE_TABLE, quantity: 1 },
      { slug: TV_STAND, quantity: 1 },
      { slug: TV_55, quantity: 2 },
      { slug: DINING_TABLE, quantity: 1 },
      { slug: DINING_CHAIRS, quantity: 1 },
      { slug: WASHING_MACHINE, quantity: 1 },
      { slug: FRIDGE_FREEZER, quantity: 1 },
    ],
  },
  {
    profileId: "full-house-4-bedrooms-v2",
    profileVersion: REFERENCE_PROFILE_VERSION,
    classification: "FULL_HOUSE",
    moveTypes: ["house-move", "flat-move"],
    propertySize: "4-bedrooms",
    referenceCrew: 2,
    rationale: "Normal four-bedroom home with increased boxed contents, bedroom furniture, and living furniture.",
    items: [
      { slug: BOX, quantity: 58 },
      { slug: LARGE_BOX, quantity: 8 },
      { slug: SUITCASE, quantity: 5 },
      { slug: KING_BED, quantity: 1 },
      { slug: DOUBLE_BED, quantity: 2 },
      { slug: SINGLE_BED, quantity: 1 },
      { slug: DOUBLE_WARDROBE, quantity: 3 },
      { slug: SINGLE_WARDROBE, quantity: 2 },
      { slug: SOFA_3, quantity: 2 },
      { slug: SOFA_2, quantity: 1 },
      { slug: ARMCHAIR, quantity: 3 },
      { slug: COFFEE_TABLE, quantity: 2 },
      { slug: TV_STAND, quantity: 2 },
      { slug: TV_55, quantity: 3 },
      { slug: DINING_TABLE, quantity: 1 },
      { slug: DINING_CHAIRS, quantity: 2 },
      { slug: WASHING_MACHINE, quantity: 1 },
      { slug: FRIDGE_FREEZER, quantity: 1 },
    ],
  },
  {
    profileId: "full-house-5-plus-bedrooms-v2",
    profileVersion: REFERENCE_PROFILE_VERSION,
    classification: "FULL_HOUSE",
    moveTypes: ["house-move", "flat-move"],
    propertySize: "5-plus-bedrooms",
    referenceCrew: 2,
    rationale: "Supported large home reference; materially larger or specialist loads require review.",
    items: [
      { slug: BOX, quantity: 78 },
      { slug: LARGE_BOX, quantity: 12 },
      { slug: SUITCASE, quantity: 6 },
      { slug: KING_BED, quantity: 2 },
      { slug: DOUBLE_BED, quantity: 2 },
      { slug: SINGLE_BED, quantity: 2 },
      { slug: DOUBLE_WARDROBE, quantity: 4 },
      { slug: SINGLE_WARDROBE, quantity: 2 },
      { slug: SOFA_3, quantity: 2 },
      { slug: SOFA_2, quantity: 2 },
      { slug: ARMCHAIR, quantity: 4 },
      { slug: COFFEE_TABLE, quantity: 2 },
      { slug: TV_STAND, quantity: 3 },
      { slug: TV_55, quantity: 4 },
      { slug: DINING_TABLE, quantity: 2 },
      { slug: DINING_CHAIRS, quantity: 3 },
      { slug: WASHING_MACHINE, quantity: 1 },
      { slug: FRIDGE_FREEZER, quantity: 1 },
    ],
  },
  {
    profileId: "individual-single-item-v2",
    profileVersion: REFERENCE_PROFILE_VERSION,
    classification: "INDIVIDUAL_ITEMS",
    moveTypes: ["single-item-delivery", "furniture-delivery", "piano-move", "house-move", "flat-move"],
    propertySize: "single-item",
    referenceCrew: 2,
    rationale: "Normal single-item benchmark: a supported two-person sofa-sized furniture item.",
    items: [{ slug: SOFA_2, quantity: 1 }],
  },
  {
    profileId: "individual-few-items-v2",
    profileVersion: REFERENCE_PROFILE_VERSION,
    classification: "INDIVIDUAL_ITEMS",
    moveTypes: ["single-item-delivery", "furniture-delivery", "piano-move", "house-move", "flat-move"],
    propertySize: "few-items",
    referenceCrew: 2,
    rationale: "Normal few-items benchmark: a small supported furniture delivery bundle.",
    items: [
      { slug: SOFA_2, quantity: 1 },
      { slug: COFFEE_TABLE, quantity: 1 },
      { slug: TV_STAND, quantity: 1 },
    ],
  },
  {
    profileId: "student-move-few-items-v2",
    profileVersion: REFERENCE_PROFILE_VERSION,
    classification: "STUDENT_MOVE",
    moveTypes: ["student-move"],
    propertySize: "few-items",
    referenceCrew: 2,
    rationale: "Student move reference: boxes, bags, suitcase, and a few compact personal items.",
    items: [
      { slug: BOX, quantity: 8 },
      { slug: SUITCASE, quantity: 2 },
      { slug: TRAVEL_BAG, quantity: 2 },
      { slug: SMALL_TABLE, quantity: 1 },
      { slug: OFFICE_CHAIR, quantity: 1 },
    ],
  },
  {
    profileId: "man-and-van-normal-load-v2",
    profileVersion: REFERENCE_PROFILE_VERSION,
    classification: "MAN_AND_VAN",
    moveTypes: ["marketplace-collection"],
    propertySize: "few-items",
    referenceCrew: 2,
    rationale: "Man-and-van normal load: explicitly not a vehicle class; a modest supported mixed-item load.",
    items: [
      { slug: BOX, quantity: 6 },
      { slug: SUITCASE, quantity: 1 },
      { slug: ARMCHAIR, quantity: 1 },
      { slug: COFFEE_TABLE, quantity: 1 },
      { slug: TV_STAND, quantity: 1 },
    ],
  },
  {
    profileId: "business-removal-office-v2",
    profileVersion: REFERENCE_PROFILE_VERSION,
    classification: "BUSINESS_REMOVAL",
    moveTypes: ["office-move"],
    propertySize: "office",
    referenceCrew: 2,
    rationale: "Small office reference: desks, chairs, IT equipment, storage, and business boxes.",
    items: [
      { slug: BOX, quantity: 20 },
      { slug: OFFICE_DESK, quantity: 4 },
      { slug: OFFICE_CHAIR, quantity: 6 },
      { slug: FILING_CABINET, quantity: 2 },
      { slug: OFFICE_BOOKSHELF, quantity: 1 },
      { slug: OFFICE_STORAGE, quantity: 1 },
      { slug: MONITOR, quantity: 4 },
      { slug: DESKTOP, quantity: 2 },
      { slug: PRINTER, quantity: 1 },
    ],
  },
];

function round(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function resolveDefinition(
  definition: ReferenceProfileDefinition,
  moveType: string
): DynamicReferenceProfile | null {
  const items = definition.items.flatMap((item) => {
    const metric = getItemMetricBySlug(item.slug);
    return metric ? [{ ...item, metric }] : [];
  });
  if (items.length !== definition.items.length) return null;

  return {
    profileId: definition.profileId,
    profileVersion: definition.profileVersion,
    classification: definition.classification,
    moveType,
    propertySize: definition.propertySize,
    metricDatasetVersion: ITEM_METRICS_DATASET_VERSION,
    referenceUnits: items.reduce((sum, item) => sum + item.quantity, 0),
    referenceVolumeM3: round(items.reduce((sum, item) => sum + item.metric.estimatedVolumeM3 * item.quantity, 0)),
    referenceWeightKg: round(items.reduce((sum, item) => sum + item.metric.estimatedWeightKg * item.quantity, 0), 1),
    referenceHandlingMinutes: items.reduce((sum, item) => sum + item.metric.handlingMinutes * item.quantity, 0),
    referenceCrew: definition.referenceCrew,
    items,
    rationale: definition.rationale,
  };
}

export function findDynamicReferenceProfile(params: {
  classification: DynamicPricingClassification;
  moveType: string;
  propertySize: string | null;
}): DynamicReferenceProfile | null {
  const definition = PROFILE_DEFINITIONS.find((profile) => (
    profile.classification === params.classification &&
    profile.moveTypes.includes(params.moveType) &&
    profile.propertySize === params.propertySize
  ));
  return definition ? resolveDefinition(definition, params.moveType) : null;
}

export function listDynamicReferenceProfiles(): DynamicReferenceProfile[] {
  return PROFILE_DEFINITIONS.flatMap((definition) => (
    definition.moveTypes.flatMap((moveType) => resolveDefinition(definition, moveType) ?? [])
  ));
}

"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Box, Flex, HStack, SimpleGrid, Spinner, Text, VStack } from "@chakra-ui/react";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiArrowRight,
  FiBox,
  FiCalendar,
  FiChevronLeft,
  FiChevronDown,
  FiChevronRight,
  FiCheck,
  FiCoffee,
  FiCreditCard,
  FiCopy,
  FiDroplet,
  FiEdit2,
  FiHome,
  FiInfo,
  FiMapPin,
  FiMinusCircle,
  FiMonitor,
  FiPackage,
  FiPlus,
  FiPlusCircle,
  FiShield,
  FiShoppingBag,
  FiStar,
  FiTrash2,
  FiTruck,
  FiUser,
  FiUsers,
  FiZap,
} from "react-icons/fi";
import { AddressAutocomplete } from "@/components/booking/AddressAutocomplete";
import {
  attachPricePreviewScope,
  filterPricePreviewsByScope,
  shouldAcceptPricePreviewResponse,
} from "@/lib/booking/price-preview-cache";
import { packingChargePenceForMove, type PackingMode } from "@/lib/pricing/packing";
import { formatPence } from "@/lib/pricing";
import type { AddressData } from "@/types/booking";

type MapboxModule = typeof import("mapbox-gl");
type MapboxRuntime = MapboxModule & { accessToken: string };
type MapboxMap = import("mapbox-gl").Map;
type MapboxMarker = import("mapbox-gl").Marker;

const MOVE_TYPES = [
  { value: "house-move", label: "House move" },
  { value: "flat-move", label: "Flat move" },
  { value: "office-move", label: "Office move" },
  { value: "student-move", label: "Student move" },
  { value: "single-item-delivery", label: "Single-item delivery" },
  { value: "furniture-delivery", label: "Furniture delivery" },
  { value: "marketplace-collection", label: "Marketplace collection" },
  { value: "piano-move", label: "Piano move" },
  { value: "other", label: "Other" },
] as const;

const MOVE_SIZES = [
  { value: "single-item", label: "Single item" },
  { value: "few-items", label: "Few items" },
  { value: "studio", label: "Studio" },
  { value: "1-bedroom", label: "1 bedroom" },
  { value: "2-bedrooms", label: "2 bedrooms" },
  { value: "3-bedrooms", label: "3 bedrooms" },
  { value: "4-bedrooms", label: "4 bedrooms" },
  { value: "5-plus-bedrooms", label: "5+ bedrooms" },
  { value: "office", label: "Office" },
  { value: "custom-inventory", label: "Custom inventory" },
] as const;

type MoveSizeValue = (typeof MOVE_SIZES)[number]["value"];
const MOVER_COUNTS = [1, 2] as const;
type MoverCount = (typeof MOVER_COUNTS)[number];
const PRICE_PREVIEW_CLIENT_TIMEOUT_MS = 12_000;
const QUOTE_REQUEST_CLIENT_TIMEOUT_MS = 20_000;
const CLIENT_ESTIMATED_VOLUME_PER_ITEM_M3 = 0.81;

const STEPS = [
  "Move details",
  "Items",
  "Date",
  "Extras",
  "Details",
] as const;

const bookingTheme = {
  page: "#F4F8FA",
  panel: "#FFFFFF",
  raised: "#FFFFFF",
  ink: "#14323C",
  muted: "#647780",
  subtle: "#F7FAFB",
  border: "#DCE7EA",
  borderStrong: "#B7CBD2",
  primary: "#00A878",
  primaryDark: "#078464",
  primarySoft: "#E4F8F1",
  heroBlue: "#2563EB",
  ctaPink: "#E83278",
  ctaPinkDark: "#D82669",
  accent: "#FFD84D",
  accentSoft: "#FFF8D9",
  danger: "#D92D20",
  dangerSoft: "#FFF0EE",
} as const;

const QUOTE_DRAFT_KEY = "ma-removals-instant-quote-draft-v2";
const QUOTE_REFERENCE_PATTERN = /^MAQ-\d{4}-[A-Z0-9]{6}$/;
const QUOTE_REFERENCE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const ROOMS = [
  { value: "bedroom", label: "Bedrooms", categoryNames: ["Bedroom", "Wardrobes & Closets", "Electrical & Electronics"], icon: FiHome },
  { value: "living-room", label: "Living", categoryNames: ["Living Room", "Electrical & Electronics"], icon: FiMonitor },
  { value: "dining-room", label: "Dining", categoryNames: ["Dining Room"], icon: FiCoffee },
  { value: "kitchen", label: "Kitchen", categoryNames: ["Kitchen & Appliances"], icon: FiPackage },
  { value: "bathroom", label: "Bathroom", categoryNames: ["Bathroom"], icon: FiDroplet },
  { value: "garden", label: "Garden", categoryNames: ["Garden & Outdoor"], icon: FiTruck },
  { value: "other", label: "Boxes & Bags", categoryNames: ["Bags, Luggage & Boxes"], icon: FiShoppingBag },
] as const;

type RoomValue = (typeof ROOMS)[number]["value"];

const ROOM_ITEM_LABELS: Record<RoomValue, string[]> = {
  "bedroom": [
    "Single Bed & Mattress",
    "Double Bed & Mattress",
    "Kingsize Bed & Mattress",
    "Single Wardrobe",
    "Double Wardrobe",
    "Chest Of Drawers",
    "Bedside Table",
    "Dressing Table",
    "Television",
    "Side Table",
  ],
  "living-room": [
    "Two Seater Sofa",
    "Three Seater Sofa",
    "Armchair",
    "Coffee Table",
    "TV Stand",
    "Television",
    "Bookcase",
    "Side Table",
    "Rug",
    "Lamp",
  ],
  "dining-room": [
    "Dining Table",
    "Dining Chairs",
    "Sideboard",
    "Display Cabinet",
    "Wine Rack",
    "Bar Stools",
    "Console Table",
    "Mirror",
  ],
  "kitchen": [
    "Fridge Freezer",
    "Washing Machine",
    "Dishwasher",
    "Microwave",
    "Cooker",
    "Chest Freezer",
    "Small Appliance",
    "Kitchen Boxes",
  ],
  "bathroom": [
    "Bathroom Cabinet",
    "Mirror",
    "Laundry Basket",
    "Bathroom Shelf",
    "Towel Rack",
    "Bathroom Stool",
  ],
  "garden": [
    "Garden Table",
    "Garden Chairs",
    "BBQ",
    "Lawnmower",
    "Garden Shed",
    "Outdoor Storage Box",
    "Garden Planters",
    "Parasol",
  ],
  "other": [
    "Large Box",
    "Small Box",
    "Suitcase",
    "Travel Bag",
    "Garment Bag",
    "Storage Trunk",
    "Backpack",
  ],
};

const ITEM_MATCH_KEYWORDS: Record<string, string[]> = {
  "Single Bed & Mattress": ["single", "bed"],
  "Double Bed & Mattress": ["double", "bed"],
  "Kingsize Bed & Mattress": ["king", "bed"],
  "Single Wardrobe": ["wardrobe", "single"],
  "Double Wardrobe": ["wardrobe", "double"],
  "Chest Of Drawers": ["dresser"],
  "Bedside Table": ["bedside"],
  "Dressing Table": ["dressing"],
  "Television": ["television"],
  "Side Table": ["end", "table"],
  "Two Seater Sofa": ["sofa", "2"],
  "Three Seater Sofa": ["sofa", "3"],
  "Armchair": ["armchair"],
  "Coffee Table": ["coffee", "table"],
  "TV Stand": ["tv", "stand"],
  "Bookcase": ["bookcase"],
  "Rug": ["rug"],
  "Lamp": ["lamp"],
  "Dining Table": ["dining", "table"],
  "Dining Chairs": ["dining", "chairs"],
  "Sideboard": ["sideboard"],
  "Display Cabinet": ["display", "cabinet"],
  "Wine Rack": ["wine", "rack"],
  "Bar Stools": ["bar", "stools"],
  "Console Table": ["console", "table"],
  "Mirror": ["mirror"],
  "Fridge Freezer": ["fridge", "freezer"],
  "Washing Machine": ["washing", "machine"],
  "Dishwasher": ["dishwasher"],
  "Microwave": ["microwave"],
  "Cooker": ["range"],
  "Chest Freezer": ["chest", "freezer"],
  "Small Appliance": ["air", "fryer"],
  "Kitchen Boxes": ["moving", "boxes"],
  "Bathroom Cabinet": ["cabinet"],
  "Laundry Basket": ["laundry", "basket"],
  "Bathroom Shelf": ["shelf"],
  "Towel Rack": ["towel", "rack"],
  "Bathroom Stool": ["stool"],
  "Garden Table": ["outdoor", "table"],
  "Garden Chairs": ["outdoor", "chair"],
  "BBQ": ["bbq"],
  "Lawnmower": ["lawnmower"],
  "Garden Shed": ["garden", "shed"],
  "Outdoor Storage Box": ["outdoor", "storage", "box"],
  "Garden Planters": ["garden", "planter"],
  "Parasol": ["parasol"],
  "Large Box": ["moving", "boxes"],
  "Small Box": ["moving", "boxes"],
  "Suitcase": ["suitcase"],
  "Travel Bag": ["travel", "bag"],
  "Garment Bag": ["garment", "bag"],
  "Storage Trunk": ["storage", "trunk"],
  "Backpack": ["backpack"],
};

const ITEM_ID_OVERRIDES: Record<string, string[]> = {
  "Chest Of Drawers": ["chest-drawers-mahogany", "dresser-antique-rosewood", "cassettone-dresser-chestnut"],
  "Bedside Table": ["end-table-industrial-square-foluban", "end-table-4-tier-tribesigns", "side-table-round-2-tier-fantersi"],
  "Dressing Table": ["dresser-antique-rosewood", "changing-table-dresser-combo", "dresser-5drawer-changing-table"],
  "Side Table": ["side-table-round-2-tier-fantersi", "end-table-4-tier-tribesigns", "end-table-industrial-square-foluban"],
  "Kitchen Boxes": [
    "moving-boxes-uboxes-with-handles-10-premium",
    "moving-boxes-uboxes-1-room-economy-kit-15-boxes",
    "moving-boxes-8-best-top-moving-house-boxes",
  ],
  "Large Box": [
    "moving-boxes-uboxes-1-room-economy-kit-15-boxes",
    "moving-boxes-8-best-top-moving-house-boxes",
    "moving-boxes-uboxes-with-handles-10-premium",
  ],
  "Small Box": [
    "moving-boxes-uboxes-with-handles-10-premium",
    "moving-boxes-uboxes-1-room-economy-kit-15-boxes",
    "moving-boxes-8-best-top-moving-house-boxes",
  ],
};

const ITEM_KEYWORD_GROUP_OVERRIDES: Record<string, string[][]> = {
  "Chest Of Drawers": [["chest", "drawers"], ["dresser"]],
  "Bedside Table": [["bedside", "table"], ["end", "table"], ["side", "table"]],
  "Dressing Table": [["dressing", "table"], ["dresser"]],
  "Side Table": [["side", "table"], ["end", "table"]],
  "Kitchen Boxes": [["moving", "boxes"], ["moving", "box"], ["boxes"]],
  "Large Box": [["moving", "boxes"], ["large", "box"], ["boxes"]],
  "Small Box": [["moving", "boxes"], ["small", "box"], ["boxes"]],
};

const QUICK_ITEM_PRESETS: Record<string, ApiItem> = {
  "Chest Of Drawers": {
    id: "preset-chest-of-drawers",
    name: "Chest Of Drawers",
    slug: "preset-chest-of-drawers",
    imagePath: "",
  },
  "Bedside Table": {
    id: "preset-bedside-table",
    name: "Bedside Table",
    slug: "preset-bedside-table",
    imagePath: "",
  },
  "Dressing Table": {
    id: "preset-dressing-table",
    name: "Dressing Table",
    slug: "preset-dressing-table",
    imagePath: "",
  },
  "Side Table": {
    id: "preset-side-table",
    name: "Side Table",
    slug: "preset-side-table",
    imagePath: "",
  },
  "Kitchen Boxes": {
    id: "preset-kitchen-boxes",
    name: "Kitchen Boxes",
    slug: "preset-kitchen-boxes",
    imagePath: "",
  },
};

const HERO_PROPERTY_OPTIONS = [
  { label: "1 Bedroom", detail: "House", value: "1 Bedroom House", moveSize: "1-bedroom" },
  { label: "2 Bedroom", detail: "House", value: "2 Bedroom House", moveSize: "2-bedrooms" },
  { label: "3 Bedroom", detail: "House", value: "3 Bedroom House", moveSize: "3-bedrooms" },
  { label: "4 Bedroom", detail: "House", value: "4 Bedroom House", moveSize: "4-bedrooms" },
  { label: "5+ Bedroom", detail: "House", value: "5+ Bedroom House", moveSize: "5-plus-bedrooms" },
] as const;

type HeroPropertyValue = (typeof HERO_PROPERTY_OPTIONS)[number]["value"];
const DEFAULT_HERO_PROPERTY = HERO_PROPERTY_OPTIONS[0]!;

const PARKING_OPTIONS = [
  { value: "on-site", label: "On-site" },
  { value: "street", label: "Street" },
  { value: "paid", label: "Paid" },
  { value: "restricted", label: "Restricted" },
  { value: "unknown", label: "Unknown" },
] as const;

const SERVICE_OPTIONS = [
  ["packing", "Packing"],
  ["packingMaterials", "Materials"],
  ["unpacking", "Unpacking"],
  ["dismantling", "Dismantling"],
  ["reassembly", "Reassembly"],
  ["furnitureProtection", "Protection"],
  ["mattressProtection", "Mattress cover"],
  ["tvProtection", "TV protection"],
  ["wasteDisposal", "Waste disposal"],
  ["additionalMover", "Additional mover"],
  ["waitingTime", "Waiting time"],
  ["heavyItemHandling", "Heavy handling"],
  ["pianoHandling", "Piano handling"],
] as const;

type BookingServiceState = Record<(typeof SERVICE_OPTIONS)[number][0], boolean>;

interface AccessDraft {
  address: AddressData | null;
  propertyType: string;
  floor: number;
  hasLift: boolean;
  internalStairs: number;
  externalStairs: number;
  parking: "on-site" | "street" | "paid" | "restricted" | "unknown";
  parkingRestrictions: string;
  carryDistanceMeters: number;
  narrowRoad: boolean;
  loadingBayAvailable: boolean;
  accessRestrictions: string;
  notes: string;
}

interface InventoryLine {
  itemId: string;
  name: string;
  imagePath: string;
  quantity: number;
  room: RoomValue;
  source?: "preset";
}

interface CustomItemLine {
  name: string;
  quantity: number;
  room: RoomValue;
  notes: string;
}

interface CustomerDraft {
  fullName: string;
  email: string;
  phone: string;
  notes: string;
  companyName: string;
  preferredContactMethod: "email" | "phone" | "sms";
  marketingConsent: boolean;
  bookingConsentAccepted: boolean;
  termsAccepted: boolean;
}

interface ApiItem {
  id: string;
  name: string;
  imagePath: string;
  slug: string;
}

interface ApiCategory {
  id: string;
  name: string;
  items: ApiItem[];
}

interface QuoteResponse {
  reference: string;
  status: "FIXED" | "MANUAL_REVIEW";
  pricingVersion: number | null;
  expiresAt: string;
  totalPence: number | null;
  originalTotalPence: number | null;
  discountTotalPence: number;
  promotionLabel: string | null;
  routeMileage: number | null;
  estimatedDurationMinutes: number | null;
  vehicle: {
    name: string | null;
    multipleVehiclesRequired: boolean;
    multipleTripsLikely: boolean;
  };
  crew: {
    movers: number;
    loadingMinutes: number;
    unloadingMinutes: number;
    travelMinutes: number;
    totalJobMinutes: number;
  };
  inventory: {
    totalVolumeM3: number;
    totalWeightKg: number;
    itemUnits: number;
    fragileItemCount: number;
    heavyOrSpecialItemCount: number;
  };
  breakdown: Array<{ key: string; label: string; amountPence: number }>;
  manualReviewReasons: string[];
}

interface QuotePricePreview {
  key: string;
  pricingScopeKey?: string | null;
  date?: string | null;
  requestedMovers?: number | null;
  status: "FIXED" | "MANUAL_REVIEW";
  totalPence: number | null;
  originalTotalPence?: number | null;
  discountTotalPence?: number;
  promotionLabel?: string | null;
  routeMileage?: number | null;
  estimatedDurationMinutes?: number | null;
  vehicle?: QuoteResponse["vehicle"];
  inventory?: QuoteResponse["inventory"];
  breakdown?: QuoteResponse["breakdown"];
  estimateSource?: "authoritative" | "fast";
  crew?: {
    movers: number;
    loadingMinutes: number;
    unloadingMinutes: number;
    travelMinutes: number;
    totalJobMinutes: number;
  };
  manualReviewReasons: string[];
}

type PriceTone = "cheap" | "medium" | "expensive";

const PRICE_TONE_ORDER: PriceTone[] = ["cheap", "medium", "expensive"];

const PRICE_TONE_META: Record<PriceTone, {
  label: string;
  color: string;
  bg: string;
  border: string;
  text: string;
}> = {
  cheap: {
    label: "Cheap",
    color: "#059669",
    bg: "#ECFDF5",
    border: "#34D399",
    text: "#064E3B",
  },
  medium: {
    label: "Medium",
    color: "#D97706",
    bg: "#FFFBEB",
    border: "#F59E0B",
    text: "#78350F",
  },
  expensive: {
    label: "Expensive",
    color: "#DC2626",
    bg: "#FEF2F2",
    border: "#F87171",
    text: "#7F1D1D",
  },
};

type InventoryListItem = ApiItem & {
  displayName: string;
  room: RoomValue;
};

function initialAccess(): AccessDraft {
  return {
    address: null,
    propertyType: DEFAULT_HERO_PROPERTY.value,
    floor: 0,
    hasLift: false,
    internalStairs: 0,
    externalStairs: 0,
    parking: "unknown",
    parkingRestrictions: "",
    carryDistanceMeters: 0,
    narrowRoad: false,
    loadingBayAvailable: false,
    accessRestrictions: "",
    notes: "",
  };
}

function randomKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function generateQuoteReference() {
  const year = new Date().getFullYear();
  let suffix = "";
  const cryptoValues =
    typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function"
      ? crypto.getRandomValues(new Uint32Array(6))
      : null;

  for (let index = 0; index < 6; index += 1) {
    const randomValue = cryptoValues?.[index] ?? Math.floor(Math.random() * QUOTE_REFERENCE_CHARS.length);
    suffix += QUOTE_REFERENCE_CHARS[randomValue % QUOTE_REFERENCE_CHARS.length];
  }

  return `MAQ-${year}-${suffix}`;
}

function isQuoteReference(value: unknown): value is string {
  return typeof value === "string" && QUOTE_REFERENCE_PATTERN.test(value.trim());
}

function itemMatchesKeywordGroup(item: ApiItem, keywords: string[]) {
  const source = normaliseSearch(`${item.name} ${item.slug}`);
  return keywords.every((keyword) => source.includes(normaliseSearch(keyword)));
}

function findUnusedItemByIds(items: ApiItem[], ids: string[], used: Set<string>) {
  const wanted = new Set(ids.map((id) => normaliseSearch(id)));
  return items.find((item) => (
    !used.has(item.id) &&
    (wanted.has(normaliseSearch(item.id)) || wanted.has(normaliseSearch(item.slug)))
  ));
}

function findUnusedItemByKeywords(items: ApiItem[], keywordGroups: string[][], used: Set<string>) {
  for (const keywords of keywordGroups) {
    const match = items.find((item) => !used.has(item.id) && itemMatchesKeywordGroup(item, keywords));
    if (match) return match;
  }
  return null;
}

function buildInventoryRows(categories: ApiCategory[], roomValue: RoomValue): InventoryListItem[] {
  const room = ROOMS.find((option) => option.value === roomValue) ?? ROOMS[0]!;
  const candidates = categories
    .filter((category) => (room.categoryNames as readonly string[]).includes(category.name))
    .flatMap((category) => category.items);
  const allItems = categories.flatMap((category) => category.items);
  const used = new Set<string>();

  return ROOM_ITEM_LABELS[roomValue].flatMap((displayName) => {
    const keywordGroups = ITEM_KEYWORD_GROUP_OVERRIDES[displayName] ??
      [ITEM_MATCH_KEYWORDS[displayName] ?? normaliseSearch(displayName).split(" ").filter(Boolean)];
    const visualMatch =
      findUnusedItemByIds(allItems, ITEM_ID_OVERRIDES[displayName] ?? [], used) ??
      findUnusedItemByKeywords(candidates, keywordGroups, used) ??
      findUnusedItemByKeywords(allItems, keywordGroups, used);
    const preset = QUICK_ITEM_PRESETS[displayName];

    if (preset && !used.has(preset.id)) {
      used.add(preset.id);
      return [{
        ...preset,
        imagePath: visualMatch?.imagePath ?? preset.imagePath,
        displayName,
        name: displayName,
        room: roomValue,
      }];
    }

    const match =
      visualMatch;

    if (!match) return [];
    used.add(match.id);
    return [{ ...match, displayName, name: displayName, room: roomValue }];
  });
}

function routeLocationLabel(address: AddressData | null, fallback: string) {
  if (!address) return fallback;
  return address.postcode ? `${address.postcode}, ${address.city}` : address.fullAddress;
}

async function recordQuoteEvent(params: {
  reference?: string;
  type: string;
  step?: string;
  metadata?: Record<string, unknown>;
}) {
  if (isLocalBookingHost() || params.reference?.startsWith("LOCAL-")) return;
  await fetch("/api/quotes/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).catch(() => {});
}

function typeForItems(moveType: string) {
  return moveType === "office-move" ? "business" : "residential";
}

function normaliseSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function formatRoomPropertyType(propertyType: string) {
  return propertyType || "2 Bed House";
}

function estimateRouteMilesValue(collectionAddress: AddressData | null, deliveryAddress: AddressData | null) {
  if (!collectionAddress || !deliveryAddress) return null;
  const toRad = (value: number) => value * Math.PI / 180;
  const earthMiles = 3958.8;
  const dLat = toRad(deliveryAddress.lat - collectionAddress.lat);
  const dLng = toRad(deliveryAddress.lng - collectionAddress.lng);
  const lat1 = toRad(collectionAddress.lat);
  const lat2 = toRad(deliveryAddress.lat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const miles = earthMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(1, Math.round(miles * 1.18));
}

function estimateRouteMiles(collectionAddress: AddressData | null, deliveryAddress: AddressData | null) {
  const miles = estimateRouteMilesValue(collectionAddress, deliveryAddress);
  return miles == null ? "" : `${miles} miles`;
}

function formatRouteDuration(minutes: number | null) {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes} mins`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} mins` : `${hours} hr`;
}

function decodePolyline(polyline: string): Array<{ lng: number; lat: number }> {
  const coords: Array<{ lng: number; lat: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < polyline.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;

    do {
      byte = polyline.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < polyline.length);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = polyline.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < polyline.length);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return coords;
}

function formatShortPence(pence: number) {
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}

function packingModeForServices(
  services: BookingServiceState
): PackingMode {
  if (services.packing) return "full";
  if (services.packingMaterials) return "materials";
  return "none";
}

function packingChargeForMode(mode: PackingMode, moveSize: MoveSizeValue, selectedUnits: number) {
  return packingChargePenceForMove(mode, moveSize, selectedUnits);
}

function selectedAddonSummaries(
  services: BookingServiceState,
  moveSize: MoveSizeValue,
  selectedUnits: number,
  dismantleCount: number,
  assemblyCount: number
) {
  const packingMode = packingModeForServices(services);
  const summaries: Array<{ label: string; amountPence: number }> = [];

  if (packingMode === "full") {
    summaries.push({
      label: "Full packing service",
      amountPence: packingChargeForMode("full", moveSize, selectedUnits),
    });
  } else if (packingMode === "materials") {
    summaries.push({
      label: "Packing materials",
      amountPence: packingChargeForMode("materials", moveSize, selectedUnits),
    });
  }

  if (dismantleCount > 0) {
    summaries.push({
      label: `Dismantling (${dismantleCount} item${dismantleCount === 1 ? "" : "s"})`,
      amountPence: dismantleCount * 1000,
    });
  }

  if (assemblyCount > 0) {
    summaries.push({
      label: `Reassembly (${assemblyCount} item${assemblyCount === 1 ? "" : "s"})`,
      amountPence: assemblyCount * 1000,
    });
  }

  return summaries;
}

function getFixedPreviewPrices(pricePreviews: Record<string, QuotePricePreview>) {
  return Object.values(pricePreviews).flatMap((preview) => (
    preview.status === "FIXED" && typeof preview.totalPence === "number" && Number.isFinite(preview.totalPence)
      ? [preview.totalPence]
      : []
  ));
}

function pricePreviewKey(date: string | null | undefined, movers: MoverCount) {
  return `${date ?? "flexible"}::${movers}`;
}

function pricePreviewsForMover(
  pricePreviews: Record<string, QuotePricePreview>,
  movers: MoverCount
): Record<string, QuotePricePreview> {
  return Object.fromEntries(Object.values(pricePreviews).flatMap((preview) => {
    const previewMovers = preview.requestedMovers ?? Number(preview.key.split("::")[1]);
    if (previewMovers !== movers) return [];
    const date = preview.date ?? preview.key.split("::")[0] ?? "";
    return date ? [[date, preview] as const] : [];
  }));
}

function fixedPreviewValues(pricePreviews: Record<string, QuotePricePreview>): QuotePricePreview[] {
  return Object.values(pricePreviews)
    .filter((preview) => preview.status === "FIXED" && typeof preview.totalPence === "number")
    .sort((a, b) => (a.totalPence ?? 0) - (b.totalPence ?? 0));
}

function representativePreview(
  pricePreviews: Record<string, QuotePricePreview>,
  selectedDate: string
): QuotePricePreview | undefined {
  return pricePreviews[selectedDate] ?? fixedPreviewValues(pricePreviews)[0];
}

function priceToneForTotal(totalPence: number | null | undefined, comparisonPrices: number[]): PriceTone | null {
  if (typeof totalPence !== "number" || !Number.isFinite(totalPence) || comparisonPrices.length < 2) return null;

  const sortedPrices = [...comparisonPrices].filter(Number.isFinite).sort((a, b) => a - b);
  if (sortedPrices.length < 2) return null;

  const lowestPrice = sortedPrices[0] ?? totalPence;
  const highestPrice = sortedPrices[sortedPrices.length - 1] ?? lowestPrice;
  if (highestPrice <= lowestPrice) return null;

  const position = (totalPence - lowestPrice) / (highestPrice - lowestPrice);
  if (position <= 0.34) return "cheap";
  if (position <= 0.67) return "medium";
  return "expensive";
}

function isLocalBookingHost() {
  if (typeof window === "undefined") return false;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

function formatMoveDateSummary(dateValue: string) {
  if (!dateValue) return "Date selected";
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Date selected";
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function protectionPlusPence() {
  return 3200;
}

function normaliseDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthYear(date: Date) {
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function makePriceCalendarDays(anchorDate: Date) {
  const normalisedAnchor = normaliseDate(anchorDate);
  const weekday = normalisedAnchor.getDay() || 7;
  const start = addDays(normalisedAnchor, 1 - weekday);

  return Array.from({ length: 35 }).map((_, index) => {
    const date = addDays(start, index);
    return {
      date,
      iso: toDateInputValue(date),
      isPast: date < normalisedAnchor,
    };
  });
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normaliseUkPhone(value: string) {
  return value.trim().replace(/[^\d+]/g, "").replace(/^0044/, "+44");
}

function isValidUkPhone(value: string) {
  const phone = normaliseUkPhone(value);
  return /^(\+44\d{10}|0\d{10})$/i.test(phone);
}

function formatEstimatedInventoryVolume(selectedUnits: number) {
  return `${(Math.max(0, selectedUnits) * CLIENT_ESTIMATED_VOLUME_PER_ITEM_M3).toFixed(2)} m³`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMoveType(value: unknown): value is (typeof MOVE_TYPES)[number]["value"] {
  return typeof value === "string" && MOVE_TYPES.some((option) => option.value === value);
}

function isMoveSize(value: unknown): value is (typeof MOVE_SIZES)[number]["value"] {
  return typeof value === "string" && MOVE_SIZES.some((option) => option.value === value);
}

function isRoom(value: unknown): value is (typeof ROOMS)[number]["value"] {
  return typeof value === "string" && ROOMS.some((option) => option.value === value);
}

function isArrivalWindow(value: unknown): value is "morning" | "afternoon" | "evening" {
  return value === "morning" || value === "afternoon" || value === "evening";
}

function isPreferredContact(value: unknown): value is "email" | "phone" | "sms" {
  return value === "email" || value === "phone" || value === "sms";
}

function isMoverCount(value: unknown): value is 1 | 2 {
  return value === 1 || value === 2;
}

function normalisePropertyType(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  if (!value.trim()) return fallback;
  if (value === "House") return "2 Bedroom House";
  if (value === "Flat") return "2 Bedroom Flat";
  return value;
}

function restoreAccessDraft(value: unknown): AccessDraft | null {
  if (!isRecord(value)) return null;
  const base = initialAccess();
  return {
    ...base,
    address: isRecord(value.address) ? value.address as unknown as AddressData : null,
    propertyType: normalisePropertyType(value.propertyType, base.propertyType),
    floor: typeof value.floor === "number" ? Math.max(0, Math.min(30, Math.floor(value.floor))) : base.floor,
    hasLift: typeof value.hasLift === "boolean" ? value.hasLift : base.hasLift,
    internalStairs: typeof value.internalStairs === "number" ? Math.max(0, Math.min(40, Math.floor(value.internalStairs))) : base.internalStairs,
    externalStairs: typeof value.externalStairs === "number" ? Math.max(0, Math.min(40, Math.floor(value.externalStairs))) : base.externalStairs,
    parking: PARKING_OPTIONS.some((option) => option.value === value.parking) ? value.parking as AccessDraft["parking"] : base.parking,
    parkingRestrictions: typeof value.parkingRestrictions === "string" ? value.parkingRestrictions.slice(0, 400) : base.parkingRestrictions,
    carryDistanceMeters: typeof value.carryDistanceMeters === "number" ? Math.max(0, Math.min(500, Math.floor(value.carryDistanceMeters))) : base.carryDistanceMeters,
    narrowRoad: typeof value.narrowRoad === "boolean" ? value.narrowRoad : base.narrowRoad,
    loadingBayAvailable: typeof value.loadingBayAvailable === "boolean" ? value.loadingBayAvailable : base.loadingBayAvailable,
    accessRestrictions: typeof value.accessRestrictions === "string" ? value.accessRestrictions.slice(0, 600) : base.accessRestrictions,
    notes: typeof value.notes === "string" ? value.notes.slice(0, 1200) : base.notes,
  };
}

function restoreInventoryLines(value: unknown): InventoryLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.itemId !== "string" || typeof entry.name !== "string" || typeof entry.imagePath !== "string") return [];
    if (!isRoom(entry.room)) return [];
    const quantity = typeof entry.quantity === "number" ? Math.max(1, Math.min(99, Math.floor(entry.quantity))) : 1;
    return [{
      itemId: entry.itemId,
      name: entry.name,
      imagePath: entry.imagePath,
      quantity,
      room: entry.room,
      source: entry.source === "preset" ? "preset" : undefined,
    }];
  });
}

function restoreCustomItems(value: unknown): CustomItemLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.name !== "string" || !isRoom(entry.room)) return [];
    const quantity = typeof entry.quantity === "number" ? Math.max(1, Math.min(25, Math.floor(entry.quantity))) : 1;
    return [{
      name: entry.name.slice(0, 120),
      quantity,
      room: entry.room,
      notes: typeof entry.notes === "string" ? entry.notes.slice(0, 1200) : "",
    }];
  });
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <VStack align="start" gap={4} w="full">
      <VStack align="start" gap={1}>
        <Text fontFamily="heading" fontSize={{ base: "2xl", md: "3xl" }} fontWeight={900} color={bookingTheme.ink} lineHeight="1.1">
          {title}
        </Text>
        {subtitle && (
          <Text fontSize="sm" color={bookingTheme.muted} lineHeight="1.45" maxW={{ base: "280px", md: "full" }}>
            {subtitle}
          </Text>
        )}
      </VStack>
      {children}
    </VStack>
  );
}

function normaliseHeroProperty(value: string): HeroPropertyValue | "" {
  return HERO_PROPERTY_OPTIONS.find((option) => option.value === value)?.value ?? "";
}

function floorLabel(floor: number) {
  if (floor === 0) return "Ground floor";
  const suffix = floor % 100 >= 11 && floor % 100 <= 13
    ? "th"
    : floor % 10 === 1
      ? "st"
      : floor % 10 === 2
        ? "nd"
        : floor % 10 === 3
          ? "rd"
          : "th";
  return `${floor}${suffix} floor`;
}

const FLOOR_OPTIONS = Array.from({ length: 31 }, (_, floor) => ({
  value: floor,
  label: floorLabel(floor),
}));

function HeroSectionHeader({ children, hint = false }: { children: ReactNode; hint?: boolean }) {
  return (
    <HStack gap={2} color="#0E1B3A" fontSize="xs" fontWeight={900} textTransform="uppercase" letterSpacing="0.02em">
      <Text>{children}</Text>
      {hint && <FiInfo size={14} color="#7C8AA5" />}
    </HStack>
  );
}

function HeroPropertyCards({
  title,
  value,
  compact = false,
  onChange,
}: {
  title: string;
  value: string;
  compact?: boolean;
  onChange: (property: (typeof HERO_PROPERTY_OPTIONS)[number]) => void;
}) {
  const selectedOption = HERO_PROPERTY_OPTIONS.find((option) => option.value === value);
  return (
    <Box w="full" minW={0}>
      <Box position="relative" w="full">
        <Box
          position="absolute"
          left={3}
          top="50%"
          transform="translateY(-50%)"
          color={bookingTheme.heroBlue}
          pointerEvents="none"
          zIndex={1}
        >
          <FiHome size={18} />
        </Box>
        <Box
          w="full"
          h={compact ? "42px" : "48px"}
          pl="38px"
          pr="38px"
          borderRadius="md"
          border={`1.5px solid ${selectedOption ? bookingTheme.heroBlue : "#D8E2F0"}`}
          bg={selectedOption ? "rgba(37,99,235,0.04)" : "#FFFFFF"}
          color="#0E1B3A"
          fontSize="sm"
          fontWeight={900}
          _focusWithin={{
            borderColor: bookingTheme.heroBlue,
            boxShadow: "0 0 0 2px rgba(37,99,235,0.16)",
          }}
        >
          <select
            value={value}
            onChange={(event) => {
              const nextOption = HERO_PROPERTY_OPTIONS.find((option) => option.value === event.target.value);
              if (nextOption) onChange(nextOption);
            }}
            aria-label={title}
            style={{
              width: "100%",
              height: "100%",
              appearance: "none",
              background: "transparent",
              border: 0,
              outline: "none",
            }}
          >
            {HERO_PROPERTY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} {option.detail}
              </option>
            ))}
          </select>
        </Box>
        <Box
          position="absolute"
          right={3}
          top="50%"
          transform="translateY(-50%)"
          color="#344463"
          pointerEvents="none"
        >
          <FiChevronDown size={18} />
        </Box>
      </Box>
    </Box>
  );
}

function RouteDetailsFields({
  title,
  value,
  locationColor,
  propertyValue,
  onChange,
  onPropertyChange,
}: {
  title: string;
  value: AccessDraft;
  locationColor: string;
  propertyValue: string;
  onChange: (value: AccessDraft) => void;
  onPropertyChange: (property: (typeof HERO_PROPERTY_OPTIONS)[number]) => void;
}) {
  const patch = (updates: Partial<AccessDraft>) => onChange({ ...value, ...updates });
  const updateFloor = (rawValue: string) => {
    const nextFloor = Math.max(0, Math.min(30, Number.parseInt(rawValue || "0", 10) || 0));
    patch({
      floor: nextFloor,
      internalStairs: value.hasLift ? value.internalStairs : Math.max(value.internalStairs, nextFloor),
    });
  };
  return (
    <VStack align="start" gap={3} w="full" minW={0}>
      <HeroPropertyCards
        title="Property size"
        value={propertyValue}
        compact
        onChange={onPropertyChange}
      />
      <SimpleGrid columns={{ base: 1, sm: 2 }} gap={2.5} w="full">
        <Box>
          <Text mb={1.5} fontSize="xs" color="#0E1B3A" fontWeight={900} textTransform="uppercase">
            Floor number
          </Text>
          <Box
            position="relative"
            h="38px"
            pl={3}
            pr={9}
            borderRadius="md"
            border="1px solid #D8E2F0"
            bg="#FFFFFF"
            color={bookingTheme.ink}
            fontSize="sm"
            fontWeight={800}
            _focusWithin={{ borderColor: locationColor, boxShadow: `0 0 0 2px ${locationColor}22` }}
          >
            <select
              value={value.floor}
              onChange={(event) => updateFloor(event.target.value)}
              aria-label={`${title} floor number`}
              style={{
                width: "100%",
                height: "100%",
                appearance: "none",
                border: 0,
                background: "transparent",
                outline: "none",
              }}
            >
              {FLOOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Box
              position="absolute"
              right={3}
              top="50%"
              transform="translateY(-50%)"
              color="#344463"
              pointerEvents="none"
            >
              <FiChevronDown size={16} />
            </Box>
          </Box>
        </Box>
        <Box>
          <Text mb={1.5} fontSize="xs" color="#0E1B3A" fontWeight={900} textTransform="uppercase">
            Lift available
          </Text>
          <Box
            as="button"
            onClick={() => {
              const nextHasLift = !value.hasLift;
              patch({
                hasLift: nextHasLift,
                internalStairs: nextHasLift ? 0 : Math.max(value.internalStairs, value.floor),
              });
            }}
            w="full"
            h="38px"
            px={3}
            borderRadius="md"
            border={`1.5px solid ${value.hasLift ? locationColor : "#D8E2F0"}`}
            bg={value.hasLift ? `${locationColor}12` : "#FFFFFF"}
            color="#0E1B3A"
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            fontSize="sm"
            fontWeight={900}
            _hover={{ borderColor: locationColor }}
            _focusVisible={{ outline: `2px solid ${locationColor}`, outlineOffset: "2px" }}
          >
            <Text>{value.hasLift ? "Yes" : "No"}</Text>
            <Box
              w="34px"
              h="20px"
              borderRadius="full"
              bg={value.hasLift ? locationColor : "#D8E2F0"}
              p="2px"
              display="flex"
              justifyContent={value.hasLift ? "flex-end" : "flex-start"}
              transition="background 0.18s ease"
            >
              <Box w="16px" h="16px" borderRadius="full" bg="#FFFFFF" boxShadow="0 1px 3px rgba(0,0,0,0.18)" />
            </Box>
          </Box>
        </Box>
      </SimpleGrid>
    </VStack>
  );
}

function RouteColumn({
  title,
  value,
  scope,
  searchProximity,
  locationColor,
  propertyValue,
  showDetailsOnMobile = true,
  onChange,
  onPropertyChange,
}: {
  title: string;
  value: AccessDraft;
  scope?: "uk" | "scotland";
  searchProximity?: Pick<AddressData, "lat" | "lng"> | null;
  locationColor: string;
  propertyValue: string;
  showDetailsOnMobile?: boolean;
  onChange: (value: AccessDraft) => void;
  onPropertyChange: (property: (typeof HERO_PROPERTY_OPTIONS)[number]) => void;
}) {
  const patch = (updates: Partial<AccessDraft>) => onChange({ ...value, ...updates });
  return (
    <VStack align="start" gap={2} w="full" minW={0}>
      <HStack gap={2} color="#0E1B3A" fontSize="xs" fontWeight={900} textTransform="uppercase" letterSpacing="0.02em">
        <FiMapPin color={locationColor} size={16} />
        <Text>{title}</Text>
      </HStack>
      <Box
        w="full"
        bg="#FFFFFF"
        border="1px solid #D8E2F0"
        borderRadius="md"
        boxShadow="0 1px 0 rgba(20,50,60,0.04)"
        overflow="visible"
        _focusWithin={{
          borderColor: bookingTheme.heroBlue,
          boxShadow: "0 0 0 2px rgba(37,99,235,0.14)",
        }}
      >
        <AddressAutocomplete
          value={value.address}
          onChange={(address) => patch({ address })}
          scope={scope}
          proximity={searchProximity}
          placeholder="Postcode or full address"
          tone="light"
          enableCurrentLocation
          currentLocationColor={locationColor}
          embedded
        />
      </Box>
      <Box display={{ base: showDetailsOnMobile ? "block" : "none", md: "block" }} w="full">
        <RouteDetailsFields
          title={title}
          value={value}
          locationColor={locationColor}
          propertyValue={propertyValue}
          onChange={onChange}
          onPropertyChange={onPropertyChange}
        />
      </Box>
    </VStack>
  );
}

function MoveDateBlock({
  moveDate,
  flexibleDate,
  minDate,
  onDateChange,
  onFlexibleChange,
}: {
  moveDate: string;
  flexibleDate: boolean;
  minDate: string;
  onDateChange: (date: string) => void;
  onFlexibleChange: (value: boolean) => void;
}) {
  return (
    <VStack align="start" gap={2.5} w="full">
      <Box position="relative" w="full">
        <Box
          position="absolute"
          left={3}
          top="50%"
          transform="translateY(-50%)"
          color={bookingTheme.heroBlue}
          pointerEvents="none"
          zIndex={1}
        >
          <FiCalendar size={16} />
        </Box>
        <Box
          asChild
          w="full"
          h="38px"
          pl="38px"
          pr="38px"
          borderRadius="lg"
          bg="#FFFFFF"
          border={`1px solid ${moveDate ? bookingTheme.heroBlue : "#D8E2F0"}`}
          color={moveDate ? bookingTheme.ink : bookingTheme.muted}
          fontSize="sm"
          fontWeight={700}
          _focusWithin={{
            borderColor: bookingTheme.heroBlue,
            boxShadow: "0 0 0 2px rgba(37,99,235,0.18)",
          }}
        >
          <input
            type={moveDate ? "date" : "text"}
            min={minDate}
            value={moveDate}
            onChange={(event) => onDateChange(event.target.value)}
            onFocus={(event) => {
              event.currentTarget.type = "date";
              const picker = event.currentTarget as HTMLInputElement & { showPicker?: () => void };
              picker.showPicker?.();
            }}
            onBlur={(event) => {
              if (!event.currentTarget.value) event.currentTarget.type = "text";
            }}
            placeholder="When are you moving?"
            aria-label="When are you moving?"
            style={{ width: "100%", height: "100%", outline: "none" }}
          />
        </Box>
      </Box>
      <Box
        as="button"
        onClick={() => onFlexibleChange(!flexibleDate)}
        display="flex"
        alignItems="center"
        gap={2.5}
        color={bookingTheme.ink}
        fontSize="sm"
        fontWeight={800}
        textAlign="left"
      >
        <Box
          w="20px"
          h="20px"
          borderRadius="md"
          border={`1.5px solid ${flexibleDate ? bookingTheme.heroBlue : "#C9D4E5"}`}
          bg={flexibleDate ? bookingTheme.heroBlue : "#FFFFFF"}
          color="#FFFFFF"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          {flexibleDate && <FiCheck size={15} />}
        </Box>
        I don&apos;t have a move date yet
      </Box>
    </VStack>
  );
}

function TrustpilotBadge() {
  return (
    <VStack align="start" gap={1}>
      <HStack gap={1.5} fontSize="xs" color={bookingTheme.ink}>
        <FiStar color="#00B67A" fill="#00B67A" size={14} />
        <Text fontWeight={800}>Trustpilot</Text>
        <Text>200,570</Text>
      </HStack>
      <HStack gap="2px">
        {Array.from({ length: 5 }).map((_, index) => (
          <Box
            key={index}
            w="22px"
            h="22px"
            bg="#00B67A"
            color="#FFFFFF"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <FiStar fill="#FFFFFF" size={13} />
          </Box>
        ))}
      </HStack>
    </VStack>
  );
}

function InventoryMobileSummary({
  selectedUnits,
  activeRoomLabel,
  activeRoomUnits,
  collection,
  delivery,
  onEditInventory,
  onClearInventory,
}: {
  selectedUnits: number;
  activeRoomLabel: string;
  activeRoomUnits: number;
  collection: AccessDraft;
  delivery: AccessDraft;
  onEditInventory?: () => void;
  onClearInventory?: () => void;
}) {
  const routeLabel = `${routeLocationLabel(collection.address, "Collection")} to ${routeLocationLabel(delivery.address, "Delivery")}`;
  const hasItems = selectedUnits > 0;
  const routeDetails = useBookingRouteDetails(collection, delivery);

  return (
    <Box
      display={{ base: "block", lg: "none" }}
      mb={4}
      p={4}
      borderRadius="md"
      border={`1px solid ${bookingTheme.borderStrong}`}
      bg="#FFFFFF"
      boxShadow="0 10px 28px rgba(20,50,60,0.08)"
    >
      <HStack justify="space-between" align="start" gap={3}>
        <Box minW={0}>
          <Text fontSize="xs" color={bookingTheme.muted} fontWeight={900} textTransform="uppercase">
            Your move
          </Text>
          <Text mt={1} fontSize="sm" fontWeight={900} color={bookingTheme.ink} lineHeight="1.35" overflow="hidden" textOverflow="ellipsis">
            {routeLabel}
          </Text>
        </Box>
        <Box
          px={3}
          py={1.5}
          borderRadius="md"
          bg={hasItems ? bookingTheme.primarySoft : "#F2F6F7"}
          color={hasItems ? bookingTheme.primaryDark : bookingTheme.muted}
          fontSize="sm"
          fontWeight={900}
          flexShrink={0}
        >
          {selectedUnits} item{selectedUnits === 1 ? "" : "s"}
        </Box>
      </HStack>
      <HStack mt={3} gap={2} color={bookingTheme.muted} fontSize="sm" flexWrap="wrap">
        <FiBox />
        <Text>
          {activeRoomLabel}: {activeRoomUnits} selected
        </Text>
      </HStack>
      {collection.address && delivery.address && (
        <Box mt={4} borderRadius="md" overflow="hidden" border={`1px solid ${bookingTheme.border}`}>
          <MapboxRouteMap
            pickup={collection.address}
            dropoff={delivery.address}
            geometry={routeDetails.geometry}
            loading={routeDetails.loading}
          />
        </Box>
      )}
      {hasItems && (
        <HStack mt={4} gap={2}>
          {onEditInventory && (
            <Box
              as="button"
              onClick={onEditInventory}
              flex={1}
              h="42px"
              borderRadius="md"
              border={`1px solid ${bookingTheme.heroBlue}`}
              color={bookingTheme.heroBlue}
              display="flex"
              alignItems="center"
              justifyContent="center"
              gap={2}
              fontSize="sm"
              fontWeight={900}
            >
              <FiShoppingBag />
              Edit items
            </Box>
          )}
          {onClearInventory && (
            <Box
              as="button"
              onClick={onClearInventory}
              w="46px"
              h="42px"
              borderRadius="md"
              border={`1px solid ${bookingTheme.borderStrong}`}
              color={bookingTheme.danger}
              display="flex"
              alignItems="center"
              justifyContent="center"
              aria-label="Clear selected items"
              title="Clear selected items"
            >
              <FiTrash2 />
            </Box>
          )}
        </HStack>
      )}
    </Box>
  );
}

function FirstStepRoutePreview({
  collection,
  delivery,
  size = "full",
}: {
  collection: AccessDraft;
  delivery: AccessDraft;
  size?: "compact" | "full";
}) {
  const routeDetails = useBookingRouteDetails(collection, delivery);
  const hasRoute = Boolean(collection.address && delivery.address);
  const routeMiles = routeDetails.distanceMiles != null
    ? `${routeDetails.distanceMiles} miles`
    : estimateRouteMiles(collection.address, delivery.address);
  const routeDuration = formatRouteDuration(routeDetails.durationMinutes);
  const routeLabel = `${routeLocationLabel(collection.address, "Collection")} to ${routeLocationLabel(delivery.address, "Delivery")}`;
  const routeMeta = routeMiles
    ? `${routeMiles}${routeDuration ? `, ${routeDuration}` : routeDetails.loading ? ", calculating time..." : ""}`
    : routeDetails.loading ? "Calculating route..." : "Route distance pending";
  const isCompact = size === "compact";
  const mapHeight = isCompact
    ? { base: "178px", md: "196px" }
    : { base: "280px", md: "340px", lg: "500px" };

  if (!hasRoute) return null;

  return (
    <Box
      className="ma-booking-panel-enter"
      display="block"
      position="relative"
      alignSelf="stretch"
      style={{ animationDelay: "120ms" }}
    >
      <Box
        borderRadius="md"
        overflow="hidden"
        border="1px solid rgba(255,255,255,0.38)"
        bg="#FFFFFF"
        boxShadow={isCompact ? "0 12px 32px rgba(20,50,60,0.13)" : "0 26px 70px rgba(5, 20, 46, 0.34)"}
      >
        <Box position="relative" h={mapHeight} bg="#0B1F38" overflow="hidden">
          <MapboxRouteMap
            pickup={collection.address}
            dropoff={delivery.address}
            geometry={routeDetails.geometry}
            loading={routeDetails.loading}
            variant={isCompact ? "mini" : "hero"}
          />
        </Box>

        <Box
          p={isCompact ? 3 : { base: 3, md: 4 }}
          bg="#FFFFFF"
          color={bookingTheme.ink}
        >
          <Box minW={0}>
            <Text fontSize="xs" color={bookingTheme.heroBlue} fontWeight={900} textTransform="uppercase">
              Your route
            </Text>
            <Text mt={1} fontSize={{ base: "sm", md: "md" }} fontWeight={900} lineHeight="1.35">
              {routeLabel}
            </Text>
            <Text mt={1} fontSize={isCompact ? "xs" : "sm"} color={bookingTheme.muted} fontWeight={800}>
              {routeMeta}
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function HeroBenefitsStrip() {
  const benefits = [
    { title: "Clear Quote", detail: "Route, crew and add-ons shown before checkout.", icon: FiTruck },
    { title: "Careful Handling", detail: "We treat your belongings like our own.", icon: FiShield },
    { title: "Live Support", detail: "Friendly support when you need it.", icon: FiMonitor },
    { title: "Secure Payments", detail: "Safe, secure and encrypted payments.", icon: FiCreditCard },
  ];

  return (
    <Box
      className="ma-booking-panel-enter"
      mt={5}
      bg="#FFFFFF"
      borderRadius="xl"
      boxShadow="0 22px 50px rgba(3,16,45,0.22)"
      border="1px solid rgba(255,255,255,0.8)"
      p={{ base: 3, md: 4 }}
      style={{ animationDelay: "170ms" }}
    >
      <SimpleGrid columns={{ base: 1, sm: 2, lg: 5 }} gap={0}>
        {benefits.map(({ title, detail, icon: Icon }, index) => (
          <HStack
            key={title}
            gap={3}
            px={{ base: 2, md: 4 }}
            py={2}
            borderRight={{ base: "0", lg: index < benefits.length - 1 ? "1px solid #D8E2F0" : "0" }}
          >
            <Box
              w="48px"
              h="48px"
              borderRadius="lg"
              bg="rgba(37,99,235,0.10)"
              color={bookingTheme.heroBlue}
              display="flex"
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
            >
              <Icon size={22} />
            </Box>
            <Box minW={0}>
              <Text fontSize="sm" fontWeight={900} color="#0E1B3A">{title}</Text>
              <Text mt={0.5} fontSize="xs" lineHeight="1.25" color="#344463">{detail}</Text>
            </Box>
          </HStack>
        ))}
        <HStack gap={3} px={{ base: 2, md: 4 }} py={2}>
          <Box
            w="48px"
            h="48px"
            borderRadius="lg"
            bg="rgba(37,99,235,0.10)"
            color={bookingTheme.heroBlue}
            display="flex"
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
          >
            <FiStar size={24} />
          </Box>
          <Box>
            <HStack gap={2}>
              <Text fontSize="2xl" fontWeight={900} color="#0E1B3A">4.9/5</Text>
              <HStack gap={0.5} color="#FFB900">
                {Array.from({ length: 5 }).map((_, index) => (
                  <FiStar key={index} fill="currentColor" size={15} />
                ))}
              </HStack>
            </HStack>
            <Text fontSize="xs" color="#344463">Based on 200,570+ reviews</Text>
          </Box>
        </HStack>
      </SimpleGrid>
    </Box>
  );
}

function createRouteMarker(label: "A" | "B", color: string) {
  const marker = document.createElement("div");
  marker.setAttribute("aria-label", label === "A" ? "Collection marker" : "Delivery marker");
  marker.classList.add("ma-route-marker");
  marker.style.setProperty("--ma-route-marker-color", color);
  marker.style.width = "30px";
  marker.style.height = "30px";
  marker.style.borderRadius = "999px";
  marker.style.background = color;
  marker.style.border = "3px solid #FFFFFF";
  marker.style.boxShadow = "0 7px 18px rgba(20, 50, 60, 0.28)";
  marker.style.color = "#FFFFFF";
  marker.style.display = "flex";
  marker.style.alignItems = "center";
  marker.style.justifyContent = "center";
  marker.style.fontSize = "13px";
  marker.style.fontWeight = "900";
  marker.style.isolation = "isolate";
  marker.style.lineHeight = "1";
  marker.style.overflow = "visible";
  marker.style.position = "relative";
  marker.textContent = label;
  return marker;
}

function fallbackRoutePoints(
  pickup: AddressData,
  dropoff: AddressData,
  geometry: string | null
) {
  const route = geometry ? decodePolyline(geometry) : [];
  const points = route.length > 1
    ? route
    : [
        { lng: pickup.lng, lat: pickup.lat },
        { lng: dropoff.lng, lat: dropoff.lat },
      ];
  const lngs = points.map((point) => point.lng);
  const lats = points.map((point) => point.lat);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const lngRange = Math.max(maxLng - minLng, 0.000001);
  const latRange = Math.max(maxLat - minLat, 0.000001);

  return points.map((point) => {
    const x = 14 + ((point.lng - minLng) / lngRange) * 72;
    const y = 18 + (1 - ((point.lat - minLat) / latRange)) * 64;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
}

function RouteFallbackMap({
  pickup,
  dropoff,
  geometry,
  variant,
}: {
  pickup: AddressData | null;
  dropoff: AddressData | null;
  geometry: string | null;
  variant: "mini" | "compact" | "hero";
}) {
  if (!pickup || !dropoff) {
    return (
      <VStack position="absolute" inset={0} justify="center" gap={2} color={bookingTheme.muted} bg="#E8F0F3">
        <FiMapPin size={28} />
        <Text fontSize="sm" fontWeight={800}>Route preview unavailable</Text>
      </VStack>
    );
  }

  const points = fallbackRoutePoints(pickup, dropoff, geometry);
  const strokeWidth = variant === "hero" ? 4 : 5;

  return (
    <Box position="absolute" inset={0} bg="linear-gradient(135deg, #EAF2F7 0%, #F8FBFC 52%, #E0ECF2 100%)">
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <filter id="fallbackRouteGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke="rgba(20,50,60,0.18)"
          strokeWidth={strokeWidth + 4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={bookingTheme.heroBlue}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#fallbackRouteGlow)"
        />
      </svg>
      <Box position="absolute" left="14%" top="62%" transform="translate(-50%, -50%)">
        <Box w="30px" h="30px" borderRadius="full" bg={bookingTheme.heroBlue} border="3px solid #FFFFFF" color="#FFFFFF" display="flex" alignItems="center" justifyContent="center" fontSize="13px" fontWeight={900} boxShadow="0 7px 18px rgba(20,50,60,0.28)">
          A
        </Box>
      </Box>
      <Box position="absolute" right="14%" top="38%" transform="translate(50%, -50%)">
        <Box w="30px" h="30px" borderRadius="full" bg={bookingTheme.ctaPink} border="3px solid #FFFFFF" color="#FFFFFF" display="flex" alignItems="center" justifyContent="center" fontSize="13px" fontWeight={900} boxShadow="0 7px 18px rgba(20,50,60,0.28)">
          B
        </Box>
      </Box>
      <Box position="absolute" left={3} bottom={3} px={3} py={1.5} borderRadius="full" bg="rgba(255,255,255,0.92)" color={bookingTheme.ink} fontSize="xs" fontWeight={800} boxShadow="0 8px 20px rgba(20,50,60,0.12)">
        Route preview
      </Box>
    </Box>
  );
}

function MapboxRouteMap({
  pickup,
  dropoff,
  geometry,
  loading,
  variant = "compact",
}: {
  pickup: AddressData | null;
  dropoff: AddressData | null;
  geometry: string | null;
  loading: boolean;
  variant?: "mini" | "compact" | "hero";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<MapboxMarker[]>([]);
  const [mapError, setMapError] = useState("");
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
  const hasRealToken = mapboxToken && mapboxToken !== "pk.placeholder";
  const canRenderMap = Boolean(
    hasRealToken &&
    pickup?.lat != null &&
    pickup.lng != null &&
    dropoff?.lat != null &&
    dropoff.lng != null
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !canRenderMap || !pickup || !dropoff) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let resizeMap: (() => void) | null = null;
    const resizeTimers: number[] = [];
    setMapError("");

    const decodedRoute = geometry ? decodePolyline(geometry) : [];
    const routeCoordinates: Array<[number, number]> = decodedRoute.length > 1
      ? decodedRoute.map((point) => [point.lng, point.lat])
      : [
          [pickup.lng, pickup.lat],
          [dropoff.lng, dropoff.lat],
        ];
    let mapLoaded = false;

    void (async () => {
      try {
        const imported = await import("mapbox-gl");
        if (cancelled) return;

        const mapboxgl = (imported.default ?? imported) as unknown as MapboxRuntime;
        mapboxgl.accessToken = mapboxToken;

        const map = new mapboxgl.Map({
          accessToken: mapboxToken,
          attributionControl: false,
          center: [(pickup.lng + dropoff.lng) / 2, (pickup.lat + dropoff.lat) / 2],
          container,
          cooperativeGestures: true,
          dragRotate: false,
          pitchWithRotate: false,
          style: "mapbox://styles/mapbox/light-v11",
          zoom: 7,
        });

        mapRef.current = map;
        const handleResize = () => map.resize();
        resizeMap = handleResize;
        resizeObserver = typeof ResizeObserver !== "undefined"
          ? new ResizeObserver(handleResize)
          : null;
        resizeObserver?.observe(container);
        window.addEventListener("resize", handleResize);
        markersRef.current = [
          new mapboxgl.Marker({ element: createRouteMarker("A", bookingTheme.heroBlue) })
            .setLngLat([pickup.lng, pickup.lat])
            .addTo(map),
          new mapboxgl.Marker({ element: createRouteMarker("B", bookingTheme.ctaPink) })
            .setLngLat([dropoff.lng, dropoff.lat])
            .addTo(map),
        ];

        map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
        map.on("error", (event) => {
          const status = (event.error as Error & { status?: number }).status;
          if (!cancelled && !mapLoaded && (status === 401 || status === 403)) {
            setMapError("Map unavailable");
          }
        });

        map.on("load", () => {
          if (cancelled) return;
          mapLoaded = true;
          setMapError("");
          map.addSource("booking-route", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: routeCoordinates,
              },
            },
          });
          map.addLayer({
            id: "booking-route-line",
            type: "line",
            source: "booking-route",
            layout: {
              "line-cap": "round",
              "line-join": "round",
            },
            paint: {
              "line-color": bookingTheme.heroBlue,
              "line-opacity": 0.88,
              "line-width": 5,
            },
          });

          const firstPoint = routeCoordinates[0] ?? [pickup.lng, pickup.lat];
          const bounds = new mapboxgl.LngLatBounds(firstPoint, firstPoint);
          for (const point of routeCoordinates) bounds.extend(point);
          bounds.extend([pickup.lng, pickup.lat]);
          bounds.extend([dropoff.lng, dropoff.lat]);
          map.fitBounds(bounds, {
            duration: variant === "hero" ? 650 : 0,
            maxZoom: 13,
            padding: variant === "hero"
              ? { bottom: 58, left: 48, right: 48, top: 58 }
              : variant === "mini"
                ? { bottom: 30, left: 30, right: 30, top: 30 }
              : { bottom: 42, left: 42, right: 42, top: 42 },
          });
          resizeTimers.push(window.setTimeout(handleResize, 120));
          resizeTimers.push(window.setTimeout(handleResize, 420));
        });

        resizeTimers.push(window.setTimeout(handleResize, 80));
      } catch {
        if (!cancelled) setMapError("Map unavailable");
      }
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      for (const timer of resizeTimers) window.clearTimeout(timer);
      if (resizeMap) window.removeEventListener("resize", resizeMap);
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [
    canRenderMap,
    dropoff,
    dropoff?.lat,
    dropoff?.lng,
    geometry,
    mapboxToken,
    pickup,
    pickup?.lat,
    pickup?.lng,
    variant,
  ]);

  const mapHeight = variant === "hero"
    ? { base: "280px", md: "340px", lg: "500px" }
    : variant === "mini"
      ? { base: "178px", md: "196px" }
      : { base: "224px", md: "202px" };

  return (
    <Box
      h={mapHeight}
      minH={mapHeight}
      bg="#E8F0F3"
      position="relative"
      overflow="hidden"
    >
      <Box ref={containerRef} position="absolute" inset={0} />
      {(!canRenderMap || mapError) && (
        <RouteFallbackMap pickup={pickup} dropoff={dropoff} geometry={geometry} variant={variant} />
      )}
      {canRenderMap && loading && !mapError && (
        <Box
          position="absolute"
          left={3}
          bottom={3}
          px={3}
          py={1.5}
          borderRadius="full"
          bg="rgba(255,255,255,0.92)"
          color={bookingTheme.ink}
          fontSize="xs"
          fontWeight={800}
          boxShadow="0 8px 20px rgba(20,50,60,0.12)"
          pointerEvents="none"
        >
          Calculating route...
        </Box>
      )}
    </Box>
  );
}

function InventoryItemRow({
  item,
  quantity,
  onAdd,
  onRemove,
}: {
  item: InventoryListItem;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onAdd}
      onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onAdd();
        }
      }}
      minH="58px"
      px={{ base: 4, md: 6 }}
      py={3}
      borderBottom={`1px solid ${bookingTheme.border}`}
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      gap={4}
      cursor="pointer"
      color={bookingTheme.ink}
      bg={quantity > 0 ? "#FCFEFF" : "#FFFFFF"}
      _hover={{ bg: "#F8FBFC" }}
      _focusVisible={{ outline: `2px solid ${bookingTheme.heroBlue}`, outlineOffset: "-2px" }}
    >
      <Text fontSize={{ base: "sm", md: "md" }} fontWeight={500}>
        {item.displayName}
      </Text>
      {quantity > 0 ? (
        <HStack gap={2} onClick={(event) => event.stopPropagation()} color={bookingTheme.heroBlue}>
          <FiEdit2 size={18} />
          <Box as="button" aria-label={`Remove ${item.displayName}`} onClick={onRemove} color={bookingTheme.heroBlue}>
            <FiMinusCircle size={24} />
          </Box>
          <Box minW="42px" h="36px" border={`1px solid ${bookingTheme.borderStrong}`} bg="#FFFFFF" display="flex" alignItems="center" justifyContent="center" color={bookingTheme.ink} fontSize="xl" fontWeight={700}>
            {quantity}
          </Box>
          <Box as="button" aria-label={`Add ${item.displayName}`} onClick={onAdd} color={bookingTheme.heroBlue}>
            <FiPlusCircle size={24} />
          </Box>
        </HStack>
      ) : (
        <Box color="#8B979D">
          <FiPlus size={24} />
        </Box>
      )}
    </Box>
  );
}

function SummaryEditButton({
  label,
  onClick,
  icon = "edit",
}: {
  label: string;
  onClick?: () => void;
  icon?: "edit" | "basket";
}) {
  const Icon = icon === "basket" ? FiShoppingBag : FiEdit2;
  if (!onClick) return <Icon color={bookingTheme.heroBlue} />;

  return (
    <Box
      as="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      w="32px"
      h="32px"
      borderRadius="full"
      color={bookingTheme.heroBlue}
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
      _hover={{ bg: "rgba(37,99,235,0.10)" }}
      _focusVisible={{ outline: `2px solid ${bookingTheme.heroBlue}`, outlineOffset: "2px" }}
    >
      <Icon size={18} />
    </Box>
  );
}

function InventorySidebar({
  selectedUnits,
  activeRoomLabel,
  activeRoomUnits,
  collection,
  delivery,
  onEditRoute,
  onEditInventory,
}: {
  selectedUnits: number;
  activeRoomLabel: string;
  activeRoomUnits: number;
  collection: AccessDraft;
  delivery: AccessDraft;
  onEditRoute?: () => void;
  onEditInventory?: () => void;
}) {
  const routeDetails = useBookingRouteDetails(collection, delivery);
  const routeMiles = routeDetails.distanceMiles != null
    ? `${routeDetails.distanceMiles} miles`
    : estimateRouteMiles(collection.address, delivery.address);
  const routeDuration = formatRouteDuration(routeDetails.durationMinutes);
  const routeLabel = `${routeLocationLabel(collection.address, "Collection")} to ${routeLocationLabel(delivery.address, "Delivery")}`;
  const propertyLabel = `${formatRoomPropertyType(collection.propertyType)} to ${formatRoomPropertyType(delivery.propertyType)}`;
  const approxVolume = formatEstimatedInventoryVolume(selectedUnits);
  const routeMeta = routeMiles
    ? `${routeMiles}${routeDuration ? `, ${routeDuration}` : routeDetails.loading ? ", calculating time..." : ", estimated time calculated at checkout"}`
    : routeDetails.loading ? "Calculating route..." : "Estimated distance calculated at checkout";

  return (
    <VStack align="stretch" gap={4}>
      <Box border={`1px solid ${bookingTheme.borderStrong}`} borderRadius="md" bg="#FFFFFF" overflow="hidden">
        <Box bg="#FFFBE5" p={4}>
          <HStack gap={2} color={bookingTheme.heroBlue} fontWeight={900} fontSize="lg">
            <FiShield size={22} />
            <Text>Complimentary cover</Text>
          </HStack>
          <Text mt={2} fontSize="sm" lineHeight="1.45" color="#111111">
            Experience peaceful moving with our Complimentary Cover, offering £50,000 security against fire and theft.
          </Text>
        </Box>
        <MapboxRouteMap
          pickup={collection.address}
          dropoff={delivery.address}
          geometry={routeDetails.geometry}
          loading={routeDetails.loading}
        />
        <Box p={4}>
          <HStack justify="space-between" align="start" gap={3}>
            <Text fontSize="sm" fontWeight={900} color={bookingTheme.ink} lineHeight="1.35">
              {routeLabel}
            </Text>
            <SummaryEditButton label="Edit route details" onClick={onEditRoute} />
          </HStack>
          <Text mt={2} fontSize="sm" color={bookingTheme.muted}>{propertyLabel}</Text>
          <Text mt={1} fontSize="sm" color={bookingTheme.muted}>
            {routeMeta}
          </Text>
          {selectedUnits > 0 && (
            <Box mt={4} p={3} borderRadius="md" bg="#F8F8F8">
              <HStack justify="space-between">
                <Text fontSize="sm" fontWeight={900}>Inventory <Text as="span" fontWeight={500}>({selectedUnits} item{selectedUnits === 1 ? "" : "s"})</Text></Text>
                <SummaryEditButton label="Edit inventory" onClick={onEditInventory} icon="basket" />
              </HStack>
              <HStack mt={2} gap={2} color={bookingTheme.muted} fontSize="xs">
                <Text>{approxVolume}</Text>
                <Text>/</Text>
                <Text>Copy inventory</Text>
                <FiCopy size={14} />
              </HStack>
              <HStack mt={3} justify="space-between" color={bookingTheme.ink}>
                <Text>{activeRoomLabel} <Text as="span" color={bookingTheme.muted}>({activeRoomUnits} item{activeRoomUnits === 1 ? "" : "s"})</Text></Text>
                <FiChevronDown />
              </HStack>
            </Box>
          )}
        </Box>
      </Box>
      <HStack justify="center" gap={2} color={bookingTheme.muted} fontSize="xs">
        <FiBox />
        <Text>Working with trusted UK marketplaces</Text>
      </HStack>
    </VStack>
  );
}

type RouteDetailsData = {
  distanceMiles: number | null;
  durationMinutes: number | null;
  geometry: string | null;
};

type RouteDetailsState = RouteDetailsData & {
  loading: boolean;
};

const EMPTY_ROUTE_DETAILS: RouteDetailsState = {
  distanceMiles: null,
  durationMinutes: null,
  geometry: null,
  loading: false,
};

const ROUTE_DETAILS_CACHE = new Map<string, RouteDetailsData>();
const ROUTE_DETAILS_IN_FLIGHT = new Map<string, Promise<RouteDetailsData>>();
const MAX_ROUTE_DETAILS_CACHE_ENTRIES = 40;

function routeDetailsKey(pickup: AddressData, dropoff: AddressData) {
  const rounded = (value: number) => value.toFixed(5);
  return `${rounded(pickup.lng)},${rounded(pickup.lat)}>${rounded(dropoff.lng)},${rounded(dropoff.lat)}`;
}

function rememberRouteDetails(key: string, details: RouteDetailsData) {
  if (ROUTE_DETAILS_CACHE.has(key)) ROUTE_DETAILS_CACHE.delete(key);
  ROUTE_DETAILS_CACHE.set(key, details);
  while (ROUTE_DETAILS_CACHE.size > MAX_ROUTE_DETAILS_CACHE_ENTRIES) {
    const oldestKey = ROUTE_DETAILS_CACHE.keys().next().value;
    if (!oldestKey) break;
    ROUTE_DETAILS_CACHE.delete(oldestKey);
  }
}

async function loadRouteDetails(pickup: AddressData, dropoff: AddressData) {
  const key = routeDetailsKey(pickup, dropoff);
  const cached = ROUTE_DETAILS_CACHE.get(key);
  if (cached) return cached;

  const inFlight = ROUTE_DETAILS_IN_FLIGHT.get(key);
  if (inFlight) return inFlight;

  const from = `${pickup.lng},${pickup.lat}`;
  const to = `${dropoff.lng},${dropoff.lat}`;
  const promise = fetch(`/api/booking/directions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("Route calculation failed");
      return data;
    })
    .then((data: { distanceMiles?: number; durationMinutes?: number; geometry?: string | null }) => {
      const details = {
        distanceMiles: typeof data.distanceMiles === "number" ? data.distanceMiles : null,
        durationMinutes: typeof data.durationMinutes === "number" ? data.durationMinutes : null,
        geometry: typeof data.geometry === "string" ? data.geometry : null,
      };
      rememberRouteDetails(key, details);
      return details;
    })
    .finally(() => {
      ROUTE_DETAILS_IN_FLIGHT.delete(key);
    });

  ROUTE_DETAILS_IN_FLIGHT.set(key, promise);
  return promise;
}

function useBookingRouteDetails(collection: AccessDraft, delivery: AccessDraft) {
  const [routeDetails, setRouteDetails] = useState<RouteDetailsState>(EMPTY_ROUTE_DETAILS);

  useEffect(() => {
    const pickup = collection.address;
    const dropoff = delivery.address;
    if (!pickup || !dropoff) {
      setRouteDetails(EMPTY_ROUTE_DETAILS);
      return;
    }

    const key = routeDetailsKey(pickup, dropoff);
    const cached = ROUTE_DETAILS_CACHE.get(key);
    if (cached) {
      setRouteDetails({ ...cached, loading: false });
      return;
    }

    let active = true;
    setRouteDetails({ ...EMPTY_ROUTE_DETAILS, loading: true });

    void loadRouteDetails(pickup, dropoff)
      .then((details) => {
        if (!active) return;
        setRouteDetails({ ...details, loading: false });
      })
      .catch(() => {
        if (!active) return;
        setRouteDetails(EMPTY_ROUTE_DETAILS);
      });

    return () => {
      active = false;
    };
  }, [
    collection.address,
    collection.address?.lat,
    collection.address?.lng,
    delivery.address,
    delivery.address?.lat,
    delivery.address?.lng,
  ]);

  return routeDetails;
}

function CrewOption({
  movers,
  pricePence,
  priceTone,
  loading,
  selected,
  onClick,
}: {
  movers: MoverCount;
  pricePence?: number | null;
  priceTone?: PriceTone | null;
  loading?: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = movers === 1 ? FiUser : FiUsers;
  const description = movers === 1 ? "Driver helps" : "Driver + helper";
  const priceToneMeta = priceTone ? PRICE_TONE_META[priceTone] : null;
  const hasPrice = typeof pricePence === "number";
  return (
    <Box
      as="button"
      onClick={onClick}
      h={{ base: "74px", md: "58px" }}
      px={{ base: 2.5, md: 4 }}
      borderRight={`1px solid ${bookingTheme.borderStrong}`}
      borderTop={selected ? `3px solid ${bookingTheme.heroBlue}` : "3px solid transparent"}
      bg={selected ? "#FFFFFF" : "#F3F7F8"}
      display="grid"
      gridTemplateColumns={{ base: "minmax(0, 1fr)", md: "minmax(0, 1fr) auto" }}
      gridTemplateRows={{ base: "auto auto", md: "auto" }}
      alignItems="center"
      columnGap={2}
      rowGap={1}
      textAlign="left"
      color={selected ? bookingTheme.ink : bookingTheme.muted}
      cursor="pointer"
      _hover={{ bg: "#FFFFFF" }}
      _focusVisible={{ outline: `2px solid ${bookingTheme.heroBlue}`, outlineOffset: "-2px" }}
    >
      <HStack gap={2} minW={0}>
        <Icon size={20} color={bookingTheme.heroBlue} />
        <Box minW={0}>
          <Text fontSize="sm" fontWeight={900} whiteSpace="nowrap">{movers === 1 ? "1 Person" : "2 People"}</Text>
          <Text fontSize="xs" color={bookingTheme.muted} whiteSpace="nowrap">{description}</Text>
        </Box>
      </HStack>
      <HStack gap={1.5} pl={{ base: 7, md: 0 }} justifySelf={{ base: "start", md: "end" }} minW={0}>
        <Text fontSize="xs" color={bookingTheme.muted}>From</Text>
        <Text
          className={hasPrice ? "ma-price-shimmer" : undefined}
          style={hasPrice ? ({ "--ma-price-tone": priceToneMeta?.color ?? bookingTheme.heroBlue } as React.CSSProperties) : undefined}
          fontSize="sm"
          fontWeight={900}
          color={priceToneMeta?.color}
        >
          {typeof pricePence === "number" ? formatPence(pricePence) : loading ? "Checking" : "Quote"}
        </Text>
        {loading && !hasPrice && <PriceLoadingDots color={bookingTheme.heroBlue} />}
      </HStack>
    </Box>
  );
}

function PriceLoadingDots({ color = bookingTheme.heroBlue }: { color?: string }) {
  return (
    <HStack as="span" gap="3px" aria-hidden="true">
      <Box className="ma-price-dot" as="span" w="4px" h="4px" borderRadius="full" bg={color} />
      <Box className="ma-price-dot ma-price-dot--late" as="span" w="4px" h="4px" borderRadius="full" bg={color} />
      <Box className="ma-price-dot ma-price-dot--later" as="span" w="4px" h="4px" borderRadius="full" bg={color} />
    </HStack>
  );
}

function PriceCalendar({
  selectedDate,
  anchorDate,
  pricePreviews,
  loading,
  previewError,
  onPrevious,
  onNext,
  onSelectDate,
}: {
  selectedDate: string;
  anchorDate: Date;
  pricePreviews: Record<string, QuotePricePreview>;
  loading: boolean;
  previewError?: string;
  onPrevious: () => void;
  onNext: () => void;
  onSelectDate: (date: string) => void;
}) {
  const days = useMemo(() => makePriceCalendarDays(anchorDate), [anchorDate]);
  const comparisonPrices = useMemo(() => getFixedPreviewPrices(pricePreviews), [pricePreviews]);
  const monthLabel = formatMonthYear(anchorDate);
  const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <Box border={`1px solid ${bookingTheme.borderStrong}`} bg="#FFFFFF">
      <HStack h="52px" justify="center" gap={8} borderBottom={`1px solid ${bookingTheme.borderStrong}`}>
        <Box
          as="button"
          aria-label="Previous month"
          onClick={onPrevious}
          w="36px"
          h="36px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          color={bookingTheme.muted}
          _hover={{ color: bookingTheme.heroBlue }}
        >
          <FiChevronLeft />
        </Box>
        <Text minW="180px" textAlign="center" fontSize="xl" fontWeight={800} color="#4A4A4A">
          {monthLabel}
        </Text>
        <Box
          as="button"
          aria-label="Next month"
          onClick={onNext}
          w="36px"
          h="36px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          color={bookingTheme.muted}
          _hover={{ color: bookingTheme.heroBlue }}
        >
          <FiChevronRight />
        </Box>
      </HStack>
      <Flex
        px={{ base: 2, md: 3 }}
        py={2}
        gap={{ base: 1.5, md: 3 }}
        align="center"
        justify="space-between"
        flexWrap="wrap"
        borderBottom={`1px solid ${bookingTheme.border}`}
        bg="#F8FBFC"
      >
        <Text fontSize="xs" color={bookingTheme.muted} fontWeight={800}>
          Price guide
        </Text>
        <HStack gap={{ base: 1, md: 2 }} flexWrap="wrap">
          {PRICE_TONE_ORDER.map((tone) => {
            const toneMeta = PRICE_TONE_META[tone];
            return (
              <HStack key={tone} gap={1} px={{ base: 1.5, md: 2 }} py={1} borderRadius="sm" bg={toneMeta.bg} border={`1px solid ${toneMeta.border}`}>
                <Box w="7px" h="7px" borderRadius="full" bg={toneMeta.color} flexShrink={0} />
                <Text fontSize={{ base: "10px", md: "xs" }} fontWeight={900} color={toneMeta.text} lineHeight="1">
                  {toneMeta.label}
                </Text>
              </HStack>
            );
          })}
        </HStack>
      </Flex>
      <Box w="full" overflow="hidden">
        <Box display="grid" gridTemplateColumns={{ base: "repeat(7, minmax(0, 1fr))", md: "repeat(7, minmax(72px, 1fr))" }}>
          {weekdayLabels.map((label) => (
            <Box key={label} h="42px" px={3} display="flex" alignItems="center" color={bookingTheme.muted} fontSize="sm">
              {label}
            </Box>
          ))}
          {days.map((day) => {
            const selected = day.iso === selectedDate;
            const preview = pricePreviews[day.iso];
            const priceTone = priceToneForTotal(preview?.totalPence, comparisonPrices);
            const priceToneMeta = priceTone ? PRICE_TONE_META[priceTone] : null;
            const hasPrice = typeof preview?.totalPence === "number";
            return (
              <Box
                key={day.iso}
                as="button"
                aria-disabled={day.isPast ? "true" : undefined}
                onClick={() => {
                  if (!day.isPast) onSelectDate(day.iso);
                }}
                minH={{ base: "74px", md: "104px" }}
                p={{ base: 1.5, md: 2 }}
                borderTop={`1px solid ${bookingTheme.border}`}
                borderRight={`1px solid ${bookingTheme.border}`}
                bg={selected ? "rgba(37,99,235,0.10)" : day.isPast ? "#F4F6F7" : "#FFFFFF"}
                color={day.isPast ? "#B8C1C5" : bookingTheme.ink}
                display="flex"
                flexDirection="column"
                alignItems="start"
                justifyContent="space-between"
                cursor={day.isPast ? "not-allowed" : "pointer"}
                _hover={day.isPast ? {} : { bg: selected ? "rgba(37,99,235,0.16)" : "#F8FBFC" }}
                _focusVisible={{ outline: `2px solid ${bookingTheme.heroBlue}`, outlineOffset: "-2px" }}
              >
                <Box
                  w="25px"
                  h="25px"
                  borderRadius="full"
                  bg={selected ? bookingTheme.ctaPink : "transparent"}
                  color={selected ? "#FFFFFF" : "inherit"}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  fontSize={{ base: "xs", md: "sm" }}
                  fontWeight={800}
                >
                  {day.date.getDate()}
                </Box>
                {!day.isPast && (
                  <Text
                    className={hasPrice ? "ma-price-shimmer" : undefined}
                    style={hasPrice ? ({ "--ma-price-tone": priceToneMeta?.color ?? (selected ? bookingTheme.heroBlue : bookingTheme.ink) } as React.CSSProperties) : undefined}
                    fontSize={{ base: "xs", md: "md" }}
                    fontWeight={900}
                    color={priceToneMeta?.color ?? (selected ? bookingTheme.heroBlue : bookingTheme.ink)}
                  >
                    {typeof preview?.totalPence === "number"
                        ? formatPence(preview.totalPence)
                      : loading
                        ? <PriceLoadingDots color={selected ? bookingTheme.heroBlue : bookingTheme.muted} />
                        : preview?.status === "MANUAL_REVIEW"
                          ? "Review"
                          : previewError
                            ? "Retry"
                            : "..."}
                  </Text>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

function PriceCalculationPanel({
  loading,
  hasPrices,
  selectedUnits,
  collection,
  delivery,
}: {
  loading: boolean;
  hasPrices: boolean;
  selectedUnits: number;
  collection: AccessDraft;
  delivery: AccessDraft;
}) {
  const [phase, setPhase] = useState(0);
  const stages = useMemo(() => [
    { label: "Checking live route distance", value: "Route" },
    { label: "Matching the right van and crew", value: "Crew" },
    { label: "Reading your inventory weight", value: `${selectedUnits} items` },
    { label: "Applying date availability", value: "Calendar" },
    { label: "Preparing your best price", value: "Best value" },
  ], [selectedUnits]);
  const activeStage = stages[phase % stages.length] ?? stages[0]!;
  const progress = hasPrices
    ? 100
    : Math.min(94, 22 + (phase % stages.length) * 16);
  const routeLabel = `${routeLocationLabel(collection.address, "Collection")} to ${routeLocationLabel(delivery.address, "Delivery")}`;

  useEffect(() => {
    if (!loading) {
      setPhase(0);
      return;
    }
    const timer = window.setInterval(() => {
      setPhase((value) => value + 1);
    }, 1350);
    return () => window.clearInterval(timer);
  }, [loading]);

  if (!loading && !hasPrices) return null;

  return (
    <Box
      mb={4}
      p={{ base: 4, md: 5 }}
      borderRadius="md"
      border={`1px solid ${hasPrices ? bookingTheme.primary : bookingTheme.heroBlue}`}
      bg={hasPrices ? "#F0FFF7" : "#F5F9FF"}
      color={bookingTheme.ink}
      overflow="hidden"
      position="relative"
    >
      <Box
        position="absolute"
        inset={0}
        pointerEvents="none"
        opacity={loading ? 1 : 0}
        bg="linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.64) 45%, transparent 70%)"
        style={{ animation: loading ? "maQuoteSheen 2.8s ease-in-out infinite" : undefined }}
      />
      <Flex align={{ base: "start", md: "center" }} justify="space-between" gap={4} direction={{ base: "column", md: "row" }} position="relative">
        <HStack align="center" gap={4} minW={0}>
          <Box
            w="82px"
            h="48px"
            borderRadius="md"
            bg="#FFFFFF"
            border={`1px solid ${bookingTheme.border}`}
            position="relative"
            overflow="hidden"
            flexShrink={0}
          >
            <Box position="absolute" left="10px" right="10px" top="24px" h="2px" bg="#CFE0FF" />
            <Box className={loading ? "ma-price-truck" : undefined} position="absolute" left="10px" top="13px" color={hasPrices ? bookingTheme.primaryDark : bookingTheme.heroBlue}>
              <FiTruck size={22} />
            </Box>
            <Box position="absolute" left="9px" top="23px" w="6px" h="6px" borderRadius="full" bg={bookingTheme.heroBlue} />
            <Box position="absolute" right="9px" top="23px" w="6px" h="6px" borderRadius="full" bg={bookingTheme.ctaPink} />
          </Box>
          <Box minW={0}>
            <HStack gap={2} flexWrap="wrap">
              <Text fontSize="sm" fontWeight={900} color={hasPrices ? bookingTheme.primaryDark : bookingTheme.heroBlue}>
                {hasPrices ? "Prices ready" : "Calculating your live prices"}
              </Text>
              {!hasPrices && (
                <HStack gap={1} color={bookingTheme.heroBlue} fontSize="xs" fontWeight={900}>
                  <Box className="ma-price-dot" w="5px" h="5px" borderRadius="full" bg={bookingTheme.heroBlue} />
                  <Box className="ma-price-dot ma-price-dot--late" w="5px" h="5px" borderRadius="full" bg={bookingTheme.heroBlue} />
                  <Box className="ma-price-dot ma-price-dot--later" w="5px" h="5px" borderRadius="full" bg={bookingTheme.heroBlue} />
                </HStack>
              )}
            </HStack>
            <Text mt={1} fontSize={{ base: "sm", md: "md" }} fontWeight={900} lineHeight="1.35">
              {hasPrices ? "Good choice. You can compare dates before you pay." : activeStage.label}
            </Text>
            <Text mt={1} fontSize="xs" color={bookingTheme.muted} lineHeight="1.4" overflow="hidden" textOverflow="ellipsis">
              {routeLabel}
            </Text>
          </Box>
        </HStack>
        <Box minW={{ base: "100%", md: "170px" }}>
          <HStack justify="space-between" mb={2}>
            <Text fontSize="xs" color={bookingTheme.muted} fontWeight={900}>{activeStage.value}</Text>
            <Text fontFamily="mono" fontSize="sm" color={hasPrices ? bookingTheme.primaryDark : bookingTheme.heroBlue} fontWeight={900}>
              {progress}%
            </Text>
          </HStack>
          <Box h="8px" borderRadius="full" bg="#E2EAF0" overflow="hidden">
            <Box
              h="full"
              w={`${progress}%`}
              borderRadius="full"
              bg={hasPrices ? bookingTheme.primary : bookingTheme.heroBlue}
              transition="width 0.55s ease"
            />
          </Box>
        </Box>
      </Flex>
    </Box>
  );
}

function PriceOptionsSidebar({
  selectedUnits,
  moveSize,
  collection,
  delivery,
  items,
  customItems,
  selectedDate,
  services,
  dismantleCount = 0,
  assemblyCount = 0,
  totalPence,
  priceTone,
  totalLoading = false,
  coverageMode = "standard",
  protectionSelected = false,
  onProtectionChange,
  onEditRoute,
  onEditInventory,
  onEditDateAndAddOns,
}: {
  selectedUnits: number;
  moveSize: MoveSizeValue;
  collection: AccessDraft;
  delivery: AccessDraft;
  items: InventoryLine[];
  customItems: CustomItemLine[];
  selectedDate?: string;
  services?: BookingServiceState;
  dismantleCount?: number;
  assemblyCount?: number;
  totalPence?: number;
  priceTone?: PriceTone | null;
  totalLoading?: boolean;
  coverageMode?: "standard" | "checkout";
  protectionSelected?: boolean;
  onProtectionChange?: (selected: boolean) => void;
  onEditRoute?: () => void;
  onEditInventory?: () => void;
  onEditDateAndAddOns?: () => void;
}) {
  const routeDetails = useBookingRouteDetails(collection, delivery);
  const routeMiles = routeDetails.distanceMiles != null
    ? `${routeDetails.distanceMiles} miles`
    : estimateRouteMiles(collection.address, delivery.address);
  const routeDuration = formatRouteDuration(routeDetails.durationMinutes);
  const routeLabel = `${routeLocationLabel(collection.address, "Collection")} to ${routeLocationLabel(delivery.address, "Delivery")}`;
  const propertyLabel = `${formatRoomPropertyType(collection.propertyType)} to ${formatRoomPropertyType(delivery.propertyType)}`;
  const approxVolume = formatEstimatedInventoryVolume(selectedUnits);
  const priceToneMeta = priceTone ? PRICE_TONE_META[priceTone] : null;
  const hasTotalPrice = typeof totalPence === "number";
  const addOnSummaries = services
    ? selectedAddonSummaries(services, moveSize, selectedUnits, dismantleCount, assemblyCount)
    : [];
  const addOnTotalPence = addOnSummaries.reduce((sum, addon) => sum + addon.amountPence, 0);
  const selectedNames = [
    ...items.filter((item) => item.quantity > 0).map((item) => item.name),
    ...customItems.filter((item) => item.quantity > 0).map((item) => item.name),
  ];
  const routeMeta = routeMiles
    ? `${routeMiles}${routeDuration ? `, estimated ${routeDuration}` : routeDetails.loading ? ", calculating time..." : ", estimated time calculated at checkout"}`
    : routeDetails.loading ? "Calculating route..." : "Estimated distance calculated at checkout";

  return (
    <VStack align="stretch" gap={4}>
      <Box border={`1px solid ${bookingTheme.borderStrong}`} borderRadius="md" bg="#FFFFFF" overflow="hidden">
        <MapboxRouteMap
          pickup={collection.address}
          dropoff={delivery.address}
          geometry={routeDetails.geometry}
          loading={routeDetails.loading}
        />
        <Box p={4}>
          <HStack justify="space-between" align="start" gap={3}>
            <Text fontSize="sm" fontWeight={900} color={bookingTheme.ink} lineHeight="1.35">
              {routeLabel}
            </Text>
            <SummaryEditButton label="Edit route details" onClick={onEditRoute} />
          </HStack>
          <Text mt={2} fontSize="sm" color={bookingTheme.muted}>{propertyLabel}</Text>
          <Text mt={1} fontSize="sm" color={bookingTheme.muted}>{routeMeta}</Text>
          <Box mt={4}>
            <HStack justify="space-between">
              <Text fontSize="sm" fontWeight={900}>Inventory <Text as="span" fontWeight={500}>({selectedUnits} item{selectedUnits === 1 ? "" : "s"})</Text></Text>
              <SummaryEditButton label="Edit inventory" onClick={onEditInventory} icon="basket" />
            </HStack>
            <HStack mt={2} gap={2} color={bookingTheme.muted} fontSize="xs">
              <Text>{approxVolume}</Text>
              <Text>/</Text>
              <Text>Copy inventory</Text>
              <FiCopy size={14} />
            </HStack>
            <VStack mt={3} align="stretch" gap={1}>
              {selectedNames.slice(0, 4).map((name) => (
                <Text key={name} fontSize="sm" color={bookingTheme.ink}>{name}</Text>
              ))}
              {selectedNames.length > 4 && (
                <Text fontSize="sm" color={bookingTheme.muted}>+ {selectedNames.length - 4} more</Text>
              )}
            </VStack>
          </Box>
          {selectedDate && (
            <Box mt={4} p={3} borderRadius="md" bg="#F8F8F8">
              <HStack justify="space-between">
                <Text fontSize="sm" fontWeight={900}>Move date and add-ons</Text>
                <SummaryEditButton label="Edit move date and add-ons" onClick={onEditDateAndAddOns} />
              </HStack>
              <HStack mt={3} gap={2} color={bookingTheme.ink} fontSize="sm">
                <FiCalendar color={bookingTheme.heroBlue} />
                  <Text>
                    {formatMoveDateSummary(selectedDate)}
                    <Text as="span" color={bookingTheme.muted}> · 8:00am - 6:00pm</Text>
                  </Text>
              </HStack>
              {addOnSummaries.length > 0 ? (
                <VStack mt={3} align="stretch" gap={2}>
                  {addOnSummaries.map((addon) => (
                    <HStack key={addon.label} justify="space-between" gap={3} fontSize="sm">
                      <Text color={bookingTheme.ink}>{addon.label}</Text>
                      <Text fontFamily="mono" fontWeight={900} color={bookingTheme.primaryDark}>
                        +{formatPence(addon.amountPence)}
                      </Text>
                    </HStack>
                  ))}
                  <HStack
                    justify="space-between"
                    borderTop={`1px solid ${bookingTheme.border}`}
                    pt={2}
                    fontSize="xs"
                    color={bookingTheme.muted}
                    fontWeight={900}
                  >
                    <Text>Included in current prices</Text>
                    <Text>+{formatPence(addOnTotalPence)}</Text>
                  </HStack>
                </VStack>
              ) : (
                <Text mt={3} fontSize="xs" color={bookingTheme.muted}>
                  No paid add-ons selected yet.
                </Text>
              )}
            </Box>
          )}
          {coverageMode === "checkout" && (
            <VStack mt={4} align="stretch" gap={3}>
              <Box border={`1px solid ${bookingTheme.heroBlue}`} borderRadius="md" bg="#FFFFFF" p={4}>
                <Flex align="start" justify="space-between" gap={3}>
                  <HStack align="start" gap={3}>
                    <FiShield color={bookingTheme.heroBlue} size={22} />
                    <Box>
                      <Text fontSize="sm" fontWeight={900}>Complimentary Cover</Text>
                      <Text mt={2} fontSize="sm" color={bookingTheme.ink} lineHeight="1.45">
                        Included in every move. Covers loss, fire and theft up to £20,000, plus damage cover up to £100 per item.
                      </Text>
                    </Box>
                  </HStack>
                  <HStack px={2.5} py={1} borderRadius="md" bg="rgba(37,99,235,0.10)" color={bookingTheme.heroBlue} fontSize="10px" fontWeight={900}>
                    <FiCheck size={12} />
                    <Text>Included</Text>
                  </HStack>
                </Flex>
              </Box>

              <Box
                as="button"
                onClick={() => onProtectionChange?.(!protectionSelected)}
                textAlign="left"
                border="1px solid #BFE3A8"
                borderTop="6px solid #70B62C"
                borderRadius="md"
                bg="#F4FAEF"
                p={4}
                color={bookingTheme.ink}
                _hover={{ borderColor: "#70B62C" }}
              >
                <Text
                  mb={3}
                  display="inline-flex"
                  px={2}
                  py={0.5}
                  borderRadius="sm"
                  bg="#70B62C"
                  color="#FFFFFF"
                  fontSize="10px"
                  fontWeight={900}
                >
                  Recommended
                </Text>
                <HStack align="start" gap={3}>
                  <Box
                    mt={0.5}
                    w="20px"
                    h="20px"
                    borderRadius="md"
                    border={`1px solid ${protectionSelected ? "#70B62C" : bookingTheme.borderStrong}`}
                    bg={protectionSelected ? "#70B62C" : "#FFFFFF"}
                    color="#FFFFFF"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    flexShrink={0}
                  >
                    {protectionSelected && <FiCheck size={13} />}
                  </Box>
                  <Box>
                    <Text fontSize="sm" fontWeight={900}>Protection+</Text>
                    <Text mt={2} fontSize="sm" color={bookingTheme.muted} lineHeight="1.45">
                      Includes complimentary cover, plus enhanced damage protection up to the declared value of your items. Recommended if any item is worth over £100.
                    </Text>
                    <HStack mt={3} gap={2} align="baseline" flexWrap="wrap">
                      <Text fontSize="sm" color={bookingTheme.muted}>From</Text>
                      <Text fontSize="xl" fontWeight={900}>{formatShortPence(protectionPlusPence())}</Text>
                      <Text fontSize="sm" color={bookingTheme.muted}>Based on a declared item value of: £1,000</Text>
                    </HStack>
                  </Box>
                </HStack>
              </Box>
              <Text fontSize="sm" color={bookingTheme.muted}>
                By purchasing Protection+, you agree to the associated <Text as="span" color={bookingTheme.heroBlue}>terms & conditions</Text>.
              </Text>
            </VStack>
          )}
          {(totalLoading || typeof totalPence === "number") && (
            <HStack mt={4} justify="space-between" align="end">
              <Text fontSize="sm" fontWeight={900}>Amount to pay</Text>
              <Text
                className={hasTotalPrice ? "ma-price-shimmer" : undefined}
                style={hasTotalPrice ? ({ "--ma-price-tone": priceToneMeta?.color ?? bookingTheme.heroBlue } as React.CSSProperties) : undefined}
                fontSize="2xl"
                fontWeight={900}
                color={priceToneMeta?.color ?? bookingTheme.heroBlue}
              >
                {typeof totalPence === "number" ? formatPence(totalPence) : "Calculating..."}
              </Text>
              {totalLoading && typeof totalPence !== "number" && <PriceLoadingDots color={bookingTheme.heroBlue} />}
            </HStack>
          )}
          {coverageMode === "standard" && (
            <HStack mt={4} p={3} borderRadius="md" border="1px solid #B9E7CF" bg="#F0FFF7" color="#16805A" justify="center">
              <FiCreditCard />
              <Text fontSize="sm" fontWeight={900}>42% saving vs other companies</Text>
            </HStack>
          )}
        </Box>
      </Box>
      <Box p={4} border={`1px solid ${bookingTheme.borderStrong}`} borderRadius="md" bg="#FFFFFF">
        <HStack align="start" gap={3} color={bookingTheme.heroBlue}>
          <FiShield size={22} />
          <Text fontSize="sm" color={bookingTheme.ink}>
            <Text as="span" fontWeight={900}>Money Back Guarantee & Free Cancellation!</Text>{" "}
            <Text as="span" color={bookingTheme.heroBlue} textDecoration="underline">Learn more</Text>
          </Text>
        </HStack>
      </Box>
      {coverageMode === "checkout" && !totalLoading && typeof totalPence === "number" && (
        <Box p={4} border={`1px solid ${bookingTheme.borderStrong}`} borderRadius="md" bg="#FFFFFF">
          <HStack align="center" gap={3}>
            <Box px={2} py={1} borderRadius="sm" bg="#FFB3D2" color="#2B1830" fontSize="sm" fontWeight={900}>
              Klarna
            </Box>
            <Text fontSize="sm" color={bookingTheme.ink}>
              3 payments of <Text as="span" fontWeight={900}>{formatPence(Math.round((totalPence ?? 0) / 3))}</Text> at 0% interest
            </Text>
          </HStack>
        </Box>
      )}
      {coverageMode === "checkout" && (
        <Text textAlign="center" fontSize="sm" color={bookingTheme.ink} fontWeight={800}>
          By proceeding, you agree with our Terms of use.
        </Text>
      )}
      <HStack justify="center" gap={2}>
        {["VISA", "Mastercard", "G Pay", "Apple Pay", "Klarna"].map((label) => (
          <Box key={label} px={2} py={1} borderRadius="sm" bg="#E8EEF1" color={bookingTheme.ink} fontSize="9px" fontWeight={900}>
            {label}
          </Box>
        ))}
      </HStack>
      <HStack justify="center" gap={2} color={bookingTheme.muted} fontSize="xs">
        <FiBox />
        <Text>Working with trusted UK marketplaces</Text>
      </HStack>
    </VStack>
  );
}

function SelectedItemsSummary({
  items,
  customItems,
  onEdit,
}: {
  items: InventoryLine[];
  customItems: CustomItemLine[];
  onEdit?: () => void;
}) {
  const selected = [
    ...items.filter((item) => item.quantity > 0).map((item) => ({
      key: `${item.room}-${item.itemId}`,
      name: item.name,
      quantity: item.quantity,
    })),
    ...customItems.filter((item) => item.quantity > 0).map((item, index) => ({
      key: `custom-${index}-${item.name}`,
      name: item.name,
      quantity: item.quantity,
    })),
  ];
  const totalUnits = selected.reduce((sum, item) => sum + item.quantity, 0);

  if (selected.length === 0) return null;

  return (
    <Box w="full" p={4} borderRadius="lg" border={`1px solid ${bookingTheme.border}`} bg="#FFFFFF">
      <HStack justify="space-between" align="center" gap={3} mb={3}>
        <HStack gap={2} color={bookingTheme.ink}>
          <FiShoppingBag color={bookingTheme.heroBlue} />
          <Text fontSize="sm" fontWeight={900}>
            Item summary ({totalUnits} item{totalUnits === 1 ? "" : "s"})
          </Text>
        </HStack>
        {onEdit && (
          <Box
            as="button"
            onClick={onEdit}
            display="inline-flex"
            alignItems="center"
            gap={1.5}
            color={bookingTheme.heroBlue}
            fontSize="sm"
            fontWeight={900}
          >
            <FiShoppingBag size={16} />
            Edit
          </Box>
        )}
      </HStack>
      <VStack align="stretch" gap={2} maxH="220px" overflowY="auto">
        {selected.map((item) => (
          <HStack key={item.key} justify="space-between" gap={3} p={2.5} borderRadius="md" bg={bookingTheme.subtle}>
            <Text fontSize="sm" color={bookingTheme.ink} fontWeight={700}>
              {item.name}
            </Text>
            <Text fontFamily="mono" fontSize="sm" fontWeight={900} color={bookingTheme.muted}>
              x{item.quantity}
            </Text>
          </HStack>
        ))}
      </VStack>
    </Box>
  );
}

function ExistingQuotePrompt({
  onContinue,
  onStartNew,
}: {
  onContinue: () => void;
  onStartNew: () => void;
}) {
  return (
    <Box position="fixed" inset={0} zIndex={70} bg="rgba(12,52,65,0.58)" display="flex" alignItems="center" justifyContent="center" px={4}>
      <Box w="full" maxW="430px" bg="#FFFFFF" borderRadius="md" p={{ base: 5, md: 6 }} boxShadow="0 26px 80px rgba(0,0,0,0.28)">
        <HStack gap={3} align="start">
          <Box w="42px" h="42px" borderRadius="full" bg={bookingTheme.primarySoft} color={bookingTheme.primaryDark} display="flex" alignItems="center" justifyContent="center" flexShrink={0}>
            <FiShoppingBag size={22} />
          </Box>
          <Box>
            <Text fontSize={{ base: "lg", md: "xl" }} fontWeight={900} color={bookingTheme.ink}>
              You have an existing quote
            </Text>
            <Text mt={2} fontSize="sm" color={bookingTheme.muted} lineHeight="1.5">
              Would you like to continue where you left off, or start a fresh quote?
            </Text>
          </Box>
        </HStack>
        <VStack mt={6} align="stretch" gap={3}>
          <Box
            as="button"
            onClick={onContinue}
            h="52px"
            borderRadius="md"
            bg={bookingTheme.primary}
            color="#FFFFFF"
            fontWeight={900}
            _hover={{ bg: bookingTheme.primaryDark }}
          >
            Continue quote
          </Box>
          <Box
            as="button"
            onClick={onStartNew}
            h="52px"
            borderRadius="md"
            border={`1px solid ${bookingTheme.borderStrong}`}
            bg="#FFFFFF"
            color={bookingTheme.ink}
            fontWeight={900}
            _hover={{ bg: "#F8FBFC" }}
          >
            Start new one
          </Box>
        </VStack>
      </Box>
    </Box>
  );
}

function PriceOptionsStep({
  selectedUnits,
  moveSize,
  collection,
  delivery,
  items,
  customItems,
  selectedDate,
  selectedMoverCount,
  displayQuoteReference,
  calendarAnchor,
  pricePreviews,
  pricePreviewLoading,
  pricePreviewError,
  services,
  dismantleCount,
  assemblyCount,
  onMoverChange,
  onCalendarPrevious,
  onCalendarNext,
  onDateSelect,
  onPreviewRetry,
  onEditRoute,
  onEditInventory,
  onEditDateAndAddOns,
  onBack,
  onNext,
}: {
  selectedUnits: number;
  moveSize: MoveSizeValue;
  collection: AccessDraft;
  delivery: AccessDraft;
  items: InventoryLine[];
  customItems: CustomItemLine[];
  selectedDate: string;
  selectedMoverCount: 1 | 2;
  displayQuoteReference: string;
  calendarAnchor: Date;
  pricePreviews: Record<string, QuotePricePreview>;
  pricePreviewLoading: boolean;
  pricePreviewError: string;
  services: BookingServiceState;
  dismantleCount: number;
  assemblyCount: number;
  onMoverChange: (value: 1 | 2) => void;
  onCalendarPrevious: () => void;
  onCalendarNext: () => void;
  onDateSelect: (date: string, options?: { advance?: boolean }) => void;
  onPreviewRetry: () => void;
  onEditRoute?: () => void;
  onEditInventory?: () => void;
  onEditDateAndAddOns?: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const selectedMoverPricePreviews = useMemo(
    () => pricePreviewsForMover(pricePreviews, selectedMoverCount),
    [pricePreviews, selectedMoverCount]
  );
  const onePersonPricePreviews = useMemo(
    () => pricePreviewsForMover(pricePreviews, 1),
    [pricePreviews]
  );
  const twoPersonPricePreviews = useMemo(
    () => pricePreviewsForMover(pricePreviews, 2),
    [pricePreviews]
  );
  const onePersonPreview = representativePreview(onePersonPricePreviews, selectedDate);
  const twoPersonPreview = representativePreview(twoPersonPricePreviews, selectedDate);
  const selectedPreviewTotal = selectedMoverPricePreviews[selectedDate]?.totalPence ?? null;
  const comparisonPrices = useMemo(() => getFixedPreviewPrices(selectedMoverPricePreviews), [selectedMoverPricePreviews]);
  const crewComparisonPrices = useMemo(
    () => getFixedPreviewPrices({
      one: onePersonPreview ?? { key: "one", status: "MANUAL_REVIEW", totalPence: null, manualReviewReasons: [] },
      two: twoPersonPreview ?? { key: "two", status: "MANUAL_REVIEW", totalPence: null, manualReviewReasons: [] },
    }),
    [onePersonPreview, twoPersonPreview]
  );
  const selectedPriceTone = priceToneForTotal(selectedPreviewTotal, comparisonPrices);
  const onePersonTone = priceToneForTotal(onePersonPreview?.totalPence, crewComparisonPrices);
  const twoPersonTone = priceToneForTotal(twoPersonPreview?.totalPence, crewComparisonPrices);
  const hasPreviewPrices = fixedPreviewValues(pricePreviews).length > 0;
  const addOnSummaries = selectedAddonSummaries(services, moveSize, selectedUnits, dismantleCount, assemblyCount);
  const addOnTotalPence = addOnSummaries.reduce((sum, addon) => sum + addon.amountPence, 0);
  const canContinue = typeof selectedPreviewTotal === "number" && !pricePreviewLoading;

  const handleDateSelect = (date: string) => {
    const preview = selectedMoverPricePreviews[date];
    const canAdvance =
      preview?.status === "FIXED" &&
      typeof preview.totalPence === "number";
    onDateSelect(date, { advance: canAdvance });
  };

  return (
    <Box position="relative">
      <Box>
        <Box display="grid" gridTemplateColumns={{ base: "1fr", lg: "minmax(0, 1fr) 364px" }} gap={6} alignItems="start">
          <Box minW={0}>
            <Box mb={8}>
              <Text fontFamily="heading" fontSize={{ base: "3xl", md: "4xl" }} fontWeight={900} color="#3D3D3D">
                Select a date
              </Text>
              <Text mt={1} fontSize={{ base: "md", md: "xl" }} color="#50646E">
                Your delivery will be <Text as="span" fontWeight={900}>same day</Text>
              </Text>
            </Box>
            {addOnSummaries.length > 0 && (
              <Box
                mb={5}
                p={{ base: 4, md: 5 }}
                borderRadius="md"
                border={`1px solid ${bookingTheme.heroBlue}`}
                bg="rgba(37,99,235,0.08)"
                color={bookingTheme.ink}
              >
                <HStack justify="space-between" align="start" gap={4}>
                  <Box>
                    <Text fontSize="sm" fontWeight={900}>
                      Prices include your selected add-ons
                    </Text>
                    <Text mt={1} fontSize="sm" color={bookingTheme.muted}>
                      {addOnSummaries.map((addon) => addon.label).join(", ")}
                    </Text>
                  </Box>
                  <Text fontFamily="mono" fontSize="sm" fontWeight={900} color={bookingTheme.primaryDark} whiteSpace="nowrap">
                    +{formatPence(addOnTotalPence)}
                  </Text>
                </HStack>
              </Box>
            )}
            <PriceCalculationPanel
              loading={pricePreviewLoading}
              hasPrices={hasPreviewPrices}
              selectedUnits={selectedUnits}
              collection={collection}
              delivery={delivery}
            />
            <Box border={`1px solid ${bookingTheme.borderStrong}`} borderRadius="md" overflow="hidden" bg="#FFFFFF">
              <Box display="grid" gridTemplateColumns="repeat(2, minmax(0, 1fr))">
                <CrewOption
                  movers={1}
                  pricePence={onePersonPreview?.totalPence}
                  priceTone={onePersonTone}
                  loading={pricePreviewLoading}
                  selected={selectedMoverCount === 1}
                  onClick={() => onMoverChange(1)}
                />
                <CrewOption
                  movers={2}
                  pricePence={twoPersonPreview?.totalPence}
                  priceTone={twoPersonTone}
                  loading={pricePreviewLoading}
                  selected={selectedMoverCount === 2}
                  onClick={() => onMoverChange(2)}
                />
              </Box>
              {pricePreviewError && (
                <HStack
                  px={4}
                  py={3}
                  justify="space-between"
                  align="center"
                  gap={3}
                  borderBottom={`1px solid ${bookingTheme.border}`}
                  bg={bookingTheme.dangerSoft}
                  color={bookingTheme.danger}
                >
                  <HStack gap={2} minW={0}>
                    <FiAlertTriangle />
                    <Text fontSize="sm" fontWeight={900}>
                      {pricePreviewError}
                    </Text>
                  </HStack>
                  <Box
                    as="button"
                    onClick={onPreviewRetry}
                    px={3}
                    py={1.5}
                    borderRadius="sm"
                    bg="#FFFFFF"
                    border={`1px solid ${bookingTheme.danger}`}
                    color={bookingTheme.danger}
                    fontSize="xs"
                    fontWeight={900}
                    flexShrink={0}
                  >
                    Retry
                  </Box>
                </HStack>
              )}
              <PriceCalendar
                selectedDate={selectedDate}
                anchorDate={calendarAnchor}
                pricePreviews={selectedMoverPricePreviews}
                loading={pricePreviewLoading}
                previewError={pricePreviewError}
                onPrevious={onCalendarPrevious}
                onNext={onCalendarNext}
                onSelectDate={handleDateSelect}
              />
            </Box>
            <HStack mt={4} gap={3} justify="space-between" align="center">
              <Box
                as="button"
                onClick={onBack}
                minW="160px"
                h="54px"
                borderRadius="md"
                border={`1px solid ${bookingTheme.borderStrong}`}
                bg="#FFFFFF"
                color={bookingTheme.ink}
                display="flex"
                alignItems="center"
                justifyContent="center"
                gap={2}
                fontSize="md"
                fontWeight={900}
                _hover={{ bg: "#F8FBFC" }}
              >
                <FiArrowLeft />
                Back
              </Box>
              <Box
                as="button"
                className={canContinue ? "ma-cta-attention ma-cta-scan" : undefined}
                onClick={() => {
                  if (canContinue) onNext();
                }}
                aria-disabled={!canContinue ? "true" : undefined}
                minW={{ base: "160px", md: "200px" }}
                h="54px"
                borderRadius="md"
                bg={canContinue ? bookingTheme.heroBlue : "#BFD3DC"}
                color="#FFFFFF"
                display="flex"
                alignItems="center"
                justifyContent="center"
                gap={2}
                fontSize="md"
                fontWeight={900}
                cursor={canContinue ? "pointer" : "not-allowed"}
                _hover={canContinue ? { bg: "#2563EB" } : {}}
              >
                {canContinue ? "Next Step" : "Calculating..."}
              </Box>
            </HStack>
          </Box>
          <Box display={{ base: "none", lg: "block" }}>
            <HStack justify="space-between" align="start" mb={7}>
              <Box>
                {displayQuoteReference && (
                  <Text color={bookingTheme.muted}>Quote ref: {displayQuoteReference}</Text>
                )}
                <Text className="ma-quote-ref-phone" fontSize="3xl" color={bookingTheme.heroBlue} fontWeight={900}>07426 467 112</Text>
              </Box>
            </HStack>
            <PriceOptionsSidebar
              selectedUnits={selectedUnits}
              moveSize={moveSize}
              collection={collection}
              delivery={delivery}
              items={items}
              customItems={customItems}
              selectedDate={selectedDate}
              services={services}
              dismantleCount={dismantleCount}
              assemblyCount={assemblyCount}
              totalPence={typeof selectedPreviewTotal === "number" ? selectedPreviewTotal : undefined}
              priceTone={selectedPriceTone}
              totalLoading={pricePreviewLoading}
              onEditRoute={onEditRoute}
              onEditInventory={onEditInventory}
              onEditDateAndAddOns={onEditDateAndAddOns}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function CoverPromptModal({
  onAddProtection,
  onKeepComplimentary,
}: {
  onAddProtection: () => void;
  onKeepComplimentary: () => void;
}) {
  return (
    <Box position="fixed" inset={0} zIndex={60} bg="rgba(12,52,65,0.62)" display="flex" alignItems="center" justifyContent="center" px={4}>
      <Box w="full" maxW="520px" bg="#FFFFFF" borderRadius="md" p={{ base: 5, md: 6 }} boxShadow="0 26px 80px rgba(0,0,0,0.28)">
        <HStack align="start" gap={4}>
          <Box w="42px" h="42px" borderRadius="full" bg="#F4FAEF" color="#70B62C" display="flex" alignItems="center" justifyContent="center" flexShrink={0}>
            <FiShield size={24} />
          </Box>
          <Box>
            <HStack gap={2} mb={1}>
              <Text fontSize={{ base: "lg", md: "xl" }} fontWeight={900} color="#3D3D3D">
                Complete your cover
              </Text>
              <Text px={2} py={0.5} borderRadius="sm" bg="#70B62C" color="#FFFFFF" fontSize="10px" fontWeight={900}>
                Recommended
              </Text>
            </HStack>
            <Text fontSize="sm" color={bookingTheme.ink} lineHeight="1.55">
              Complimentary Cover includes loss, fire and theft, but are you sure you don&apos;t want to protect items above £100 from damages?
            </Text>
          </Box>
        </HStack>
        <VStack mt={6} align="stretch" gap={3}>
          <Box
            as="button"
            onClick={onAddProtection}
            h="52px"
            borderRadius="md"
            bg={bookingTheme.heroBlue}
            color="#FFFFFF"
            fontWeight={900}
            _hover={{ bg: "#2563EB" }}
          >
            Add Protection+
          </Box>
          <Box
            as="button"
            onClick={onKeepComplimentary}
            h="52px"
            borderRadius="md"
            border={`1px solid ${bookingTheme.borderStrong}`}
            bg="#FFFFFF"
            color={bookingTheme.ink}
            fontWeight={900}
            _hover={{ bg: "#F8FBFC" }}
          >
            I&apos;m OK with Complimentary
          </Box>
        </VStack>
      </Box>
    </Box>
  );
}

function StepperControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <HStack gap={3} flexShrink={0}>
      <Box
        as="button"
        aria-label="Decrease"
        onClick={() => onChange(Math.max(0, value - 1))}
        color={value > 0 ? bookingTheme.heroBlue : bookingTheme.muted}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <FiMinusCircle size={24} />
      </Box>
      <Text minW="18px" textAlign="center" fontSize="lg" fontWeight={900}>{value}</Text>
      <Box
        as="button"
        aria-label="Increase"
        onClick={() => onChange(Math.min(20, value + 1))}
        color={bookingTheme.heroBlue}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <FiPlusCircle size={24} />
      </Box>
    </HStack>
  );
}

function MobileCurrentPricePanel({
  selectedUnits,
  moveSize,
  services,
  dismantleCount,
  assemblyCount,
  totalPence,
  priceTone,
  totalLoading,
}: {
  selectedUnits: number;
  moveSize: MoveSizeValue;
  services: BookingServiceState;
  dismantleCount: number;
  assemblyCount: number;
  totalPence?: number;
  priceTone?: PriceTone | null;
  totalLoading?: boolean;
}) {
  const priceToneMeta = priceTone ? PRICE_TONE_META[priceTone] : null;
  const hasTotalPrice = typeof totalPence === "number";
  const addOnSummaries = selectedAddonSummaries(services, moveSize, selectedUnits, dismantleCount, assemblyCount);

  return (
    <Box
      display={{ base: "block", lg: "none" }}
      p={4}
      borderRadius="md"
      border={`1px solid ${bookingTheme.borderStrong}`}
      bg="#FFFFFF"
      boxShadow="0 14px 34px rgba(20,50,60,0.10)"
    >
      <Flex align="start" justify="space-between" gap={4}>
        <Box minW={0}>
          <Text fontSize="xs" color={bookingTheme.muted} fontWeight={900} textTransform="uppercase">
            Current total
          </Text>
          <Text mt={1} fontSize="sm" color={bookingTheme.ink} fontWeight={900}>
            {addOnSummaries.length > 0 ? "Includes selected add-ons" : "Move price"}
          </Text>
        </Box>
        <HStack align="center" gap={2} flexShrink={0}>
          {totalLoading && !hasTotalPrice && <Spinner size="sm" color={bookingTheme.heroBlue} />}
          <Text
            className={hasTotalPrice ? "ma-price-shimmer" : undefined}
            style={hasTotalPrice ? ({ "--ma-price-tone": priceToneMeta?.color ?? bookingTheme.heroBlue } as React.CSSProperties) : undefined}
            fontSize="2xl"
            lineHeight="1"
            fontWeight={900}
            color={priceToneMeta?.color ?? bookingTheme.heroBlue}
            whiteSpace="nowrap"
          >
            {hasTotalPrice ? formatPence(totalPence) : "Calculating"}
          </Text>
        </HStack>
      </Flex>
      {addOnSummaries.length > 0 && (
        <VStack mt={3} align="stretch" gap={2}>
          {addOnSummaries.map((addon) => (
            <HStack key={addon.label} justify="space-between" gap={3}>
              <Text fontSize="sm" color={bookingTheme.muted}>
                {addon.label}
              </Text>
              <Text fontFamily="mono" fontSize="sm" fontWeight={900} color={bookingTheme.primaryDark} whiteSpace="nowrap">
                +{formatPence(addon.amountPence)}
              </Text>
            </HStack>
          ))}
        </VStack>
      )}
    </Box>
  );
}

function AdditionalServicesStep({
  selectedUnits,
  moveSize,
  collection,
  delivery,
  items,
  customItems,
  selectedDate,
  displayQuoteReference,
  services,
  dismantleCount,
  assemblyCount,
  serverTotalPence,
  priceTone,
  totalLoading,
  onPackingModeChange,
  onDismantleCountChange,
  onAssemblyCountChange,
  onEditRoute,
  onEditInventory,
  onEditDateAndAddOns,
  onBack,
  onNext,
}: {
  selectedUnits: number;
  moveSize: MoveSizeValue;
  collection: AccessDraft;
  delivery: AccessDraft;
  items: InventoryLine[];
  customItems: CustomItemLine[];
  selectedDate: string;
  displayQuoteReference: string;
  services: BookingServiceState;
  dismantleCount: number;
  assemblyCount: number;
  serverTotalPence?: number;
  priceTone?: PriceTone | null;
  totalLoading?: boolean;
  onPackingModeChange: (mode: PackingMode) => void;
  onDismantleCountChange: (value: number) => void;
  onAssemblyCountChange: (value: number) => void;
  onEditRoute?: () => void;
  onEditInventory?: () => void;
  onEditDateAndAddOns?: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const packingMode = packingModeForServices(services);
  const packingMaterialsPence = packingChargeForMode("materials", moveSize, selectedUnits);
  const fullPackingPence = packingChargeForMode("full", moveSize, selectedUnits);
  const canContinue = typeof serverTotalPence === "number" && !totalLoading;
  const packingOptions: Array<{
    mode: "none" | "materials" | "full";
    title: string;
    description: string;
    priceLabel: string;
  }> = [
    {
      mode: "none",
      title: "No packing help",
      description: "Everything is packed and ready when the team arrives.",
      priceLabel: "Included",
    },
    {
      mode: "materials",
      title: "Premium packing materials",
      description: "Strong boxes, tape and protective wrap supplied for the move.",
      priceLabel: `+${formatShortPence(packingMaterialsPence)}`,
    },
    {
      mode: "full",
      title: "Full packing service",
      description: "Our team professionally packs your inventory before moving day.",
      priceLabel: `+${formatShortPence(fullPackingPence)}`,
    },
  ];

  return (
    <Box display="grid" gridTemplateColumns={{ base: "1fr", lg: "minmax(0, 1fr) 364px" }} gap={6} alignItems="start">
      <Box minW={0}>
        <Text
          as="h1"
          fontFamily="heading"
          fontSize={{ base: "2xl", md: "3xl" }}
          fontWeight={900}
          color="#3D3D3D"
          mb={{ base: 5, md: 8 }}
          lineHeight="1.15"
        >
          Packing and furniture help
        </Text>

        <VStack align="stretch" gap={5}>
          <Box border={`1px solid ${bookingTheme.borderStrong}`} borderRadius="md" bg="#FFFFFF" overflow="hidden">
            <HStack p={{ base: 4, md: 5 }} gap={3} borderBottom={`1px solid ${bookingTheme.borderStrong}`}>
              <FiPackage color={bookingTheme.heroBlue} size={24} />
              <Text fontSize="xl" fontWeight={900}>Packing options</Text>
            </HStack>
            <SimpleGrid columns={{ base: 1, md: 3 }} gap={3} p={{ base: 4, md: 5 }}>
              {packingOptions.map((option) => {
                const selected = packingMode === option.mode;
                return (
                  <Box
                    key={option.mode}
                    as="button"
                    onClick={() => onPackingModeChange(option.mode)}
                    textAlign="left"
                    minH="122px"
                    p={4}
                    borderRadius="md"
                    border={`2px solid ${selected ? bookingTheme.heroBlue : bookingTheme.borderStrong}`}
                    bg={selected ? "rgba(37,99,235,0.07)" : "#FFFFFF"}
                    color={bookingTheme.ink}
                    display="flex"
                    flexDirection="column"
                    justifyContent="space-between"
                    gap={3}
                    _hover={{ borderColor: bookingTheme.heroBlue }}
                    _focusVisible={{ outline: `2px solid ${bookingTheme.heroBlue}`, outlineOffset: "2px" }}
                  >
                    <HStack justify="space-between" align="start" gap={3}>
                      <FiPackage color={selected ? bookingTheme.heroBlue : bookingTheme.muted} size={22} />
                      <Box
                        w="20px"
                        h="20px"
                        borderRadius="full"
                        border={`1px solid ${selected ? bookingTheme.heroBlue : bookingTheme.borderStrong}`}
                        bg={selected ? bookingTheme.heroBlue : "#FFFFFF"}
                        color="#FFFFFF"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        flexShrink={0}
                      >
                        {selected && <FiCheck size={13} />}
                      </Box>
                    </HStack>
                    <Box>
                      <HStack justify="space-between" align="start" gap={3}>
                        <Text fontSize="md" fontWeight={900}>{option.title}</Text>
                        <Text
                          px={2}
                          py={1}
                          borderRadius="sm"
                          bg={selected ? bookingTheme.heroBlue : bookingTheme.accentSoft}
                          color={selected ? "#FFFFFF" : bookingTheme.ink}
                          fontSize="xs"
                          fontWeight={900}
                          whiteSpace="nowrap"
                        >
                          {option.priceLabel}
                        </Text>
                      </HStack>
                      <Text mt={1} fontSize="sm" color={bookingTheme.muted} lineHeight="1.45">
                        {option.description}
                      </Text>
                    </Box>
                  </Box>
                );
              })}
            </SimpleGrid>
          </Box>

          <Box border={`1px solid ${bookingTheme.borderStrong}`} borderRadius="md" bg="#FFFFFF" overflow="hidden">
            <HStack p={{ base: 4, md: 5 }} gap={3} borderBottom={`1px solid ${bookingTheme.borderStrong}`}>
              <FiPackage color={bookingTheme.heroBlue} size={24} />
              <Text fontSize="xl" fontWeight={900}>Dismantling & Reassembly</Text>
            </HStack>
            <VStack align="stretch" gap={4} p={{ base: 4, md: 5 }}>
              <Text fontSize="sm" color={bookingTheme.ink}>Need a hand with any bulky items? We have the tools for that.</Text>
              <HStack justify="space-between" align="center" gap={4}>
                <Text fontSize="sm">
                  Dismantle <Text as="span" color={bookingTheme.heroBlue} fontWeight={900}>+£10 per item</Text>
                </Text>
                <StepperControl value={dismantleCount} onChange={onDismantleCountChange} />
              </HStack>
              <HStack justify="space-between" align="center" gap={4}>
                <Text fontSize="sm">
                  Assembly <Text as="span" color={bookingTheme.heroBlue} fontWeight={900}>+£10 per item</Text>
                </Text>
                <StepperControl value={assemblyCount} onChange={onAssemblyCountChange} />
              </HStack>
              <Text fontSize="xs" color={bookingTheme.muted}>
                Add the number of items that need furniture help. We price each selected item at £10.
              </Text>
            </VStack>
          </Box>

          <MobileCurrentPricePanel
            selectedUnits={selectedUnits}
            moveSize={moveSize}
            services={services}
            dismantleCount={dismantleCount}
            assemblyCount={assemblyCount}
            totalPence={serverTotalPence}
            priceTone={priceTone}
            totalLoading={totalLoading}
          />
        </VStack>

        <HStack mt={6} gap={3} justify="space-between" align="center">
          <Box
            as="button"
            onClick={onBack}
            minW="100px"
            h="54px"
            borderRadius="md"
            border={`1px solid ${bookingTheme.borderStrong}`}
            bg="#FFFFFF"
            color={bookingTheme.ink}
            display="flex"
            alignItems="center"
            justifyContent="center"
            gap={2}
            fontSize="md"
            fontWeight={900}
            _hover={{ bg: "#F8FBFC" }}
          >
            <FiArrowLeft />
            Back
          </Box>
          <Box
            as="button"
            className={canContinue ? "ma-cta-attention ma-cta-scan" : undefined}
            onClick={() => {
              if (canContinue) onNext();
            }}
            aria-disabled={!canContinue ? "true" : undefined}
            minW={{ base: "180px", md: "200px" }}
            h="54px"
            borderRadius="md"
            bg={canContinue ? bookingTheme.heroBlue : "#BFD3DC"}
            color="#FFFFFF"
            display="flex"
            alignItems="center"
            justifyContent="center"
            gap={3}
            fontSize="md"
            fontWeight={900}
            cursor={canContinue ? "pointer" : "not-allowed"}
            _hover={canContinue ? { bg: "#2563EB" } : {}}
          >
            {canContinue ? "Next Step" : "Calculating..."}
            {canContinue && <FiChevronRight />}
          </Box>
        </HStack>
      </Box>

      <Box display={{ base: "none", lg: "block" }}>
        <HStack justify="space-between" align="start" mb={7}>
          <Box>
            {displayQuoteReference && (
              <Text color={bookingTheme.muted}>Quote ref: {displayQuoteReference}</Text>
            )}
            <Text className="ma-quote-ref-phone" fontSize="3xl" color={bookingTheme.heroBlue} fontWeight={900}>07426 467 112</Text>
          </Box>
        </HStack>
        <PriceOptionsSidebar
          selectedUnits={selectedUnits}
          moveSize={moveSize}
          collection={collection}
          delivery={delivery}
          items={items}
          customItems={customItems}
          selectedDate={selectedDate}
          services={services}
          dismantleCount={dismantleCount}
          assemblyCount={assemblyCount}
          totalPence={serverTotalPence}
          priceTone={priceTone}
          totalLoading={Boolean(totalLoading)}
          onEditRoute={onEditRoute}
          onEditInventory={onEditInventory}
          onEditDateAndAddOns={onEditDateAndAddOns}
        />
      </Box>
    </Box>
  );
}

function CheckoutTextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  rightAdornment,
  readOnly = false,
  name,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  type?: "text" | "email" | "tel";
  placeholder?: string;
  rightAdornment?: React.ReactNode;
  readOnly?: boolean;
  name?: string;
  autoComplete?: string;
}) {
  return (
    <VStack align="start" gap={1.5} w="full">
      {label && (
        <Text
          color="#56666E"
          fontSize="xs"
          fontWeight={800}
          lineHeight="1.2"
        >
          {label}
        </Text>
      )}
      <Box position="relative" w="full">
        <input
          type={type}
          name={name}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          placeholder={placeholder ?? label}
          readOnly={readOnly}
          autoComplete={autoComplete ?? "off"}
          style={{
            width: "100%",
            height: 54,
            border: `1px solid ${bookingTheme.borderStrong}`,
            borderRadius: 5,
            padding: rightAdornment ? "0 44px 0 14px" : "0 14px",
            color: bookingTheme.ink,
            background: "#FFFFFF",
            outline: "none",
            fontSize: 15,
          }}
        />
        {rightAdornment && (
          <Box position="absolute" right={4} top="50%" transform="translateY(-50%)" color={bookingTheme.heroBlue}>
            {rightAdornment}
          </Box>
        )}
      </Box>
    </VStack>
  );
}

function CheckoutTextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <VStack align="start" gap={1.5} w="full">
      <Text color="#56666E" fontSize="xs" fontWeight={800} lineHeight="1.2">
        {label}
      </Text>
      <Box
        w="full"
        minH="118px"
        border={`1px solid ${bookingTheme.borderStrong}`}
        borderRadius="md"
        bg="#FFFFFF"
        color={bookingTheme.ink}
        fontSize="sm"
        _focusWithin={{
          borderColor: bookingTheme.heroBlue,
          boxShadow: "0 0 0 2px rgba(37,99,235,0.14)",
        }}
      >
        <textarea
          value={value}
          maxLength={1200}
          onChange={(event) => onChange(event.target.value.slice(0, 1200))}
          placeholder={placeholder ?? label}
          style={{
            width: "100%",
            minHeight: 118,
            border: 0,
            background: "transparent",
            outline: "none",
            padding: 14,
            resize: "vertical",
          }}
        />
      </Box>
      <Text alignSelf="end" fontSize="xs" color={bookingTheme.muted}>
        {value.length}/1200
      </Text>
    </VStack>
  );
}

function CheckoutSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box border={`1px solid ${bookingTheme.borderStrong}`} borderRadius="md" bg="#FFFFFF" p={{ base: 4, md: 5 }}>
      <Text fontSize={{ base: "lg", md: "xl" }} fontWeight={900} color="#3D3D3D" mb={4}>
        {title}
      </Text>
      {children}
    </Box>
  );
}

function AddressReviewFields({
  access,
  scope,
  onAddressChange,
}: {
  access: AccessDraft;
  scope: "uk" | "scotland";
  onAddressChange: (address: AddressData | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const postcode = access.address?.postcode || access.address?.fullAddress.split(",")[0]?.trim() || "";
  const selectedAddress = access.address?.fullAddress ?? "";

  return (
    <Box>
      <SimpleGrid columns={{ base: 1, md: 2 }} gap={4} alignItems="end">
        <CheckoutTextField
          label="Search postcode"
          value={postcode}
          readOnly
          rightAdornment={
            selectedAddress ? (
              <HStack gap={2} color={bookingTheme.primary} fontSize="sm">
                <FiCheck />
                <Text as="span">Edit</Text>
              </HStack>
            ) : undefined
          }
        />
        <Box
          as="button"
          onClick={() => setEditing((value) => !value)}
          minH="54px"
          px={4}
          borderRadius="md"
          border={`1px solid ${bookingTheme.borderStrong}`}
          bg="#FFFFFF"
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          gap={3}
          textAlign="left"
          color={selectedAddress ? bookingTheme.ink : bookingTheme.muted}
          fontSize="sm"
        >
          <Text overflow="hidden" whiteSpace="nowrap" textOverflow="ellipsis">
            {selectedAddress || "Please select address"}
          </Text>
          <FiChevronDown />
        </Box>
      </SimpleGrid>
      {editing && (
        <Box mt={3}>
          <AddressAutocomplete
            value={access.address}
            onChange={(address) => {
              onAddressChange(address);
              if (address) setEditing(false);
            }}
            scope={scope}
            tone="light"
            placeholder="Search postcode or full address"
          />
        </Box>
      )}
      {!selectedAddress && (
        <Text mt={2} fontSize="sm" color={bookingTheme.danger}>
          Please enter a valid UK postcode
        </Text>
      )}
      <Box
        as="button"
        onClick={() => setEditing((value) => !value)}
        mt={3}
        color={bookingTheme.heroBlue}
        fontSize="sm"
        fontWeight={700}
      >
        Enter Address Manually
      </Box>
    </Box>
  );
}

function ConfirmDetailsStep({
  selectedUnits,
  moveSize,
  collection,
  delivery,
  items,
  customItems,
  selectedDate,
  services,
  dismantleCount,
  assemblyCount,
  customer,
  displayQuoteReference,
  quoteLoading,
  serverTotalPence,
  priceTone,
  totalLoading,
  manualReviewReference,
  onCustomerChange,
  onCollectionAddressChange,
  onDeliveryAddressChange,
  onEditRoute,
  onEditInventory,
  onEditDateAndAddOns,
  onBack,
  onSubmit,
}: {
  selectedUnits: number;
  moveSize: MoveSizeValue;
  collection: AccessDraft;
  delivery: AccessDraft;
  items: InventoryLine[];
  customItems: CustomItemLine[];
  selectedDate: string;
  services: BookingServiceState;
  dismantleCount: number;
  assemblyCount: number;
  customer: CustomerDraft;
  displayQuoteReference: string;
  quoteLoading: boolean;
  serverTotalPence?: number;
  priceTone?: PriceTone | null;
  totalLoading?: boolean;
  manualReviewReference?: string;
  onCustomerChange: (updater: (prev: CustomerDraft) => CustomerDraft) => void;
  onCollectionAddressChange: (address: AddressData | null) => void;
  onDeliveryAddressChange: (address: AddressData | null) => void;
  onEditRoute?: () => void;
  onEditInventory?: () => void;
  onEditDateAndAddOns?: () => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const submittedForReview = Boolean(manualReviewReference);
  const customerDetailsValid =
    customer.fullName.trim().length >= 2 &&
    isValidEmail(customer.email) &&
    isValidUkPhone(customer.phone);
  const canSubmit = customerDetailsValid && !quoteLoading && typeof serverTotalPence === "number" && !totalLoading;
  const submitLabel = canSubmit
    ? "Next Step"
    : !customerDetailsValid
      ? "Enter details"
      : quoteLoading
        ? "Submitting..."
        : "Calculating...";

  return (
    <Box display="grid" gridTemplateColumns={{ base: "1fr", lg: "minmax(0, 1fr) 364px" }} gap={6} alignItems="start">
      <Box minW={0}>
        <Text
          as="h1"
          fontFamily="heading"
          fontSize={{ base: "2xl", md: "3xl" }}
          fontWeight={900}
          color="#3D3D3D"
          mb={{ base: 5, md: 8 }}
          lineHeight="1.15"
        >
          Confirm your details
        </Text>
        {submittedForReview && (
          <Box
            mb={5}
            p={{ base: 4, md: 5 }}
            borderRadius="md"
            border={`1px solid ${bookingTheme.heroBlue}`}
            bg="rgba(37,99,235,0.08)"
            color={bookingTheme.ink}
          >
            <Text fontSize="lg" fontWeight={900}>Thanks, we&apos;ve received your details</Text>
            <Text mt={2} fontSize="sm" color={bookingTheme.muted} lineHeight="1.5">
              Reference {manualReviewReference}. Our team will confirm the final availability and price with you shortly.
            </Text>
          </Box>
        )}

        <VStack align="stretch" gap={5}>
          <CheckoutSection title="Your booking details">
            <VStack align="stretch" gap={4}>
              <CheckoutTextField
                label="First and last name"
                value={customer.fullName}
                onChange={(value) => onCustomerChange((prev) => ({ ...prev, fullName: value }))}
                placeholder="First and last name"
                name="name"
                autoComplete="name"
              />
              <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                <CheckoutTextField
                  label="Email address"
                  value={customer.email}
                  type="email"
                  onChange={(value) => onCustomerChange((prev) => ({ ...prev, email: value }))}
                  placeholder="Email address"
                  name="email"
                  autoComplete="email"
                  rightAdornment={isValidEmail(customer.email) ? <FiCheck /> : undefined}
                />
                <CheckoutTextField
                  label="Phone number"
                  value={customer.phone}
                  type="tel"
                  onChange={(value) => onCustomerChange((prev) => ({ ...prev, phone: value }))}
                  placeholder="Phone number"
                  name="tel"
                  autoComplete="tel"
                  rightAdornment={isValidUkPhone(customer.phone) ? <FiCheck /> : undefined}
                />
              </SimpleGrid>
              {customer.phone.trim() && !isValidUkPhone(customer.phone) && (
                <Text fontSize="xs" color={bookingTheme.danger} fontWeight={800}>
                  Enter a valid UK phone number.
                </Text>
              )}
            </VStack>
          </CheckoutSection>

          <CheckoutSection title="Customer note">
            <CheckoutTextArea
              label="Notes for the move"
              value={customer.notes}
              onChange={(value) => onCustomerChange((prev) => ({ ...prev, notes: value }))}
              placeholder="Add anything the team should know before moving day."
            />
          </CheckoutSection>

          <CheckoutSection title="Pickup details">
            <AddressReviewFields
              access={collection}
              scope="scotland"
              onAddressChange={onCollectionAddressChange}
            />
          </CheckoutSection>

          <CheckoutSection title="Delivery details">
            <AddressReviewFields
              access={delivery}
              scope="uk"
              onAddressChange={onDeliveryAddressChange}
            />
          </CheckoutSection>
        </VStack>

        <Flex mt={6} align={{ base: "stretch", md: "center" }} justify="space-between" gap={4} direction={{ base: "column", md: "row" }}>
          <Box
            as="button"
            onClick={onBack}
            minW="100px"
            h="54px"
            px={5}
            borderRadius="md"
            border={`1px solid ${bookingTheme.borderStrong}`}
            bg="#FFFFFF"
            color={bookingTheme.ink}
            display="flex"
            alignItems="center"
            justifyContent="center"
            gap={2}
            fontSize="md"
            fontWeight={900}
            _hover={{ bg: "#F8FBFC" }}
          >
            <FiArrowLeft />
            Back
          </Box>
          <HStack gap={4} justify={{ base: "space-between", md: "end" }}>
            <Box
              as="button"
              className={canSubmit ? "ma-cta-attention ma-cta-scan" : undefined}
              onClick={() => {
                if (canSubmit) onSubmit();
              }}
              aria-disabled={!canSubmit ? "true" : undefined}
              minW={{ base: "180px", md: "200px" }}
              h="54px"
              borderRadius="md"
              bg={canSubmit ? bookingTheme.heroBlue : "#BFD3DC"}
              color="#FFFFFF"
              display="flex"
              alignItems="center"
              justifyContent="center"
              gap={3}
              fontSize="md"
              fontWeight={900}
              cursor={canSubmit ? "pointer" : "not-allowed"}
              _hover={canSubmit ? { bg: "#2563EB" } : {}}
            >
              {submitLabel}
              {canSubmit && <FiChevronRight />}
            </Box>
          </HStack>
        </Flex>
        <Text mt={4} fontSize="xs" color={bookingTheme.muted} fontStyle="italic" lineHeight="1.45">
          You&apos;ll receive essential booking details to the email address and phone numbers entered above. We&apos;ll also send occasional offers and news. Your privacy is treated with respect - we don&apos;t sell customer information. You can learn more and opt out of emails at any time.
        </Text>
      </Box>

      <Box>
        <HStack justify="space-between" align="start" mb={7}>
          <Box>
            {displayQuoteReference && (
              <Text color={bookingTheme.muted}>Quote ref: {displayQuoteReference}</Text>
            )}
            <Text className="ma-quote-ref-phone" fontSize="3xl" color={bookingTheme.heroBlue} fontWeight={900}>07426 467 112</Text>
          </Box>
        </HStack>
        <PriceOptionsSidebar
          selectedUnits={selectedUnits}
          moveSize={moveSize}
          collection={collection}
          delivery={delivery}
          items={items}
          customItems={customItems}
          selectedDate={selectedDate}
          services={services}
          dismantleCount={dismantleCount}
          assemblyCount={assemblyCount}
          totalPence={serverTotalPence}
          priceTone={priceTone}
          totalLoading={Boolean(totalLoading)}
          onEditRoute={onEditRoute}
          onEditInventory={onEditInventory}
          onEditDateAndAddOns={onEditDateAndAddOns}
        />
      </Box>
    </Box>
  );
}

function StripeRedirectPanel({
  quote,
  busy,
  error,
  onRetry,
}: {
  quote: QuoteResponse;
  busy: boolean;
  error: string;
  onRetry: () => void;
}) {
  return (
    <VStack align="stretch" gap={3} w="full">
      <Box p={4} borderRadius="lg" border={`1px solid ${bookingTheme.heroBlue}`} bg="rgba(37,99,235,0.08)">
        <HStack gap={3}>
          {busy && <Spinner size="sm" color={bookingTheme.heroBlue} />}
          <Box>
            <Text fontSize="sm" fontWeight={900} color={bookingTheme.ink}>
              {busy ? "Redirecting to Stripe..." : "Ready for secure Stripe payment"}
            </Text>
            <Text mt={1} fontSize="xs" color={bookingTheme.muted}>
              Quote {quote.reference} · {formatPence(quote.totalPence ?? 0)}
            </Text>
          </Box>
        </HStack>
      </Box>
      {error && <ErrorBox>{error}</ErrorBox>}
      <PrimaryButton disabled={busy} onClick={onRetry}>
        {busy ? "Opening Stripe..." : `Pay ${formatPence(quote.totalPence ?? 0)} on Stripe`}
      </PrimaryButton>
    </VStack>
  );
}

function LocalPreviewNextPanel({
  totalPence,
  error,
  busy,
  onNext,
}: {
  totalPence: number;
  error: string;
  busy?: boolean;
  onNext: () => void;
}) {
  return (
    <Box w="full" p={4} borderRadius="lg" border={`1px solid ${bookingTheme.borderStrong}`} bg="#FFFFFF">
      <HStack align="center" justify="space-between" gap={4} flexWrap="wrap">
        <Box>
          <Text fontSize="sm" fontWeight={900} color={bookingTheme.ink}>
            Ready to continue
          </Text>
          <Text mt={1} fontSize="xs" color={bookingTheme.muted}>
            Review your move details before payment.
          </Text>
        </Box>
        <Box
          as="button"
          className={busy ? undefined : "ma-cta-attention ma-cta-scan"}
          aria-disabled={busy ? "true" : undefined}
          onClick={() => {
            if (!busy) onNext();
          }}
          minW="190px"
          h="52px"
          px={5}
          borderRadius="lg"
          bg={busy ? "#BFD3DC" : bookingTheme.heroBlue}
          color="#FFFFFF"
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          gap={2}
          fontSize="sm"
          fontWeight={900}
          cursor={busy ? "not-allowed" : "pointer"}
          _hover={busy ? {} : { bg: "#2563EB" }}
          _focusVisible={{ outline: `2px solid ${bookingTheme.heroBlue}`, outlineOffset: "2px" }}
        >
          {busy ? "Opening checkout..." : "Next Step"}
          {!busy && <FiChevronRight />}
        </Box>
      </HStack>
      <Text mt={2} fontSize="xs" color={bookingTheme.muted}>
        Quote total: {formatPence(totalPence)}
      </Text>
      {error && <Box mt={3}><ErrorBox>{error}</ErrorBox></Box>}
    </Box>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <Box role="alert" w="full" p={3} borderRadius="lg" border={`1px solid ${bookingTheme.danger}`} bg={bookingTheme.dangerSoft}>
      <Text color={bookingTheme.danger} fontSize="sm" fontWeight={800}>{children}</Text>
    </Box>
  );
}

function PrimaryButton({
  children,
  disabled,
  attention = false,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  attention?: boolean;
  onClick: () => void;
}) {
  return (
    <Box
      as="button"
      className={!disabled && attention ? "ma-cta-attention ma-cta-scan ma-quote-cta" : undefined}
      aria-disabled={disabled ? "true" : undefined}
      onClick={() => {
        if (!disabled) onClick();
      }}
      w="full"
      minH="52px"
      borderRadius="lg"
      bg={disabled ? "#DDE7EA" : bookingTheme.primary}
      color={disabled ? "#7B8E96" : "white"}
      fontFamily="heading"
      fontSize="sm"
      fontWeight={900}
      cursor={disabled ? "not-allowed" : "pointer"}
      display="flex"
      alignItems="center"
      justifyContent="center"
      gap={2}
      boxShadow={disabled ? "none" : "0 10px 24px rgba(0,168,120,0.22)"}
      _hover={disabled ? {} : { bg: bookingTheme.primaryDark, transform: "translateY(-1px)" }}
      _focusVisible={{ outline: `2px solid ${bookingTheme.primary}`, outlineOffset: "2px" }}
    >
      {children}
    </Box>
  );
}

export function InstantQuotePage() {
  const [step, setStep] = useState(0);
  const [moveType, setMoveType] = useState<(typeof MOVE_TYPES)[number]["value"]>("house-move");
  const [moveSize, setMoveSize] = useState<MoveSizeValue>(DEFAULT_HERO_PROPERTY.moveSize);
  const [collection, setCollection] = useState<AccessDraft>(() => initialAccess());
  const [delivery, setDelivery] = useState<AccessDraft>(() => initialAccess());
  const [hasAdditionalStop, setHasAdditionalStop] = useState(false);
  const [additionalStop, setAdditionalStop] = useState<AccessDraft>(() => initialAccess());
  const [moveDate, setMoveDate] = useState("");
  const [arrivalWindow, setArrivalWindow] = useState<"morning" | "afternoon" | "evening">("morning");
  const [flexibleDate, setFlexibleDate] = useState(false);
  const [flexibleTime, setFlexibleTime] = useState(false);
  const [exactTime, setExactTime] = useState(false);
  const [earliestDate, setEarliestDate] = useState("");
  const [latestDate, setLatestDate] = useState("");
  const [calendarAnchor, setCalendarAnchor] = useState(() => normaliseDate(new Date()));
  const [selectedMoverCount, setSelectedMoverCount] = useState<1 | 2>(1);
  const [showCoverPrompt, setShowCoverPrompt] = useState(false);
  const [dismantleCount, setDismantleCount] = useState(0);
  const [assemblyCount, setAssemblyCount] = useState(0);
  const [sameDay, setSameDay] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [items, setItems] = useState<InventoryLine[]>([]);
  const [customItems, setCustomItems] = useState<CustomItemLine[]>([]);
  const [customName, setCustomName] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [activeRoom, setActiveRoom] = useState<RoomValue>("bedroom");
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [services, setServices] = useState<BookingServiceState>({
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
  });
  const [customer, setCustomer] = useState<CustomerDraft>({
    fullName: "",
    email: "",
    phone: "",
    notes: "",
    companyName: "",
    preferredContactMethod: "email" as "email" | "phone" | "sms",
    marketingConsent: false,
    bookingConsentAccepted: false,
    termsAccepted: false,
  });
  const [error, setError] = useState("");
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [paymentRedirecting, setPaymentRedirecting] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [pricePreviews, setPricePreviews] = useState<Record<string, QuotePricePreview>>({});
  const [pricePreviewLoading, setPricePreviewLoading] = useState(false);
  const [pricePreviewError, setPricePreviewError] = useState("");
  const [pricePreviewRetryKey, setPricePreviewRetryKey] = useState(0);
  const [pricePreviewInvalidationKey, setPricePreviewInvalidationKey] = useState(0);
  const pricePreviewRequestRef = useRef(0);
  const quoteRequestRef = useRef(0);
  const quoteSubmitKeyRef = useRef<{ stateKey: string; idempotencyKey: string } | null>(null);
  const [bookingRef, setBookingRef] = useState("");
  const [clientQuoteReference, setClientQuoteReference] = useState("");
  const [promotionCode, setPromotionCode] = useState("");
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<Record<string, unknown> | null>(null);
  const [showExistingQuotePrompt, setShowExistingQuotePrompt] = useState(false);
  const [draftNotice, setDraftNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    setItemsLoading(true);
    void (async () => {
      try {
        const response = await fetch(`/api/items?type=${typeForItems(moveType)}`);
        const data = await response.json() as ApiCategory[];
        if (!cancelled) setCategories(data);
      } catch {
        if (!cancelled) setCategories([]);
      } finally {
        if (!cancelled) setItemsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [moveType]);

  const restoreStoredDraft = (draft: Record<string, unknown>) => {
    if (typeof draft.step === "number") setStep(Math.max(0, Math.min(STEPS.length - 1, Math.floor(draft.step))));
    if (isMoveType(draft.moveType)) setMoveType(draft.moveType);
    if (isMoveSize(draft.moveSize)) setMoveSize(draft.moveSize);
    const restoredCollection = restoreAccessDraft(draft.collection);
    if (restoredCollection) setCollection(restoredCollection);
    const restoredDelivery = restoreAccessDraft(draft.delivery);
    if (restoredDelivery) setDelivery(restoredDelivery);
    const restoredAdditionalStop = restoreAccessDraft(draft.additionalStop);
    if (restoredAdditionalStop) setAdditionalStop(restoredAdditionalStop);
    if (typeof draft.hasAdditionalStop === "boolean") setHasAdditionalStop(draft.hasAdditionalStop);
    if (typeof draft.moveDate === "string") setMoveDate(draft.moveDate);
    if (isArrivalWindow(draft.arrivalWindow)) setArrivalWindow(draft.arrivalWindow);
    if (typeof draft.flexibleDate === "boolean") setFlexibleDate(draft.flexibleDate);
    if (typeof draft.flexibleTime === "boolean") setFlexibleTime(draft.flexibleTime);
    if (typeof draft.exactTime === "boolean") setExactTime(draft.exactTime);
    if (typeof draft.earliestDate === "string") setEarliestDate(draft.earliestDate);
    if (typeof draft.latestDate === "string") setLatestDate(draft.latestDate);
    if (isMoverCount(draft.selectedMoverCount)) setSelectedMoverCount(draft.selectedMoverCount);
    if (typeof draft.dismantleCount === "number") setDismantleCount(Math.max(0, Math.min(20, Math.floor(draft.dismantleCount))));
    if (typeof draft.assemblyCount === "number") setAssemblyCount(Math.max(0, Math.min(20, Math.floor(draft.assemblyCount))));
    if (typeof draft.sameDay === "boolean") setSameDay(draft.sameDay);
    if (typeof draft.urgent === "boolean") setUrgent(draft.urgent);
    setItems(restoreInventoryLines(draft.items));
    setCustomItems(restoreCustomItems(draft.customItems));
    if (isRoom(draft.activeRoom)) setActiveRoom(draft.activeRoom);
    if (isQuoteReference(draft.quoteReference)) setClientQuoteReference(draft.quoteReference.trim());
    if (isRecord(draft.services)) {
      const draftServices = draft.services;
      setServices((prev) => {
        const nextServices = { ...prev };
        for (const [key] of SERVICE_OPTIONS) {
          if (typeof draftServices[key] === "boolean") nextServices[key] = draftServices[key];
        }
        return nextServices;
      });
    }
    if (isRecord(draft.customer)) {
      const draftCustomer = draft.customer;
      setCustomer((prev) => ({
        ...prev,
        fullName: typeof draftCustomer.fullName === "string" ? draftCustomer.fullName : prev.fullName,
        email: typeof draftCustomer.email === "string" ? draftCustomer.email : prev.email,
        phone: typeof draftCustomer.phone === "string" ? draftCustomer.phone : prev.phone,
        notes: typeof draftCustomer.notes === "string" ? draftCustomer.notes.slice(0, 1200) : prev.notes,
        companyName: typeof draftCustomer.companyName === "string" ? draftCustomer.companyName : prev.companyName,
        preferredContactMethod: isPreferredContact(draftCustomer.preferredContactMethod) ? draftCustomer.preferredContactMethod : prev.preferredContactMethod,
        marketingConsent: typeof draftCustomer.marketingConsent === "boolean" ? draftCustomer.marketingConsent : prev.marketingConsent,
        bookingConsentAccepted: false,
        termsAccepted: false,
      }));
    }
    if (typeof draft.promotionCode === "string") setPromotionCode(draft.promotionCode.slice(0, 40).toUpperCase());
  };

  useEffect(() => {
    setClientQuoteReference((current) => current || generateQuoteReference());
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(QUOTE_DRAFT_KEY);
      if (!raw) {
        setDraftHydrated(true);
        return;
      }
      const draft = JSON.parse(raw) as Record<string, unknown>;
      setPendingDraft(draft);
      setShowExistingQuotePrompt(true);
    } catch {
      try {
        window.localStorage.removeItem(QUOTE_DRAFT_KEY);
      } catch {}
      setDraftHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!draftNotice) return;
    const timeout = window.setTimeout(() => setDraftNotice(""), 3400);
    return () => window.clearTimeout(timeout);
  }, [draftNotice]);

  useEffect(() => {
    if (isQuoteReference(quote?.reference)) {
      setClientQuoteReference(quote.reference);
    }
  }, [quote?.reference]);

  useEffect(() => {
    if (!draftHydrated) return;
    const timeout = window.setTimeout(() => {
      try {
        if (bookingRef) {
          window.localStorage.removeItem(QUOTE_DRAFT_KEY);
          return;
        }

        const draftItemUnits = items.reduce((sum, item) => sum + item.quantity, 0) +
          customItems.reduce((sum, item) => sum + item.quantity, 0);
        const hasDraftProgress =
          step > 0 ||
          Boolean(collection.address) ||
          Boolean(delivery.address) ||
          Boolean(moveDate) ||
          draftItemUnits > 0 ||
          Boolean(customer.fullName.trim()) ||
          Boolean(customer.email.trim()) ||
          Boolean(customer.phone.trim()) ||
          Boolean(customer.notes.trim());

        if (!hasDraftProgress) {
          window.localStorage.removeItem(QUOTE_DRAFT_KEY);
          return;
        }

        window.localStorage.setItem(QUOTE_DRAFT_KEY, JSON.stringify({
          version: 2,
          updatedAt: new Date().toISOString(),
          step: Math.min(step, STEPS.length - 1),
          moveType,
          moveSize,
          collection,
          delivery,
          hasAdditionalStop,
          additionalStop,
          moveDate,
          arrivalWindow,
          flexibleDate,
          flexibleTime,
          exactTime,
          earliestDate,
          latestDate,
          selectedMoverCount,
          dismantleCount,
          assemblyCount,
          sameDay,
          urgent,
          items,
          customItems,
          activeRoom,
          services,
          customer,
          promotionCode,
          quoteReference: isQuoteReference(quote?.reference) ? quote.reference : clientQuoteReference || null,
        }));
      } catch {}
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [
    activeRoom,
    additionalStop,
    assemblyCount,
    arrivalWindow,
    bookingRef,
    clientQuoteReference,
    collection,
    customItems,
    customer,
    delivery,
    dismantleCount,
    draftHydrated,
    earliestDate,
    exactTime,
    flexibleDate,
    flexibleTime,
    hasAdditionalStop,
    items,
    latestDate,
    moveDate,
    moveSize,
    moveType,
    promotionCode,
    quote?.reference,
    sameDay,
    selectedMoverCount,
    services,
    step,
    urgent,
  ]);

  useEffect(() => {
    void recordQuoteEvent({
      type: "quote_started",
      metadata: { sourceChannel: "instant_quote_page" },
    });
  }, []);

  useEffect(() => {
    void recordQuoteEvent({
      reference: quote?.reference,
      type: "quote_step_view",
      step: STEPS[step],
      metadata: { moveType, moveSize },
    });
  }, [moveSize, moveType, quote?.reference, step]);

  useEffect(() => {
    if (step !== STEPS.length - 1 || quote?.status !== "FIXED") return;
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [quote?.reference, quote?.status, step]);

  const activeRoomDefinition = ROOMS.find((room) => room.value === activeRoom) ?? ROOMS[0]!;
  const visibleItems = useMemo(() => buildInventoryRows(categories, activeRoom), [activeRoom, categories]);
  const selectedUnits = items.reduce((sum, item) => sum + item.quantity, 0) +
    customItems.reduce((sum, item) => sum + item.quantity, 0);
  const activeRoomUnits = items
    .filter((item) => item.room === activeRoom)
    .reduce((sum, item) => sum + item.quantity, 0) +
    customItems
      .filter((item) => item.room === activeRoom)
      .reduce((sum, item) => sum + item.quantity, 0);
  const pricePreviewScopeKey = useMemo(() => JSON.stringify({
    moveType,
    moveSize,
    collection,
    delivery,
    hasAdditionalStop,
    additionalStop,
    arrivalWindow,
    flexibleDate,
    flexibleTime,
    exactTime,
    earliestDate,
    latestDate,
    dismantleCount,
    assemblyCount,
    urgent,
    items,
    customItems,
    services,
    promotionCode,
  }), [
    additionalStop,
    arrivalWindow,
    assemblyCount,
    collection,
    customItems,
    delivery,
    dismantleCount,
    earliestDate,
    exactTime,
    flexibleDate,
    flexibleTime,
    hasAdditionalStop,
    items,
    latestDate,
    moveSize,
    moveType,
    promotionCode,
    services,
    urgent,
  ]);
  const pricingStateKey = useMemo(() => JSON.stringify({
    moveType,
    moveSize,
    collection,
    delivery,
    hasAdditionalStop,
    additionalStop,
    moveDate,
    arrivalWindow,
    flexibleDate,
    flexibleTime,
    exactTime,
    earliestDate,
    latestDate,
    selectedMoverCount,
    dismantleCount,
    assemblyCount,
    sameDay,
    urgent,
    items,
    customItems,
    services,
    promotionCode,
    customerEmail: customer.email,
    customerPhone: customer.phone,
  }), [
    additionalStop,
    arrivalWindow,
    assemblyCount,
    collection,
    customItems,
    customer.email,
    customer.phone,
    delivery,
    dismantleCount,
    earliestDate,
    exactTime,
    flexibleDate,
    flexibleTime,
    hasAdditionalStop,
    items,
    latestDate,
    moveDate,
    moveSize,
    moveType,
    promotionCode,
    sameDay,
    selectedMoverCount,
    services,
    urgent,
  ]);
  const previousPricingStateKeyRef = useRef(pricingStateKey);

  useEffect(() => {
    if (previousPricingStateKeyRef.current === pricingStateKey) return;
    previousPricingStateKeyRef.current = pricingStateKey;
    quoteRequestRef.current += 1;
    pricePreviewRequestRef.current += 1;
    quoteSubmitKeyRef.current = null;
    setQuote(null);
    setQuoteLoading(false);
    setPaymentError("");
    setPricePreviews({});
    setPricePreviewInvalidationKey((value) => value + 1);
    setPricePreviewLoading(step >= 2 && step <= 4);
    setPricePreviewError("");
  }, [pricingStateKey, step]);

  const invalidatePricedResults = useCallback(() => {
    quoteRequestRef.current += 1;
    pricePreviewRequestRef.current += 1;
    quoteSubmitKeyRef.current = null;
    setQuote(null);
    setQuoteLoading(false);
    setPaymentError("");
    setPricePreviews({});
    setPricePreviewInvalidationKey((value) => value + 1);
    setPricePreviewLoading(step >= 2 && step <= 4);
    setPricePreviewError("");
  }, [step]);

  const updateCollection = useCallback((value: AccessDraft) => {
    invalidatePricedResults();
    setCollection(value);
  }, [invalidatePricedResults]);

  const updateDelivery = useCallback((value: AccessDraft) => {
    invalidatePricedResults();
    setDelivery(value);
  }, [invalidatePricedResults]);

  const setItemQuantity = (item: ApiItem, delta: number, room: RoomValue = activeRoom) => {
    invalidatePricedResults();
    setItems((prev) => {
      const existing = prev.find((line) => line.itemId === item.id && line.room === room);
      if (!existing && delta <= 0) return prev;
      if (!existing) {
        return [...prev, { itemId: item.id, name: item.name, imagePath: item.imagePath, quantity: 1, room }];
      }
      const quantity = Math.max(0, Math.min(99, existing.quantity + delta));
      if (quantity === 0) return prev.filter((line) => !(line.itemId === item.id && line.room === room));
      return prev.map((line) => line.itemId === item.id && line.room === room ? { ...line, quantity } : line);
    });
  };

  const clearSelectedItems = () => {
    invalidatePricedResults();
    setItems([]);
    setCustomItems([]);
  };

  const updateDismantleCount = (value: number) => {
    invalidatePricedResults();
    const nextCount = Math.max(0, Math.min(20, Math.floor(value)));
    setDismantleCount(nextCount);
    setServices((prev) => ({ ...prev, dismantling: nextCount > 0 }));
  };

  const updateAssemblyCount = (value: number) => {
    invalidatePricedResults();
    const nextCount = Math.max(0, Math.min(20, Math.floor(value)));
    setAssemblyCount(nextCount);
    setServices((prev) => ({ ...prev, reassembly: nextCount > 0 }));
  };

  const validateStep = () => {
    if (step === 0) {
      if (!collection.address || !collection.propertyType) return "Enter the collection address and property type.";
      if (!delivery.address || !delivery.propertyType) return "Enter the delivery address and property type.";
      if (!moveDate && !flexibleDate) return "Choose a move date or tick that you do not have a date yet.";
    }
    if (step === 1 && selectedUnits === 0) return "Add at least one inventory item or custom item.";
    if (step === 2) {
      if (!moveDate) return "Select a move date.";
    }
    return "";
  };

  const validateQuoteReady = () => {
    if (!collection.address || !collection.propertyType) return "Enter the collection address and property type.";
    if (!delivery.address || !delivery.propertyType) return "Enter the delivery address and property type.";
    if (hasAdditionalStop && (!additionalStop.address || !additionalStop.propertyType)) return "Enter the additional stop address and property type.";
    if (selectedUnits === 0) return "Add at least one inventory item or custom item.";
    if (!moveDate && !flexibleDate) return "Choose a move date or mark the date as flexible.";
    if (!customer.fullName.trim() || !isValidEmail(customer.email) || !isValidUkPhone(customer.phone)) return "Enter your name, email, and UK phone number.";
    return "";
  };

  const next = () => {
    const message = validateStep();
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setStep((value) => Math.min(STEPS.length - 1, value + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const back = () => {
    setError("");
    setShowCoverPrompt(false);
    setStep((value) => Math.max(0, value - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToStep = (targetStep: number) => {
    setError("");
    setShowCoverPrompt(false);
    setPaymentError("");
    invalidatePricedResults();
    setStep(Math.max(0, Math.min(STEPS.length - 1, targetStep)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const accessPayload = (draft: AccessDraft) => {
    if (!draft.address) throw new Error("Address missing");
    return {
      fullAddress: draft.address.fullAddress ?? "",
      postcode: draft.address.postcode ?? "",
      lat: draft.address.lat,
      lng: draft.address.lng,
      city: draft.address.city ?? "",
      region: draft.address.region ?? "",
      country: draft.address.country ?? "",
      propertyType: draft.propertyType,
      floor: draft.floor,
      hasLift: draft.hasLift,
      internalStairs: draft.internalStairs,
      externalStairs: draft.externalStairs,
      parking: draft.parking,
      parkingRestrictions: draft.parkingRestrictions,
      carryDistanceMeters: draft.carryDistanceMeters,
      narrowRoad: draft.narrowRoad,
      loadingBayAvailable: draft.loadingBayAvailable,
      accessRestrictions: draft.accessRestrictions,
      notes: draft.notes,
    };
  };

  const selectedServicesPayload = () => ({
    ...services,
    additionalMover: services.additionalMover,
    dismantling: dismantleCount > 0,
    reassembly: assemblyCount > 0,
    dismantlingItems: dismantleCount,
    reassemblyItems: assemblyCount,
  });

  const quoteCustomerPayload = (
    override?: Partial<CustomerDraft>,
    options: { allowPreviewFallback?: boolean } = {}
  ) => {
    const source = { ...customer, ...override };
    const phone = source.phone?.trim() ?? "";
    const validPhone = isValidUkPhone(phone);
    const fallback = Boolean(options.allowPreviewFallback);
    return {
      ...source,
      fullName: source.fullName?.trim() || (fallback ? "Price Preview" : ""),
      email: isValidEmail(source.email ?? "") ? source.email.trim() : fallback ? "preview@example.com" : (source.email ?? "").trim(),
      phone: validPhone ? normaliseUkPhone(phone) : fallback ? "07123456789" : phone,
      notes: source.notes?.trim().slice(0, 1200) ?? "",
      companyName: "",
      preferredContactMethod: source.preferredContactMethod ?? "email",
      marketingConsent: Boolean(source.marketingConsent),
      bookingConsentAccepted: true,
      termsAccepted: true,
    };
  };

  const buildQuotePayload = ({
    moveDateOverride = moveDate,
    preferredMoversOverride,
    idempotencyKey,
    includeContactNotes,
    customerOverride,
  }: {
    moveDateOverride?: string;
    preferredMoversOverride?: MoverCount;
    idempotencyKey?: string;
    includeContactNotes: boolean;
    customerOverride?: Partial<CustomerDraft>;
  }) => {
    const collectionPayload = accessPayload(collection);
    const deliveryPayload = accessPayload(delivery);
    const hasSpecificDate = Boolean(moveDateOverride);
    const moveDateForPayload = hasSpecificDate ? moveDateOverride : null;
    void includeContactNotes;

    return {
      idempotencyKey,
      reference: clientQuoteReference || undefined,
      moveType,
      moveSize,
      collection: collectionPayload,
      delivery: deliveryPayload,
      additionalStop: hasAdditionalStop ? accessPayload(additionalStop) : null,
      moveDate: moveDateForPayload,
      earliestDate: hasSpecificDate ? null : earliestDate || null,
      latestDate: hasSpecificDate ? null : latestDate || null,
      arrivalWindow,
      flexibleDate: hasSpecificDate ? false : flexibleDate,
      flexibleTime,
      exactTime,
      sameDay: Boolean(moveDateForPayload && moveDateForPayload === minDate),
      urgent,
      preferredMovers: preferredMoversOverride ?? selectedMoverCount,
      inventory: items.filter((item) => item.quantity > 0 && item.itemId.trim()).map((item) => ({
        itemId: item.itemId,
        quantity: Math.max(1, Math.min(99, Math.floor(item.quantity))),
        room: item.room,
      })),
      customItems: customItems
        .filter((item) => item.quantity > 0 && item.name.trim().length >= 2)
        .map((item) => ({
          name: item.name.trim(),
          quantity: Math.max(1, Math.min(25, Math.floor(item.quantity))),
          room: item.room,
          notes: item.notes.trim(),
        })),
      services: selectedServicesPayload(),
      customer: quoteCustomerPayload(customerOverride, { allowPreviewFallback: !includeContactNotes }),
      promotionCode: promotionCode.trim() || undefined,
      sourceChannel: "web",
    };
  };

  const startStripeCheckout = async (quoteReference: string) => {
    setPaymentRedirecting(true);
    setPaymentError("");
    const idempotencyKey = randomKey("checkout");
    const response = await fetch("/api/booking/checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteReference, idempotencyKey }),
    });
    const data = await response.json().catch(() => null) as { url?: string; error?: string } | null;
    if (!response.ok || !data?.url) {
      setPaymentRedirecting(false);
      const message = data?.error ?? "Unable to open Stripe checkout.";
      setPaymentError(message);
      throw new Error(message);
    }
    void recordQuoteEvent({
      reference: quoteReference,
      type: "stripe_checkout_started",
      metadata: { sourceChannel: "instant_quote_page" },
    });
    window.location.assign(data.url);
  };

  const completeLocalPreviewBooking = () => {
    const reference = quote?.reference.startsWith("LOCAL-")
      ? quote.reference.replace(/^LOCAL-/, "LOCAL-BOOK-")
      : `LOCAL-BOOK-${Date.now().toString(36).toUpperCase()}`;
    setPaymentError("");
    setError("");
    setBookingRef(reference);
    try {
      window.localStorage.removeItem(QUOTE_DRAFT_KEY);
    } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const buildLocalPreviewQuote = (preview: QuotePricePreview): QuoteResponse | null => {
    if (preview.status !== "FIXED" || typeof preview.totalPence !== "number") return null;
    const movers = preview.crew?.movers ?? selectedMoverCount;
    return {
      reference: `LOCAL-${Date.now().toString(36).toUpperCase()}`,
      status: "FIXED",
      pricingVersion: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      totalPence: preview.totalPence,
      originalTotalPence: preview.originalTotalPence ?? preview.totalPence,
      discountTotalPence: preview.discountTotalPence ?? 0,
      promotionLabel: preview.promotionLabel ?? null,
      routeMileage: preview.routeMileage ?? null,
      estimatedDurationMinutes: preview.estimatedDurationMinutes ?? preview.crew?.totalJobMinutes ?? null,
      vehicle: preview.vehicle ?? {
        name: selectedUnits >= 35 ? "Luton van" : "Transit van",
        multipleVehiclesRequired: selectedUnits >= 75,
        multipleTripsLikely: selectedUnits >= 65,
      },
      crew: preview.crew ?? {
        movers,
        loadingMinutes: 0,
        unloadingMinutes: 0,
        travelMinutes: 0,
        totalJobMinutes: 0,
      },
      inventory: preview.inventory ?? {
        totalVolumeM3: Math.round(selectedUnits * CLIENT_ESTIMATED_VOLUME_PER_ITEM_M3 * 100) / 100,
        totalWeightKg: selectedUnits * 18,
        itemUnits: selectedUnits,
        fragileItemCount: 0,
        heavyOrSpecialItemCount: 0,
      },
      breakdown: preview.breakdown?.length
        ? preview.breakdown
        : [{ key: "estimated_total", label: "Estimated move total", amountPence: preview.totalPence }],
      manualReviewReasons: preview.manualReviewReasons ?? [],
    };
  };

  const requestQuote = async ({
    allowLocalPreview = true,
    startCheckout = false,
  }: {
    allowLocalPreview?: boolean;
    startCheckout?: boolean;
  } = {}) => {
    const message = validateQuoteReady();
    if (message) {
      setError(message);
      return;
    }
    if (allowLocalPreview && isLocalBookingHost()) {
      const localQuote = selectedServerPreview ? buildLocalPreviewQuote(selectedServerPreview) : null;
      if (localQuote) {
        setQuote(localQuote);
        setError("");
        setPaymentError("");
        setQuoteLoading(false);
        setStep(STEPS.length - 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }
    const submitStateKey = JSON.stringify({
      pricingStateKey,
      customerName: customer.fullName,
      customerNotes: customer.notes,
      marketingConsent: customer.marketingConsent,
    });
    const submitKey = quoteSubmitKeyRef.current?.stateKey === submitStateKey
      ? quoteSubmitKeyRef.current.idempotencyKey
      : randomKey("quote");
    quoteSubmitKeyRef.current = { stateKey: submitStateKey, idempotencyKey: submitKey };
    const controller = new AbortController();
    const requestId = quoteRequestRef.current + 1;
    quoteRequestRef.current = requestId;
    let requestTimedOut = false;
    const requestTimeout = window.setTimeout(() => {
      requestTimedOut = true;
      controller.abort();
    }, QUOTE_REQUEST_CLIENT_TIMEOUT_MS);
    setQuoteLoading(true);
    setError("");
    setPaymentError("");
    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(buildQuotePayload({
          idempotencyKey: submitKey,
          includeContactNotes: true,
        })),
      });
      const data = await response.json() as { quote?: QuoteResponse; error?: string; issues?: string[] };
      if (requestId !== quoteRequestRef.current) return;
      if (!response.ok || !data.quote) {
        throw new Error(data.issues?.[0] ?? data.error ?? "Quote could not be created.");
      }
      quoteSubmitKeyRef.current = null;
      setQuote(data.quote);
      setStep(STEPS.length - 1);
      if (startCheckout && data.quote.status === "FIXED") {
        await startStripeCheckout(data.quote.reference);
      }
    } catch (caught) {
      if (requestId !== quoteRequestRef.current) return;
      if (caught instanceof DOMException && caught.name === "AbortError") {
        const timeoutMessage = requestTimedOut
          ? "Quote is taking longer than expected. Please try again."
          : "Quote request was cancelled.";
        if (startCheckout) {
          setPaymentError(timeoutMessage);
        } else {
          setError(timeoutMessage);
        }
        return;
      }
      const errorMessage = caught instanceof Error ? caught.message : "Quote could not be created.";
      if (startCheckout) {
        setPaymentError(errorMessage);
      } else {
        setError(errorMessage);
      }
    } finally {
      window.clearTimeout(requestTimeout);
      if (requestId === quoteRequestRef.current) {
        setQuoteLoading(false);
      }
    }
  };

  const minDate = new Date().toISOString().split("T")[0] ?? "";
  const calendarPreviewDates = useMemo(
    () => makePriceCalendarDays(calendarAnchor).filter((day) => !day.isPast).map((day) => day.iso),
    [calendarAnchor]
  );
  const previewRequestDates = useMemo(() => {
    const dates = step === 2
      ? [moveDate, ...calendarPreviewDates]
      : moveDate
        ? [moveDate]
        : calendarPreviewDates;
    return Array.from(new Set(dates.filter(Boolean)));
  }, [calendarPreviewDates, moveDate, step]);
  const previewRequestMovers = useMemo<MoverCount[]>(
    () => (step === 2 ? [...MOVER_COUNTS] : [selectedMoverCount]),
    [selectedMoverCount, step]
  );
  const previewRequestDatesKey = previewRequestDates.join("|");
  const previewRequestMoversKey = previewRequestMovers.join("|");
  const scopedPricePreviews = useMemo(
    () => filterPricePreviewsByScope(pricePreviews, pricePreviewScopeKey),
    [pricePreviews, pricePreviewScopeKey]
  );
  const selectedMoverServerPreviews = useMemo(
    () => pricePreviewsForMover(scopedPricePreviews, selectedMoverCount),
    [scopedPricePreviews, selectedMoverCount]
  );
  const selectedServerPreview =
    scopedPricePreviews[pricePreviewKey(moveDate, selectedMoverCount)] ??
    (moveDate ? selectedMoverServerPreviews[moveDate] : undefined);
  const selectedServerTotalPence =
    selectedServerPreview?.status === "FIXED" && typeof selectedServerPreview.totalPence === "number"
      ? selectedServerPreview.totalPence
      : undefined;
  const serverComparisonPrices = useMemo(() => getFixedPreviewPrices(scopedPricePreviews), [scopedPricePreviews]);
  const selectedServerPriceTone = priceToneForTotal(selectedServerTotalPence, serverComparisonPrices);
  const displayQuoteReference = isQuoteReference(quote?.reference)
    ? quote.reference
    : clientQuoteReference;
  const isFirstQuoteStep = !bookingRef && step === 0;
  const isInventoryStep = !bookingRef && step === 1;
  const isPriceOptionsStep = !bookingRef && step === 2;
  const isAddOnsStep = !bookingRef && step === 3;
  const isDetailsStep = !bookingRef && step === 4 && quote?.status !== "FIXED";
  const isWideBookingStep = isFirstQuoteStep || isInventoryStep || isPriceOptionsStep || isAddOnsStep || isDetailsStep;
  const collectionHeroPropertyValue = normaliseHeroProperty(collection.propertyType);
  const deliveryHeroPropertyValue = normaliseHeroProperty(delivery.propertyType);
  const selectCollectionProperty = (option: (typeof HERO_PROPERTY_OPTIONS)[number]) => {
    invalidatePricedResults();
    setCollection((prev) => ({ ...prev, propertyType: option.value }));
    setMoveType("house-move");
    setMoveSize(option.moveSize);
  };
  const selectDeliveryProperty = (option: (typeof HERO_PROPERTY_OPTIONS)[number]) => {
    invalidatePricedResults();
    setDelivery((prev) => ({ ...prev, propertyType: option.value }));
  };
  const showProgressHeader = false;
  const selectPriceDate = (date: string, options?: { advance?: boolean }) => {
    invalidatePricedResults();
    setMoveDate(date);
    setFlexibleDate(false);
    setEarliestDate("");
    setLatestDate("");
    setSameDay(date === minDate);
    if (!options?.advance) return;
    setError("");
    setStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const continueExistingQuote = () => {
    if (pendingDraft) restoreStoredDraft(pendingDraft);
    setPendingDraft(null);
    setShowExistingQuotePrompt(false);
    setDraftHydrated(true);
    setDraftNotice("Existing quote restored.");
  };

  const startNewQuote = () => {
    try {
      window.localStorage.removeItem(QUOTE_DRAFT_KEY);
    } catch {}
    setPendingDraft(null);
    setShowExistingQuotePrompt(false);
    setDraftHydrated(true);
    setClientQuoteReference(generateQuoteReference());
    setDraftNotice("Started a new quote.");
  };

  useEffect(() => {
    if (step !== 3) setShowCoverPrompt(false);
  }, [step]);

  useEffect(() => {
    const canPreview =
      draftHydrated &&
      step >= 2 &&
      step <= 4 &&
      Boolean(collection.address) &&
      Boolean(delivery.address) &&
      (!hasAdditionalStop || Boolean(additionalStop.address)) &&
      selectedUnits > 0 &&
      previewRequestDates.length > 0;

    if (!canPreview) {
      pricePreviewRequestRef.current += 1;
      setPricePreviews({});
      setPricePreviewLoading(false);
      setPricePreviewError("");
      return;
    }

    const controller = new AbortController();
    const requestId = pricePreviewRequestRef.current + 1;
    const requestPricingScopeKey = pricePreviewScopeKey;
    pricePreviewRequestRef.current = requestId;
    let active = true;
    let requestTimedOut = false;
    setPricePreviewLoading(true);
    setPricePreviewError("");
    const requestTimeout = window.setTimeout(() => {
      requestTimedOut = true;
      controller.abort();
      if (active && requestId === pricePreviewRequestRef.current) {
        setPricePreviewLoading(false);
        setPricePreviewError("Prices are taking longer than expected. Please try again.");
      }
    }, PRICE_PREVIEW_CLIENT_TIMEOUT_MS);
    const timeout = window.setTimeout(() => {
      void (async () => {
      try {
        const response = await fetch("/api/quotes/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            quotes: previewRequestDates.flatMap((date) => previewRequestMovers.map((movers) => buildQuotePayload({
              moveDateOverride: date,
              preferredMoversOverride: movers,
              includeContactNotes: false,
              customerOverride: {
                fullName: customer.fullName || "Price Preview",
                email: isValidEmail(customer.email) ? customer.email : "preview@example.com",
                phone: customer.phone || "07123456789",
              },
            }))),
          }),
        });
        const data = await response.json().catch(() => null) as { previews?: QuotePricePreview[]; error?: string; issues?: string[] } | null;
        if (!response.ok || !data?.previews) {
          throw new Error(data?.issues?.[0] ?? data?.error ?? "Prices could not load.");
        }
        if (
          !active ||
          controller.signal.aborted ||
          !shouldAcceptPricePreviewResponse({
            responseRequestId: requestId,
            activeRequestId: pricePreviewRequestRef.current,
            responsePricingScopeKey: requestPricingScopeKey,
            activePricingScopeKey: pricePreviewScopeKey,
          })
        ) {
          return;
        }
        setPricePreviews(Object.fromEntries(
          attachPricePreviewScope(data.previews, requestPricingScopeKey)
            .map((preview) => [preview.key, preview])
        ));
        setPricePreviewError("");
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          if (requestTimedOut && active && requestId === pricePreviewRequestRef.current) {
            setPricePreviewError("Prices are taking longer than expected. Please try again.");
          }
          return;
        }
        if (!active || requestId !== pricePreviewRequestRef.current) return;
        setPricePreviewError(caught instanceof Error ? caught.message : "Prices could not load.");
      } finally {
        window.clearTimeout(requestTimeout);
        if (active && requestId === pricePreviewRequestRef.current) {
          setPricePreviewLoading(false);
        }
      }
      })();
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timeout);
      window.clearTimeout(requestTimeout);
      controller.abort();
    };
    // buildQuotePayload reads the same state listed here; preview request arrays are represented by their keys.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    additionalStop,
    arrivalWindow,
    collection,
    customItems,
    customer.email,
    customer.fullName,
    customer.phone,
    delivery,
    dismantleCount,
    draftHydrated,
    exactTime,
    flexibleTime,
    hasAdditionalStop,
    items,
    moveSize,
    moveType,
    previewRequestDatesKey,
    previewRequestMoversKey,
    pricePreviewInvalidationKey,
    pricePreviewScopeKey,
    pricePreviewRetryKey,
    promotionCode,
    selectedUnits,
    services,
    step,
    urgent,
  ]);

  return (
    <Box
      minH="100vh"
      bg={isFirstQuoteStep ? "#0638B7" : isInventoryStep || isPriceOptionsStep || isAddOnsStep || isDetailsStep ? "#F7F7F7" : bookingTheme.page}
      color={bookingTheme.ink}
      backgroundImage={isFirstQuoteStep ? "radial-gradient(circle at 14% 2%, rgba(24,87,255,0.55), transparent 34%), radial-gradient(circle at 78% 16%, rgba(0,10,39,0.55), transparent 36%), linear-gradient(135deg, #07318F 0%, #0036BC 52%, #004ACC 100%)" : undefined}
    >
      {showProgressHeader && (
        <Box
          position="sticky"
          top={0}
          zIndex={10}
          bg="rgba(255,255,255,0.96)"
          borderBottom={`1px solid ${bookingTheme.border}`}
          boxShadow="0 2px 14px rgba(20,50,60,0.06)"
          px={4}
          py={3}
        >
          <Box w="100%" maxW={{ base: "358px", md: "1080px" }} mx="auto">
            <HStack justify="space-between" mb={2} align="center">
              <Text fontSize="xs" fontWeight={900} color={bookingTheme.primaryDark} textTransform="uppercase">
                Instant removals quote
              </Text>
              <Text fontFamily="mono" fontSize="xs" color={bookingTheme.muted}>
                Step {step + 1} of {STEPS.length}
              </Text>
            </HStack>
            <Box display="grid" gridTemplateColumns={`repeat(${STEPS.length}, 1fr)`} gap={1}>
              {STEPS.map((label, index) => (
                <Box
                  key={label}
                  h="6px"
                  borderRadius="full"
                  bg={index <= step ? bookingTheme.primary : "#D7E4E8"}
                  transition="background 0.2s ease"
                />
              ))}
            </Box>
            <HStack justify="space-between" mt={2} display={{ base: "none", md: "flex" }}>
              {STEPS.map((label, index) => (
                <Text
                  key={label}
                  fontSize="xs"
                  fontWeight={index === step ? 900 : 700}
                  color={index === step ? bookingTheme.primaryDark : bookingTheme.muted}
                >
                  {label}
                </Text>
              ))}
            </HStack>
            <Text mt={2} fontSize="xs" color={bookingTheme.muted} display={{ base: "block", md: "none" }}>
              {STEPS[step]}
            </Text>
          </Box>
        </Box>
      )}

      <Box
        w="100%"
        maxW={isFirstQuoteStep ? { base: "calc(100% - 32px)", md: "1180px", xl: "1540px" } : isWideBookingStep ? { base: "calc(100% - 32px)", md: "1172px" } : { base: "358px", md: "760px" }}
        mx="auto"
        pt={isFirstQuoteStep ? { base: 6, md: 7, lg: 8 } : isInventoryStep || isPriceOptionsStep || isAddOnsStep || isDetailsStep ? { base: 6, md: 10 } : { base: 5, md: 8 }}
        pb={isFirstQuoteStep ? { base: 8, md: 8 } : isWideBookingStep ? { base: 8, md: 10 } : "124px"}
      >
        <Box
          display="grid"
          gridTemplateColumns={isFirstQuoteStep ? { base: "1fr", lg: "minmax(0, 750px) minmax(480px, 1fr)" } : "1fr"}
          gap={isFirstQuoteStep ? { base: 5, lg: 8 } : 4}
          alignItems={isFirstQuoteStep ? "center" : "start"}
          minW={0}
        >
          <Box w="full" minW={0}>
          {isFirstQuoteStep && (
            <Box className="ma-text-reveal" color="#FFFFFF" mb={{ base: 4, md: 5 }}>
              <HStack
                display="inline-flex"
                gap={2}
                px={3}
                py={1.5}
                mb={4}
                borderRadius="md"
                bg="rgba(37,99,235,0.78)"
                color="#FFFFFF"
                fontSize="sm"
                fontWeight={900}
                textTransform="uppercase"
                boxShadow="0 10px 24px rgba(0,0,0,0.15)"
              >
                <FiZap color="#FFB900" />
                <Text>Instant online quote</Text>
              </HStack>
              <Text as="h1" fontFamily="heading" fontSize={{ base: "40px", md: "58px", xl: "64px" }} fontWeight={900} lineHeight="1" maxW="680px">
                <Box as="span" className="ma-hero-line">
                  Home removals,{" "}
                </Box>
                <Box as="span" className="ma-hero-line ma-hero-line--late">
                  made{" "}
                <Text as="span" color="#2384FF" position="relative" display="inline-block">
                  simple.
                  <Box
                    as="span"
                    className="ma-hero-underline"
                    position="absolute"
                    left={1}
                    right={0}
                    bottom="-4px"
                    h="6px"
                    borderRadius="full"
                    bg="#FFB900"
                    transform="rotate(-3deg)"
                  />
                </Text>
                </Box>
              </Text>
              <Text className="ma-text-reveal ma-text-reveal--later" mt={4} fontSize={{ base: "md", md: "lg" }} fontWeight={700} lineHeight="1.35" color="rgba(255,255,255,0.92)" maxW="520px">
                Get your instant removal quote in seconds.
                <br />
                Fast, reliable and stress-free moving experience.
              </Text>
            </Box>
          )}
          <Box
            key={step}
            className={isFirstQuoteStep ? "ma-booking-panel-enter" : "ma-booking-step-enter"}
            w="full"
            minW={0}
            bg={isInventoryStep || isPriceOptionsStep || isAddOnsStep || isDetailsStep ? "transparent" : bookingTheme.panel}
            border={isInventoryStep || isPriceOptionsStep || isAddOnsStep || isDetailsStep ? "0" : isFirstQuoteStep ? "1px solid rgba(255,255,255,0.62)" : `1px solid ${bookingTheme.border}`}
            borderRadius={isFirstQuoteStep ? "xl" : "lg"}
            boxShadow={isFirstQuoteStep ? "0 28px 70px rgba(3, 16, 45, 0.24)" : isInventoryStep || isPriceOptionsStep || isAddOnsStep || isDetailsStep ? "none" : "0 18px 50px rgba(20,50,60,0.10)"}
            p={isFirstQuoteStep ? { base: 4, md: 5 } : isInventoryStep || isPriceOptionsStep || isAddOnsStep || isDetailsStep ? 0 : { base: 4, md: 6 }}
          >
        {!bookingRef && step > 2 && step < STEPS.length - 1 && !isAddOnsStep && (
          <Box
            as="button"
            onClick={back}
            display="inline-flex"
            alignItems="center"
            gap={2}
            mb={5}
            px={4}
            py={3}
            borderRadius="lg"
            border={`1px solid ${bookingTheme.border}`}
            bg="#FFFFFF"
            color={bookingTheme.ink}
            fontSize="sm"
            fontWeight={900}
            _hover={{ bg: bookingTheme.primarySoft, borderColor: bookingTheme.primary }}
            _focusVisible={{ outline: `2px solid ${bookingTheme.primary}`, outlineOffset: "2px" }}
          >
            <FiArrowLeft />
            Back
          </Box>
        )}
        {bookingRef ? (
          <StepShell
            title={bookingRef.startsWith("LOCAL-") ? "Booking details ready" : "Booking confirmed"}
            subtitle={`Your booking reference is ${bookingRef}.`}
          >
            <Box p={5} borderRadius="lg" border={`1px solid ${bookingTheme.primary}`} bg={bookingTheme.primarySoft} w="full">
              <Text fontSize="lg" fontWeight={900}>
                {bookingRef.startsWith("LOCAL-") ? "Thank you. Your move details are ready." : "Thank you. Your move is booked."}
              </Text>
              <Text mt={2} color={bookingTheme.muted}>
                {bookingRef.startsWith("LOCAL-")
                  ? "You will review payment before the booking is confirmed."
                  : "A confirmation email is on its way."}
              </Text>
            </Box>
          </StepShell>
        ) : (
          <>
            {step === 0 && (
              <VStack align="stretch" gap={4} w="full">
                {displayQuoteReference && (
                  <Text fontSize="xs" color={bookingTheme.muted} fontWeight={900} textTransform="uppercase">
                    Quote ref: {displayQuoteReference}
                  </Text>
                )}
                <SimpleGrid columns={{ base: 1, md: 2 }} gap={4} w="full">
                  <RouteColumn
                    title="Moving from"
                    value={collection}
                    scope="scotland"
                    searchProximity={collection.address}
                    locationColor={bookingTheme.heroBlue}
                    propertyValue={collectionHeroPropertyValue}
                    showDetailsOnMobile={false}
                    onChange={updateCollection}
                    onPropertyChange={selectCollectionProperty}
                  />
                  <RouteColumn
                    title="Moving to"
                    value={delivery}
                    searchProximity={delivery.address ?? collection.address}
                    locationColor="#F72C54"
                    propertyValue={deliveryHeroPropertyValue}
                    showDetailsOnMobile={false}
                    onChange={updateDelivery}
                    onPropertyChange={selectDeliveryProperty}
                  />
                </SimpleGrid>
                <Box display={{ base: "block", lg: "none" }} w="full">
                  <FirstStepRoutePreview collection={collection} delivery={delivery} size="compact" />
                </Box>
                <SimpleGrid columns={{ base: 1, md: 2 }} gap={3} display={{ base: "grid", md: "none" }}>
                  <Box p={3} border="1px solid #E0E8F2" borderRadius="md" bg="#FFFFFF">
                    <HStack mb={3} gap={2} color="#0E1B3A" fontSize="xs" fontWeight={900} textTransform="uppercase">
                      <FiMapPin color={bookingTheme.heroBlue} size={15} />
                      <Text>Pickup details</Text>
                    </HStack>
                    <RouteDetailsFields
                      title="Moving from"
                      value={collection}
                      locationColor={bookingTheme.heroBlue}
                      propertyValue={collectionHeroPropertyValue}
                      onChange={updateCollection}
                      onPropertyChange={selectCollectionProperty}
                    />
                  </Box>
                  <Box p={3} border="1px solid #E0E8F2" borderRadius="md" bg="#FFFFFF">
                    <HStack mb={3} gap={2} color="#0E1B3A" fontSize="xs" fontWeight={900} textTransform="uppercase">
                      <FiMapPin color="#F72C54" size={15} />
                      <Text>Drop-off details</Text>
                    </HStack>
                    <RouteDetailsFields
                      title="Moving to"
                      value={delivery}
                      locationColor="#F72C54"
                      propertyValue={deliveryHeroPropertyValue}
                      onChange={updateDelivery}
                      onPropertyChange={selectDeliveryProperty}
                    />
                  </Box>
                </SimpleGrid>
                <Box>
                  <HeroSectionHeader>When are you moving?</HeroSectionHeader>
                  <Box mt={2} maxW={{ base: "full", md: "360px" }}>
                    <MoveDateBlock
                      moveDate={moveDate}
                      flexibleDate={flexibleDate}
                      minDate={minDate}
                      onDateChange={(date) => {
                        invalidatePricedResults();
                        setMoveDate(date);
                        setFlexibleDate(false);
                        setEarliestDate("");
                        setLatestDate("");
                      }}
                      onFlexibleChange={(value) => {
                        invalidatePricedResults();
                        setFlexibleDate(value);
                        if (value) setMoveDate("");
                      }}
                    />
                  </Box>
                </Box>
                <Flex direction={{ base: "column", md: "row" }} align={{ base: "stretch", md: "end" }} justify="space-between" gap={4}>
                  <HStack gap={4} flexWrap="wrap" align="end">
                    <TrustpilotBadge />
                    <Box asChild color={bookingTheme.heroBlue} textDecoration="none" fontWeight={800} fontSize="sm" _hover={{ color: "#0B4ED8", textDecoration: "underline" }}>
                      <Link href="/booking/track">Already received a quote?</Link>
                    </Box>
                  </HStack>
                  <Box w={{ base: "full", md: "286px" }}>
                    <Box
                      as="button"
                      className="ma-cta-attention ma-cta-scan ma-quote-cta"
                      onClick={next}
                      w="full"
                      h="64px"
                      px={5}
                      borderRadius="md"
                      bg={bookingTheme.accent}
                      color={bookingTheme.ink}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      gap={2}
                      fontSize="lg"
                      fontWeight={900}
                      position="relative"
                      overflow="hidden"
                      boxShadow="0 14px 28px rgba(245,158,11,0.24)"
                      transition="transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease"
                      _hover={{ bg: "#F5B018", transform: "translateY(-2px)", boxShadow: "0 18px 34px rgba(245,158,11,0.30)" }}
                      _active={{ transform: "translateY(0)" }}
                      _focusVisible={{ outline: "3px solid rgba(245,158,11,0.35)", outlineOffset: "2px" }}
                    >
                      <Box as="span" position="relative" display="inline-flex" alignItems="center" gap={2}>
                        Get an instant quote
                        <FiArrowRight />
                      </Box>
                    </Box>
                  </Box>
                </Flex>
                <HStack
                  gap={{ base: 2.5, md: 4 }}
                  justify={{ base: "center", md: "flex-end" }}
                  flexWrap="wrap"
                  color="#5B6680"
                  fontSize="xs"
                  fontWeight={800}
                >
                  {["Live route pricing", "Fully insured", "Secure checkout"].map((label) => (
                    <HStack key={label} gap={1.5}>
                      <FiCheck color={bookingTheme.heroBlue} />
                      <Text>{label}</Text>
                    </HStack>
                  ))}
                </HStack>
              </VStack>
            )}

            {step === 1 && (
              <Box>
                <Box display="grid" gridTemplateColumns={{ base: "1fr", lg: "minmax(0, 1fr) 364px" }} gap={6} alignItems="start">
                  <Box minW={0}>
                    <Flex
                      direction={{ base: "column", md: "row" }}
                      align={{ base: "stretch", md: "center" }}
                      justify="space-between"
                      gap={{ base: 3, md: 4 }}
                      mb={{ base: 4, md: 8 }}
                    >
                      <Box>
                        <Text
                          as="h1"
                          fontFamily="heading"
                          fontSize={{ base: "2xl", md: "4xl" }}
                          fontWeight={900}
                          color="#3D3D3D"
                          lineHeight="1.1"
                        >
                          What are we moving?
                        </Text>
                        <Text mt={2} fontSize={{ base: "sm", md: "md" }} color={bookingTheme.muted} lineHeight="1.45">
                          Tap an item to add it. Use the plus and minus buttons to adjust quantities.
                        </Text>
                      </Box>
                      {selectedUnits > 0 && (
                        <Box
                          as="button"
                          onClick={clearSelectedItems}
                          aria-label="Clear selected items"
                          title="Clear selected items"
                          w="44px"
                          h="44px"
                          borderRadius="md"
                          border={`1px solid ${bookingTheme.borderStrong}`}
                          bg="#FFFFFF"
                          color={bookingTheme.danger}
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          flexShrink={0}
                          _hover={{ bg: bookingTheme.dangerSoft, borderColor: bookingTheme.danger }}
                        >
                          <FiTrash2 />
                        </Box>
                      )}
                    </Flex>

                    <InventoryMobileSummary
                      selectedUnits={selectedUnits}
                      activeRoomLabel={activeRoomDefinition.label}
                      activeRoomUnits={activeRoomUnits}
                      collection={collection}
                      delivery={delivery}
                      onEditInventory={() => goToStep(1)}
                      onClearInventory={clearSelectedItems}
                    />

                    <Box border={`1px solid ${bookingTheme.borderStrong}`} borderRadius="md" bg="#FFFFFF" overflow="hidden">
                      <Box overflowX="auto" bg="#F8FBFC">
                        <Box display="grid" gridTemplateColumns={{ base: `repeat(${ROOMS.length}, 104px)`, md: `repeat(${ROOMS.length}, 1fr)` }} minW={{ base: "728px", md: "auto" }}>
                          {ROOMS.map((room, index) => {
                            const RoomIcon = room.icon;
                            const selected = activeRoom === room.value;
                            return (
                              <Box
                                key={room.value}
                                as="button"
                                onClick={() => setActiveRoom(room.value)}
                                h={{ base: "72px", md: "80px" }}
                                borderRight={index < ROOMS.length - 1 ? `1px solid ${bookingTheme.borderStrong}` : "0"}
                                borderBottom={`1px solid ${bookingTheme.borderStrong}`}
                                bg={selected ? (room.value === "other" ? "#FFFBEA" : "#FFFFFF") : "#F8F8F8"}
                                color={selected ? bookingTheme.heroBlue : "#9CA5AA"}
                                display="flex"
                                flexDirection="column"
                                alignItems="center"
                                justifyContent="center"
                                gap={{ base: 1.5, md: 2 }}
                                fontSize={{ base: "xs", md: "sm" }}
                                fontWeight={selected ? 900 : 700}
                                _hover={{ bg: "#FFFFFF", color: bookingTheme.heroBlue }}
                                _focusVisible={{ outline: `2px solid ${bookingTheme.heroBlue}`, outlineOffset: "-2px" }}
                              >
                                <RoomIcon size={selected ? 23 : 21} />
                                <span>{room.label}</span>
                              </Box>
                            );
                          })}
                        </Box>
                      </Box>

                      <Flex
                        px={{ base: 4, md: 6 }}
                        py={3}
                        align={{ base: "start", sm: "center" }}
                        justify="space-between"
                        direction={{ base: "column", sm: "row" }}
                        gap={2}
                        borderBottom={`1px solid ${bookingTheme.border}`}
                        bg="#FFFFFF"
                      >
                        <Text fontSize="sm" color={bookingTheme.ink} fontWeight={900}>
                          {activeRoomDefinition.label}
                        </Text>
                        <Text fontSize="sm" color={bookingTheme.muted} fontWeight={800}>
                          {activeRoomUnits} in this room · {selectedUnits} total
                        </Text>
                      </Flex>

                      {itemsLoading ? (
                        <HStack minH="320px" justify="center">
                          <Spinner size="sm" color={bookingTheme.heroBlue} />
                          <Text color={bookingTheme.muted}>Loading inventory...</Text>
                        </HStack>
                      ) : (
                        <Box>
                          {visibleItems.map((item) => {
                            const quantity = items.find((line) => line.itemId === item.id && line.room === activeRoom)?.quantity ?? 0;
                            return (
                              <InventoryItemRow
                                key={`${activeRoom}-${item.id}-${item.displayName}`}
                                item={item}
                                quantity={quantity}
                                onAdd={() => setItemQuantity(item, 1, activeRoom)}
                                onRemove={() => setItemQuantity(item, -1, activeRoom)}
                              />
                            );
                          })}
                          {visibleItems.length === 0 && (
                            <VStack minH="220px" justify="center" gap={3} px={4} textAlign="center">
                              <FiBox size={28} color={bookingTheme.heroBlue} />
                              <Box>
                                <Text fontWeight={900} color={bookingTheme.ink}>No quick items found here</Text>
                                <Text mt={1} fontSize="sm" color={bookingTheme.muted}>Add a custom item below and we will price it with your quote.</Text>
                              </Box>
                            </VStack>
                          )}
                          <Box px={{ base: 4, md: 6 }} py={4} borderBottom={`1px solid ${bookingTheme.border}`}>
                            <Text fontSize="sm" fontWeight={900} mb={3}>Can&apos;t find an item?</Text>
                            <Box display="grid" gridTemplateColumns={{ base: "1fr", md: "minmax(0, 1fr) minmax(0, 1fr) 180px" }} gap={2}>
                              <Box asChild p={3} borderRadius="md" bg="#FFFFFF" border={`1px solid ${bookingTheme.border}`} color={bookingTheme.ink}>
                                <input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Item name" />
                              </Box>
                              <Box asChild p={3} borderRadius="md" bg="#FFFFFF" border={`1px solid ${bookingTheme.border}`} color={bookingTheme.ink}>
                                <input value={customNotes} onChange={(event) => setCustomNotes(event.target.value)} placeholder="Notes" />
                              </Box>
                              <PrimaryButton disabled={!customName.trim()} onClick={() => {
                                invalidatePricedResults();
                                setCustomItems((prev) => [...prev, { name: customName.trim(), quantity: 1, room: activeRoom, notes: customNotes.trim() }]);
                                setCustomName("");
                                setCustomNotes("");
                              }}>
                                Add item
                              </PrimaryButton>
                            </Box>
                          </Box>
                        </Box>
                      )}
                    </Box>

                    <Flex mt={4} gap={3} justify="space-between" align="center" direction={{ base: "column-reverse", md: "row" }}>
                      <Box
                        as="button"
                        onClick={back}
                        w={{ base: "full", md: "auto" }}
                        minW={{ base: "auto", md: "160px" }}
                        h="54px"
                        borderRadius="md"
                        border={`1px solid ${bookingTheme.borderStrong}`}
                        bg="#FFFFFF"
                        color={bookingTheme.ink}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        gap={2}
                        fontSize="md"
                        fontWeight={900}
                        _hover={{ bg: "#F8FBFC" }}
                      >
                        <FiArrowLeft />
                        Back
                      </Box>
                      <Box
                        as="button"
                        onClick={next}
                        w={{ base: "full", md: "auto" }}
                        minW={{ base: "auto", md: "240px" }}
                        h="54px"
                        borderRadius="md"
                        bg={bookingTheme.accent}
                        color={bookingTheme.ink}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        gap={2}
                        fontSize="md"
                        fontWeight={900}
                        _hover={{ bg: "#F5B018" }}
                      >
                        Get Prices
                      </Box>
                    </Flex>
                  </Box>

                  <Box display={{ base: "none", lg: "block" }}>
                    <HStack justify="space-between" align="start" mb={7}>
                      <Box>
                        {displayQuoteReference && (
                          <Text color={bookingTheme.muted}>Quote ref: {displayQuoteReference}</Text>
                        )}
                        <Text className="ma-quote-ref-phone" fontSize="3xl" color={bookingTheme.heroBlue} fontWeight={900}>07426 467 112</Text>
                      </Box>
                    </HStack>
                    <InventorySidebar
                      selectedUnits={selectedUnits}
                      activeRoomLabel={activeRoomDefinition.label}
                      activeRoomUnits={activeRoomUnits}
                      collection={collection}
                      delivery={delivery}
                      onEditRoute={() => goToStep(0)}
                      onEditInventory={() => goToStep(1)}
                    />
                  </Box>
                </Box>
              </Box>
            )}

            {step === 2 && (
              <PriceOptionsStep
                selectedUnits={selectedUnits}
                moveSize={moveSize}
                collection={collection}
                delivery={delivery}
                items={items}
                customItems={customItems}
                selectedDate={moveDate}
                selectedMoverCount={selectedMoverCount}
                displayQuoteReference={displayQuoteReference}
                calendarAnchor={calendarAnchor}
                pricePreviews={scopedPricePreviews}
                pricePreviewLoading={pricePreviewLoading}
                pricePreviewError={pricePreviewError}
                services={services}
                dismantleCount={dismantleCount}
                assemblyCount={assemblyCount}
                onMoverChange={(value) => {
                  invalidatePricedResults();
                  setSelectedMoverCount(value);
                }}
                onCalendarPrevious={() => setCalendarAnchor((date) => addDays(date, -28))}
                onCalendarNext={() => setCalendarAnchor((date) => addDays(date, 28))}
                onDateSelect={selectPriceDate}
                onPreviewRetry={() => setPricePreviewRetryKey((value) => value + 1)}
                onEditRoute={() => goToStep(0)}
                onEditInventory={() => goToStep(1)}
                onEditDateAndAddOns={() => goToStep(2)}
                onBack={back}
                onNext={next}
              />
            )}

            {step === 3 && (
              <AdditionalServicesStep
                selectedUnits={selectedUnits}
                moveSize={moveSize}
                collection={collection}
                delivery={delivery}
                items={items}
                customItems={customItems}
                selectedDate={moveDate}
                displayQuoteReference={displayQuoteReference}
                services={services}
                dismantleCount={dismantleCount}
                assemblyCount={assemblyCount}
                serverTotalPence={selectedServerTotalPence}
                priceTone={selectedServerPriceTone}
                totalLoading={pricePreviewLoading}
                onPackingModeChange={(mode) => {
                  invalidatePricedResults();
                  setServices((prev) => ({
                    ...prev,
                    packing: mode === "full",
                    packingMaterials: mode === "materials",
                    unpacking: false,
                  }));
                }}
                onDismantleCountChange={updateDismantleCount}
                onAssemblyCountChange={updateAssemblyCount}
                onEditRoute={() => goToStep(0)}
                onEditInventory={() => goToStep(1)}
                onEditDateAndAddOns={() => goToStep(2)}
                onBack={back}
                onNext={next}
              />
            )}

            {step === 4 && (
              <>
                {quote?.status !== "FIXED" ? (
                  <ConfirmDetailsStep
                    selectedUnits={selectedUnits}
                    moveSize={moveSize}
                    collection={collection}
                    delivery={delivery}
                    items={items}
                    customItems={customItems}
                    selectedDate={moveDate}
                    services={services}
                    dismantleCount={dismantleCount}
                    assemblyCount={assemblyCount}
                    customer={customer}
                    displayQuoteReference={displayQuoteReference}
                    quoteLoading={quoteLoading}
                    serverTotalPence={selectedServerTotalPence}
                    priceTone={selectedServerPriceTone}
                    totalLoading={pricePreviewLoading}
                    manualReviewReference={quote?.status === "MANUAL_REVIEW" ? quote.reference : undefined}
                    onCustomerChange={setCustomer}
                    onCollectionAddressChange={(address) => {
                      invalidatePricedResults();
                      setCollection((prev) => ({ ...prev, address }));
                    }}
                    onDeliveryAddressChange={(address) => {
                      invalidatePricedResults();
                      setDelivery((prev) => ({ ...prev, address }));
                    }}
                    onEditRoute={() => goToStep(0)}
                    onEditInventory={() => goToStep(1)}
                    onEditDateAndAddOns={() => goToStep(2)}
                    onBack={back}
                    onSubmit={() => void requestQuote()}
                  />
                ) : (
                  <StepShell
                    title={quote.status === "FIXED" ? "Your fixed quote" : "Manual review required"}
                    subtitle={quote.reference.startsWith("LOCAL-") ? "Instant fixed price" : `Quote reference ${quote.reference}`}
                  >
                    {(() => {
                      const localPreviewQuote = quote.reference.startsWith("LOCAL-");
                      return (
                        <>
                    <Box
                      as="button"
                      onClick={back}
                      display="inline-flex"
                      alignItems="center"
                      gap={2}
                      px={3}
                      py={2}
                      borderRadius="lg"
                      border={`1px solid ${bookingTheme.border}`}
                      color={bookingTheme.ink}
                      fontSize="sm"
                      fontWeight={900}
                      _hover={{ bg: bookingTheme.primarySoft, borderColor: bookingTheme.primary }}
                      _focusVisible={{ outline: `2px solid ${bookingTheme.primary}`, outlineOffset: "2px" }}
                    >
                      <FiArrowLeft />
                      Back
                    </Box>
                  <VStack align="start" gap={4} w="full">
                    {quote.status === "FIXED" ? (
                      <Box w="full" p={5} borderRadius="lg" border={`1px solid ${bookingTheme.primary}`} bg={bookingTheme.primarySoft}>
                        {quote.discountTotalPence > 0 && quote.originalTotalPence && (
                          <Text fontSize="sm" color={bookingTheme.muted} textDecoration="line-through">
                            {formatPence(quote.originalTotalPence)}
                          </Text>
                        )}
                        <Text fontFamily="heading" fontSize="4xl" fontWeight={900} color={bookingTheme.ink}>
                          {formatPence(quote.totalPence ?? 0)}
                        </Text>
                        {quote.discountTotalPence > 0 && (
                          <Text color={bookingTheme.primaryDark} fontSize="sm" fontWeight={900}>
                            {quote.promotionLabel ?? "Online saving"} · you save {formatPence(quote.discountTotalPence)}
                          </Text>
                        )}
                        <Text color={bookingTheme.muted} fontSize="sm">
                          Fixed price held until {new Date(quote.expiresAt).toLocaleString("en-GB")}
                        </Text>
                        <Text color={bookingTheme.muted} fontSize="xs" mt={1}>
                          Secure booking. You will review everything before payment.
                        </Text>
                      </Box>
                    ) : (
                      <Box w="full" p={5} borderRadius="lg" border={`1px solid ${bookingTheme.accent}`} bg={bookingTheme.accentSoft}>
                        <HStack align="start">
                          <FiAlertTriangle color="#B77900" />
                          <Text fontWeight={900}>We need to review this move before giving a fixed price.</Text>
                        </HStack>
                        <Text mt={2} color={bookingTheme.muted} fontSize="sm">
                          Your request has been saved and sent to the admin team.
                        </Text>
                      </Box>
                    )}
                    {quote.status === "FIXED" && localPreviewQuote && (
                      <LocalPreviewNextPanel
                        totalPence={quote.totalPence ?? 0}
                        error={paymentError}
                        busy={quoteLoading || paymentRedirecting}
                        onNext={completeLocalPreviewBooking}
                      />
                    )}
                    <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap={3} w="full">
                      <SummaryCell label="Distance" value={quote.routeMileage == null ? "Review" : `${quote.routeMileage.toFixed(1)} miles`} />
                      <SummaryCell label="Vehicle" value={quote.vehicle.name ?? "Review"} />
                      <SummaryCell label="Crew" value={`${quote.crew.movers || 0} mover${quote.crew.movers === 1 ? "" : "s"}`} />
                      <SummaryCell label="Duration" value={quote.estimatedDurationMinutes == null ? "Review" : `${Math.round(quote.estimatedDurationMinutes / 60 * 10) / 10} hrs`} />
                    </SimpleGrid>
                    {quote.status === "FIXED" && (
                      <Box w="full">
                        <Text fontSize="sm" fontWeight={900} mb={2}>Customer summary</Text>
                        <VStack gap={2} align="stretch">
                          {quote.breakdown.map((line) => (
                            <HStack key={line.key} justify="space-between" p={3} borderRadius="lg" bg={bookingTheme.subtle}>
                              <Text fontSize="sm" color={bookingTheme.muted}>{line.label}</Text>
                              <Text fontFamily="mono" fontSize="sm" fontWeight={900}>{formatPence(line.amountPence)}</Text>
                            </HStack>
                          ))}
                        </VStack>
                      </Box>
                    )}
                    {quote.status === "FIXED" && (
                      <SelectedItemsSummary
                        items={items}
                        customItems={customItems}
                        onEdit={() => goToStep(1)}
                      />
                    )}
                    {quote.status === "FIXED" && !localPreviewQuote && (
                      <StripeRedirectPanel
                        quote={quote}
                        busy={paymentRedirecting}
                        error={paymentError}
                        onRetry={() => void startStripeCheckout(quote.reference)}
                      />
                    )}
                  </VStack>
                        </>
                      );
                    })()}
                  </StepShell>
                )}
              </>
            )}
          </>
        )}

        {error && <Box mt={5}><ErrorBox>{error}</ErrorBox></Box>}
          </Box>
          </Box>

          {isFirstQuoteStep && (
            <Box display={{ base: "none", lg: "block" }}>
              <FirstStepRoutePreview collection={collection} delivery={delivery} />
            </Box>
          )}
        </Box>
        {isFirstQuoteStep && <HeroBenefitsStrip />}
      </Box>

      {!bookingRef && step > 2 && step < STEPS.length - 1 && !isAddOnsStep && (
        <Box
          position="fixed"
          bottom={0}
          left={0}
          right={0}
          px={4}
          py={4}
          bg="rgba(255,255,255,0.98)"
          borderTop={`1px solid ${bookingTheme.border}`}
          boxShadow="0 -10px 30px rgba(20,50,60,0.10)"
          zIndex={20}
        >
          <HStack w="100%" maxW={{ base: "358px", md: "760px" }} mx="auto" gap={3}>
            {step > 0 && (
              <Box
                as="button"
                onClick={back}
                minW={{ base: "104px", sm: "116px" }}
                h="52px"
                px={4}
                borderRadius="lg"
                border={`1px solid ${bookingTheme.border}`}
                bg="#FFFFFF"
                color={bookingTheme.ink}
                display="flex"
                alignItems="center"
                justifyContent="center"
                gap={2}
                fontSize="sm"
                fontWeight={900}
                _hover={{ bg: bookingTheme.primarySoft, borderColor: bookingTheme.primary }}
                _focusVisible={{ outline: `2px solid ${bookingTheme.primary}`, outlineOffset: "2px" }}
              >
                <FiArrowLeft />
                Back
              </Box>
            )}
            <PrimaryButton attention onClick={step === STEPS.length - 2 ? () => void requestQuote() : next}>
              {step === STEPS.length - 2
                ? "Get instant price"
                : step === 0
                  ? <>Get an instant quote <FiArrowRight /></>
                  : <>Continue <FiArrowRight /></>}
            </PrimaryButton>
          </HStack>
        </Box>
      )}

      {showExistingQuotePrompt && pendingDraft && (
        <ExistingQuotePrompt
          onContinue={continueExistingQuote}
          onStartNew={startNewQuote}
        />
      )}

      {draftNotice && (
        <Box
          position="fixed"
          left="50%"
          bottom={{ base: 5, md: 8 }}
          transform="translateX(-50%)"
          zIndex={80}
          px={4}
          py={3}
          borderRadius="md"
          bg={bookingTheme.ink}
          color="#FFFFFF"
          fontSize="sm"
          fontWeight={900}
          boxShadow="0 18px 45px rgba(0,0,0,0.22)"
        >
          {draftNotice}
        </Box>
      )}

      {!bookingRef && step === 3 && showCoverPrompt && (
        <CoverPromptModal
          onAddProtection={() => {
            invalidatePricedResults();
            setServices((prev) => ({ ...prev, furnitureProtection: true }));
            setShowCoverPrompt(false);
            next();
          }}
          onKeepComplimentary={() => {
            setShowCoverPrompt(false);
            next();
          }}
        />
      )}
    </Box>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <Box p={4} borderRadius="lg" border={`1px solid ${bookingTheme.border}`} bg={bookingTheme.subtle}>
      <Text fontSize="xs" color={bookingTheme.muted} fontWeight={800} textTransform="uppercase">{label}</Text>
      <Text mt={1} fontSize="sm" fontWeight={900} color={bookingTheme.ink}>{value}</Text>
    </Box>
  );
}

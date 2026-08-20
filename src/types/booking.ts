export interface AddressData {
  fullAddress: string;
  postcode: string;
  lat: number;
  lng: number;
  city: string;
  region?: string;
  country?: string;
}

export interface SelectedItem {
  itemId: string;
  name: string;
  imagePath: string;
  quantity: number;
}

/** How complex the move is — drives which base fee tier is used. */
export type MoveComplexity = "single_item" | "few_items" | "small_move" | "house_removal";

export interface PricingLineItem {
  label: string;
  amount: number;
  /** info = label-only row (no amount rendered); discount = negative (green). */
  type: "base" | "surcharge" | "discount" | "multiplier" | "info";
}

export interface DayAdjustment {
  label: string;
  amount: number;
  type: "surcharge" | "discount";
}

export interface DayPrice {
  date: string;
  dayName: string;
  dayNumber: number;
  month: string;
  prices: { morning: number; afternoon: number; evening: number };
  cheapest: number;
  tier: "cheap" | "mid" | "expensive";
  isToday: boolean;
  isTomorrow: boolean;
  isWeekend: boolean;
  weather: {
    condition: string;
    description: string;
    icon: string;
    surcharge: number;
  };
  /** Per-day surcharge/discount lines for the breakdown UI (server-computed). */
  dayAdjustments: DayAdjustment[];
  multipliers: {
    urgency: number;
    calendar: number;
    combined: number;
    capped: boolean;
  };
}

export interface PricingResult {
  days: DayPrice[];
  staticLineItems: PricingLineItem[];
  staticSubtotal: number;
  moveComplexity: MoveComplexity;
  moveComplexityLabel: string;
  currency: string;
  symbol: string;
}

export interface PriceBreakdown {
  base: number;
  distanceCharge: number;
  lineItems: Array<{ label: string; amount: number }>;
  lines: Array<{ label: string; amount: number }>;
  dayMultiplier: number;
  dayLabel: string;
  subtotal: number;
  total: number;
}

export interface BookingFormState {
  // Step 1
  service: string;
  serviceVariant: string;
  helpersCount: number;
  needsPacking: boolean;
  needsAssembly: boolean;
  // Step 2
  pickupAddress: AddressData | null;
  pickupPropertyType: string;
  pickupFloor: number;
  pickupHasLift: boolean;
  dropoffAddress: AddressData | null;
  dropoffPropertyType: string;
  dropoffFloor: number;
  dropoffHasLift: boolean;
  distanceMiles: number | null;
  durationMinutes: number | null;
  selectedItems: SelectedItem[];
  // Step 3
  selectedDate: string | null;
  moveDateFlexible: boolean;
  selectedTimeSlot: "morning" | "afternoon" | "evening" | null;
  priceBreakdown: PriceBreakdown | null;
  pricingResult: PricingResult | null;
  selectedPrice: number | null;
  // Step 4
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  specialInstructions: string;
  priceIntentSecret: string | null;
}

export const INITIAL_BOOKING_STATE: BookingFormState = {
  service: "",
  serviceVariant: "",
  helpersCount: 0,
  needsPacking: false,
  needsAssembly: false,
  pickupAddress: null,
  pickupPropertyType: "",
  pickupFloor: 0,
  pickupHasLift: false,
  dropoffAddress: null,
  dropoffPropertyType: "",
  dropoffFloor: 0,
  dropoffHasLift: false,
  distanceMiles: null,
  durationMinutes: null,
  selectedItems: [],
  selectedDate: null,
  moveDateFlexible: false,
  selectedTimeSlot: null,
  priceBreakdown: null,
  pricingResult: null,
  selectedPrice: null,
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  specialInstructions: "",
  priceIntentSecret: null,
};

export const SERVICE_LABELS: Record<string, string> = {
  "house-move": "House Move",
  "van-with-man": "Van with Man",
  "furniture-removals": "Furniture Removals",
  "deliveries": "Deliveries",
  "business-removals": "Business Removals",
  "hotel-removals": "Hotel Removals",
  "office-removals": "Office Removals",
  "piano-moves": "Piano Move",
  "packing-service": "Packing Service",
};

export const TIME_SLOTS = [
  { value: "07:00", label: "7:00 AM" },
  { value: "08:00", label: "8:00 AM" },
  { value: "09:00", label: "9:00 AM" },
  { value: "10:00", label: "10:00 AM" },
  { value: "11:00", label: "11:00 AM" },
  { value: "12:00", label: "12:00 PM" },
  { value: "14:00", label: "2:00 PM" },
];

/** @deprecated Use /api/items instead */
export const FURNITURE_CATEGORIES = [
  {
    id: "bedroom",
    name: "Bedroom",
    emoji: "🛏️",
    items: [
      { id: "single-bed", name: "Single Bed", emoji: "🛏️" },
      { id: "double-bed", name: "Double Bed", emoji: "🛏️" },
      { id: "king-bed", name: "King Bed", emoji: "🛏️" },
      { id: "wardrobe", name: "Wardrobe", emoji: "🚪" },
      { id: "chest-drawers", name: "Chest of Drawers", emoji: "🗄️" },
      { id: "bedside-table", name: "Bedside Table", emoji: "🪑" },
      { id: "desk", name: "Desk", emoji: "🖥️" },
      { id: "dressing-table", name: "Dressing Table", emoji: "🪞" },
    ],
  },
  {
    id: "living",
    name: "Living Room",
    emoji: "🛋️",
    items: [
      { id: "sofa-2", name: "2-Seater Sofa", emoji: "🛋️" },
      { id: "sofa-3", name: "3-Seater Sofa", emoji: "🛋️" },
      { id: "sofa-corner", name: "Corner Sofa", emoji: "🛋️" },
      { id: "armchair", name: "Armchair", emoji: "🪑" },
      { id: "coffee-table", name: "Coffee Table", emoji: "🪵" },
      { id: "tv-unit", name: "TV Unit", emoji: "📺" },
      { id: "large-tv", name: "TV 55\"+ ", emoji: "📺" },
      { id: "bookcase", name: "Bookcase", emoji: "📚" },
    ],
  },
  {
    id: "kitchen",
    name: "Kitchen / White Goods",
    emoji: "🍽️",
    items: [
      { id: "fridge-freezer", name: "Fridge Freezer", emoji: "🧊" },
      { id: "washing-machine", name: "Washing Machine", emoji: "🫧" },
      { id: "dishwasher", name: "Dishwasher", emoji: "🍽️" },
      { id: "tumble-dryer", name: "Tumble Dryer", emoji: "🌀" },
      { id: "oven-range", name: "Oven / Range", emoji: "♨️" },
    ],
  },
  {
    id: "dining",
    name: "Dining Room",
    emoji: "🪵",
    items: [
      { id: "dining-table", name: "Dining Table", emoji: "🪵" },
      { id: "dining-chairs", name: "Dining Chairs ×4", emoji: "🪑" },
      { id: "sideboard", name: "Sideboard / Cabinet", emoji: "🗄️" },
    ],
  },
  {
    id: "boxes",
    name: "Boxes & Misc",
    emoji: "📦",
    items: [
      { id: "small-boxes", name: "Small Boxes", emoji: "📦" },
      { id: "medium-boxes", name: "Medium Boxes", emoji: "📦" },
      { id: "large-boxes", name: "Large Boxes", emoji: "📦" },
      { id: "bike", name: "Bicycle", emoji: "🚲" },
      { id: "plant-large", name: "Large Plant", emoji: "🌴" },
    ],
  },
];

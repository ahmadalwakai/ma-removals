import type { ServiceSlug } from "@/lib/constants";
import type { CreateQuoteRequest } from "@/lib/quotes/schemas";

export const BOOKING_INTENTS = [
  "home-removal",
  "furniture",
  "man-and-van",
  "delivery",
  "student-move",
  "other",
] as const;

export type BookingIntent = (typeof BOOKING_INTENTS)[number];

interface BookingIntentDefaults {
  moveType: CreateQuoteRequest["moveType"];
  moveSize: NonNullable<CreateQuoteRequest["moveSize"]>;
  propertyType: string;
  activeRoom: CreateQuoteRequest["inventory"][number]["room"];
}

const BOOKING_INTENT_DEFAULTS: Record<BookingIntent, BookingIntentDefaults> = {
  "home-removal": {
    moveType: "house-move",
    moveSize: "1-bedroom",
    propertyType: "1 Bedroom House",
    activeRoom: "bedroom",
  },
  furniture: {
    moveType: "furniture-delivery",
    moveSize: "single-item",
    propertyType: "Ground Floor Property",
    activeRoom: "living-room",
  },
  "man-and-van": {
    moveType: "marketplace-collection",
    moveSize: "few-items",
    propertyType: "Ground Floor Property",
    activeRoom: "other",
  },
  delivery: {
    moveType: "single-item-delivery",
    moveSize: "single-item",
    propertyType: "Ground Floor Property",
    activeRoom: "other",
  },
  "student-move": {
    moveType: "student-move",
    moveSize: "few-items",
    propertyType: "Student Accommodation",
    activeRoom: "bedroom",
  },
  other: {
    moveType: "other",
    moveSize: "custom-inventory",
    propertyType: "Ground Floor Property",
    activeRoom: "other",
  },
};

const SERVICE_INTENTS: Record<ServiceSlug, BookingIntent> = {
  "house-move": "home-removal",
  "van-with-man": "man-and-van",
  "furniture-removals": "furniture",
  deliveries: "delivery",
  "business-removals": "other",
  "hotel-removals": "other",
  "office-removals": "other",
  "piano-moves": "other",
  "packing-service": "other",
};

export function parseBookingIntent(value: string | null | undefined): BookingIntent | null {
  return BOOKING_INTENTS.includes(value as BookingIntent) ? (value as BookingIntent) : null;
}

export function bookingIntentDefaults(intent: BookingIntent): BookingIntentDefaults {
  return BOOKING_INTENT_DEFAULTS[intent];
}

export function bookingHrefForIntent(intent: BookingIntent): string {
  return `/book?intent=${intent}`;
}

export function bookingIntentForServiceSlug(slug: ServiceSlug): BookingIntent {
  return SERVICE_INTENTS[slug];
}

export function bookingHrefForServiceSlug(slug: ServiceSlug): string {
  return bookingHrefForIntent(bookingIntentForServiceSlug(slug));
}

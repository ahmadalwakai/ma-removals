import { z } from "zod";

export const gbpFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

export const moveTypeSchema = z.enum([
  "house-move",
  "flat-move",
  "office-move",
  "student-move",
  "single-item-delivery",
  "furniture-delivery",
  "marketplace-collection",
  "piano-move",
  "other",
]);

export const moveSizeSchema = z.enum([
  "single-item",
  "few-items",
  "studio",
  "1-bedroom",
  "2-bedrooms",
  "3-bedrooms",
  "4-bedrooms",
  "5-plus-bedrooms",
  "office",
  "custom-inventory",
]);

export const arrivalWindowSchema = z.enum(["morning", "afternoon", "evening"]);

export const roomSchema = z.enum([
  "living-room",
  "bedroom",
  "kitchen",
  "dining-room",
  "bathroom",
  "office",
  "garden",
  "garage",
  "storage",
  "other",
]);

const customerNoteSchema = z
  .string()
  .trim()
  .max(1200)
  .transform((value) => value.replace(/[<>]/g, ""))
  .optional()
  .or(z.literal(""));

const postcodeSchema = z.string().trim().max(12).optional().default("");

export const addressAccessSchema = z.object({
  fullAddress: z.string().trim().min(3).max(260),
  postcode: postcodeSchema,
  lat: z.number().finite().min(49).max(62).default(55.8642),
  lng: z.number().finite().min(-9.5).max(2.5).default(-4.2518),
  city: z.string().trim().max(80).optional().default(""),
  region: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional(),
  propertyType: z.string().trim().min(1).max(80).default("House"),
  floor: z.number().int().min(0).max(30).default(0),
  hasLift: z.boolean().default(false),
  internalStairs: z.number().int().min(0).max(40).default(0),
  externalStairs: z.number().int().min(0).max(40).default(0),
  parking: z.enum(["on-site", "street", "paid", "restricted", "unknown"]).default("unknown"),
  parkingRestrictions: z.string().trim().max(400).optional().default(""),
  carryDistanceMeters: z.number().int().min(0).max(500).default(0),
  narrowRoad: z.boolean().default(false),
  loadingBayAvailable: z.boolean().default(false),
  accessRestrictions: z.string().trim().max(600).optional().default(""),
  notes: customerNoteSchema.default(""),
});

export const inventoryItemSelectionSchema = z.object({
  itemId: z.string().trim().min(1),
  quantity: z.number().int().min(1).max(99),
  room: roomSchema,
});

export const customInventoryItemSchema = z.object({
  name: z.string().trim().min(2).max(120),
  quantity: z.number().int().min(1).max(25),
  room: roomSchema,
  notes: customerNoteSchema.default(""),
});

export const additionalServicesSchema = z.object({
  packing: z.boolean().default(false),
  packingMaterials: z.boolean().default(false),
  unpacking: z.boolean().default(false),
  dismantling: z.boolean().default(false),
  reassembly: z.boolean().default(false),
  furnitureProtection: z.boolean().default(false),
  mattressProtection: z.boolean().default(false),
  tvProtection: z.boolean().default(false),
  wasteDisposal: z.boolean().default(false),
  additionalMover: z.boolean().default(false),
  waitingTime: z.boolean().default(false),
  heavyItemHandling: z.boolean().default(false),
  pianoHandling: z.boolean().default(false),
}).passthrough();

export const defaultAdditionalServices = {
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

export const customerDetailsSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(7).max(40),
  notes: customerNoteSchema.default(""),
  companyName: z.string().trim().max(140).optional().default(""),
  preferredContactMethod: z.enum(["email", "phone", "sms"]).optional().default("phone"),
  marketingConsent: z.boolean().default(false),
  bookingConsentAccepted: z.literal(true),
  termsAccepted: z.literal(true),
});

export const quoteReferenceSchema = z
  .string()
  .trim()
  .regex(/^MAQ-\d{4}-[A-Z0-9]{6}$/);

export const createQuoteRequestSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
  reference: quoteReferenceSchema.optional(),
  moveType: moveTypeSchema,
  moveSize: moveSizeSchema.optional(),
  collection: addressAccessSchema,
  delivery: addressAccessSchema,
  additionalStop: addressAccessSchema.optional().nullable(),
  moveDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  earliestDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  latestDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  arrivalWindow: arrivalWindowSchema.optional().nullable(),
  flexibleDate: z.boolean().default(false),
  flexibleTime: z.boolean().default(false),
  exactTime: z.boolean().default(false),
  sameDay: z.boolean().default(false),
  urgent: z.boolean().default(false),
  preferredMovers: z.number().int().min(1).max(12).optional(),
  inventory: z.array(inventoryItemSelectionSchema).max(300).default([]),
  customItems: z.array(customInventoryItemSchema).max(25).default([]),
  services: additionalServicesSchema.default(defaultAdditionalServices),
  customer: customerDetailsSchema,
  sourceChannel: z.string().trim().max(80).optional(),
  utmSource: z.string().trim().max(120).optional(),
  utmMedium: z.string().trim().max(120).optional(),
  utmCampaign: z.string().trim().max(160).optional(),
  referralCode: z.string().trim().max(80).optional(),
});

export const acceptQuoteRequestSchema = z.object({
  quoteReference: quoteReferenceSchema,
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

export const confirmBookingFromQuoteSchema = z.object({
  quoteReference: quoteReferenceSchema,
  paymentIntentId: z.string().trim().min(8).max(120),
  idempotencyKey: z.string().trim().min(8).max(120),
});

export const quoteEventSchema = z.object({
  reference: quoteReferenceSchema.optional(),
  type: z.string().trim().min(2).max(80),
  step: z.string().trim().max(80).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateQuoteRequest = z.infer<typeof createQuoteRequestSchema>;
export type AddressAccessInput = z.infer<typeof addressAccessSchema>;
export type InventoryItemSelection = z.infer<typeof inventoryItemSelectionSchema>;
export type CustomInventoryItem = z.infer<typeof customInventoryItemSchema>;
export type AdditionalServicesInput = z.infer<typeof additionalServicesSchema>;

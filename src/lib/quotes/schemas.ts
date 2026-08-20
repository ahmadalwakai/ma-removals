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

export const arrivalWindowSchema = z.enum([
  "morning",
  "afternoon",
  "evening",
]);

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

const postcodeSchema = z
  .string()
  .trim()
  .max(12)
  .refine(
    (value) => value === "" || /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(value),
    "Enter a valid UK postcode"
  );

const customerNoteSchema = z
  .string()
  .trim()
  .max(1200)
  .transform((value) => value.replace(/[<>]/g, ""))
  .optional()
  .or(z.literal(""));

export const addressAccessSchema = z.object({
  fullAddress: z.string().trim().min(6).max(260),
  postcode: postcodeSchema,
  lat: z.number().finite().min(49).max(62),
  lng: z.number().finite().min(-9.5).max(2.5),
  city: z.string().trim().max(80).optional().default(""),
  region: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional(),
  propertyType: z.string().trim().min(1).max(80),
  floor: z.number().int().min(0).max(30),
  hasLift: z.boolean(),
  internalStairs: z.number().int().min(0).max(40),
  externalStairs: z.number().int().min(0).max(40),
  parking: z.enum(["on-site", "street", "paid", "restricted", "unknown"]),
  parkingRestrictions: z.string().trim().max(400).optional().default(""),
  carryDistanceMeters: z.number().int().min(0).max(500),
  narrowRoad: z.boolean().default(false),
  loadingBayAvailable: z.boolean().default(false),
  accessRestrictions: z.string().trim().max(600).optional().default(""),
  notes: customerNoteSchema.default(""),
});

export const stopSchema = z.object({
  role: z.enum(["collection", "delivery", "additional-stop"]),
  access: addressAccessSchema,
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
  dimensions: z
    .object({
      lengthCm: z.number().int().positive().max(1000).optional(),
      widthCm: z.number().int().positive().max(1000).optional(),
      heightCm: z.number().int().positive().max(1000).optional(),
      weightKg: z.number().positive().max(5000).optional(),
    })
    .optional(),
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
  phone: z
    .string()
    .trim()
    .regex(/^(\+44|0)7\d{9}$|^(\+44|0)\d{10}$/i, "Enter a valid UK phone number"),
  notes: customerNoteSchema.default(""),
  companyName: z.string().trim().max(140).optional().default(""),
  preferredContactMethod: z.enum(["email", "phone", "sms"]).optional().default("email"),
  marketingConsent: z.boolean(),
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
  promotionCode: z.string().trim().max(40).optional().transform((value) => value ? value.toUpperCase() : undefined),
  sourceChannel: z.string().trim().max(80).optional(),
  utmSource: z.string().trim().max(120).optional(),
  utmMedium: z.string().trim().max(120).optional(),
  utmCampaign: z.string().trim().max(160).optional(),
  referralCode: z.string().trim().max(80).optional(),
});

export const acceptQuoteRequestSchema = z.object({
  quoteReference: quoteReferenceSchema,
  idempotencyKey: z.string().trim().min(8).max(120),
});

export const createQuotePaymentIntentSchema = z.object({
  quoteReference: quoteReferenceSchema,
  idempotencyKey: z.string().trim().min(8).max(120),
});

export const confirmBookingFromQuoteSchema = z.object({
  quoteReference: quoteReferenceSchema,
  paymentIntentId: z.string().trim().min(8).max(120),
  idempotencyKey: z.string().trim().min(8).max(120),
});

export const quotePaymentFailureSchema = z.object({
  quoteReference: quoteReferenceSchema,
  paymentIntentId: z.string().trim().min(8).max(120).optional(),
  message: z.string().trim().max(300).optional(),
});

export const vehicleClassConfigSchema = z.object({
  name: z.string().trim().min(2).max(80),
  isActive: z.boolean(),
  maxUsableVolumeM3: z.number().positive().max(300).nullable(),
  maxPayloadKg: z.number().positive().max(50000).nullable(),
  minCrew: z.number().int().min(1).max(12),
  maxCrew: z.number().int().min(1).max(20),
  baseFeePence: z.number().int().min(0).max(5_000_000).nullable(),
  perMilePence: z.number().int().min(0).max(100_000).nullable(),
  perHourPence: z.number().int().min(0).max(500_000).nullable(),
  loadingEfficiencyFactor: z.number().positive().max(10).nullable(),
  unloadingEfficiencyFactor: z.number().positive().max(10).nullable(),
  fleetCount: z.number().int().min(0).max(500).nullable(),
  manualReviewThresholdM3: z.number().positive().max(300).nullable(),
  manualReviewPayloadKg: z.number().positive().max(50000).nullable(),
}).refine((value) => value.maxCrew >= value.minCrew, {
  message: "Maximum crew must be greater than or equal to minimum crew",
  path: ["maxCrew"],
});

export const pricingSimulatorSchema = createQuoteRequestSchema.extend({
  routeOverride: z
    .object({
      distanceMiles: z.number().finite().min(0).max(2000),
      durationMinutes: z.number().int().min(0).max(5000),
    })
    .optional(),
});

export const promotionCampaignSchema = z.object({
  type: z.enum([
    "STANDARD",
    "GROWTH",
    "AGGRESSIVE",
    "OCCUPANCY_FILL",
    "BACKHAUL",
    "STUDENT_MOVE",
    "SINGLE_ITEM",
    "LAST_MINUTE",
    "RECOVERY",
    "MANUAL_CAMPAIGN",
  ]).default("MANUAL_CAMPAIGN"),
  internalName: z.string().trim().min(2).max(140),
  customerLabel: z.string().trim().min(2).max(120),
  active: z.boolean().default(false),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  percentageReduction: z.number().min(0).max(0.95).optional().nullable(),
  fixedReductionPence: z.number().int().min(0).max(5_000_000).optional().nullable(),
  maximumDiscountPence: z.number().int().min(0).max(5_000_000).optional().nullable(),
  maximumDiscountPercent: z.number().min(0).max(0.95).optional().nullable(),
  hardMinimumPricePence: z.number().int().min(0).max(5_000_000).optional().nullable(),
  hardMinimumContributionPence: z.number().int().min(-5_000_000).max(5_000_000).optional().nullable(),
  hardMinimumMarginPercent: z.number().min(-1).max(1).optional().nullable(),
  allowZeroMargin: z.boolean().default(false),
  allowNegativeMargin: z.boolean().default(false),
  maximumPermittedLossPence: z.number().int().min(0).max(5_000_000).optional().nullable(),
  campaignBudgetPence: z.number().int().min(0).max(100_000_000).optional().nullable(),
  dailyBudgetPence: z.number().int().min(0).max(20_000_000).optional().nullable(),
  maximumRedemptions: z.number().int().min(0).max(1_000_000).optional().nullable(),
  stackable: z.boolean().default(false),
  autoPauseOnBudget: z.boolean().default(true),
  rules: z.record(z.string(), z.unknown()).optional().nullable(),
  reason: z.string().trim().min(3).max(500),
}).refine((value) => value.percentageReduction != null || value.fixedReductionPence != null, {
  message: "Campaign requires a percentage or fixed reduction",
});

export const promotionCodeAdminSchema = z.object({
  code: z.string().trim().min(3).max(40).regex(/^[A-Z0-9_-]+$/i),
  internalName: z.string().trim().min(2).max(140),
  customerLabel: z.string().trim().min(2).max(120),
  active: z.boolean().default(false),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.number().int().min(0).max(5_000_000),
  maximumDiscountPence: z.number().int().min(0).max(5_000_000).optional().nullable(),
  minimumSubtotalPence: z.number().int().min(0).max(10_000_000).optional().nullable(),
  maximumSubtotalPence: z.number().int().min(0).max(10_000_000).optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  maximumRedemptions: z.number().int().min(0).max(1_000_000).optional().nullable(),
  maximumRedemptionsPerCustomer: z.number().int().min(0).max(1000).optional().nullable(),
  applicableMoveTypes: z.array(z.string().trim().max(80)).default([]),
  applicableRegions: z.array(z.string().trim().max(80)).default([]),
  applicableWeekdays: z.array(z.number().int().min(0).max(6)).default([]),
  applicableVehicleClasses: z.array(z.string().trim().max(120)).default([]),
  firstBookingOnly: z.boolean().default(false),
  stackable: z.boolean().default(false),
  campaignId: z.string().trim().min(1).optional().nullable(),
  reason: z.string().trim().min(3).max(500),
});

export const competitorBenchmarkAdminSchema = z.object({
  region: z.string().trim().min(2).max(100),
  moveType: moveTypeSchema,
  propertySize: z.string().trim().min(2).max(160),
  serviceLevel: z.string().trim().min(2).max(80),
  packingIncluded: z.boolean().default(false),
  distanceBandMinMiles: z.number().finite().min(0).max(2000),
  distanceBandMaxMiles: z.number().finite().min(0).max(2000).optional().nullable(),
  benchmarkPricePence: z.number().int().positive().max(10_000_000),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional().nullable(),
  sourceNote: z.string().trim().min(3).max(500),
  active: z.boolean().default(false),
  reason: z.string().trim().min(3).max(500),
}).refine((value) => (
  value.distanceBandMaxMiles == null ||
  value.distanceBandMaxMiles >= value.distanceBandMinMiles
), {
  message: "Maximum distance must be greater than or equal to minimum distance",
  path: ["distanceBandMaxMiles"],
}).refine((value) => (
  value.effectiveTo == null ||
  new Date(value.effectiveTo).getTime() > new Date(value.effectiveFrom).getTime()
), {
  message: "Effective end must be after effective start",
  path: ["effectiveTo"],
});

export const beatCompetitorCampaignSchema = z.object({
  enabled: z.boolean().default(false),
  internalName: z.string().trim().min(2).max(140),
  competitorLabel: z.string().trim().min(2).max(140),
  applicableRegions: z.array(z.string().trim().min(1).max(100)).default([]),
  applicableMoveTypes: z.array(moveTypeSchema).default([]),
  applicablePropertySizes: z.array(moveSizeSchema).default([]),
  beatPercentage: z.number().min(0).max(0.5).default(0),
  beatFixedAmountPence: z.number().int().min(0).max(5_000_000).optional().nullable(),
  minimumPricePence: z.number().int().min(0).max(10_000_000).optional().nullable(),
  minimumContributionPence: z.number().int().min(-5_000_000).max(5_000_000).optional().nullable(),
  minimumMarginPercent: z.number().min(-1).max(1).optional().nullable(),
  maximumDiscountPence: z.number().int().positive().max(5_000_000).optional().nullable(),
  allowZeroMargin: z.boolean().default(false),
  allowNegativeMargin: z.boolean().default(false),
  maximumPermittedLossPence: z.number().int().min(0).max(5_000_000).optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  dailyBookingLimit: z.number().int().positive().max(100_000).optional().nullable(),
  totalCampaignBookingLimit: z.number().int().positive().max(1_000_000).optional().nullable(),
  autoPause: z.boolean().default(true),
  reason: z.string().trim().min(3).max(500),
}).refine((value) => value.beatPercentage > 0 || (value.beatFixedAmountPence ?? 0) > 0, {
  message: "Beat competitor mode requires a percentage or fixed beat amount",
}).refine((value) => (
  value.endsAt == null ||
  value.startsAt == null ||
  new Date(value.endsAt).getTime() > new Date(value.startsAt).getTime()
), {
  message: "Campaign end must be after campaign start",
  path: ["endsAt"],
}).refine((value) => (
  !value.enabled ||
  !value.allowNegativeMargin ||
  (value.maximumPermittedLossPence != null && value.minimumPricePence != null)
), {
  message: "Enabled negative-margin beat mode requires maximum permitted loss and minimum price",
  path: ["maximumPermittedLossPence"],
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
export type VehicleClassConfigInput = z.infer<typeof vehicleClassConfigSchema>;
export type PricingSimulatorInput = z.infer<typeof pricingSimulatorSchema>;
export type PromotionCampaignInput = z.infer<typeof promotionCampaignSchema>;
export type PromotionCodeAdminInput = z.infer<typeof promotionCodeAdminSchema>;
export type CompetitorBenchmarkAdminInput = z.infer<typeof competitorBenchmarkAdminSchema>;
export type BeatCompetitorCampaignInput = z.infer<typeof beatCompetitorCampaignSchema>;

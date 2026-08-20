import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { requireAdminMobile } from "@/lib/admin-mobile-auth";
import { db } from "@/lib/db";
import {
  calculateRemovalQuote,
  normaliseQuoteInputForPricing,
} from "@/lib/pricing/domain";
import { getCompetitorPricingContext } from "@/lib/pricing/competitor-repository";
import { getPromotionPricingContext } from "@/lib/pricing/promotion-repository";
import { getActivePricingVersion } from "@/lib/pricing/version-repository";
import { calculateServerRoute } from "@/lib/routing/mapbox";
import { resolveInventoryForQuote } from "@/lib/quotes/service";
import type {
  AddressAccessInput,
  AdditionalServicesInput,
  CreateQuoteRequest,
} from "@/lib/quotes/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type JsonRecord = Record<string, unknown>;

const updateAddressSchema = z.object({
  fullAddress: z.string().trim().min(3).max(260).optional(),
  postcode: z.string().trim().max(12).optional(),
  lat: z.number().finite().min(49).max(62).nullable().optional(),
  lng: z.number().finite().min(-9.5).max(2.5).nullable().optional(),
  propertyType: z.string().trim().min(1).max(80).optional(),
  floor: z.number().int().min(0).max(30).optional(),
  hasLift: z.boolean().optional(),
});

const updateBookingSchema = z.object({
  customer: z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      email: z.string().trim().email().max(160).optional(),
      phone: z.string().trim().min(7).max(30).optional(),
    })
    .optional(),
  pickup: updateAddressSchema.optional(),
  dropoff: updateAddressSchema.optional(),
  moveType: z.string().trim().max(80).optional(),
  moveSize: z.string().trim().max(80).optional(),
  scheduledDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  scheduledTime: z.string().trim().min(2).max(40).optional(),
  arrivalWindow: z.enum(["morning", "afternoon", "evening"]).optional(),
  peopleNeeded: z.number().int().min(1).max(12).optional(),
  notes: z.string().trim().max(1200).optional(),
  services: z
    .object({
      packing: z.boolean().optional(),
      packingMaterials: z.boolean().optional(),
      dismantlingItems: z.number().int().min(0).max(99).optional(),
      reassemblyItems: z.number().int().min(0).max(99).optional(),
    })
    .optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().trim().min(1),
        quantity: z.number().int().min(1).max(99),
        room: z.string().trim().min(1).max(40).optional(),
      }),
    )
    .max(300)
    .optional(),
});

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function intValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : fallback;
}

function stopAccess(normalised: unknown, role: string): JsonRecord {
  const stops = asArray(asRecord(normalised).stops);
  const stop = stops.find((entry) => asRecord(entry).role === role);
  return asRecord(asRecord(stop).access);
}

function servicesFromQuote(normalised: unknown, selectedServices: unknown): JsonRecord {
  return {
    ...asRecord(asRecord(normalised).services),
    ...asRecord(selectedServices),
  };
}

function propertyToMoveSize(propertyType: string | null, fallback?: string | null): CreateQuoteRequest["moveSize"] {
  const value = (propertyType ?? fallback ?? "").toLowerCase();
  if (value.includes("studio")) return "studio";
  if (value.includes("1")) return "1-bedroom";
  if (value.includes("2")) return "2-bedrooms";
  if (value.includes("3")) return "3-bedrooms";
  if (value.includes("4")) return "4-bedrooms";
  if (value.includes("5")) return "5-plus-bedrooms";
  if (fallback === "office") return "office";
  return "2-bedrooms";
}

function moveTypeFromProperty(propertyType: string | null, fallback?: string | null): CreateQuoteRequest["moveType"] {
  const value = (propertyType ?? "").toLowerCase();
  if (value.includes("flat") || value.includes("studio")) return "flat-move";
  const allowed = [
    "house-move",
    "flat-move",
    "office-move",
    "student-move",
    "single-item-delivery",
    "furniture-delivery",
    "marketplace-collection",
    "piano-move",
    "other",
  ] as const;
  return allowed.includes(fallback as (typeof allowed)[number])
    ? (fallback as CreateQuoteRequest["moveType"])
    : "house-move";
}

function timeToWindow(time?: string | null): "morning" | "afternoon" | "evening" {
  if (!time) return "morning";
  if (/evening|17|18|19|20/i.test(time)) return "evening";
  if (/afternoon|12|13|14|15|16/i.test(time)) return "afternoon";
  return "morning";
}

function normaliseArrivalWindow(value: string | null | undefined): "morning" | "afternoon" | "evening" {
  return value === "afternoon" || value === "evening" ? value : "morning";
}

function dateInput(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? new Date().toISOString().slice(0, 10)
    : date.toISOString().slice(0, 10);
}

function parseBookingDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12, 0, 0);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function moneyFromPence(pence: number): number {
  return Math.round(pence) / 100;
}

function serviceNameFromMoveType(moveType: string): string {
  return moveType
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function accessInput(params: {
  currentAddress: string;
  currentPostcode: string;
  currentLat: number | null;
  currentLng: number | null;
  currentFloor: number;
  currentHasLift: boolean;
  previous: JsonRecord;
  patch?: z.infer<typeof updateAddressSchema>;
  fallbackPropertyType: string;
}): AddressAccessInput {
  const lat = params.patch?.lat ?? params.currentLat ?? numberValue(params.previous.lat) ?? 55.8642;
  const lng = params.patch?.lng ?? params.currentLng ?? numberValue(params.previous.lng) ?? -4.2518;
  return {
    fullAddress:
      params.patch?.fullAddress ??
      stringValue(params.previous.fullAddress) ??
      params.currentAddress,
    postcode:
      params.patch?.postcode ??
      stringValue(params.previous.postcode) ??
      params.currentPostcode,
    lat,
    lng,
    city: stringValue(params.previous.city) ?? "",
    region: stringValue(params.previous.region) ?? "",
    country: stringValue(params.previous.country) ?? "",
    propertyType:
      params.patch?.propertyType ??
      stringValue(params.previous.propertyType) ??
      params.fallbackPropertyType,
    floor: params.patch?.floor ?? intValue(params.previous.floor, params.currentFloor),
    hasLift: params.patch?.hasLift ?? booleanValue(params.previous.hasLift, params.currentHasLift),
    internalStairs: intValue(params.previous.internalStairs, 0),
    externalStairs: intValue(params.previous.externalStairs, 0),
    parking:
      stringValue(params.previous.parking) === "on-site" ||
      stringValue(params.previous.parking) === "street" ||
      stringValue(params.previous.parking) === "paid" ||
      stringValue(params.previous.parking) === "restricted"
        ? (stringValue(params.previous.parking) as AddressAccessInput["parking"])
        : "unknown",
    parkingRestrictions: stringValue(params.previous.parkingRestrictions) ?? "",
    carryDistanceMeters: intValue(params.previous.carryDistanceMeters, 0),
    narrowRoad: booleanValue(params.previous.narrowRoad),
    loadingBayAvailable: booleanValue(params.previous.loadingBayAvailable),
    accessRestrictions: stringValue(params.previous.accessRestrictions) ?? "",
    notes: stringValue(params.previous.notes) ?? "",
  };
}

function itemInput(
  bodyItems: z.infer<typeof updateBookingSchema>["items"],
  normalised: unknown,
  bookingItems: Array<{ itemId: string; quantity: number }>,
): CreateQuoteRequest["inventory"] {
  if (bodyItems) {
    return bodyItems.map((item) => ({
      itemId: item.itemId,
      quantity: item.quantity,
      room: (item.room ?? "other") as CreateQuoteRequest["inventory"][number]["room"],
    }));
  }

  const stored = asArray(asRecord(normalised).inventory)
    .map((entry) => asRecord(entry))
    .filter((entry) => stringValue(entry.itemId))
    .map((entry) => ({
      itemId: stringValue(entry.itemId) ?? "",
      quantity: Math.max(1, intValue(entry.quantity, 1)),
      room: (stringValue(entry.room) ?? "other") as CreateQuoteRequest["inventory"][number]["room"],
    }));

  if (stored.length > 0) return stored;
  return bookingItems.map((item) => ({
    itemId: item.itemId,
    quantity: item.quantity,
    room: "other",
  }));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdminMobile(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true, email: true, phone: true, createdAt: true } },
      quote: {
        select: {
          normalisedInput: true,
          selectedServices: true,
          crewRecommendation: true,
          customerBreakdown: true,
          moveType: true,
          moveSize: true,
          arrivalWindow: true,
          moveDate: true,
        },
      },
      driver: { include: { user: { select: { name: true, email: true, phone: true } } } },
      bookingItems: {
        include: { item: { include: { category: { select: { name: true } } } } },
      },
      payments: { orderBy: { createdAt: "desc" } },
      statusHistory: { orderBy: { timestamp: "desc" }, take: 30 },
      trackingEvents: { orderBy: { timestamp: "desc" }, take: 40 },
    },
  });

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const normalised = booking.quote?.normalisedInput;
  const collectionAccess = stopAccess(normalised, "collection");
  const deliveryAccess = stopAccess(normalised, "delivery");
  const selectedServices = servicesFromQuote(normalised, booking.quote?.selectedServices);
  const crew = asRecord(booking.quote?.crewRecommendation);
  const itemCount = booking.bookingItems.reduce((sum, entry) => sum + entry.quantity, 0);
  const peopleNeeded = numberValue(crew.movers) ?? booking.helpersCount + 1;
  const dismantlingItems = intValue(selectedServices.dismantlingItems, booking.needsAssembly ? 1 : 0);
  const reassemblyItems = intValue(selectedServices.reassemblyItems, booking.needsAssembly ? 1 : 0);
  const packingMaterials = booleanValue(selectedServices.packingMaterials, booking.needsPacking);
  const fullPacking = booleanValue(selectedServices.packing, false);

  return NextResponse.json({
    booking: {
      id: booking.id,
      reference: booking.reference,
      customer: {
        ...booking.customer,
        createdAt: booking.customer.createdAt.toISOString(),
      },
      serviceName: booking.serviceName,
      serviceVariant: booking.serviceVariant,
      moveType: booking.quote?.moveType ?? booking.serviceSlug,
      moveSize: booking.quote?.moveSize ?? propertyToMoveSize(stringValue(collectionAccess.propertyType)),
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      pickupAddress: booking.pickupAddress,
      pickupPostcode: booking.pickupPostcode,
      pickupLat: booking.pickupLat,
      pickupLng: booking.pickupLng,
      pickupPropertyType:
        stringValue(collectionAccess.propertyType) ?? booking.serviceVariant ?? "2 Bedroom House",
      pickupFloor: booking.pickupFloor,
      pickupHasLift: booking.pickupHasLift,
      dropoffAddress: booking.dropoffAddress,
      dropoffPostcode: booking.dropoffPostcode,
      dropoffLat: booking.dropoffLat,
      dropoffLng: booking.dropoffLng,
      dropoffPropertyType:
        stringValue(deliveryAccess.propertyType) ??
        stringValue(collectionAccess.propertyType) ??
        "2 Bedroom House",
      dropoffFloor: booking.dropoffFloor,
      dropoffHasLift: booking.dropoffHasLift,
      distanceMiles: booking.distanceMiles,
      scheduledDate: booking.scheduledDate.toISOString(),
      scheduledTime: booking.scheduledTime,
      estimatedHours: booking.estimatedHours,
      basePrice: booking.basePrice,
      quotedPrice: booking.quotedPrice,
      finalPrice: booking.finalPrice,
      totalPaid: booking.totalPaid,
      isPaid: booking.isPaid,
      helpersCount: booking.helpersCount,
      peopleNeeded,
      needsPacking: booking.needsPacking,
      needsAssembly: booking.needsAssembly,
      packingType: fullPacking ? "full" : packingMaterials ? "materials" : "none",
      dismantlingItems,
      reassemblyItems,
      selectedServices,
      notes: booking.notes,
      items: booking.items,
      itemCount,
      driver: booking.driver
        ? {
            id: booking.driver.id,
            name: booking.driver.user.name ?? "Driver",
            email: booking.driver.user.email,
            phone: booking.driver.user.phone,
            vehicleType: booking.driver.vehicleType,
            licensePlate: booking.driver.licensePlate,
          }
        : null,
      bookingItems: booking.bookingItems.map((entry) => ({
        id: entry.id,
        quantity: entry.quantity,
        item: {
          id: entry.item.id,
          name: entry.item.name,
          category: entry.item.category.name,
          weight: entry.item.weight,
          size: entry.item.size,
        },
      })),
      payments: booking.payments.map((payment) => ({
        id: payment.id,
        stripeId: payment.stripeId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        refundAmount: payment.refundAmount,
        createdAt: payment.createdAt.toISOString(),
      })),
      history: booking.statusHistory.map((history) => ({
        id: history.id,
        fromStatus: history.fromStatus,
        toStatus: history.toStatus,
        changedByRole: history.changedByRole,
        note: history.note,
        timestamp: history.timestamp.toISOString(),
      })),
      trackingEvents: booking.trackingEvents.map((event) => ({
        id: event.id,
        type: event.type,
        title: event.title,
        description: event.description,
        isPublic: event.isPublic,
        timestamp: event.timestamp.toISOString(),
      })),
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdminMobile(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = updateBookingSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid booking update", issues: parsed.error.issues.map((issue) => issue.message) },
      { status: 400 },
    );
  }

  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      quote: {
        select: {
          id: true,
          normalisedInput: true,
          selectedServices: true,
          routeMetrics: true,
          inventorySnapshot: true,
          accessDetails: true,
          customerBreakdown: true,
          moveType: true,
          moveSize: true,
          arrivalWindow: true,
          moveDate: true,
          sourceChannel: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          referralCode: true,
        },
      },
      bookingItems: { select: { itemId: true, quantity: true } },
    },
  });

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const body = parsed.data;
  const normalised = booking.quote?.normalisedInput;
  const collectionAccess = stopAccess(normalised, "collection");
  const deliveryAccess = stopAccess(normalised, "delivery");
  const currentServices = servicesFromQuote(normalised, booking.quote?.selectedServices);

  const pickup = accessInput({
    currentAddress: booking.pickupAddress,
    currentPostcode: booking.pickupPostcode,
    currentLat: booking.pickupLat,
    currentLng: booking.pickupLng,
    currentFloor: booking.pickupFloor,
    currentHasLift: booking.pickupHasLift,
    previous: collectionAccess,
    patch: body.pickup,
    fallbackPropertyType: "2 Bedroom House",
  });
  const dropoff = accessInput({
    currentAddress: booking.dropoffAddress,
    currentPostcode: booking.dropoffPostcode,
    currentLat: booking.dropoffLat,
    currentLng: booking.dropoffLng,
    currentFloor: booking.dropoffFloor,
    currentHasLift: booking.dropoffHasLift,
    previous: deliveryAccess,
    patch: body.dropoff,
    fallbackPropertyType: pickup.propertyType,
  });

  const moveType = moveTypeFromProperty(
    pickup.propertyType,
    body.moveType ?? booking.quote?.moveType ?? booking.serviceSlug,
  );
  const moveSize = (body.moveSize as CreateQuoteRequest["moveSize"] | undefined) ??
    propertyToMoveSize(pickup.propertyType, booking.quote?.moveSize);
  const scheduledDateInput = body.scheduledDate ?? dateInput(booking.scheduledDate);
  const scheduledTime = body.scheduledTime ?? booking.scheduledTime;
  const arrivalWindow = normaliseArrivalWindow(
    body.arrivalWindow ?? booking.quote?.arrivalWindow ?? timeToWindow(scheduledTime),
  );
  const peopleNeeded = body.peopleNeeded ?? booking.helpersCount + 1;

  const dismantlingItems =
    body.services?.dismantlingItems ?? intValue(currentServices.dismantlingItems, booking.needsAssembly ? 1 : 0);
  const reassemblyItems =
    body.services?.reassemblyItems ?? intValue(currentServices.reassemblyItems, booking.needsAssembly ? 1 : 0);
  const packing = body.services?.packing ?? booleanValue(currentServices.packing, false);
  const packingMaterials =
    body.services?.packingMaterials ?? booleanValue(currentServices.packingMaterials, booking.needsPacking);

  const services = {
    unpacking: booleanValue(currentServices.unpacking, false),
    furnitureProtection: booleanValue(currentServices.furnitureProtection, false),
    mattressProtection: booleanValue(currentServices.mattressProtection, false),
    tvProtection: booleanValue(currentServices.tvProtection, false),
    wasteDisposal: booleanValue(currentServices.wasteDisposal, false),
    additionalMover: booleanValue(currentServices.additionalMover, false),
    waitingTime: booleanValue(currentServices.waitingTime, false),
    heavyItemHandling: booleanValue(currentServices.heavyItemHandling, false),
    pianoHandling: booleanValue(currentServices.pianoHandling, false),
    ...currentServices,
    packing,
    packingMaterials: packing || packingMaterials,
    dismantling: dismantlingItems > 0,
    reassembly: reassemblyItems > 0,
    dismantlingItems,
    reassemblyItems,
  } as unknown as AdditionalServicesInput & Record<string, unknown>;

  const inventory = itemInput(body.items, normalised, booking.bookingItems);
  const customerName = body.customer?.name ?? booking.customer.name ?? "Customer";
  const customerEmail = body.customer?.email ?? booking.customer.email ?? "customer@example.com";
  const customerPhone = body.customer?.phone ?? booking.customer.phone ?? "07123456789";
  const notes = body.notes ?? booking.notes ?? "";

  const input: CreateQuoteRequest = {
    moveType,
    moveSize,
    collection: pickup,
    delivery: dropoff,
    additionalStop: null,
    moveDate: scheduledDateInput,
    earliestDate: null,
    latestDate: null,
    arrivalWindow,
    flexibleDate: false,
    flexibleTime: false,
    exactTime: false,
    sameDay: scheduledDateInput === dateInput(new Date()),
    urgent: false,
    preferredMovers: peopleNeeded,
    inventory,
    customItems: [],
    services,
    customer: {
      fullName: customerName,
      email: customerEmail,
      phone: customerPhone,
      notes,
      companyName: "",
      preferredContactMethod: "phone",
      marketingConsent: false,
      bookingConsentAccepted: true,
      termsAccepted: true,
    },
    promotionCode: undefined,
    sourceChannel: "admin-mobile-edit",
    utmSource: booking.quote?.utmSource ?? undefined,
    utmMedium: booking.quote?.utmMedium ?? undefined,
    utmCampaign: booking.quote?.utmCampaign ?? undefined,
    referralCode: booking.quote?.referralCode ?? undefined,
  };

  const pricingVersion = await getActivePricingVersion();
  const now = new Date();
  const inventoryResult = await resolveInventoryForQuote(input);
  const pricingInput = normaliseQuoteInputForPricing(input, inventoryResult.items);
  const routeResult = await calculateServerRoute([pickup, dropoff]);
  const promotion = await getPromotionPricingContext(pricingInput);
  if (pricingVersion?.settings) {
    const minimumContribution = pricingVersion.settings.minimum_contribution;
    const minimumMargin =
      pricingVersion.settings.minimum_margin_percent ??
      pricingVersion.settings.manual_review_min_margin_percent;
    promotion.context.minimumContributionPence =
      typeof minimumContribution === "number" && Number.isFinite(minimumContribution)
        ? Math.round(minimumContribution * 100)
        : 0;
    promotion.context.minimumMarginPercent =
      typeof minimumMargin === "number" && Number.isFinite(minimumMargin)
        ? minimumMargin
        : null;
    promotion.context.allowZeroMargin = pricingVersion.settings.allow_zero_margin === 1;
    promotion.context.allowNegativeMargin = pricingVersion.settings.allow_negative_margin === 1;
  }
  const competitor = await getCompetitorPricingContext(
    pricingInput,
    routeResult.route?.distanceMiles ?? null,
    inventoryResult.items,
  );
  const calculated = calculateRemovalQuote({
    input: pricingInput,
    inventory: inventoryResult.items,
    route: routeResult.route,
    pricingVersion,
    promotionContext: promotion.context,
    competitorContext: competitor,
    now,
    quoteExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
  });
  const manualReviewReasons = Array.from(new Set([
    ...inventoryResult.reasons,
    ...routeResult.reasons,
    ...calculated.manualReviewReasons,
  ]));
  if (manualReviewReasons.length > 0 || calculated.status !== "FIXED" || calculated.finalTotalPence == null) {
    return NextResponse.json({
      error: "MANUAL_REVIEW_REQUIRED",
      manualReviewReasons,
    }, { status: 422 });
  }
  const route = routeResult.route!;
  const finalPricePence = calculated.finalTotalPence;
  const finalPrice = moneyFromPence(finalPricePence);
  const baseLine = calculated.customerBreakdown.find((line) => line.key === "base_service_charge");
  const normalisedInput = {
    moveType: pricingInput.moveType,
    moveSize: pricingInput.moveSize,
    moveDate: pricingInput.moveDate,
    earliestDate: null,
    latestDate: null,
    arrivalWindow,
    flexibleDate: false,
    flexibleTime: false,
    exactTime: false,
    sameDay: pricingInput.sameDay,
    urgent: false,
    stops: [
      { role: "collection", access: pickup },
      { role: "delivery", access: dropoff },
    ],
    inventory: pricingInput.inventory,
    customItems: [],
    services,
    customerNote: notes,
    sourceChannel: "admin-mobile-edit",
  };

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: booking.customerId },
      data: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
      },
    });

    await tx.booking.update({
      where: { id },
      data: {
        serviceSlug: pricingInput.moveType,
        serviceName: serviceNameFromMoveType(pricingInput.moveType),
        pickupAddress: pickup.fullAddress,
        pickupPostcode: pickup.postcode,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        pickupFloor: pickup.floor,
        pickupHasLift: pickup.hasLift,
        dropoffAddress: dropoff.fullAddress,
        dropoffPostcode: dropoff.postcode,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        dropoffFloor: dropoff.floor,
        dropoffHasLift: dropoff.hasLift,
        distanceMiles: route.distanceMiles,
        scheduledDate: parseBookingDate(scheduledDateInput),
        scheduledTime,
        estimatedHours: calculated.crewRecommendation.totalJobMinutes / 60,
        basePrice: baseLine ? moneyFromPence(baseLine.amountPence) : finalPrice,
        quotedPrice: finalPrice,
        finalPrice,
        helpersCount: Math.max(0, calculated.crewRecommendation.movers - 1),
        needsPacking: Boolean(services.packing || services.packingMaterials),
        needsAssembly: dismantlingItems + reassemblyItems > 0,
        notes: notes || null,
        items: pricingInput.inventory.map((item) => ({
          id: item.itemId,
          qty: item.quantity,
          room: item.room,
        })) as unknown as Prisma.InputJsonValue,
      },
    });

    await tx.bookingItem.deleteMany({ where: { bookingId: id } });
    if (pricingInput.inventory.length > 0) {
      await tx.bookingItem.createMany({
        data: pricingInput.inventory.map((item) => ({
          bookingId: id,
          itemId: item.itemId,
          quantity: item.quantity,
        })),
        skipDuplicates: true,
      });
    }

    if (booking.quoteId) {
      await tx.quote.update({
        where: { id: booking.quoteId },
        data: {
          pricingVersionId: pricingVersion?.id ?? null,
          moveType: pricingInput.moveType,
          moveSize: pricingInput.moveSize ?? null,
          moveDate: parseBookingDate(scheduledDateInput),
          arrivalWindow,
          customerName,
          customerEmail,
          customerPhone,
          normalisedInput: normalisedInput as unknown as Prisma.InputJsonValue,
          routeMetrics: route as unknown as Prisma.InputJsonValue,
          inventorySnapshot: calculated.inventoryMetrics as unknown as Prisma.InputJsonValue,
          accessDetails: {
            collection: pickup,
            delivery: dropoff,
            additionalStop: null,
            customerNote: notes,
          } as unknown as Prisma.InputJsonValue,
          selectedServices: services as unknown as Prisma.InputJsonValue,
          vehicleRecommendation: calculated.vehicleRecommendation as unknown as Prisma.InputJsonValue,
          crewRecommendation: calculated.crewRecommendation as unknown as Prisma.InputJsonValue,
          estimatedDurationMinutes: calculated.crewRecommendation.totalJobMinutes,
          customerBreakdown: calculated.customerBreakdown as unknown as Prisma.InputJsonValue,
          internalBreakdown: {
            lines: calculated.internalBreakdown,
            summary: calculated.internalSummary,
          } as unknown as Prisma.InputJsonValue,
          preDiscountTotalPence: calculated.internalSummary.preDiscountTotalPence,
          originalTotalPence: calculated.customerSummary.originalTotalPence,
          discountTotalPence: calculated.customerSummary.discountTotalPence,
          roundingAdjustmentPence: calculated.internalSummary.roundingAdjustmentPence,
          finalTotalPence: finalPricePence,
          contributionPence: calculated.internalSummary.contributionPence,
          grossMarginPercentage: calculated.internalSummary.grossMarginPercentage,
          manualReviewReasons,
        },
      });
    }

    await tx.bookingStatusHistory.create({
      data: {
        bookingId: id,
        fromStatus: booking.status,
        toStatus: booking.status,
        changedBy: user.id,
        changedByRole: "ADMIN",
        note: `Booking edited in mobile admin. Price recalculated to £${finalPrice.toFixed(2)}.`,
      },
    });
  });

  return NextResponse.json({
    ok: true,
    quotedPrice: finalPrice,
    finalPrice,
    peopleNeeded: calculated.crewRecommendation.movers,
    itemCount: pricingInput.inventory.reduce((sum, item) => sum + item.quantity, 0),
    manualReviewReasons,
  });
}

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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

type JsonRecord = Record<string, unknown>;

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function stopAccess(normalised: unknown, role: string): AddressAccessInput | null {
  const stops = asArray(asRecord(normalised).stops);
  const stop = stops.find((entry) => asRecord(entry).role === role);
  const access = asRecord(asRecord(stop).access);
  if (!stringValue(access.fullAddress) || !stringValue(access.postcode)) return null;
  if (typeof access.lat !== "number" || typeof access.lng !== "number") return null;
  return access as unknown as AddressAccessInput;
}

function parseInventory(normalised: unknown): CreateQuoteRequest["inventory"] {
  return asArray(asRecord(normalised).inventory).flatMap((entry) => {
    const item = asRecord(entry);
    const itemId = stringValue(item.itemId);
    const quantity = typeof item.quantity === "number" ? Math.max(1, Math.floor(item.quantity)) : 1;
    const room = stringValue(item.room) ?? "other";
    return itemId ? [{ itemId, quantity, room: room as CreateQuoteRequest["inventory"][number]["room"] }] : [];
  });
}

function parseDate(value: unknown): string | null {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

function quoteInputFromStoredQuote(params: {
  quote: {
    normalisedInput: unknown;
    selectedServices: unknown;
    moveType: string;
    moveSize: string | null;
    moveDate: Date | null;
    arrivalWindow: string | null;
    customerName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    sourceChannel: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    referralCode: string | null;
  };
  body: {
    scheduledDate?: string;
    needsPacking?: boolean;
    needsAssembly?: boolean;
  };
}): CreateQuoteRequest | null {
  const normalised = asRecord(params.quote.normalisedInput);
  const collection = stopAccess(normalised, "collection");
  const delivery = stopAccess(normalised, "delivery");
  const additionalStop = stopAccess(normalised, "additional-stop");
  if (!collection || !delivery) return null;

  const services = {
    ...asRecord(normalised.services),
    ...asRecord(params.quote.selectedServices),
  } as AdditionalServicesInput & Record<string, unknown>;
  if (params.body.needsPacking != null) {
    services.packing = params.body.needsPacking;
    services.packingMaterials = params.body.needsPacking;
  }
  if (params.body.needsAssembly != null) {
    services.dismantling = params.body.needsAssembly;
    services.reassembly = params.body.needsAssembly;
  }

  const moveDate =
    params.body.scheduledDate ??
    parseDate(normalised.moveDate) ??
    params.quote.moveDate?.toISOString().slice(0, 10) ??
    new Date().toISOString().slice(0, 10);

  return {
    moveType: params.quote.moveType as CreateQuoteRequest["moveType"],
    moveSize: (params.quote.moveSize ?? normalised.moveSize) as CreateQuoteRequest["moveSize"],
    collection,
    delivery,
    additionalStop,
    moveDate,
    earliestDate: null,
    latestDate: null,
    arrivalWindow: (
      params.quote.arrivalWindow === "afternoon" || params.quote.arrivalWindow === "evening"
        ? params.quote.arrivalWindow
        : "morning"
    ),
    flexibleDate: booleanValue(normalised.flexibleDate),
    flexibleTime: booleanValue(normalised.flexibleTime),
    exactTime: booleanValue(normalised.exactTime),
    sameDay: moveDate === new Date().toISOString().slice(0, 10),
    urgent: booleanValue(normalised.urgent),
    inventory: parseInventory(normalised),
    customItems: [],
    services,
    customer: {
      fullName: params.quote.customerName ?? "Customer",
      email: params.quote.customerEmail ?? "customer@example.com",
      phone: params.quote.customerPhone ?? "07123456789",
      notes: stringValue(normalised.customerNote) ?? "",
      companyName: "",
      preferredContactMethod: "email",
      marketingConsent: false,
      bookingConsentAccepted: true,
      termsAccepted: true,
    },
    promotionCode: undefined,
    sourceChannel: params.quote.sourceChannel ?? "admin-recalculate",
    utmSource: params.quote.utmSource ?? undefined,
    utmMedium: params.quote.utmMedium ?? undefined,
    utmCampaign: params.quote.utmCampaign ?? undefined,
    referralCode: params.quote.referralCode ?? undefined,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const booking = await db.booking.findUnique({
    where: { id },
    include: { quote: true },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!booking.quote) {
    return NextResponse.json({
      newPrice: null,
      originalPrice: booking.quotedPrice,
      totalPaid: booking.totalPaid,
      manualReviewReasons: [
        "MANUAL_REVIEW_REQUIRED: Booking has no canonical quote snapshot to recalculate from",
      ],
    }, { status: 422 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    scheduledDate?: string;
    needsPacking?: boolean;
    needsAssembly?: boolean;
  };
  const input = quoteInputFromStoredQuote({ quote: booking.quote, body });
  if (!input) {
    return NextResponse.json({
      newPrice: null,
      originalPrice: booking.quotedPrice,
      totalPaid: booking.totalPaid,
      manualReviewReasons: [
        "MANUAL_REVIEW_REQUIRED: Stored quote inputs are incomplete",
      ],
    }, { status: 422 });
  }

  const pricingVersion = await getActivePricingVersion();
  const addresses = [
    input.collection,
    ...(input.additionalStop ? [input.additionalStop] : []),
    input.delivery,
  ];
  const [inventoryResult, routeResult] = await Promise.all([
    resolveInventoryForQuote(input),
    calculateServerRoute(addresses),
  ]);
  const pricingInput = normaliseQuoteInputForPricing(input, inventoryResult.items);
  const [promotion, competitor] = await Promise.all([
    getPromotionPricingContext(pricingInput),
    getCompetitorPricingContext(pricingInput, routeResult.route?.distanceMiles ?? null, inventoryResult.items),
  ]);
  const result = calculateRemovalQuote({
    input: pricingInput,
    inventory: inventoryResult.items,
    route: routeResult.route,
    pricingVersion,
    promotionContext: promotion.context,
    competitorContext: competitor,
    now: new Date(),
    quoteExpiresAt: booking.quote.expiresAt,
  });
  const manualReviewReasons = Array.from(new Set([
    ...inventoryResult.reasons,
    ...routeResult.reasons,
    ...result.manualReviewReasons,
  ]));
  const fixedTotalPence =
    manualReviewReasons.length === 0 && result.status === "FIXED" && result.finalTotalPence != null
      ? result.finalTotalPence
      : null;

  return NextResponse.json({
    newPrice: fixedTotalPence != null ? fixedTotalPence / 100 : null,
    originalPrice: booking.quotedPrice,
    totalPaid: booking.totalPaid,
    manualReviewReasons,
    breakdown: {
      classification: competitor.selection.classificationKind,
      benchmarkId: competitor.benchmark?.id ?? null,
      benchmarkPricePence: competitor.benchmark?.benchmarkPricePence ?? null,
      customerBreakdown: fixedTotalPence != null ? result.customerBreakdown : [],
      internalSummary: result.internalSummary,
    },
  }, { status: fixedTotalPence != null ? 200 : 422 });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireDriver, forbidden } from "@/lib/driver-auth";

/**
 * Canonical driver stage exposed to the native driver app. Derived from the
 * existing BookingStatus plus the driver progress milestones already recorded
 * as public TrackingEvents — this does NOT introduce a new status system, it
 * only normalizes existing data so the app can gate its action buttons.
 */
type DriverStage =
  | "assigned"
  | "accepted"
  | "en_route"
  | "arrived"
  | "completed"
  | "cancelled";

type JsonRecord = Record<string, unknown>;

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

function propertyToMoveSize(propertyType: string | null, fallback?: string | null): string {
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

/**
 * GET /api/driver/my-jobs
 * Returns all bookings assigned to this driver, grouped by status. Each job
 * carries a computed `stage` so the driver app can drive its state machine
 * from a single server-side source of truth.
 */
export async function GET() {
  const driver = await requireDriver();
  if (!driver) return forbidden();

  const bookings = await db.booking.findMany({
    where: {
      driverId: driver.id,
      status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] },
    },
    orderBy: { scheduledDate: "desc" },
    include: {
      customer: { select: { name: true, phone: true } },
      quote: {
        select: {
          normalisedInput: true,
          selectedServices: true,
          crewRecommendation: true,
          moveType: true,
          moveSize: true,
        },
      },
      bookingItems: {
        include: {
          item: { include: { category: { select: { name: true } } } },
        },
      },
      conversations: { select: { id: true }, take: 1 },
    },
  });

  // Look up the driver-progress milestones (recorded by the event/status
  // routes) so CONFIRMED → accepted and IN_PROGRESS → arrived can be derived.
  const bookingIds = bookings.map((b) => b.id);
  const milestones = bookingIds.length
    ? await db.trackingEvent.findMany({
        where: {
          bookingId: { in: bookingIds },
          type: { in: ["driver_accepted", "arrived_pickup"] },
        },
        select: { bookingId: true, type: true },
      })
    : [];

  const acceptedIds = new Set(
    milestones.filter((m) => m.type === "driver_accepted").map((m) => m.bookingId),
  );
  const arrivedIds = new Set(
    milestones.filter((m) => m.type === "arrived_pickup").map((m) => m.bookingId),
  );

  function stageFor(b: (typeof bookings)[number]): DriverStage {
    switch (b.status) {
      case "COMPLETED":
        return "completed";
      case "CANCELLED":
        return "cancelled";
      case "IN_PROGRESS":
        return arrivedIds.has(b.id) ? "arrived" : "en_route";
      default: // CONFIRMED
        return acceptedIds.has(b.id) ? "accepted" : "assigned";
    }
  }

  // Flatten conversationId to top level + attach the computed stage.
  const mapped = bookings.map((b) => {
    const normalised = b.quote?.normalisedInput;
    const collectionAccess = stopAccess(normalised, "collection");
    const deliveryAccess = stopAccess(normalised, "delivery");
    const selectedServices = servicesFromQuote(normalised, b.quote?.selectedServices);
    const crew = asRecord(b.quote?.crewRecommendation);
    const itemCount = b.bookingItems.reduce((sum, entry) => sum + entry.quantity, 0);
    const peopleNeeded = numberValue(crew.movers) ?? b.helpersCount + 1;
    const dismantlingItems = intValue(
      selectedServices.dismantlingItems,
      b.needsAssembly ? 1 : 0,
    );
    const reassemblyItems = intValue(
      selectedServices.reassemblyItems,
      b.needsAssembly ? 1 : 0,
    );
    const packingMaterials = booleanValue(selectedServices.packingMaterials, b.needsPacking);
    const fullPacking = booleanValue(selectedServices.packing, false);
    const pickupPropertyType =
      stringValue(collectionAccess.propertyType) ?? b.serviceVariant ?? "2 Bedroom House";
    const dropoffPropertyType =
      stringValue(deliveryAccess.propertyType) ?? pickupPropertyType;

    return {
      ...b,
      stage: stageFor(b),
      conversationId: b.conversations[0]?.id ?? null,
      conversations: undefined,
      quote: undefined,
      moveType: b.quote?.moveType ?? b.serviceSlug,
      moveSize: b.quote?.moveSize ?? propertyToMoveSize(pickupPropertyType),
      pickupPropertyType,
      dropoffPropertyType,
      peopleNeeded,
      packingType: fullPacking ? "full" : packingMaterials ? "materials" : "none",
      dismantlingItems,
      reassemblyItems,
      selectedServices,
      itemCount,
      bookingItems: b.bookingItems.map((entry) => ({
        id: entry.id,
        quantity: entry.quantity,
        item: {
          id: entry.item.id,
          name: entry.item.name,
          category: entry.item.category.name,
        },
      })),
    };
  });

  // A driver must see every assigned (CONFIRMED) job, not only future-dated
  // ones — otherwise a job scheduled for today would silently disappear.
  const upcoming    = mapped.filter((b) => b.status === "CONFIRMED");
  const inProgress  = mapped.filter((b) => b.status === "IN_PROGRESS");
  const completed   = mapped.filter((b) => b.status === "COMPLETED");
  const cancelled   = mapped.filter((b) => b.status === "CANCELLED");

  return NextResponse.json({ upcoming, inProgress, completed, cancelled });
}

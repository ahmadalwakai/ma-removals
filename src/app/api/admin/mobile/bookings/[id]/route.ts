import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminMobile } from "@/lib/admin-mobile-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const addressPatchSchema = z.object({
  fullAddress: z.string().trim().min(3).max(260).optional(),
  postcode: z.string().trim().max(12).optional(),
  lat: z.number().finite().min(49).max(62).nullable().optional(),
  lng: z.number().finite().min(-9.5).max(2.5).nullable().optional(),
  floor: z.number().int().min(0).max(30).optional(),
  hasLift: z.boolean().optional(),
});

const updateBookingSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().max(160).optional(),
    phone: z.string().trim().min(7).max(30).optional(),
  }).optional(),
  pickup: addressPatchSchema.optional(),
  dropoff: addressPatchSchema.optional(),
  moveType: z.string().trim().max(80).optional(),
  scheduledDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  scheduledTime: z.string().trim().min(2).max(40).optional(),
  peopleNeeded: z.number().int().min(1).max(12).optional(),
  notes: z.string().trim().max(1200).optional(),
  services: z.object({
    packing: z.boolean().optional(),
    dismantling: z.boolean().optional(),
    reassembly: z.boolean().optional(),
  }).optional(),
  items: z.array(z.object({
    itemId: z.string().trim().min(1),
    quantity: z.number().int().min(1).max(99),
  })).max(300).optional(),
});

function dateFromIso(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  return new Date(`${value}T12:00:00`);
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
      driver: { include: { user: { select: { name: true, email: true, phone: true } } } },
      bookingItems: { include: { item: { include: { category: { select: { name: true } } } } } },
      payments: { orderBy: { createdAt: "desc" } },
      statusHistory: { orderBy: { timestamp: "desc" }, take: 30 },
      trackingEvents: { orderBy: { timestamp: "desc" }, take: 40 },
    },
  });

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
      moveType: booking.serviceSlug,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      pickupAddress: booking.pickupAddress,
      pickupPostcode: booking.pickupPostcode,
      pickupLat: booking.pickupLat,
      pickupLng: booking.pickupLng,
      pickupFloor: booking.pickupFloor,
      pickupHasLift: booking.pickupHasLift,
      dropoffAddress: booking.dropoffAddress,
      dropoffPostcode: booking.dropoffPostcode,
      dropoffLat: booking.dropoffLat,
      dropoffLng: booking.dropoffLng,
      dropoffFloor: booking.dropoffFloor,
      dropoffHasLift: booking.dropoffHasLift,
      distanceMiles: booking.distanceMiles,
      scheduledDate: booking.scheduledDate.toISOString(),
      scheduledTime: booking.scheduledTime,
      estimatedHours: booking.estimatedHours,
      totalPaid: booking.totalPaid,
      isPaid: booking.isPaid,
      helpersCount: booking.helpersCount,
      peopleNeeded: booking.helpersCount + 1,
      needsPacking: booking.needsPacking,
      needsAssembly: booking.needsAssembly,
      notes: booking.notes,
      items: booking.items,
      itemCount: booking.bookingItems.reduce((sum, entry) => sum + entry.quantity, 0),
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

  const parsed = updateBookingSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid booking update", issues: parsed.error.issues.map((issue) => issue.message) },
      { status: 400 },
    );
  }

  const { id } = await params;
  const booking = await db.booking.findUnique({
    where: { id },
    include: { customer: { select: { id: true } } },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const body = parsed.data;
  const updated = await db.$transaction(async (tx) => {
    if (body.customer) {
      await tx.user.update({
        where: { id: booking.customerId },
        data: {
          name: body.customer.name,
          email: body.customer.email,
          phone: body.customer.phone,
        },
      });
    }

    if (body.items) {
      await tx.bookingItem.deleteMany({ where: { bookingId: booking.id } });
      if (body.items.length > 0) {
        await tx.bookingItem.createMany({
          data: body.items.map((item) => ({
            bookingId: booking.id,
            itemId: item.itemId,
            quantity: item.quantity,
          })),
        });
      }
    }

    await tx.bookingStatusHistory.create({
      data: {
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: booking.status,
        changedBy: user.id,
        changedByRole: "ADMIN",
        note: "Booking edited in mobile admin.",
      },
    });

    return tx.booking.update({
      where: { id: booking.id },
      data: {
        serviceSlug: body.moveType ?? undefined,
        serviceName: body.moveType ? body.moveType.replace(/-/g, " ") : undefined,
        pickupAddress: body.pickup?.fullAddress,
        pickupPostcode: body.pickup?.postcode,
        pickupLat: body.pickup?.lat,
        pickupLng: body.pickup?.lng,
        pickupFloor: body.pickup?.floor,
        pickupHasLift: body.pickup?.hasLift,
        dropoffAddress: body.dropoff?.fullAddress,
        dropoffPostcode: body.dropoff?.postcode,
        dropoffLat: body.dropoff?.lat,
        dropoffLng: body.dropoff?.lng,
        dropoffFloor: body.dropoff?.floor,
        dropoffHasLift: body.dropoff?.hasLift,
        scheduledDate: dateFromIso(body.scheduledDate),
        scheduledTime: body.scheduledTime,
        helpersCount: body.peopleNeeded ? Math.max(0, body.peopleNeeded - 1) : undefined,
        needsPacking: body.services?.packing,
        needsAssembly: body.services?.dismantling ?? body.services?.reassembly,
        notes: body.notes,
      },
      include: { bookingItems: true },
    });
  });

  return NextResponse.json({
    booking: {
      id: updated.id,
      reference: updated.reference,
      scheduledDate: updated.scheduledDate.toISOString(),
      scheduledTime: updated.scheduledTime,
      helpersCount: updated.helpersCount,
      itemCount: updated.bookingItems.reduce((sum, item) => sum + item.quantity, 0),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

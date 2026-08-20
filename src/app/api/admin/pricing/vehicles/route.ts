import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { vehicleClassConfigSchema } from "@/lib/quotes/schemas";
import { createDraftPricingVersion } from "@/lib/pricing/version-repository";

const upsertVehicleSchema = vehicleClassConfigSchema.extend({
  id: z.string().optional(),
  reason: z.string().trim().max(300).optional().nullable(),
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const vehicles = await db.vehicleClassConfig.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ vehicles });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = upsertVehicleSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid vehicle class" }, { status: 400 });
  }

  const { id, reason, ...data } = parsed.data;
  const before = id ? await db.vehicleClassConfig.findUnique({ where: { id } }) : null;
  const vehicle = id
    ? await db.vehicleClassConfig.update({ where: { id }, data })
    : await db.vehicleClassConfig.upsert({
        where: { name: data.name },
        update: data,
        create: data,
      });

  await db.pricingAuditLog.create({
    data: {
      actorId: session.user.id,
      action: id ? "update_vehicle_class" : "upsert_vehicle_class",
      entityType: "VehicleClassConfig",
      entityId: vehicle.id,
      before: before ? before as unknown as Prisma.InputJsonValue : undefined,
      after: vehicle as unknown as Prisma.InputJsonValue,
      reason,
    },
  });

  await createDraftPricingVersion({
    actorId: session.user.id,
    reason: reason ?? `Vehicle class ${vehicle.name} changed`,
  });

  return NextResponse.json({ vehicle });
}

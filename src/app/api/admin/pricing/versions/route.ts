import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  activatePricingVersion,
  createDraftPricingVersion,
  validatePricingSnapshot,
} from "@/lib/pricing/version-repository";
import type { PricingVehicleClass } from "@/lib/pricing/domain";

const versionActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("draft"),
    label: z.string().trim().max(120).optional(),
    reason: z.string().trim().max(300).optional(),
  }),
  z.object({
    action: z.literal("activate"),
    versionId: z.string().trim().min(1),
    reason: z.string().trim().min(3).max(300),
  }),
]);

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const versions = await db.pricingVersion.findMany({
    orderBy: { version: "desc" },
    take: 30,
  });
  return NextResponse.json({
    versions: versions.map((version) => ({
      id: version.id,
      version: version.version,
      status: version.status,
      label: version.label,
      createdAt: version.createdAt.toISOString(),
      activatedAt: version.activatedAt?.toISOString() ?? null,
      validation: validatePricingSnapshot({
        settings: version.settings as Record<string, number>,
        vehicleClasses: Array.isArray(version.vehicleClasses)
          ? version.vehicleClasses as unknown as PricingVehicleClass[]
          : [],
      }),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = versionActionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid pricing version request" }, { status: 400 });
  }

  if (parsed.data.action === "draft") {
    const version = await createDraftPricingVersion({
      actorId: session.user.id,
      label: parsed.data.label,
      reason: parsed.data.reason,
    });
    return NextResponse.json({ version });
  }

  const result = await activatePricingVersion({
    versionId: parsed.data.versionId,
    actorId: session.user.id,
    reason: parsed.data.reason,
  });
  if (!result.ok) {
    return NextResponse.json({ error: "Pricing version cannot be activated", reasons: result.reasons }, { status: 422 });
  }

  return NextResponse.json({ version: result.version });
}

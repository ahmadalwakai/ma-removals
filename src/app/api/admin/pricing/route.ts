import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createDraftPricingVersion } from "@/lib/pricing/version-repository";

const pricingConfigSchema = z.object({
  key: z.string().trim().min(2).max(120).regex(/^[a-z0-9_]+$/),
  value: z.number().finite(),
  category: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional().nullable(),
  reason: z.string().trim().max(300).optional().nullable(),
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = pricingConfigSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid pricing config" }, { status: 400 });
  }

  const row = await db.pricingConfig.upsert({
    where: { key: parsed.data.key },
    update: {
      value: parsed.data.value,
      category: parsed.data.category,
      description: parsed.data.description,
      isActive: true,
    },
    create: {
      key: parsed.data.key,
      value: parsed.data.value,
      category: parsed.data.category,
      description: parsed.data.description,
      isActive: true,
    },
  });

  await db.pricingAuditLog.create({
    data: {
      actorId: session.user.id,
      action: "upsert_config",
      entityType: "PricingConfig",
      entityId: row.id,
      after: row as unknown as Prisma.InputJsonValue,
      reason: parsed.data.reason,
    },
  });

  await createDraftPricingVersion({
    actorId: session.user.id,
    reason: parsed.data.reason ?? `Pricing config ${row.key} changed`,
  });

  return NextResponse.json({ config: row });
}

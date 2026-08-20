import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createDraftPricingVersion } from "@/lib/pricing/version-repository";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

const patchSchema = z.object({
  value: z.number().finite(),
  reason: z.string().trim().max(300).optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = patchSchema.safeParse(await req.json());

  if (!body.success) {
    return NextResponse.json({ error: "value (number) required" }, { status: 400 });
  }

  const before = await db.pricingConfig.findUnique({ where: { id } });
  const updated = await db.pricingConfig.update({
    where: { id },
    data: { value: body.data.value },
  });

  await db.pricingAuditLog.create({
    data: {
      actorId: session.user.id,
      action: "update_config",
      entityType: "PricingConfig",
      entityId: id,
      before: before ? before as unknown as Prisma.InputJsonValue : undefined,
      after: updated as unknown as Prisma.InputJsonValue,
      reason: body.data.reason,
    },
  });

  await createDraftPricingVersion({
    actorId: session.user.id,
    reason: body.data.reason ?? `Pricing config ${updated.key} changed`,
  });

  return NextResponse.json({ ok: true });
}

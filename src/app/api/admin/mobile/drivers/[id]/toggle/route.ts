import { type NextRequest, NextResponse } from "next/server";

import { requireAdminMobile } from "@/lib/admin-mobile-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdminMobile(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as { isActive?: boolean };

  if (typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "isActive (boolean) required" }, { status: 400 });
  }

  await db.driverProfile.update({
    where: { id },
    data: { isActive: body.isActive },
  });

  return NextResponse.json({ ok: true, isActive: body.isActive });
}

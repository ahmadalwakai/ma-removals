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
  await db.adminNotification.update({ where: { id }, data: { isRead: true } });

  return NextResponse.json({ ok: true });
}

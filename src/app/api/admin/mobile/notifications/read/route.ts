import { NextResponse } from "next/server";

import { requireAdminMobile } from "@/lib/admin-mobile-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireAdminMobile(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.adminNotification.updateMany({
    where: { isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ ok: true });
}

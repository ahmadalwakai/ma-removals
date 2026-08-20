import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.adminNotification.updateMany({
    where: { isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ ok: true });
}

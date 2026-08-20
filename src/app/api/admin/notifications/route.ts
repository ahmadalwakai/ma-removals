import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const notifications = await db.adminNotification.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = await db.adminNotification.count({ where: { isRead: false } });

  return NextResponse.json({ notifications, unreadCount });
}

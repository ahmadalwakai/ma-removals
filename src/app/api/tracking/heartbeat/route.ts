import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { sessionId: string };
    await db.visitor.updateMany({
      where: { sessionId: body.sessionId },
      data: { lastSeenAt: new Date(), isActive: true },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // non-critical, never error
  }
}

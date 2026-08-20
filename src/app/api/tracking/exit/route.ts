import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { sessionId: string; duration?: number };
    await db.visitor.updateMany({
      where: { sessionId: body.sessionId },
      data: {
        isActive: false,
        exitAt: new Date(),
        duration: body.duration ?? null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      sessionId: string;
      type: string;
      page: string;
      element?: string;
      metadata?: Record<string, unknown>;
    };

    const visitor = await db.visitor.findUnique({
      where: { sessionId: body.sessionId },
      select: { id: true },
    });
    if (!visitor) return NextResponse.json({ ok: true }); // session not yet created, silently ignore

    await db.$transaction([
      db.visitorEvent.create({
        data: {
          visitorId: visitor.id,
          type: body.type,
          page: body.page,
          element: body.element ?? null,
          metadata: body.metadata as Prisma.InputJsonValue | undefined,
        },
      }),
      db.visitor.update({
        where: { id: visitor.id },
        data: {
          lastSeenAt: new Date(),
          pageCount: body.type === "page_view" ? { increment: 1 } : undefined,
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("tracking/event error:", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

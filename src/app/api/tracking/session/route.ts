import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import crypto from "crypto";

function detectDevice(ua: string): string {
  if (/tablet|ipad/i.test(ua)) return "tablet";
  if (/mobile|android|iphone/i.test(ua)) return "mobile";
  return "desktop";
}

function detectBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return "Edge";
  if (/chrome/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  if (/firefox/i.test(ua)) return "Firefox";
  return "Other";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      sessionId: string;
      landingPage: string;
      referrer?: string;
    };

    const hdrs = await headers();
    const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
    const ua = hdrs.get("user-agent") ?? "";

    // Upsert so a page refresh does not duplicate the session
    await db.visitor.upsert({
      where: { sessionId: body.sessionId },
      update: { lastSeenAt: new Date(), isActive: true },
      create: {
        sessionId: body.sessionId,
        ipHash,
        userAgent: ua,
        device: detectDevice(ua),
        browser: detectBrowser(ua),
        landingPage: body.landingPage,
        referrer: body.referrer || null,
        isActive: true,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("tracking/session error:", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

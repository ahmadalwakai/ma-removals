import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(20).max(4096),
  platform: z.enum(["android", "ios"]).default("android"),
  appVersion: z.string().max(32).optional(),
  deviceModel: z.string().max(64).optional(),
});

/**
 * Registers an FCM device token for an authenticated admin. Called by
 * the React Native shell via the WebView bridge whenever a token is
 * issued or refreshed (see usePushRegistration + NativePushRegister).
 *
 * Idempotent — `upsert` keys on the token itself so re-registering
 * just refreshes `lastSeenAt` and re-binds to the current user.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { token, platform, appVersion, deviceModel } = parsed.data;

  await db.fcmToken.upsert({
    where: { token },
    create: {
      token,
      platform,
      appVersion,
      deviceModel,
      userId: session.user.id,
    },
    update: {
      platform,
      appVersion,
      deviceModel,
      userId: session.user.id,
      lastSeenAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}

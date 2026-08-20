import { NextResponse } from "next/server";
import { z } from "zod";

import { requireDriver, forbidden } from "@/lib/driver-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(20).max(4096),
  platform: z.enum(["android", "ios"]).default("android"),
  appVersion: z.string().max(32).optional(),
  deviceModel: z.string().max(64).optional(),
});

/**
 * Registers an FCM device token for the authenticated driver. Called by
 * the React Native driver shell via the WebView bridge whenever a token
 * is issued or refreshed (see NativePushRegister + usePushRegistration).
 *
 * Idempotent — `upsert` keys on the token itself so re-registering just
 * refreshes `lastSeenAt` and re-binds to the current driver profile.
 */
export async function POST(req: Request) {
  const driver = await requireDriver();
  if (!driver) return forbidden();

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

  await db.driverFcmToken.upsert({
    where: { token },
    create: {
      token,
      platform,
      appVersion,
      deviceModel,
      driverId: driver.id,
    },
    update: {
      platform,
      appVersion,
      deviceModel,
      driverId: driver.id,
      lastSeenAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}

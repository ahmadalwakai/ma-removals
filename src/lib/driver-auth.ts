import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyDriverToken } from "@/lib/driver-token";

/**
 * Resolve the authenticated driver from either:
 *  1. An `Authorization: Bearer <token>` header (native driver app), or
 *  2. A NextAuth session cookie (web driver portal).
 *
 * Returns the DriverProfile (with the user's name/email) or `null`.
 */
export async function requireDriver() {
  // 1. Native app bearer token.
  try {
    const authHeader = (await headers()).get("authorization") ?? "";
    const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
    if (match) {
      const payload = verifyDriverToken(match[1]);
      if (payload) {
        const profile = await db.driverProfile.findUnique({
          where: { id: payload.driverId },
          include: { user: { select: { name: true, email: true } } },
        });
        if (profile) return profile;
      }
      // A presented-but-invalid bearer token must not silently fall back.
      return null;
    }
  } catch {
    // headers() can throw outside a request scope — fall through to session.
  }

  // 2. Web session cookie.
  const session = await auth();
  if (!session?.user) return null;
  if (session.user.role !== "DRIVER" && session.user.role !== "ADMIN") return null;

  const profile = await db.driverProfile.findUnique({
    where: { userId: session.user.id },
    include: { user: { select: { name: true, email: true } } },
  });
  return profile;
}

export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { db } from "@/lib/db";
import { signDriverToken } from "@/lib/driver-token";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});

/**
 * POST /api/driver/auth/login
 * Body: { email, password }
 *
 * Authenticates a driver (User with role DRIVER + a DriverProfile) against the
 * existing bcrypt password and issues a bearer token for the native app. The
 * web portal continues to use the NextAuth session cookie — this endpoint is
 * additive and does not change that flow.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { email, password } = parsed.data;

  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: {
      id: true,
      name: true,
      password: true,
      role: true,
      driverProfile: {
        select: { id: true, vehicleType: true, licensePlate: true, isActive: true },
      },
    },
  });

  // Generic error message — never reveal whether the email exists.
  const invalid = NextResponse.json(
    { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" },
    { status: 401 },
  );

  if (!user?.password || !user.driverProfile) return invalid;
  if (user.role !== "DRIVER" && user.role !== "ADMIN") return invalid;
  if (!user.driverProfile.isActive) {
    return NextResponse.json({ error: "هذا الحساب غير مفعّل" }, { status: 403 });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return invalid;

  const token = signDriverToken(user.driverProfile.id, user.id);

  return NextResponse.json({
    token,
    driver: {
      id: user.driverProfile.id,
      name: user.name,
      vehicleType: user.driverProfile.vehicleType,
      licensePlate: user.driverProfile.licensePlate,
    },
  });
}

import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

/**
 * PATCH /api/admin/drivers/[id]/password
 * Body: { password }
 *
 * Sets (or resets) the sign-in password for an existing driver so they can
 * log into the native driver app. `id` is the DriverProfile id.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await req.json()) as { password?: string };
  const password = typeof body.password === "string" ? body.password : "";

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const profile = await db.driverProfile.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.user.update({ where: { id: profile.userId }, data: { password: passwordHash } });

  return NextResponse.json({ ok: true });
}

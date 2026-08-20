import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    name: string;
    email: string;
    phone: string;
    vehicleType?: string;
    licensePlate?: string;
    password?: string;
  };

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const vehicleType = body.vehicleType || "MEDIUM_VAN";
  const licensePlate = body.licensePlate?.trim() || "TBC";

  if (!name || !email || !phone) {
    return NextResponse.json({ error: "Name, phone and email are required" }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 6) {
    return NextResponse.json({ error: "Password is required (min 6 characters) so the driver can sign in" }, { status: 400 });
  }

  const validVehicles = ["SMALL_VAN", "MEDIUM_VAN", "LARGE_VAN", "LUTON_VAN", "FLATBED"];
  if (!validVehicles.includes(vehicleType)) {
    return NextResponse.json({ error: "Invalid vehicle type" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Create user with DRIVER role, then DriverProfile
  const existingUser = await db.user.findUnique({ where: { email } });
  let userId: string;

  if (existingUser) {
    // Promote to DRIVER if not already and (re)set the sign-in password.
    await db.user.update({
      where: { id: existingUser.id },
      data: { role: "DRIVER", phone, name, password: passwordHash },
    });
    userId = existingUser.id;
  } else {
    const user = await db.user.create({
      data: {
        name,
        email,
        phone,
        role: "DRIVER",
        password: passwordHash,
      },
    });
    userId = user.id;
  }

  // Check if DriverProfile already exists
  const existing = await db.driverProfile.findUnique({ where: { userId } });
  if (existing) {
    return NextResponse.json({ error: "Driver profile already exists for this user" }, { status: 409 });
  }

  const profile = await db.driverProfile.create({
    data: {
      userId,
      vehicleType: vehicleType as "SMALL_VAN" | "MEDIUM_VAN" | "LARGE_VAN" | "LUTON_VAN" | "FLATBED",
      licensePlate: licensePlate.toUpperCase(),
      isActive: true,
    },
  });

  return NextResponse.json({ ok: true, profileId: profile.id });
}

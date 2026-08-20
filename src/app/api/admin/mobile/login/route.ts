import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import {
  createAdminMobileToken,
  type AdminMobileUser,
} from "@/lib/admin-mobile-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: {
      id: true,
      role: true,
      name: true,
      email: true,
      password: true,
    },
  });

  if (!user?.password || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await bcrypt.compare(parsed.data.password, user.password);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const adminUser: AdminMobileUser = {
    id: user.id,
    role: "ADMIN",
    name: user.name,
    email: user.email,
  };
  const token = createAdminMobileToken(adminUser);

  return NextResponse.json({
    user: adminUser,
    token: token.token,
    expiresAt: token.expiresAt,
  });
}

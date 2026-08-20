import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

/**
 * POST /api/admin/job-offers
 * Body: { bookingId, driverProfileId, expiresInHours? }
 * Creates a JobOffer from admin to a driver.
 */
export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as {
    bookingId: string;
    driverProfileId: string;
    expiresInHours?: number;
  };

  if (!body.bookingId || !body.driverProfileId) {
    return NextResponse.json({ error: "bookingId and driverProfileId are required" }, { status: 400 });
  }

  const expiresAt = body.expiresInHours
    ? new Date(Date.now() + body.expiresInHours * 60 * 60 * 1000)
    : null;

  // Upsert (re-offer if previously rejected)
  const offer = await db.jobOffer.upsert({
    where: { bookingId_driverId: { bookingId: body.bookingId, driverId: body.driverProfileId } },
    create: {
      bookingId: body.bookingId,
      driverId: body.driverProfileId,
      status: "PENDING",
      expiresAt,
    },
    update: {
      status: "PENDING",
      offeredAt: new Date(),
      respondedAt: null,
      expiresAt,
    },
  });

  return NextResponse.json({ ok: true, offerId: offer.id });
}

/**
 * GET /api/admin/job-offers?bookingId=xxx
 * Returns all offers for a booking.
 */
export async function GET(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const bookingId = req.nextUrl.searchParams.get("bookingId");
  if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

  const offers = await db.jobOffer.findMany({
    where: { bookingId },
    include: {
      driver: {
        include: { user: { select: { name: true, email: true } } },
      },
    },
    orderBy: { offeredAt: "desc" },
  });

  return NextResponse.json({ offers });
}

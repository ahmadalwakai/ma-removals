import { NextResponse } from "next/server";

import { requireDriver, forbidden } from "@/lib/driver-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/driver/auth/me
 * Validates the current bearer token (or session) and returns the driver
 * profile. The native app calls this on launch to decide whether its stored
 * token is still valid before showing the jobs screen.
 */
export async function GET() {
  const driver = await requireDriver();
  if (!driver) return forbidden();

  return NextResponse.json({
    driver: {
      id: driver.id,
      name: driver.user?.name ?? null,
      vehicleType: driver.vehicleType,
      licensePlate: driver.licensePlate,
      rating: driver.rating,
      jobsCompleted: driver.jobsCompleted,
    },
  });
}

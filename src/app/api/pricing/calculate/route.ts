import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "MANUAL_REVIEW_REQUIRED",
      reasons: [
        "MANUAL_REVIEW_REQUIRED: Legacy pricing calculation cannot produce an automatic customer price. Use /api/quotes/preview or /api/quotes so the server can resolve inventory, route mileage and the current AnyVan benchmark.",
      ],
    },
    {
      status: 422,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCompetitorPricingContext } from "@/lib/pricing/competitor-repository";
import { calculateRemovalQuote, normaliseQuoteInputForPricing } from "@/lib/pricing/domain";
import {
  getCurrentPricingSettings,
  getCurrentVehicleClasses,
} from "@/lib/pricing/version-repository";
import { pricingSimulatorSchema } from "@/lib/quotes/schemas";
import { resolveInventoryForQuote } from "@/lib/quotes/service";
import { calculateServerRoute } from "@/lib/routing/mapbox";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = pricingSimulatorSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid simulator request" }, { status: 400 });
  }

  const input = parsed.data;
  const [settings, vehicleClasses, inventory] = await Promise.all([
    getCurrentPricingSettings(),
    getCurrentVehicleClasses(),
    resolveInventoryForQuote(input),
  ]);
  const route = input.routeOverride
    ? {
        distanceMiles: input.routeOverride.distanceMiles,
        durationMinutes: input.routeOverride.durationMinutes,
        calculatedAt: new Date().toISOString(),
        routeHash: "admin-simulator",
      }
    : (await calculateServerRoute([
        input.collection,
        ...(input.additionalStop ? [input.additionalStop] : []),
        input.delivery,
      ])).route;

  const pricingInput = normaliseQuoteInputForPricing(input, inventory.items);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const competitorContext = await getCompetitorPricingContext(
    pricingInput,
    route?.distanceMiles ?? null,
    inventory.items,
  );
  const result = calculateRemovalQuote({
    input: pricingInput,
    inventory: inventory.items,
    route,
    pricingVersion: {
      id: "admin-simulator",
      version: 0,
      status: "ACTIVE",
      settings,
      vehicleClasses,
    },
    competitorContext,
    now: new Date(),
    quoteExpiresAt: expiresAt,
  });

  return NextResponse.json({
    result: {
      status: result.status,
      totalPence: result.finalTotalPence,
      internalSummary: result.internalSummary,
      competitorSummary: result.competitorSummary,
      internalBreakdown: result.internalBreakdown,
      customerBreakdown: result.customerBreakdown,
      inventoryMetrics: result.inventoryMetrics,
      vehicleRecommendation: result.vehicleRecommendation,
      crewRecommendation: result.crewRecommendation,
      manualReviewReasons: [
        ...inventory.reasons,
        ...result.manualReviewReasons,
      ],
    },
  });
}

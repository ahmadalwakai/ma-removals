import crypto from "node:crypto";
import type { AddressAccessInput } from "@/lib/quotes/schemas";
import type { RouteMetrics } from "@/lib/routing/types";

const METERS_TO_MILES = 0.000621371;
const ROUTE_REQUEST_TIMEOUT_MS = 8_000;

export interface RouteCalculationResult {
  route: RouteMetrics | null;
  reasons: string[];
}

function coordinate(address: AddressAccessInput): string {
  return `${address.lng},${address.lat}`;
}

function routeHash(addresses: AddressAccessInput[]): string {
  const stable = addresses.map((address) => ({
    postcode: address.postcode.trim().toUpperCase(),
    fullAddress: address.fullAddress.trim().toLowerCase(),
    lat: Number(address.lat.toFixed(6)),
    lng: Number(address.lng.toFixed(6)),
  }));
  return crypto.createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

function isDuplicateAddress(a: AddressAccessInput, b: AddressAccessInput): boolean {
  const postcodeA = a.postcode.replace(/\s+/g, "").toUpperCase();
  const postcodeB = b.postcode.replace(/\s+/g, "").toUpperCase();
  const addressA = a.fullAddress.trim().toLowerCase();
  const addressB = b.fullAddress.trim().toLowerCase();
  return postcodeA === postcodeB && addressA === addressB;
}

export async function calculateServerRoute(addresses: AddressAccessInput[]): Promise<RouteCalculationResult> {
  const reasons: string[] = [];
  const validAddresses = addresses.filter(Boolean);

  if (validAddresses.length < 2) {
    return { route: null, reasons: ["At least collection and delivery addresses are required"] };
  }

  for (let i = 0; i < validAddresses.length; i++) {
    for (let j = i + 1; j < validAddresses.length; j++) {
      const first = validAddresses[i];
      const second = validAddresses[j];
      if (first && second && isDuplicateAddress(first, second)) {
        reasons.push("Duplicate route addresses require manual review");
      }
    }
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || token === "pk.placeholder") {
    return {
      route: null,
      reasons: [...reasons, "Mapbox token is not configured for server-authoritative routing"],
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, ROUTE_REQUEST_TIMEOUT_MS);
    const params = new URLSearchParams({
      access_token: token,
      overview: "full",
      geometries: "polyline",
      steps: "false",
      alternatives: "false",
    });
    const coordinates = validAddresses.map(coordinate).join(";");
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordinates}?${params.toString()}`;
    const response = await fetch(url, { cache: "no-store", signal: controller.signal }).finally(() => {
      clearTimeout(timeout);
    });
    if (!response.ok) {
      return { route: null, reasons: [...reasons, "Mapbox route calculation failed"] };
    }

    const data = (await response.json()) as {
      routes?: Array<{
        distance: number;
        duration: number;
        geometry?: string;
      }>;
    };
    const route = data.routes?.[0];
    if (!route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) {
      return { route: null, reasons: [...reasons, "No possible route was returned by Mapbox"] };
    }

    return {
      route: {
        distanceMiles: Math.round(route.distance * METERS_TO_MILES * 10) / 10,
        durationMinutes: Math.max(1, Math.round(route.duration / 60)),
        geometry: route.geometry ?? null,
        calculatedAt: new Date().toISOString(),
        routeHash: routeHash(validAddresses),
      },
      reasons,
    };
  } catch (caught) {
    const timedOut = caught instanceof Error && caught.name === "AbortError";
    return {
      route: null,
      reasons: [...reasons, timedOut ? "Mapbox route calculation timed out" : "Route calculation failed unexpectedly"],
    };
  }
}

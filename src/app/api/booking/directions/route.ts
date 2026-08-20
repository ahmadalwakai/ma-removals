import { type NextRequest, NextResponse } from "next/server";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
};
const MAPBOX_DIRECTIONS_TIMEOUT_MS = 5000;

function corsHeaders(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin =
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:") ||
    origin === "https://www.maremovals.com" ||
    origin === "https://maremovals.com"
      ? origin
      : "https://www.maremovals.com";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(req: NextRequest, body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...corsHeaders(req), ...(init?.headers ?? {}) },
  });
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from"); // "lng,lat"
  const to = req.nextUrl.searchParams.get("to"); // "lng,lat"

  if (!from || !to) {
    return json(req, { error: "from and to required" }, { status: 400 });
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || token === "pk.placeholder") {
    // Return mock distance when token not configured
    return json(req, { distanceMiles: 8.5, durationMinutes: 22 }, {
      headers: CACHE_HEADERS,
    });
  }

  try {
    const params = new URLSearchParams({
      access_token: token,
      overview: "full",
      geometries: "polyline",
      steps: "false",
      alternatives: "false",
    });
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${from};${to}?${params.toString()}`;
    const res = await fetchWithTimeout(
      url,
      { cache: "no-store" },
      MAPBOX_DIRECTIONS_TIMEOUT_MS
    );
    const data = (await res.json()) as {
      routes?: Array<{
        distance: number;
        duration: number;
        geometry?: string;
      }>;
    };

    if (!data.routes?.[0]) {
      return json(req, { error: "No route found" }, { status: 404 });
    }

    const route = data.routes[0];
    return json(req, {
      distanceMiles: Math.round(route.distance * 0.000621371 * 10) / 10,
      durationMinutes: Math.round(route.duration / 60),
      geometry: route.geometry ?? null,
    }, {
      headers: CACHE_HEADERS,
    });
  } catch {
    return json(req, { error: "Route calculation failed" }, { status: 500 });
  }
}

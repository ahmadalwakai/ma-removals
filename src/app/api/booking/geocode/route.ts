import { type NextRequest, NextResponse } from "next/server";
import {
  BERMUDA_ADDRESS_MESSAGE,
  isBermudaAddress,
  isScotlandAddress,
  SCOTLAND_PICKUP_MESSAGE,
} from "@/lib/service-area";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
};
const ERROR_HEADERS = {
  "Cache-Control": "no-store",
};
const MAPBOX_GEOCODE_TIMEOUT_MS = 8000;
const GEOCODE_TIMEOUT_MESSAGE =
  "We couldn't auto-fill your address from your location. Start typing your address instead.";
const GEOCODE_UNAVAILABLE_MESSAGE =
  "Address lookup is temporarily unavailable. Start typing your address instead.";
const MAPBOX_TOKEN_UNAVAILABLE_MESSAGE =
  "Address lookup is temporarily unavailable. Start typing your address instead.";
const SCOTLAND_BBOX = "-8.85,54.55,-0.65,61.05";
const DEFAULT_SCOTLAND_PROXIMITY = {
  // Rutherglen / south-east Glasgow keeps short partial searches local first.
  lat: 55.828,
  lng: -4.214,
};

type MapboxFeature = {
  id: string;
  place_name: string;
  place_type?: string[];
  center: [number, number];
  context?: Array<{ id: string; text: string; short_code?: string }>;
};

type GeocodeFeature = {
  id: string;
  fullAddress: string;
  type: string;
  lat: number;
  lng: number;
  postcode: string;
  city: string;
  region: string;
  country: string;
};

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

function hasUsableMapboxToken(token?: string): token is string {
  return !!token && token !== "pk.placeholder" && token.length > 20;
}

function reverseResultRank(feature: { type?: string }) {
  if (feature.type === "address") return 0;
  if (feature.type === "postcode") return 1;
  if (feature.type === "place") return 2;
  return 3;
}

function parseCoordinate(value: string | null) {
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function proximityFromRequest(req: NextRequest, scotlandOnly: boolean) {
  const proximity = req.nextUrl.searchParams.get("proximity");
  if (proximity === "ip") return "ip";

  const proximityLat = parseCoordinate(req.nextUrl.searchParams.get("proximityLat"));
  const proximityLng = parseCoordinate(req.nextUrl.searchParams.get("proximityLng"));
  if (proximityLat != null && proximityLng != null) {
    return `${proximityLng},${proximityLat}`;
  }

  if (scotlandOnly) {
    return `${DEFAULT_SCOTLAND_PROXIMITY.lng},${DEFAULT_SCOTLAND_PROXIMITY.lat}`;
  }

  return "ip";
}

function toGeocodeFeature(f: MapboxFeature): GeocodeFeature {
  const region = f.context?.find((c) => c.id.startsWith("region"))?.text ?? "";
  const countryContext = f.context?.find((c) => c.id.startsWith("country"));
  const country =
    countryContext?.short_code?.toLowerCase() === "bm"
      ? "Bermuda"
      : countryContext?.text ?? "";

  return {
    id: f.id,
    fullAddress: f.place_name,
    // "address" = full street address, "postcode" = postcode-only, "place" = town/city.
    type: f.place_type?.[0] ?? f.id.split(".")[0] ?? "",
    lat: f.center[1],
    lng: f.center[0],
    postcode:
      f.place_type?.[0] === "postcode"
        ? f.place_name.split(",")[0]?.trim() ?? ""
        : f.context?.find((c) => c.id.startsWith("postcode"))?.text ?? "",
    city: f.context?.find((c) => c.id.startsWith("place"))?.text ?? "",
    region,
    country,
  };
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");
  const scope = req.nextUrl.searchParams.get("scope");
  const scotlandOnly = scope === "scotland";
  const isReverse = lat != null && lng != null;
  const latitude = parseCoordinate(lat);
  const longitude = parseCoordinate(lng);
  const proximity = proximityFromRequest(req, scotlandOnly);

  if (!isReverse && (!q || q.length < 3)) {
    return json(req, { features: [] }, {
      headers: CACHE_HEADERS,
    });
  }

  if (
    isReverse &&
    (latitude == null ||
      longitude == null ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude))
  ) {
    return json(req, {
      features: [],
      error: GEOCODE_UNAVAILABLE_MESSAGE,
    }, {
      status: 400,
      headers: ERROR_HEADERS,
    });
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();
  if (!hasUsableMapboxToken(token)) {
    return json(req, {
      features: [],
      error: MAPBOX_TOKEN_UNAVAILABLE_MESSAGE,
    }, {
      status: 503,
      headers: ERROR_HEADERS,
    });
  }

  try {
    const runMapboxLookup = async (lookup: string) => {
      const url = new URL(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(lookup)}.json`
      );
      url.searchParams.set("country", "gb");
      url.searchParams.set("types", "address,postcode,place,locality,neighborhood");
      url.searchParams.set("language", "en");
      url.searchParams.set("access_token", token);

      if (!isReverse) {
        url.searchParams.set("autocomplete", "true");
        url.searchParams.set("limit", "10");
        url.searchParams.set("proximity", proximity);
      }

      if (scotlandOnly) {
        url.searchParams.set("bbox", SCOTLAND_BBOX);
      }

      const res = await fetchWithTimeout(
        url.toString(),
        { cache: "no-store" },
        MAPBOX_GEOCODE_TIMEOUT_MS
      );
      if (!res.ok) {
        return { ok: false as const, status: res.status, features: [] as GeocodeFeature[] };
      }

      const data = (await res.json()) as {
        features?: MapboxFeature[];
      };

      return {
        ok: true as const,
        status: res.status,
        features: (data.features ?? []).map(toGeocodeFeature),
      };
    };

    // Reverse geocode (current location) uses "lng,lat", forward uses the query.
    const lookup = isReverse ? `${longitude},${latitude}` : (q as string);
    let lookupResult = await runMapboxLookup(lookup);
    if (!lookupResult.ok) {
      return json(req, {
        features: [],
        error: GEOCODE_UNAVAILABLE_MESSAGE,
      }, {
        status: lookupResult.status,
        headers: ERROR_HEADERS,
      });
    }

    let features = lookupResult.features;
    let rankedFeatures = isReverse
      ? [...features].sort((a, b) => reverseResultRank(a) - reverseResultRank(b))
      : features;
    let supportedFeatures = rankedFeatures.filter((feature) => !isBermudaAddress(feature));
    let scopedFeatures = scotlandOnly
      ? supportedFeatures.filter((feature) => isScotlandAddress(feature))
      : supportedFeatures;

    if (!isReverse && scopedFeatures.length === 0) {
      const fallbackLookup = scotlandOnly ? `${q as string} Scotland` : `${q as string} United Kingdom`;
      lookupResult = await runMapboxLookup(fallbackLookup);
      if (lookupResult.ok) {
        features = lookupResult.features;
        rankedFeatures = features;
        supportedFeatures = rankedFeatures.filter((feature) => !isBermudaAddress(feature));
        scopedFeatures = scotlandOnly
          ? supportedFeatures.filter((feature) => isScotlandAddress(feature))
          : supportedFeatures;
      }
    }

    const bermudaOnly = features.length > 0 && supportedFeatures.length === 0;
    const nonScottishOnly =
      scotlandOnly && supportedFeatures.length > 0 && scopedFeatures.length === 0;

    return json(req, {
      features: scopedFeatures,
      ...(isReverse && bermudaOnly
        ? { error: BERMUDA_ADDRESS_MESSAGE }
        : {}),
      ...(nonScottishOnly
        ? { error: SCOTLAND_PICKUP_MESSAGE }
        : {}),
    }, {
      headers: CACHE_HEADERS,
    });
  } catch (error) {
    const isTimeout =
      error instanceof DOMException && error.name === "AbortError";
    return json(req, {
      features: [],
      error: isTimeout ? GEOCODE_TIMEOUT_MESSAGE : GEOCODE_UNAVAILABLE_MESSAGE,
    }, {
      status: isTimeout ? 504 : 502,
      headers: ERROR_HEADERS,
    });
  }
}

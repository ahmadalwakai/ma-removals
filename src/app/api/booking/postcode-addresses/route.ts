import { type NextRequest, NextResponse } from "next/server";
import {
  BERMUDA_ADDRESS_MESSAGE,
  isBermudaAddress,
  isScottishPostcode,
  isScotlandAddress,
  SCOTLAND_PICKUP_MESSAGE,
} from "@/lib/service-area";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
};
const ADDRESS_LOOKUP_TIMEOUT_MS = 5000;

export interface PostcodeAddress {
  id: string;
  fullAddress: string;
  type: "address";
  lat: number;
  lng: number;
  postcode: string;
  city: string;
  region?: string;
  country?: string;
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

/**
 * Returns the list of full addresses for a UK postcode.
 *
 * Source priority:
 *  1. getAddress.io (PAF-backed, returns every delivery point) when
 *     GETADDRESS_API_KEY is configured — this is the only way to list *all*
 *     houses/flats in a postcode.
 *  2. Mapbox geocoding fallback — best-effort address features near the
 *     postcode (not exhaustive) when no address-API key is set.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("postcode")?.trim();
  const scope = req.nextUrl.searchParams.get("scope");
  const scotlandOnly = scope === "scotland";
  if (!raw) {
    return NextResponse.json({ addresses: [] }, { headers: CACHE_HEADERS });
  }
  const postcode = raw.toUpperCase();

  if (isBermudaAddress({ postcode, fullAddress: raw, country: raw })) {
    return NextResponse.json(
      { addresses: [], error: BERMUDA_ADDRESS_MESSAGE },
      { status: 422, headers: CACHE_HEADERS }
    );
  }

  if (scotlandOnly && !isScottishPostcode(postcode)) {
    return NextResponse.json(
      { addresses: [], error: SCOTLAND_PICKUP_MESSAGE, restrictedTo: "scotland" },
      { status: 422, headers: CACHE_HEADERS }
    );
  }

  const getAddressKey = process.env.GETADDRESS_API_KEY;
  if (getAddressKey && getAddressKey !== "placeholder") {
    try {
      const url = `https://api.getAddress.io/find/${encodeURIComponent(
        postcode
      )}?api-key=${getAddressKey}&expand=true`;
      const res = await fetchWithTimeout(
        url,
        { cache: "no-store" },
        ADDRESS_LOOKUP_TIMEOUT_MS
      );
      if (res.ok) {
        const data = (await res.json()) as {
          latitude?: number;
          longitude?: number;
          addresses?: Array<{
            formatted_address?: string[];
            line_1?: string;
            line_2?: string;
            line_3?: string;
            town_or_city?: string;
            county?: string;
            latitude?: number;
            longitude?: number;
          }>;
        };

        const baseLat = data.latitude ?? 0;
        const baseLng = data.longitude ?? 0;

        const addresses: PostcodeAddress[] = (data.addresses ?? []).map((a, i) => {
          const parts = (a.formatted_address ?? [
            a.line_1,
            a.line_2,
            a.line_3,
            a.town_or_city,
            a.county,
          ])
            .map((p) => (p ?? "").trim())
            .filter(Boolean);
          const fullAddress = [...parts, postcode].join(", ");
          return {
            id: `ga-${postcode}-${i}`,
            fullAddress,
            type: "address" as const,
            lat: a.latitude ?? baseLat,
            lng: a.longitude ?? baseLng,
            postcode,
            city: a.town_or_city ?? "",
            region: isScottishPostcode(postcode) ? "Scotland" : (a.county ?? ""),
            country: "United Kingdom",
          };
        });

        const supportedAddresses = addresses.filter((address) => !isBermudaAddress(address));

        return NextResponse.json(
          {
            addresses: supportedAddresses,
            source: "getaddress",
            ...(addresses.length > 0 && supportedAddresses.length === 0
              ? { error: BERMUDA_ADDRESS_MESSAGE }
              : {}),
          },
          { headers: CACHE_HEADERS }
        );
      }
    } catch {
      // fall through to Mapbox
    }
  }

  // ── Mapbox fallback ─────────────────────────────────────────────────────
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || token === "pk.placeholder") {
    return NextResponse.json({ addresses: [] }, { headers: CACHE_HEADERS });
  }

  try {
    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        postcode
      )}.json`
    );
    url.searchParams.set("country", "gb");
    url.searchParams.set("types", "address");
    url.searchParams.set("language", "en");
    url.searchParams.set("limit", "10");
    url.searchParams.set("autocomplete", "false");
    url.searchParams.set("access_token", token);

    const res = await fetchWithTimeout(
      url.toString(),
      { cache: "no-store" },
      ADDRESS_LOOKUP_TIMEOUT_MS
    );
    const data = (await res.json()) as {
      features?: Array<{
        id: string;
        place_name: string;
        center: [number, number];
        context?: Array<{ id: string; text: string; short_code?: string }>;
      }>;
    };

    const addresses: PostcodeAddress[] = (data.features ?? [])
      .map((f) => {
        const featurePostcode =
          f.context?.find((c) => c.id.startsWith("postcode"))?.text ?? postcode;
        const countryContext = f.context?.find((c) => c.id.startsWith("country"));

        return {
          id: f.id,
          fullAddress: f.place_name,
          type: "address" as const,
          lat: f.center[1],
          lng: f.center[0],
          postcode: featurePostcode,
          city: f.context?.find((c) => c.id.startsWith("place"))?.text ?? "",
          region: f.context?.find((c) => c.id.startsWith("region"))?.text ?? "",
          country:
            countryContext?.short_code?.toLowerCase() === "bm"
              ? "Bermuda"
              : countryContext?.text ?? "",
        };
      })
      .filter((address) => !isBermudaAddress(address))
      .filter((address) => !scotlandOnly || isScotlandAddress(address));

    return NextResponse.json({ addresses, source: "mapbox" }, { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json({ addresses: [] }, { headers: CACHE_HEADERS });
  }
}

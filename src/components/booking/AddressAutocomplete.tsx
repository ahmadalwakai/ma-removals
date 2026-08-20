"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Box, Text, Spinner, chakra } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { FiCrosshair } from "react-icons/fi";
import { HiLocationMarker, HiX } from "react-icons/hi";
import { colors } from "@/lib/tokens";
import type { AddressData } from "@/types/booking";

const MotionBox = motion.create(Box);

interface GeocodeSuggestion {
  id: string;
  fullAddress: string;
  type?: string;
  lat: number;
  lng: number;
  postcode: string;
  city: string;
  region?: string;
  country?: string;
}

interface AddressAutocompleteProps {
  value: AddressData | null;
  onChange: (address: AddressData | null) => void;
  placeholder?: string;
  id?: string;
  enableCurrentLocation?: boolean;
  proximity?: Pick<AddressData, "lat" | "lng"> | null;
  scope?: "uk" | "scotland";
  scopeMessage?: string;
  tone?: "dark" | "light";
  embedded?: boolean;
  currentLocationColor?: string;
}

type SuggestionsCacheEntry = {
  features: GeocodeSuggestion[];
  error: string;
};

const ADDRESS_SUGGESTION_CACHE = new Map<string, SuggestionsCacheEntry>();
const POSTCODE_ADDRESS_CACHE = new Map<string, SuggestionsCacheEntry>();
const CURRENT_LOCATION_CACHE = new Map<string, SuggestionsCacheEntry>();
const MAX_ADDRESS_CACHE_ENTRIES = 80;
const GEOLOCATION_CACHED_TIMEOUT_MS = 2500;
const GEOLOCATION_TIMEOUT_MS = 12000;
const GEOLOCATION_HIGH_ACCURACY_TIMEOUT_MS = 20000;
const GEOLOCATION_MAXIMUM_AGE_MS = 15 * 60 * 1000;
const REVERSE_GEOCODE_TIMEOUT_MS = 12000;
const LOCATION_AUTOFILL_FALLBACK_MESSAGE =
  "We couldn't auto-fill your address from your location. Start typing your address instead.";
const LOCATION_TIMEOUT_MESSAGE =
  "We couldn't get your location quickly enough. Start typing your address instead.";
const LOCATION_INSECURE_CONTEXT_MESSAGE =
  "Current location only works on HTTPS or localhost. Start typing your address instead.";
const LOCATION_PERMISSION_MESSAGE =
  "Location permission is blocked. Allow location access in your browser, then try again.";
const LOCATION_UNAVAILABLE_MESSAGE =
  "Couldn't read your current position. Start typing your address instead.";
const LOCATION_OUTSIDE_SCOTLAND_MESSAGE =
  "Your current location is outside our Scotland pickup area. Enter a Scottish pickup address instead.";
const LOCATION_OUTSIDE_UK_MESSAGE =
  "Your current location is outside the UK. Enter a UK address instead.";
const GEOLOCATION_PERMISSION_DENIED = 1;
const GEOLOCATION_POSITION_UNAVAILABLE = 2;
const GEOLOCATION_TIMEOUT = 3;
const UK_COORDINATE_BOUNDS = {
  minLat: 49.75,
  maxLat: 61.05,
  minLng: -8.85,
  maxLng: 1.85,
};
const SCOTLAND_SEARCH_PROXIMITY = {
  // Rutherglen / south-east Glasgow: a better default for local Scottish pickup searches.
  lat: 55.828,
  lng: -4.214,
};

function getBrowserPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function getWatchedPosition(
  options: PositionOptions,
  timeoutMs: number
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let watchId: number | null = null;
    let timeout: number | null = null;

    const finish = (
      position: GeolocationPosition | null,
      error?: GeolocationPositionError | { code: number }
    ) => {
      if (settled) return;
      settled = true;
      if (timeout !== null) {
        window.clearTimeout(timeout);
      }
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (position) {
        resolve(position);
      } else {
        reject(error ?? new Error("Geolocation unavailable"));
      }
    };

    timeout = window.setTimeout(() => {
      finish(null, { code: GEOLOCATION_TIMEOUT });
    }, timeoutMs);

    watchId = navigator.geolocation.watchPosition(
      (position) => finish(position),
      (error) => finish(null, error),
      options
    );
  });
}

function isGeolocationError(error: unknown): error is { code: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "number"
  );
}

function isCoordinateInUk(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= UK_COORDINATE_BOUNDS.minLat &&
    lat <= UK_COORDINATE_BOUNDS.maxLat &&
    lng >= UK_COORDINATE_BOUNDS.minLng &&
    lng <= UK_COORDINATE_BOUNDS.maxLng
  );
}

function isCoordinateInScotland(lat: number, lng: number) {
  return lat >= 54.55 && lat <= 61.05 && lng >= -8.85 && lng <= -0.65;
}

function currentLocationScopeError(scope: "uk" | "scotland", lat: number, lng: number) {
  if (scope === "scotland" && !isCoordinateInScotland(lat, lng)) {
    return LOCATION_OUTSIDE_SCOTLAND_MESSAGE;
  }

  if (!isCoordinateInUk(lat, lng)) {
    return LOCATION_OUTSIDE_UK_MESSAGE;
  }

  return "";
}

function normalizeProximity(
  proximity: Pick<AddressData, "lat" | "lng"> | null | undefined
) {
  if (!proximity) return null;
  if (!Number.isFinite(proximity.lat) || !Number.isFinite(proximity.lng)) return null;

  return {
    lat: proximity.lat,
    lng: proximity.lng,
  };
}

function normalizePostcode(value: string) {
  return value.toUpperCase().replace(/\s+/g, "");
}

async function getCurrentPositionWithFallback(): Promise<GeolocationPosition> {
  const attempts = [
    () =>
      getBrowserPosition({
        enableHighAccuracy: false,
        timeout: GEOLOCATION_CACHED_TIMEOUT_MS,
        maximumAge: GEOLOCATION_MAXIMUM_AGE_MS,
      }),
    () =>
      getBrowserPosition({
        enableHighAccuracy: true,
        timeout: GEOLOCATION_TIMEOUT_MS,
        maximumAge: 0,
      }),
    () =>
      getWatchedPosition(
        {
          enableHighAccuracy: true,
          timeout: GEOLOCATION_HIGH_ACCURACY_TIMEOUT_MS,
          maximumAge: 0,
        },
        GEOLOCATION_HIGH_ACCURACY_TIMEOUT_MS
      ),
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      if (
        isGeolocationError(error) &&
        error.code === GEOLOCATION_PERMISSION_DENIED
      ) {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError ?? new Error("Geolocation unavailable");
}

function rememberAddressResult(
  cache: Map<string, SuggestionsCacheEntry>,
  key: string,
  entry: SuggestionsCacheEntry
) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, entry);
  while (cache.size > MAX_ADDRESS_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
}

/** GPS button glyph with idle breathing and stronger active scan feedback. */
function GpsPulse({ color, locating = false }: { color: string; locating?: boolean }) {
  const shadow = `0 0 14px ${color}55`;

  return (
    <Box position="relative" w="34px" h="34px" flexShrink={0}>
      {(locating ? [0, 0.55, 1.1] : [0]).map((delay) => (
        <MotionBox
          key={delay}
          position="absolute"
          inset={locating ? "3px" : "6px"}
          borderRadius="full"
          border={`2px solid ${color}`}
          initial={false}
          animate={
            locating
              ? { scale: [0.55, 1.45], opacity: [0.6, 0] }
              : { scale: [0.86, 1.08, 0.86], opacity: [0.32, 0.12, 0.32] }
          }
          transition={{
            duration: locating ? 1.65 : 2.4,
            repeat: Infinity,
            ease: "easeOut",
            delay,
          }}
        />
      ))}
      {locating && (
        <MotionBox
          position="absolute"
          inset="1px"
          borderRadius="full"
          border="2px solid transparent"
          borderTopColor="#FFFFFF"
          borderRightColor={`${color}99`}
          animate={{ rotate: 360 }}
          transition={{ duration: 1.05, repeat: Infinity, ease: "linear" }}
        />
      )}
      {locating && (
        <MotionBox
          position="absolute"
          left="50%"
          top="50%"
          ml="-1px"
          mt="-15px"
          w="2px"
          h="15px"
          bg={`linear-gradient(180deg, ${color}, transparent)`}
          style={{ transformOrigin: "50% 100%" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1.35, repeat: Infinity, ease: "linear" }}
        />
      )}
      <MotionBox
        position="absolute"
        inset="8px"
        borderRadius="full"
        bg={color}
        boxShadow={shadow}
        display="flex"
        alignItems="center"
        justifyContent="center"
        color="#FFFFFF"
        initial={false}
        animate={
          locating
            ? { scale: [1, 1.12, 1], boxShadow: [shadow, `0 0 20px ${color}88`, shadow] }
            : { scale: [1, 1.04, 1] }
        }
        transition={{ duration: locating ? 0.9 : 2.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <MotionBox
          as="span"
          display="flex"
          initial={false}
          animate={locating ? { rotate: [0, -8, 8, 0], scale: [1, 1.1, 1] } : { rotate: 0, scale: 1 }}
          transition={{ duration: 0.9, repeat: locating ? Infinity : 0, ease: "easeInOut" }}
        >
          <FiCrosshair size={16} />
        </MotionBox>
      </MotionBox>
    </Box>
  );
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Start typing a UK address or postcode...",
  id,
  enableCurrentLocation = false,
  proximity,
  scope = "uk",
  scopeMessage = "We only collect from Scotland. Drop-off can be anywhere in the UK.",
  tone = "dark",
  embedded = false,
  currentLocationColor,
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value?.fullAddress ?? "");
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [restrictionError, setRestrictionError] = useState("");
  // Postcode-only refinement: when a customer picks a bare postcode we load all
  // addresses in that postcode so step 2 captures a precise full address.
  const [postcodeMode, setPostcodeMode] = useState<{
    postcode: string;
    lat: number;
    lng: number;
    region?: string;
    country?: string;
  } | null>(null);
  const [detailValue, setDetailValue] = useState("");
  const [postcodeAddresses, setPostcodeAddresses] = useState<GeocodeSuggestion[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [, setDetailOpen] = useState(false);
  const detailInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsAbortRef = useRef<AbortController | null>(null);
  const postcodeAbortRef = useRef<AbortController | null>(null);
  const currentLocationAbortRef = useRef<AbortController | null>(null);
  const lastExternalAddressRef = useRef(value?.fullAddress ?? "");
  const suggestionsRequestRef = useRef(0);
  const postcodeRequestRef = useRef(0);
  const locationRequestRef = useRef(0);

  // Sync inputValue when value prop changes externally
  useEffect(() => {
    const nextAddress = value?.fullAddress ?? "";
    if (nextAddress) {
      lastExternalAddressRef.current = nextAddress;
      setInputValue(nextAddress);
      return;
    }

    setInputValue((current) =>
      current === lastExternalAddressRef.current ? "" : current
    );
    lastExternalAddressRef.current = "";
  }, [value?.fullAddress]);

  const fetchSuggestions = useCallback(async (q: string) => {
    const query = q.trim();
    const normalizedProximity =
      normalizeProximity(proximity) ??
      (scope === "scotland" ? SCOTLAND_SEARCH_PROXIMITY : null);
    const proximityKey = normalizedProximity
      ? `${normalizedProximity.lat.toFixed(4)},${normalizedProximity.lng.toFixed(4)}`
      : "ip";

    if (query.length < 3) {
      suggestionsAbortRef.current?.abort();
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    const cacheKey = `${scope}:${proximityKey}:${query.toLowerCase()}`;
    const cached = ADDRESS_SUGGESTION_CACHE.get(cacheKey);
    if (cached) {
      suggestionsAbortRef.current?.abort();
      setSuggestions(cached.features);
      setRestrictionError(cached.error);
      setOpen(cached.features.length > 0);
      setLoading(false);
      return;
    }

    suggestionsAbortRef.current?.abort();
    const controller = new AbortController();
    suggestionsAbortRef.current = controller;
    const requestId = suggestionsRequestRef.current + 1;
    suggestionsRequestRef.current = requestId;
    setLoading(true);
    setRestrictionError("");
    try {
      const params = new URLSearchParams({ q: query });
      if (scope === "scotland") params.set("scope", "scotland");
      if (normalizedProximity) {
        params.set("proximityLat", String(normalizedProximity.lat));
        params.set("proximityLng", String(normalizedProximity.lng));
      } else {
        params.set("proximity", "ip");
      }
      const res = await fetch(`/api/booking/geocode?${params.toString()}`, {
        signal: controller.signal,
      });
      const data = (await res.json()) as {
        features: GeocodeSuggestion[];
        error?: string;
      };
      if (controller.signal.aborted || requestId !== suggestionsRequestRef.current) return;
      const entry = { features: data.features ?? [], error: data.error ?? "" };
      rememberAddressResult(ADDRESS_SUGGESTION_CACHE, cacheKey, entry);
      setSuggestions(entry.features);
      setRestrictionError(entry.error);
      setOpen(entry.features.length > 0);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setSuggestions([]);
    } finally {
      if (!controller.signal.aborted && requestId === suggestionsRequestRef.current) {
        setLoading(false);
      }
    }
  }, [proximity, scope]);

  const cancelCurrentLocation = useCallback(() => {
    currentLocationAbortRef.current?.abort();
    currentLocationAbortRef.current = null;
    locationRequestRef.current += 1;
    setLocating(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    cancelCurrentLocation();
    setInputValue(val);
    if (value) onChange(null); // clear selection once when user edits a chosen address
    setPostcodeMode(null); // leaving postcode-refine mode when editing the main field
    setRestrictionError("");
    setLocationError("");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(val);
    }, 250);
  };

  // Load every address in a postcode (PAF via getAddress.io, else Mapbox).
  const loadPostcodeAddresses = useCallback(async (postcode: string) => {
    const normalizedPostcode = postcode.trim().toUpperCase();
    const cacheKey = `${scope}:${normalizedPostcode}`;
    const cached = POSTCODE_ADDRESS_CACHE.get(cacheKey);
    if (cached) {
      postcodeAbortRef.current?.abort();
      setPostcodeAddresses(cached.features);
      setRestrictionError(cached.error);
      setDetailOpen(true);
      setDetailLoading(false);
      return;
    }

    postcodeAbortRef.current?.abort();
    const controller = new AbortController();
    postcodeAbortRef.current = controller;
    const requestId = postcodeRequestRef.current + 1;
    postcodeRequestRef.current = requestId;
    setDetailLoading(true);
    setPostcodeAddresses([]);
    setRestrictionError("");
    try {
      const params = new URLSearchParams({ postcode: normalizedPostcode });
      if (scope === "scotland") params.set("scope", "scotland");
      const res = await fetch(`/api/booking/postcode-addresses?${params.toString()}`, {
        signal: controller.signal,
      });
      const data = (await res.json()) as {
        addresses: GeocodeSuggestion[];
        error?: string;
      };
      if (controller.signal.aborted || requestId !== postcodeRequestRef.current) return;
      const entry = {
        features: data.addresses ?? [],
        error: data.error ?? (!res.ok ? scopeMessage : ""),
      };
      rememberAddressResult(POSTCODE_ADDRESS_CACHE, cacheKey, entry);
      setPostcodeAddresses(entry.features);
      setRestrictionError(entry.error);
      setDetailOpen(true);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setPostcodeAddresses([]);
    } finally {
      if (!controller.signal.aborted && requestId === postcodeRequestRef.current) {
        setDetailLoading(false);
      }
    }
  }, [scope, scopeMessage]);

  const handleSelect = (suggestion: GeocodeSuggestion) => {
    cancelCurrentLocation();
    setLocationError("");
    setSuggestions([]);
    setOpen(false);

    // Postcode-only pick → don't finalise yet. Immediately list all addresses in
    // that postcode so the booking captures a precise full address (and an
    // accurate distance/price).
    if (suggestion.type === "postcode") {
      const pc = suggestion.postcode || suggestion.fullAddress.split(",")[0]?.trim() || suggestion.fullAddress.trim();
      setPostcodeMode({
        postcode: pc,
        lat: suggestion.lat,
        lng: suggestion.lng,
        region: suggestion.region,
        country: suggestion.country,
      });
      setInputValue(suggestion.fullAddress);
      setDetailValue("");
      onChange(null); // incomplete until a full address is provided
      void loadPostcodeAddresses(pc);
      window.setTimeout(() => detailInputRef.current?.focus(), 0);
      return;
    }

    const address: AddressData = {
      fullAddress: suggestion.fullAddress,
      lat: suggestion.lat,
      lng: suggestion.lng,
      postcode: suggestion.postcode,
      city: suggestion.city,
      region: suggestion.region,
      country: suggestion.country,
    };
    setPostcodeMode(null);
    setRestrictionError("");
    setLocationError("");
    onChange(address);
    setInputValue(suggestion.fullAddress);
  };

  // Client-side filter of the loaded postcode address list by what the user types.
  const filteredPostcodeAddresses = (() => {
    const q = detailValue.trim().toLowerCase();
    if (!q) return postcodeAddresses;
    return postcodeAddresses.filter((a) =>
      a.fullAddress.toLowerCase().includes(q)
    );
  })();

  const handleDetailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!postcodeMode) return;
    setDetailValue(e.target.value);
    setDetailOpen(true);
  };

  const handleDetailSelect = (suggestion: GeocodeSuggestion) => {
    const address: AddressData = {
      fullAddress: suggestion.fullAddress,
      lat: suggestion.lat,
      lng: suggestion.lng,
      postcode: suggestion.postcode || postcodeMode?.postcode || "",
      city: suggestion.city,
      region: suggestion.region ?? postcodeMode?.region,
      country: suggestion.country ?? postcodeMode?.country,
    };
    onChange(address);
    setInputValue(suggestion.fullAddress);
    setPostcodeMode(null);
    setDetailValue("");
    setPostcodeAddresses([]);
    setDetailOpen(false);
    setRestrictionError("");
    setLocationError("");
  };

  // Fallback: try to geocode the typed full address before using the postcode
  // centroid, so pricing and maps use a house-level point where Mapbox can find one.
  const handleDetailManualConfirm = async () => {
    if (!postcodeMode || detailValue.trim().length < 1) return;
    const line = detailValue.trim();
    const fullAddress = `${line}, ${postcodeMode.postcode}`;
    const fallbackAddress: AddressData = {
      fullAddress,
      lat: postcodeMode.lat,
      lng: postcodeMode.lng,
      postcode: postcodeMode.postcode,
      city: "",
      region: postcodeMode.region,
      country: postcodeMode.country,
    };

    let address = fallbackAddress;
    let usedPostcodeFallback = true;
    setDetailLoading(true);
    try {
      const params = new URLSearchParams({
        q: fullAddress,
        proximityLat: String(postcodeMode.lat),
        proximityLng: String(postcodeMode.lng),
      });
      if (scope === "scotland") params.set("scope", "scotland");
      const res = await fetch(`/api/booking/geocode?${params.toString()}`);
      const data = (await res.json().catch(() => ({ features: [] }))) as {
        features?: GeocodeSuggestion[];
      };
      const postcodeKey = normalizePostcode(postcodeMode.postcode);
      const match = (data.features ?? []).find((feature) => (
        feature.type === "address" &&
        normalizePostcode(feature.postcode || postcodeMode.postcode) === postcodeKey
      )) ?? (data.features ?? []).find((feature) => normalizePostcode(feature.postcode) === postcodeKey);

      if (res.ok && match) {
        address = {
          fullAddress: match.fullAddress,
          lat: match.lat,
          lng: match.lng,
          postcode: match.postcode || postcodeMode.postcode,
          city: match.city,
          region: match.region ?? postcodeMode.region,
          country: match.country ?? postcodeMode.country,
        };
        usedPostcodeFallback = false;
        setRestrictionError("");
      } else {
        setRestrictionError(
          "We couldn't locate that exact house number, so this quote uses the postcode area. Select an address from the list if available for a more precise price."
        );
      }
    } catch {
      setRestrictionError(
        "We couldn't locate that exact house number, so this quote uses the postcode area. Select an address from the list if available for a more precise price."
      );
    } finally {
      setDetailLoading(false);
    }

    onChange(address);
    setInputValue(address.fullAddress);
    setPostcodeMode(null);
    setDetailValue("");
    setPostcodeAddresses([]);
    setDetailOpen(false);
    if (!usedPostcodeFallback) setRestrictionError("");
    setLocationError("");
  };

  const handleUseCurrentLocation = useCallback(async () => {
    setLocationError("");
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setLocationError(LOCATION_INSECURE_CONTEXT_MESSAGE);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Location isn't supported on this device.");
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    suggestionsAbortRef.current?.abort();
    postcodeAbortRef.current?.abort();
    currentLocationAbortRef.current?.abort();
    currentLocationAbortRef.current = null;
    const requestId = locationRequestRef.current + 1;
    locationRequestRef.current = requestId;

    setLoading(false);
    setDetailLoading(false);
    setSuggestions([]);
    setPostcodeAddresses([]);
    setOpen(false);
    setDetailOpen(false);
    setPostcodeMode(null);
    setDetailValue("");
    setRestrictionError("");
    setLocating(true);

    let reverseTimedOut = false;
    let reverseTimeout: number | null = null;

    try {
      const pos = await getCurrentPositionWithFallback();
      if (requestId !== locationRequestRef.current) return;

      const { latitude, longitude } = pos.coords;
      const scopeError = currentLocationScopeError(scope, latitude, longitude);
      if (scopeError) {
        setLocationError(scopeError);
        return;
      }

      const cacheKey = `${scope}:${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
      const cached = CURRENT_LOCATION_CACHE.get(cacheKey);
      if (cached) {
        const match = cached.features[0];
        if (match) {
          handleSelect(match);
        } else if (requestId === locationRequestRef.current) {
          setLocationError(
            cached.error ||
              (scope === "scotland"
                ? scopeMessage
                : "Couldn't find your address. Try typing it.")
          );
        }
        return;
      }

      const reverseController = new AbortController();
      currentLocationAbortRef.current = reverseController;
      reverseTimeout = window.setTimeout(() => {
        reverseTimedOut = true;
        reverseController.abort();
      }, REVERSE_GEOCODE_TIMEOUT_MS);

      const params = new URLSearchParams({
        lat: String(latitude),
        lng: String(longitude),
      });
      if (scope === "scotland") params.set("scope", "scotland");
      const res = await fetch(`/api/booking/geocode?${params.toString()}`, {
        signal: reverseController.signal,
      });
      const data = (await res.json().catch(() => ({
        features: [],
        error: LOCATION_AUTOFILL_FALLBACK_MESSAGE,
      }))) as {
        features: GeocodeSuggestion[];
        error?: string;
      };
      if (reverseController.signal.aborted || requestId !== locationRequestRef.current) return;

      const entry = {
        features: data.features ?? [],
        error: data.error ?? (!res.ok ? LOCATION_AUTOFILL_FALLBACK_MESSAGE : ""),
      };
      if (!res.ok) {
        setLocationError(entry.error || LOCATION_AUTOFILL_FALLBACK_MESSAGE);
        return;
      }
      rememberAddressResult(CURRENT_LOCATION_CACHE, cacheKey, entry);
      const match = entry.features[0];
      if (match) {
        handleSelect(match);
      } else {
        setLocationError(
          entry.error ||
            (scope === "scotland"
              ? scopeMessage
              : "Couldn't find your address. Try typing it.")
        );
      }
    } catch (caught) {
      if (requestId !== locationRequestRef.current) return;

      if (caught instanceof DOMException && caught.name === "AbortError") {
        if (reverseTimedOut) {
          setLocationError(LOCATION_AUTOFILL_FALLBACK_MESSAGE);
        }
        return;
      }

      if (isGeolocationError(caught)) {
        setLocationError(
          caught.code === GEOLOCATION_PERMISSION_DENIED
            ? LOCATION_PERMISSION_MESSAGE
            : caught.code === GEOLOCATION_TIMEOUT
              ? LOCATION_TIMEOUT_MESSAGE
              : caught.code === GEOLOCATION_POSITION_UNAVAILABLE
                ? LOCATION_UNAVAILABLE_MESSAGE
                : "Couldn't get your location. Try again."
        );
        return;
      }

      setLocationError("Couldn't fetch your location. Try again.");
    } finally {
      if (reverseTimeout) window.clearTimeout(reverseTimeout);
      if (requestId === locationRequestRef.current) {
        currentLocationAbortRef.current = null;
        setLocating(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelCurrentLocation, scope, scopeMessage]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setDetailOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Clean up pending timers on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      suggestionsAbortRef.current?.abort();
      postcodeAbortRef.current?.abort();
      currentLocationAbortRef.current?.abort();
    };
  }, []);

  const isSelected = !!value;
  const isLight = tone === "light";
  const ui = {
    panel: isLight ? "#FFFFFF" : "#1a2540",
    inputBg: isLight ? "#FFFFFF" : "rgba(255,255,255,0.06)",
    inputHoverBg: isLight ? "#FFFFFF" : "rgba(255,255,255,0.08)",
    muted: isLight ? "#647780" : "rgba(255,255,255,0.5)",
    faint: isLight ? "#8EA0A8" : "rgba(255,255,255,0.4)",
    text: isLight ? "#14323C" : "white",
    placeholder: isLight ? "#93A4AB" : "rgba(255,255,255,0.3)",
    border: isLight ? "#DCE7EA" : "rgba(255,255,255,0.12)",
    borderSoft: isLight ? "#E7EFF2" : "rgba(255,255,255,0.06)",
    selected: isLight ? "#00A878" : colors.emerald,
    selectedDark: isLight ? "#078464" : colors.emerald,
    selectedSoft: isLight ? "#E4F8F1" : "rgba(16,185,129,0.12)",
    warning: isLight ? "#B77900" : colors.amber,
    warningSoft: isLight ? "#FFF8D9" : "rgba(245,158,11,0.1)",
    shadow: isLight ? "0 18px 44px rgba(20,50,60,0.16)" : "0 16px 48px rgba(0,0,0,0.5)",
    hover: isLight ? "#F4FBF8" : "rgba(255,255,255,0.06)",
  };
  const gpsColor = currentLocationColor ?? ui.selected;

  const clearAddress = useCallback(() => {
    cancelCurrentLocation();
    setInputValue("");
    setSuggestions([]);
    setOpen(false);
    setPostcodeMode(null);
    setDetailValue("");
    setPostcodeAddresses([]);
    setRestrictionError("");
    setLocationError("");
    onChange(null);
  }, [cancelCurrentLocation, onChange]);

  return (
    <Box position="relative" ref={containerRef} w="full">
      <Box position="relative">
        {enableCurrentLocation ? (
          <chakra.button
            type="button"
            onClick={handleUseCurrentLocation}
            onMouseDown={(event) => event.preventDefault()}
            disabled={locating}
            aria-label="Use my current location"
            title="Use my current location"
            position="absolute"
            left="6px"
            top="50%"
            transform="translateY(-50%)"
            zIndex={3}
            w="34px"
            h="34px"
            borderRadius="full"
            display="flex"
            alignItems="center"
            justifyContent="center"
            color="#FFFFFF"
            cursor={locating ? "default" : "pointer"}
            opacity={locating ? 0.76 : 1}
            transition="transform 0.18s ease, opacity 0.18s ease"
            _hover={locating ? {} : { transform: "translateY(-50%) scale(1.05)" }}
            _focusVisible={{ outline: `2px solid ${gpsColor}`, outlineOffset: "2px" }}
          >
            {locating ? (
              <GpsPulse color={gpsColor} locating />
            ) : (
              <GpsPulse color={gpsColor} />
            )}
          </chakra.button>
        ) : (
          <Box
            position="absolute"
            left={3}
            top="50%"
            transform="translateY(-50%)"
            pointerEvents="none"
            zIndex={1}
            color={isSelected ? ui.selected : ui.faint}
          >
            <HiLocationMarker size={18} />
          </Box>
        )}
        <Box
          asChild
          w="full"
          h={embedded ? "53px" : undefined}
          pl={enableCurrentLocation ? "48px" : "42px"}
          pr={loading || value ? "42px" : "12px"}
          py={embedded ? 0 : 3}
          bg={ui.inputBg}
          border={embedded ? "0" : `2px solid ${isSelected ? ui.selected : ui.border}`}
          borderRadius={embedded ? "0" : "lg"}
          color={ui.text}
          fontSize={embedded ? "md" : "sm"}
          fontFamily="body"
          transition="border-color 0.2s"
          _placeholder={{ color: ui.placeholder }}
          _focus={{
            outline: "none",
            borderColor: ui.selected,
            bg: ui.inputHoverBg,
            boxShadow: embedded ? undefined : isLight ? "0 0 0 3px rgba(0,168,120,0.12)" : undefined,
          }}
        >
          <input
            id={id}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder={placeholder}
            autoComplete="off"
            style={{ WebkitAppearance: "none", width: "100%", height: "100%", outline: "none" }}
          />
        </Box>
        {loading && (
          <Box position="absolute" right={3} top="50%" transform="translateY(-50%)">
            <Spinner size="sm" color={ui.selected} />
          </Box>
        )}
        {!loading && value && (
          <chakra.button
            type="button"
            aria-label="Clear address"
            title="Clear address"
            onClick={clearAddress}
            onMouseDown={(event) => event.preventDefault()}
            position="absolute"
            right={2}
            top="50%"
            transform="translateY(-50%)"
            zIndex={3}
            w="30px"
            h="30px"
            borderRadius="md"
            display="flex"
            alignItems="center"
            justifyContent="center"
            color={ui.muted}
            _hover={{ bg: isLight ? "#EEF4F7" : "rgba(255,255,255,0.08)", color: ui.text }}
            _focusVisible={{ outline: `2px solid ${ui.selected}`, outlineOffset: "2px" }}
          >
            <HiX size={16} />
          </chakra.button>
        )}
      </Box>
      {restrictionError && (
        <Text mt={1} fontSize="xs" color={ui.warning}>
          {restrictionError}
        </Text>
      )}

      {/* Postcode pick → choose the exact address from the full list */}
      {postcodeMode && (
        <Box mt={2} position="relative">
          <Box
            mb={2}
            px={3}
            py={2}
            bg={ui.warningSoft}
            border={`1px solid ${ui.warning}`}
            borderRadius="lg"
          >
            <Text fontSize="xs" color={ui.warning} fontWeight={800}>
              Select your address in {postcodeMode.postcode}
            </Text>
            <Text fontSize="xs" color={ui.muted} mt={0.5}>
              We need the full address to quote the right price.
            </Text>
          </Box>
          <Box position="relative">
            <Box
              position="absolute"
              left={3}
              top="50%"
              transform="translateY(-50%)"
              pointerEvents="none"
              zIndex={1}
              color={ui.faint}
            >
              <HiLocationMarker size={18} />
            </Box>
            <Box
              asChild
              w="full"
              pl="42px"
              pr={detailLoading ? "42px" : "12px"}
              py={3}
              bg={ui.inputBg}
              border={`2px solid ${ui.warning}`}
              borderRadius="lg"
              color={ui.text}
              fontSize="sm"
              fontFamily="body"
              transition="border-color 0.2s"
              _placeholder={{ color: ui.placeholder }}
              _focus={{ outline: "none", bg: ui.inputHoverBg }}
            >
              <input
                ref={detailInputRef}
                type="text"
                value={detailValue}
                onChange={handleDetailChange}
                onFocus={() => setDetailOpen(true)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (filteredPostcodeAddresses.length === 1 && filteredPostcodeAddresses[0]) {
                      handleDetailSelect(filteredPostcodeAddresses[0]);
                    } else {
                      handleDetailManualConfirm();
                    }
                  }
                }}
                placeholder="Filter or type your house/flat number"
                autoComplete="address-line1"
                style={{ WebkitAppearance: "none" }}
              />
            </Box>
            {detailLoading && (
              <Box position="absolute" right={3} top="50%" transform="translateY(-50%)">
                <Spinner size="sm" color={ui.warning} />
              </Box>
            )}
          </Box>

          {/* Full address list for the postcode */}
          {!detailLoading && (
            <Box
              mt={2}
              bg={ui.panel}
              border={`1px solid ${ui.border}`}
              borderRadius="lg"
              boxShadow={ui.shadow}
              overflow="hidden"
              maxH="280px"
              overflowY="auto"
            >
              {filteredPostcodeAddresses.length > 0 ? (
                filteredPostcodeAddresses.map((s, i) => (
                  <Box
                    key={s.id}
                    as="button"
                    w="full"
                    textAlign="left"
                    px={4}
                    py={3}
                    display="flex"
                    alignItems="flex-start"
                    gap={3}
                    bg="transparent"
                    borderBottom={
                      i < filteredPostcodeAddresses.length - 1
                        ? `1px solid ${ui.borderSoft}`
                        : undefined
                    }
                    _hover={{ bg: ui.hover }}
                    cursor="pointer"
                    onClick={() => handleDetailSelect(s)}
                  >
                    <Box pt="2px" flexShrink={0} color={ui.faint}>
                      <HiLocationMarker size={14} />
                    </Box>
                    <Text fontSize="sm" color={ui.text} lineHeight="tight" fontFamily="body">
                      {s.fullAddress}
                    </Text>
                  </Box>
                ))
              ) : (
                <Box px={4} py={3}>
                  <Text fontSize="sm" color={ui.muted}>
                    {postcodeAddresses.length === 0
                      ? "Type your house or flat number, then press Enter."
                      : "No match — type your address and press Enter."}
                  </Text>
                </Box>
              )}
            </Box>
          )}

          {detailValue.trim().length > 0 && filteredPostcodeAddresses.length === 0 && (
            <Box
              as="button"
              mt={2}
              onClick={handleDetailManualConfirm}
              px={3}
              py={1.5}
              borderRadius="lg"
              bg="transparent"
              border={`1px solid ${ui.selected}`}
              color={ui.selectedDark}
              fontSize="xs"
              fontWeight={600}
              cursor="pointer"
              _hover={{ bg: ui.selectedSoft }}
            >
              Use “{detailValue.trim()}, {postcodeMode.postcode}”
            </Box>
          )}
        </Box>
      )}

      {enableCurrentLocation && locationError && (
        <Text mt={1} fontSize="xs" color={ui.warning}>
          {locationError}
        </Text>
      )}

      {open && suggestions.length > 0 && (
        <Box
          position="absolute"
          top="calc(100% + 6px)"
          left={0}
          right={0}
          bg={ui.panel}
          border={`1px solid ${ui.border}`}
          borderRadius="lg"
          boxShadow={ui.shadow}
          overflow="hidden"
          zIndex={100}
          maxH="280px"
          overflowY="auto"
        >
          {suggestions.map((s, i) => (
            <Box
              key={s.id}
              as="button"
              w="full"
              textAlign="left"
              px={4}
              py={3}
              display="flex"
              alignItems="flex-start"
              gap={3}
              bg="transparent"
              borderBottom={i < suggestions.length - 1 ? `1px solid ${ui.borderSoft}` : undefined}
              _hover={{ bg: ui.hover }}
              cursor="pointer"
              onClick={() => handleSelect(s)}
            >
              <Box pt="2px" flexShrink={0} color={ui.faint}>
                <HiLocationMarker size={14} />
              </Box>
              <Box flex="1" minW={0}>
                <Text
                  fontSize="sm"
                  color={ui.text}
                  lineHeight="tight"
                  fontFamily="body"
                >
                  {s.fullAddress}
                </Text>
                {s.type === "postcode" && (
                  <Text fontSize="xs" color={ui.warning} mt={0.5}>
                    Postcode — we’ll ask for your house number
                  </Text>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

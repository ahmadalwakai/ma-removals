"use client";

import { useState, useEffect, useRef } from "react";
import { Box, Flex, Text, VStack, HStack, SimpleGrid } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { HiSwitchVertical, HiOutlineLocationMarker, HiOutlineClock } from "react-icons/hi";
import { FiCheck, FiPackage, FiTool } from "react-icons/fi";
import { colors } from "@/lib/tokens";
import { parseItemWeightKg } from "@/lib/item-weight";
import {
  isScotlandAddress,
  SCOTLAND_PICKUP_MESSAGE,
} from "@/lib/service-area";
import { AddressAutocomplete } from "@/components/booking/AddressAutocomplete";
import { ItemPicker } from "@/components/booking/ItemPicker";
import type { BookingFormState, AddressData, SelectedItem } from "@/types/booking";

const MotionBox = motion.create(Box);

/** Smoothly counts a number up to its target whenever the target changes. */
function useAnimatedNumber(target: number, duration = 900) {
  const [value, setValue] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    const diff = target - from;
    prevRef.current = target;
    if (diff === 0) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(from + diff * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}

/** Animated distance figure, e.g. "154.3 mi". */
function AnimatedDistance({ miles }: { miles: number }) {
  const v = useAnimatedNumber(miles);
  return <>{v.toFixed(1)} mi</>;
}

/** Animated drive-time figure, e.g. "3h 11m" / "22m". */
function AnimatedDuration({ minutes }: { minutes: number }) {
  const v = Math.round(useAnimatedNumber(minutes));
  return <>{v < 60 ? `${v}m` : `${Math.floor(v / 60)}h ${v % 60}m`}</>;
}

interface FloorPickerProps {
  value: number;
  onChange: (v: number) => void;
  hasLift: boolean;
  onHasLiftChange: (v: boolean) => void;
}

function FloorPicker({ value, onChange, hasLift, onHasLiftChange }: FloorPickerProps) {
  const FLOORS = [
    { val: 0, label: "Ground" },
    { val: 1, label: "1st" },
    { val: 2, label: "2nd" },
    { val: 3, label: "3rd+" },
  ];
  return (
    <VStack align="start" gap={2} w="full">
      <Flex gap={2} flexWrap="wrap">
        {FLOORS.map(({ val, label }) => (
          <Box
            key={val}
            as="button"
            onClick={() => onChange(val)}
            px={3}
            py={1.5}
            borderRadius="lg"
            border={`2px solid ${value === val ? colors.emerald : "rgba(255,255,255,0.12)"}`}
            bg={value === val ? "rgba(16,185,129,0.1)" : "transparent"}
            color={value === val ? colors.emerald : "rgba(255,255,255,0.6)"}
            fontSize="xs"
            fontWeight={600}
            cursor="pointer"
            transition="all 0.15s ease"
          >
            {label}
          </Box>
        ))}
      </Flex>
      {value > 0 && (
        <Box
          as="button"
          onClick={() => onHasLiftChange(!hasLift)}
          display="flex"
          alignItems="center"
          gap={2}
          cursor="pointer"
        >
          <Box
            w="18px"
            h="18px"
            borderRadius="md"
            border={`2px solid ${hasLift ? colors.emerald : "rgba(255,255,255,0.25)"}`}
            bg={hasLift ? colors.emerald : "transparent"}
            display="flex"
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
          >
            {hasLift && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </Box>
          <Text fontSize="xs" color="rgba(255,255,255,0.6)">
            Lift available
          </Text>
        </Box>
      )}
    </VStack>
  );
}

// ---- Route map with animated radar-pulse markers ----

function lngToNx(lng: number) {
  return (lng + 180) / 360;
}
function latToNy(lat: number) {
  const r = (lat * Math.PI) / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2;
}
function nyToLat(ny: number) {
  const n = Math.PI - 2 * Math.PI * ny;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/** Decode a Mapbox/Google encoded polyline (precision 5) into [lng, lat] pairs. */
function decodePolyline(str: string): Array<{ lng: number; lat: number }> {
  const coords: Array<{ lng: number; lat: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < str.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0;
    shift = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coords.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return coords;
}

/** Map pin with A/B label, outer halo, staggered pulse rings, and strong glow. */
function MapPin({ color, x, y, label }: { color: string; x: number; y: number; label: string }) {
  const size = 20;
  const halo = size + 10;
  return (
    <Box position="absolute" left={`${x}px`} top={`${y}px`} pointerEvents="none" zIndex={3}>
      {/* Staggered pulse rings */}
      {[0, 1.1].map((delay) => (
        <MotionBox
          key={delay}
          position="absolute"
          left="0"
          top="0"
          ml={`${-halo / 2}px`}
          mt={`${-halo / 2}px`}
          w={`${halo}px`}
          h={`${halo}px`}
          borderRadius="full"
          border={`1.5px solid ${color}`}
          initial={{ scale: 1, opacity: 0.55 }}
          animate={{ scale: 3.6, opacity: 0 }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut", delay }}
        />
      ))}
      {/* Outer halo ring */}
      <Box
        position="absolute"
        left="0"
        top="0"
        ml={`${-halo / 2}px`}
        mt={`${-halo / 2}px`}
        w={`${halo}px`}
        h={`${halo}px`}
        borderRadius="full"
        border={`1px solid ${color}40`}
      />
      {/* Pin circle with label */}
      <Box
        position="absolute"
        left="0"
        top="0"
        ml={`${-size / 2}px`}
        mt={`${-size / 2}px`}
        w={`${size}px`}
        h={`${size}px`}
        borderRadius="full"
        bg={color}
        border="2.5px solid white"
        boxShadow={`0 2px 12px rgba(0,0,0,0.7), 0 0 20px ${color}90`}
        display="flex"
        alignItems="center"
        justifyContent="center"
        zIndex={4}
      >
        <Text as="span" fontSize="9px" fontWeight={900} color="white" lineHeight={1}>
          {label}
        </Text>
      </Box>
    </Box>
  );
}

interface RouteMapPreviewProps {
  pickup: AddressData;
  dropoff: AddressData;
  token: string;
  geometry: string | null;
}

export function RouteMapPreview({ pickup, dropoff, token, geometry }: RouteMapPreviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 220 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setDims({ w: Math.round(cr.width), h: Math.round(cr.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const PADDING = 44;

  // Build the set of points to fit: the full route if available, else the two endpoints.
  const routePoints = geometry ? decodePolyline(geometry) : [];
  const fitPoints =
    routePoints.length > 1
      ? routePoints
      : [
          { lng: pickup.lng, lat: pickup.lat },
          { lng: dropoff.lng, lat: dropoff.lat },
        ];
  const fitN = fitPoints.map((p) => ({ nx: lngToNx(p.lng), ny: latToNy(p.lat) }));

  const p1 = { nx: lngToNx(pickup.lng), ny: latToNy(pickup.lat) };
  const p2 = { nx: lngToNx(dropoff.lng), ny: latToNy(dropoff.lat) };
  const minNx = Math.min(...fitN.map((p) => p.nx));
  const maxNx = Math.max(...fitN.map((p) => p.nx));
  const minNy = Math.min(...fitN.map((p) => p.ny));
  const maxNy = Math.max(...fitN.map((p) => p.ny));
  const centerNx = (minNx + maxNx) / 2;
  const centerNy = (minNy + maxNy) / 2;
  const centerLng = centerNx * 360 - 180;
  const centerLat = nyToLat(centerNy);

  // Clamp the requested size so width*2 (the @2x render) stays within Mapbox's 1280px limit.
  const w = Math.min(Math.max(dims.w, 1), 640);
  const h = dims.h;

  const fracX = Math.max(maxNx - minNx, 1e-9);
  const fracY = Math.max(maxNy - minNy, 1e-9);
  const availW = Math.max(w - 2 * PADDING, 1);
  const availH = Math.max(h - 2 * PADDING, 1);
  const zoomX = Math.log2(availW / (fracX * 512));
  const zoomY = Math.log2(availH / (fracY * 512));
  let zoom = Math.min(zoomX, zoomY, 16);
  if (!Number.isFinite(zoom)) zoom = 13;
  zoom = Math.max(1, zoom);

  const worldSize = 512 * Math.pow(2, zoom);
  const project = (p: { nx: number; ny: number }) => ({
    x: (p.nx - centerNx) * worldSize + dims.w / 2,
    y: (p.ny - centerNy) * worldSize + dims.h / 2,
  });
  const a = project(p1);
  const b = project(p2);

  // Route line overlay (Mapbox static "path" using the encoded polyline).
  const pathOverlay =
    routePoints.length > 1 && geometry
      ? `path-4+10b981-0.9(${encodeURIComponent(geometry)})/`
      : "";

  const buildUrl = (overlay: string) =>
    `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${overlay}${centerLng.toFixed(
      6
    )},${centerLat.toFixed(6)},${zoom.toFixed(2)}/${w}x${h}@2x?access_token=${token}`;

  // Mapbox rejects static-image requests whose URL exceeds ~8192 chars. Long
  // routes produce a huge encoded polyline, so drop the path overlay (keep the
  // base map + markers) rather than render a broken image.
  let mapUrl = buildUrl(pathOverlay);
  let overlayDropped = false;
  if (mapUrl.length > 8000) {
    mapUrl = buildUrl("");
    overlayDropped = true;
  }

  // When the baked-in Mapbox route line was dropped (or unavailable), draw the
  // route ourselves from the projected points so a line always connects the
  // pickup and dropoff markers.
  const drawClientRoute = overlayDropped || !pathOverlay;
  const routePixels =
    routePoints.length > 1
      ? routePoints.map((p) => project({ nx: lngToNx(p.lng), ny: latToNy(p.lat) }))
      : [a, b];
  const routePointsStr = routePixels.map((p) => `${p.x},${p.y}`).join(" ");

  const ready = dims.w > 0;

  return (
    <Box ref={ref} position="relative" w="full" h="220px" overflow="hidden">
      {/* Skeleton while dimensions initialise */}
      {!ready && (
        <Box
          w="full"
          h="220px"
          bg="rgba(255,255,255,0.03)"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Text fontSize="xs" fontWeight={600} color="rgba(255,255,255,0.18)" letterSpacing="1px">
            LOADING MAP…
          </Text>
        </Box>
      )}

      {/* Mapbox static base map */}
      {ready && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mapUrl}
          alt="Route map"
          style={{ width: "100%", height: "220px", objectFit: "cover", display: "block" }}
        />
      )}

      {/* Client-side route line (when Mapbox path overlay is unavailable) */}
      {ready && drawClientRoute && (
        <Box position="absolute" inset="0" pointerEvents="none" zIndex={1}>
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${dims.w} ${dims.h}`}
            preserveAspectRatio="none"
          >
            <defs>
              <filter id="routeGlow" x="-15%" y="-15%" width="130%" height="130%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* Drop shadow under route */}
            <polyline
              points={routePointsStr}
              fill="none"
              stroke="rgba(0,0,0,0.6)"
              strokeWidth={8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Glowing route line */}
            <polyline
              points={routePointsStr}
              fill="none"
              stroke={colors.emerald}
              strokeWidth={4.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#routeGlow)"
            />
          </svg>
        </Box>
      )}

      {/* A / B map pins */}
      {ready && (
        <>
          <MapPin color={colors.emerald} x={a.x} y={a.y} label="A" />
          <MapPin color="#F59E0B" x={b.x} y={b.y} label="B" />
        </>
      )}

      {/* Bottom gradient fade into stats bar */}
      <Box
        position="absolute"
        bottom={0}
        left={0}
        right={0}
        h="72px"
        background="linear-gradient(to top, rgba(11,17,32,0.95) 0%, transparent 100%)"
        pointerEvents="none"
        zIndex={2}
      />

      {/* "ROUTE PREVIEW" badge top-left */}
      <Box
        position="absolute"
        top={2}
        left={2}
        px="8px"
        py="4px"
        bg="rgba(0,0,0,0.55)"
        backdropFilter="blur(8px)"
        borderRadius="md"
        border="1px solid rgba(255,255,255,0.1)"
        zIndex={3}
      >
        <Text as="span" fontSize="9px" fontWeight={700} color="rgba(255,255,255,0.65)" letterSpacing="1px">
          ROUTE PREVIEW
        </Text>
      </Box>
    </Box>
  );
}

interface AddressItemStepProps {
  state: BookingFormState;
  update: (updates: Partial<BookingFormState>) => void;
  onNext: () => void;
  onBack?: () => void;
  showBack?: boolean;
  hideAddresses?: boolean;
}

const HOME_SIZE_OPTIONS = ["Studio", "1 Bed", "2 Bed", "3 Bed", "4 Bed", "5+ Bed"] as const;

function estimateHomeVariant(itemCount: number): string {
  if (itemCount <= 15) return "1 Bed";
  if (itemCount <= 30) return "2 Bed";
  if (itemCount <= 50) return "3 Bed";
  if (itemCount <= 75) return "4 Bed";
  return "5+ Bed";
}

function inferServiceFromItems(items: SelectedItem[]) {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const names = items.map((item) => item.name.toLowerCase()).join(" ");

  if (names.includes("piano")) return { service: "piano-moves", serviceVariant: "" };
  if (itemCount > 10) {
    return { service: "house-move", serviceVariant: estimateHomeVariant(itemCount) };
  }

  const furnitureWords = [
    "sofa",
    "wardrobe",
    "bed",
    "mattress",
    "table",
    "chair",
    "drawer",
    "cabinet",
    "bookcase",
    "desk",
    "recliner",
    "sideboard",
  ];
  const hasFurniture = furnitureWords.some((word) => names.includes(word));

  return {
    service: hasFurniture ? "furniture-removals" : "van-with-man",
    serviceVariant: "",
  };
}

function estimateHelpers(
  items: SelectedItem[],
  pickupFloor: number,
  pickupHasLift: boolean,
  dropoffFloor: number,
  dropoffHasLift: boolean
): number {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalKg = items.reduce(
    (sum, item) => sum + parseItemWeightKg(item.imagePath) * item.quantity,
    0
  );
  const hasDifficultAccess =
    (pickupFloor > 0 && !pickupHasLift) || (dropoffFloor > 0 && !dropoffHasLift);

  if (totalKg >= 700 || itemCount >= 40) return 3;
  if (totalKg >= 350 || itemCount >= 15 || hasDifficultAccess) return 2;
  if (totalKg >= 150 || itemCount >= 6) return 1;
  return 0;
}

function clearPricing() {
  return {
    pricingResult: null,
    priceBreakdown: null,
    selectedPrice: null,
    selectedDate: null,
    selectedTimeSlot: null,
  };
}

export function AddressItemStep({
  state,
  update,
  onNext,
  onBack,
  showBack = true,
  hideAddresses = false,
}: AddressItemStepProps) {
  const [error, setError] = useState("");
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [routeGeometry, setRouteGeometry] = useState<string | null>(null);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
  const hasRealToken = mapboxToken && mapboxToken !== "pk.placeholder";

  // Fetch directions when both addresses are set
  useEffect(() => {
    const pickup = state.pickupAddress;
    const dropoff = state.dropoffAddress;
    if (!pickup?.lat || !dropoff?.lat) return;

    const controller = new AbortController();
    setDistanceLoading(true);

    const from = `${pickup.lng},${pickup.lat}`;
    const to = `${dropoff.lng},${dropoff.lat}`;

    fetch(`/api/booking/directions?from=${from}&to=${to}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d: { distanceMiles?: number; durationMinutes?: number; geometry?: string | null }) => {
        if (d.distanceMiles !== undefined) {
          update({ distanceMiles: d.distanceMiles, durationMinutes: d.durationMinutes });
        }
        setRouteGeometry(d.geometry ?? null);
      })
      .catch(() => {})
      .finally(() => setDistanceLoading(false));

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pickupAddress?.fullAddress, state.dropoffAddress?.fullAddress]);

  const canContinue = !!state.pickupAddress && !!state.dropoffAddress;

  const handleContinue = () => {
    if (state.selectedItems.length === 0 && !(state.service === "house-move" && state.serviceVariant)) {
      setError("Please add at least one item, or choose a home size.");
      return;
    }
    if (!state.pickupAddress) {
      setError("Please enter a pickup address.");
      return;
    }
    if (!isScotlandAddress(state.pickupAddress)) {
      setError(SCOTLAND_PICKUP_MESSAGE);
      return;
    }
    if (!state.dropoffAddress) {
      setError("Please enter a dropoff address.");
      return;
    }
    setError("");

    // Invalidate any cached pricing so the next step recalculates with the
    // current items / floors / distance instead of reusing a stale quote.
    const moveDetails =
      state.service === "house-move" && state.serviceVariant
        ? { service: "house-move", serviceVariant: state.serviceVariant }
        : inferServiceFromItems(state.selectedItems);
    const helpersCount = estimateHelpers(
      state.selectedItems,
      state.pickupFloor,
      state.pickupHasLift,
      state.dropoffFloor,
      state.dropoffHasLift
    );

    update({
      ...moveDetails,
      helpersCount,
      ...clearPricing(),
    });
    onNext();
  };

  const totalItems = state.selectedItems.reduce((s, i) => s + i.quantity, 0);
  const selectedHomeSize = state.service === "house-move" ? state.serviceVariant : "";

  const handleItemsChange = (items: SelectedItem[]) => {
    const inferred =
      state.service === "house-move" && state.serviceVariant
        ? {}
        : inferServiceFromItems(items);

    update({
      selectedItems: items,
      ...inferred,
      ...clearPricing(),
    });
  };

  const handleHomeSizeSelect = (variant: string) => {
    update({
      service: "house-move",
      serviceVariant: variant,
      ...clearPricing(),
    });
  };

  const handleFewItemsSelect = () => {
    update({
      ...inferServiceFromItems(state.selectedItems),
      ...clearPricing(),
    });
  };

  const toggleAddon = (key: "needsPacking" | "needsAssembly") => {
    update({
      [key]: !state[key],
      ...clearPricing(),
    });
  };

  const showMap =
    hasRealToken && state.pickupAddress?.lat != null && state.dropoffAddress?.lat != null;

  return (
    <Box>
      <Box px={{ base: 4, md: 6 }} pt={6} pb="120px">
        {/* Section A — Inventory */}
        <VStack align="start" gap={4} mb={6}>
          <VStack align="start" gap={1}>
            <Text fontFamily="heading" fontSize={{ base: "xl", md: "2xl" }} fontWeight={800} color="white">
              What are you moving?
            </Text>
            <Text fontSize="sm" color="rgba(255,255,255,0.5)">
              {hideAddresses
                ? "Add the furniture, boxes, appliances, and any extras we should price."
                : "Add the items, then choose a home size only if this is a full home move."}
            </Text>
          </VStack>

          <ItemPicker
            serviceType={state.service}
            selectedItems={state.selectedItems}
            onItemsChange={handleItemsChange}
          />

          {!hideAddresses && (
          <Box w="full">
            <HStack justify="space-between" w="full" mb={2}>
              <Text fontSize="sm" fontWeight={700} color="white">
                Home size
              </Text>
              {totalItems > 0 && (
                <Box px={3} py={1} bg="rgba(16,185,129,0.15)" borderRadius="full">
                  <Text fontFamily="mono" fontSize="xs" fontWeight={700} color={colors.emerald}>
                    {totalItems} item{totalItems === 1 ? "" : "s"}
                  </Text>
                </Box>
              )}
            </HStack>
            <SimpleGrid columns={{ base: 2, sm: 3 }} gap={2} w="full">
              <Box
                as="button"
                onClick={handleFewItemsSelect}
                px={3}
                py={3}
                borderRadius="xl"
                border={`2px solid ${state.service !== "house-move" ? colors.emerald : "rgba(255,255,255,0.12)"}`}
                bg={state.service !== "house-move" ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.03)"}
                color={state.service !== "house-move" ? colors.emerald : "rgba(255,255,255,0.65)"}
                fontSize="xs"
                fontWeight={800}
                cursor="pointer"
                minH="52px"
                _hover={{ borderColor: colors.emerald }}
              >
                Few items
              </Box>
              {HOME_SIZE_OPTIONS.map((variant) => {
                const selected = selectedHomeSize === variant;
                return (
                  <Box
                    key={variant}
                    as="button"
                    onClick={() => handleHomeSizeSelect(variant)}
                    px={3}
                    py={3}
                    borderRadius="xl"
                    border={`2px solid ${selected ? colors.emerald : "rgba(255,255,255,0.12)"}`}
                    bg={selected ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.03)"}
                    color={selected ? colors.emerald : "rgba(255,255,255,0.65)"}
                    fontSize="xs"
                    fontWeight={800}
                    cursor="pointer"
                    minH="52px"
                    _hover={{ borderColor: colors.emerald }}
                  >
                    {variant}
                  </Box>
                );
              })}
            </SimpleGrid>
          </Box>
          )}

          <SimpleGrid columns={{ base: 1, sm: 2 }} gap={2} w="full">
            {([
              {
                key: "needsPacking" as const,
                label: "Packing help",
                text: "Bring materials and pack for me",
                icon: FiPackage,
              },
              {
                key: "needsAssembly" as const,
                label: "Dismantle & rebuild",
                text: "Beds, wardrobes, tables, sofas",
                icon: FiTool,
              },
            ]).map(({ key, label, text, icon: Icon }) => {
              const checked = state[key];
              return (
                <Box
                  key={key}
                  as="button"
                  onClick={() => toggleAddon(key)}
                  w="full"
                  minH="84px"
                  p={4}
                  borderRadius="xl"
                  border={`2px solid ${checked ? colors.amber : "rgba(255,255,255,0.1)"}`}
                  bg={checked ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.03)"}
                  textAlign="left"
                  display="flex"
                  alignItems="center"
                  gap={3}
                  cursor="pointer"
                  _hover={{ borderColor: checked ? colors.amber : "rgba(255,255,255,0.25)" }}
                >
                  <Box
                    w="38px"
                    h="38px"
                    borderRadius="lg"
                    bg={checked ? colors.amber : "rgba(255,255,255,0.06)"}
                    color={checked ? colors.midnight : "rgba(255,255,255,0.55)"}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    flexShrink={0}
                  >
                    {checked ? <FiCheck size={18} /> : <Icon size={18} />}
                  </Box>
                  <VStack align="start" gap={0}>
                    <Text fontSize="sm" fontWeight={800} color="white">
                      {label}
                    </Text>
                    <Text fontSize="xs" color="rgba(255,255,255,0.45)">
                      {text}
                    </Text>
                  </VStack>
                </Box>
              );
            })}
          </SimpleGrid>
        </VStack>

        {/* Section B — Addresses */}
        {!hideAddresses && (
        <VStack align="start" gap={4} mb={6}>
          <Text fontFamily="heading" fontSize={{ base: "xl", md: "2xl" }} fontWeight={800} color="white">
            Where from & where to?
          </Text>

          <Box w="full">
            <Text fontSize="sm" fontWeight={600} color="rgba(255,255,255,0.7)" mb={2}>
              Pickup address
            </Text>
            <AddressAutocomplete
              value={state.pickupAddress}
              onChange={(addr: AddressData | null) => {
                if (addr && !isScotlandAddress(addr)) {
                  setError(SCOTLAND_PICKUP_MESSAGE);
                  update({ pickupAddress: null, ...clearPricing() });
                  return;
                }
                setError("");
                update({ pickupAddress: addr, ...clearPricing() });
              }}
              placeholder="Collection address or postcode..."
              enableCurrentLocation
              scope="scotland"
              scopeMessage={SCOTLAND_PICKUP_MESSAGE}
            />
            <Box mt={3}>
              <Text fontSize="xs" fontWeight={600} color="rgba(255,255,255,0.5)" mb={2}>
                Floor level
              </Text>
              <FloorPicker
                value={state.pickupFloor}
                onChange={(v) => update({ pickupFloor: v })}
                hasLift={state.pickupHasLift}
                onHasLiftChange={(v) => update({ pickupHasLift: v })}
              />
            </Box>
          </Box>

          {/* Swap icon */}
          <Flex justify="center" w="full">
            <Box color="rgba(255,255,255,0.2)">
              <HiSwitchVertical size={20} />
            </Box>
          </Flex>

          {/* Section B — Dropoff */}
          <Box w="full">
            <Text fontSize="sm" fontWeight={600} color="rgba(255,255,255,0.7)" mb={2}>
              Dropoff address
            </Text>
            <AddressAutocomplete
              value={state.dropoffAddress}
              onChange={(addr: AddressData | null) => update({ dropoffAddress: addr, ...clearPricing() })}
              placeholder="Delivery / destination address..."
              enableCurrentLocation
            />
            <Box mt={3}>
              <Text fontSize="xs" fontWeight={600} color="rgba(255,255,255,0.5)" mb={2}>
                Floor level
              </Text>
              <FloorPicker
                value={state.dropoffFloor}
                onChange={(v) => update({ dropoffFloor: v })}
                hasLift={state.dropoffHasLift}
                onHasLiftChange={(v) => update({ dropoffHasLift: v })}
              />
            </Box>
          </Box>
        </VStack>
        )}

        {/* Section C — Distance preview */}
        {!hideAddresses && (state.pickupAddress && state.dropoffAddress) && (
          <MotionBox
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            mb={6}
            position="relative"
            borderRadius="xl"
            overflow="hidden"
            border="1px solid rgba(255,255,255,0.08)"
          >
            {showMap && (
              <RouteMapPreview
                pickup={state.pickupAddress!}
                dropoff={state.dropoffAddress!}
                token={mapboxToken}
                geometry={routeGeometry}
              />
            )}
            <Box
              px={4}
              py={3}
              bg="rgba(11,17,32,0.8)"
              backdropFilter="blur(12px)"
              borderTop="1px solid rgba(255,255,255,0.07)"
            >
              {distanceLoading ? (
                <HStack gap={3} py="2px">
                  <MotionBox
                    w="8px"
                    h="8px"
                    borderRadius="full"
                    bg={colors.emerald}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <Text fontSize="sm" color="rgba(255,255,255,0.4)" fontWeight={500} letterSpacing="0.2px">
                    Calculating route…
                  </Text>
                </HStack>
              ) : (
                <HStack gap={5}>
                  <HStack gap="10px" align="center">
                    <Box color={colors.emerald} mt="1px" opacity={0.9}>
                      <HiOutlineLocationMarker size={15} />
                    </Box>
                    <VStack gap={0} align="start">
                      <Text fontFamily="mono" fontSize="lg" fontWeight={700} color={colors.emerald} lineHeight={1}>
                        {state.distanceMiles != null ? (
                          <AnimatedDistance miles={state.distanceMiles} />
                        ) : (
                          "— mi"
                        )}
                      </Text>
                      <Text
                        fontSize="9px"
                        fontWeight={600}
                        color="rgba(255,255,255,0.38)"
                        letterSpacing="0.5px"
                        textTransform="uppercase"
                      >
                        distance
                      </Text>
                    </VStack>
                  </HStack>
                  {state.durationMinutes != null && (
                    <>
                      <Box w="1px" h="28px" bg="rgba(255,255,255,0.1)" />
                      <HStack gap="10px" align="center">
                        <Box color="rgba(255,255,255,0.5)" mt="1px">
                          <HiOutlineClock size={15} />
                        </Box>
                        <VStack gap={0} align="start">
                          <Text fontFamily="mono" fontSize="lg" fontWeight={700} color="white" lineHeight={1}>
                            <AnimatedDuration minutes={state.durationMinutes} />
                          </Text>
                          <Text
                            fontSize="9px"
                            fontWeight={600}
                            color="rgba(255,255,255,0.38)"
                            letterSpacing="0.5px"
                            textTransform="uppercase"
                          >
                            drive time
                          </Text>
                        </VStack>
                      </HStack>
                    </>
                  )}
                </HStack>
              )}
            </Box>

            {/* Moving green line tracing the card edge */}
            <Box position="absolute" inset="0" pointerEvents="none" display="block" zIndex={2}>
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <defs>
                  {/* Comet tail: bright head fading into a long transparent trail */}
                  <linearGradient id="edgeRunner" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={colors.emerald} stopOpacity="0" />
                    <stop offset="70%" stopColor={colors.emerald} stopOpacity="0.5" />
                    <stop offset="92%" stopColor="#6EE7B7" stopOpacity="1" />
                    <stop offset="100%" stopColor="#ECFDF5" stopOpacity="1" />
                  </linearGradient>
                  <linearGradient id="edgeRunner2" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={colors.emerald} stopOpacity="0" />
                    <stop offset="80%" stopColor={colors.emerald} stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#6EE7B7" stopOpacity="0.7" />
                  </linearGradient>
                  <filter id="edgeGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="1.4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {/* faint static border */}
                <rect
                  x="0.5"
                  y="0.5"
                  width="99"
                  height="99"
                  rx="3"
                  fill="none"
                  stroke="rgba(16,185,129,0.18)"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
                {/* secondary trailing runner (offset, softer) */}
                <rect
                  x="0.5"
                  y="0.5"
                  width="99"
                  height="99"
                  rx="3"
                  fill="none"
                  stroke="url(#edgeRunner2)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  pathLength={100}
                  strokeDasharray="30 70"
                  strokeDashoffset={50}
                  vectorEffect="non-scaling-stroke"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="150"
                    to="50"
                    dur="3.4s"
                    repeatCount="indefinite"
                  />
                </rect>
                {/* primary glowing comet runner */}
                <rect
                  x="0.5"
                  y="0.5"
                  width="99"
                  height="99"
                  rx="3"
                  fill="none"
                  stroke="url(#edgeRunner)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  pathLength={100}
                  strokeDasharray="26 74"
                  filter="url(#edgeGlow)"
                  vectorEffect="non-scaling-stroke"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    values="100;0"
                    keyTimes="0;1"
                    dur="3.4s"
                    calcMode="spline"
                    keySplines="0.45 0 0.55 1"
                    repeatCount="indefinite"
                  />
                </rect>
              </svg>
            </Box>
          </MotionBox>
        )}

        {error && (
          <Box px={4} py={3} bg="rgba(239,68,68,0.1)" border="1px solid rgba(239,68,68,0.3)" borderRadius="lg" mb={4}>
            <Text fontSize="sm" color="#EF4444">{error}</Text>
          </Box>
        )}
      </Box>

      {/* Fixed bottom nav */}
      <Box
        position="fixed"
        bottom={0}
        left={0}
        right={0}
        px={{ base: 4, md: 6 }}
        py={4}
        bg="rgba(11,17,32,0.97)"
        borderTop="1px solid rgba(255,255,255,0.08)"
        backdropFilter="blur(12px)"
        zIndex={10}
      >
        <Box maxW="560px" mx="auto">
          <HStack gap={3}>
            {showBack && onBack && (
              <Box
                as="button"
                onClick={onBack}
                flex="0 0 auto"
                px={5}
                py={4}
                borderRadius="xl"
                border="2px solid rgba(255,255,255,0.15)"
                color="rgba(255,255,255,0.6)"
                fontSize="sm"
                fontWeight={600}
                cursor="pointer"
                _hover={{ borderColor: "rgba(255,255,255,0.3)", color: "white" }}
              >
                Back
              </Box>
            )}
            <Box
              as="button"
              onClick={handleContinue}
              flex={1}
              py={4}
              borderRadius="xl"
              bg={canContinue ? colors.amber : "rgba(255,255,255,0.1)"}
              color={canContinue ? colors.midnight : "rgba(255,255,255,0.3)"}
              fontFamily="heading"
              fontSize="sm"
              fontWeight={800}
              cursor={canContinue ? "pointer" : "not-allowed"}
              transition="all 0.2s ease"
              _hover={canContinue ? { bg: "#E08E0A" } : {}}
            >
              See Prices
            </Box>
          </HStack>
        </Box>
      </Box>
    </Box>
  );
}

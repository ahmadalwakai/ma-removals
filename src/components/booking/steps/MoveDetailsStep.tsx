"use client";

import { useEffect, useState } from "react";
import { Box, Text, VStack, HStack, SimpleGrid } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { HiOutlineClock, HiOutlineLocationMarker, HiSwitchVertical } from "react-icons/hi";
import { FiChevronDown, FiChevronLeft, FiCheck } from "react-icons/fi";
import { colors } from "@/lib/tokens";
import {
  isScotlandAddress,
  SCOTLAND_PICKUP_MESSAGE,
} from "@/lib/service-area";
import { AddressAutocomplete } from "@/components/booking/AddressAutocomplete";
import { RouteMapPreview } from "@/components/booking/steps/AddressItemStep";
import type { AddressData, BookingFormState } from "@/types/booking";

const MotionBox = motion.create(Box);

const PROPERTY_ROOTS = ["House", "Flat", "Studio", "Flatshare"] as const;
const BEDROOMS = ["1 Bed", "2 Bed", "3 Bed", "4 Bed", "5+ Bed"] as const;

interface MoveDetailsStepProps {
  state: BookingFormState;
  update: (updates: Partial<BookingFormState>) => void;
  onNext: () => void;
}

function clearPricing() {
  return {
    pricingResult: null,
    priceBreakdown: null,
    selectedPrice: null,
    selectedTimeSlot: null,
  };
}

function variantFromProperty(propertyType: string): string {
  if (propertyType === "Studio" || propertyType === "Flatshare") {
    return "Studio";
  }
  const match = propertyType.match(/^(1 Bed|2 Bed|3 Bed|4 Bed|5\+ Bed)/);
  return match?.[1] ?? "1 Bed";
}

function PropertyPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [family, setFamily] = useState<"House" | "Flat" | null>(null);

  const chooseRoot = (root: (typeof PROPERTY_ROOTS)[number]) => {
    if (root === "House" || root === "Flat") {
      setFamily(root);
      return;
    }
    onChange(root);
    setOpen(false);
    setFamily(null);
  };

  const chooseBedrooms = (bedrooms: (typeof BEDROOMS)[number]) => {
    onChange(`${bedrooms} ${family}`);
    setOpen(false);
    setFamily(null);
  };

  return (
    <Box position="relative" w="full">
      <Box
        as="button"
        onClick={() => setOpen((v) => !v)}
        w="full"
        h="54px"
        px={4}
        borderRadius="xl"
        border={`2px solid ${value ? colors.emerald : "rgba(255,255,255,0.12)"}`}
        bg="rgba(255,255,255,0.05)"
        color={value ? "white" : "rgba(255,255,255,0.45)"}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        textAlign="left"
        cursor="pointer"
        _hover={{ borderColor: value ? colors.emerald : "rgba(255,255,255,0.28)" }}
      >
        <VStack align="start" gap={0}>
          <Text fontSize="10px" color="rgba(255,255,255,0.42)" fontWeight={700} textTransform="uppercase">
            {label}
          </Text>
          <Text fontSize="sm" fontWeight={700}>
            {value || "Select property type"}
          </Text>
        </VStack>
        <FiChevronDown size={18} />
      </Box>

      {open && (
        <MotionBox
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          position="absolute"
          top="60px"
          left={0}
          right={0}
          zIndex={20}
          borderRadius="xl"
          border="1px solid rgba(255,255,255,0.14)"
          bg="#111A2E"
          boxShadow="0 18px 40px rgba(0,0,0,0.45)"
          overflow="hidden"
        >
          {family ? (
            <>
              <Box
                as="button"
                onClick={() => setFamily(null)}
                w="full"
                px={4}
                py={3}
                display="flex"
                alignItems="center"
                gap={2}
                color="rgba(255,255,255,0.65)"
                fontSize="sm"
                fontWeight={700}
                cursor="pointer"
              >
                <FiChevronLeft size={16} />
                {family}
              </Box>
              {BEDROOMS.map((bedrooms) => (
                <Box
                  key={bedrooms}
                  as="button"
                  onClick={() => chooseBedrooms(bedrooms)}
                  w="full"
                  px={4}
                  py={3.5}
                  borderTop="1px solid rgba(255,255,255,0.07)"
                  color="white"
                  fontSize="sm"
                  fontWeight={700}
                  textAlign="left"
                  cursor="pointer"
                  _hover={{ bg: "rgba(16,185,129,0.12)", color: colors.emerald }}
                >
                  {bedrooms} {family}
                </Box>
              ))}
            </>
          ) : (
            PROPERTY_ROOTS.map((root) => (
              <Box
                key={root}
                as="button"
                onClick={() => chooseRoot(root)}
                w="full"
                px={4}
                py={3.5}
                borderTop="1px solid rgba(255,255,255,0.07)"
                color="white"
                fontSize="sm"
                fontWeight={700}
                textAlign="left"
                cursor="pointer"
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                _first={{ borderTop: "none" }}
                _hover={{ bg: "rgba(16,185,129,0.12)", color: colors.emerald }}
              >
                {root}
                {(root === "House" || root === "Flat") && <FiChevronDown size={15} />}
              </Box>
            ))
          )}
        </MotionBox>
      )}
    </Box>
  );
}

export function MoveDetailsStep({ state, update, onNext }: MoveDetailsStepProps) {
  const [error, setError] = useState("");
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [routeGeometry, setRouteGeometry] = useState<string | null>(null);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
  const hasRealToken = mapboxToken && mapboxToken !== "pk.placeholder";

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

  const handleAddressChange = (
    key: "pickupAddress" | "dropoffAddress",
    value: AddressData | null
  ) => {
    if (key === "pickupAddress" && value && !isScotlandAddress(value)) {
      setError(SCOTLAND_PICKUP_MESSAGE);
      update({ pickupAddress: null, ...clearPricing() });
      return;
    }
    setError("");
    update({ [key]: value, ...clearPricing() });
  };

  const handleContinue = () => {
    if (!state.pickupAddress) {
      setError("Please enter where you are moving from.");
      return;
    }
    if (!isScotlandAddress(state.pickupAddress)) {
      setError(SCOTLAND_PICKUP_MESSAGE);
      return;
    }
    if (!state.pickupPropertyType) {
      setError("Please select the property type you are moving from.");
      return;
    }
    if (!state.dropoffAddress) {
      setError("Please enter where you are moving to.");
      return;
    }
    if (!state.dropoffPropertyType) {
      setError("Please select the property type you are moving to.");
      return;
    }
    if (!state.selectedDate && !state.moveDateFlexible) {
      setError("Please choose a moving date or tick that you do not have a date yet.");
      return;
    }

    setError("");
    update({
      service: "house-move",
      serviceVariant: variantFromProperty(state.pickupPropertyType),
      ...clearPricing(),
    });
    onNext();
  };

  const showMap =
    hasRealToken && state.pickupAddress?.lat != null && state.dropoffAddress?.lat != null;

  return (
    <Box>
      <Box px={{ base: 4, md: 6 }} pt={6} pb="120px">
        <VStack align="start" gap={1} mb={5}>
          <Text fontFamily="heading" fontSize={{ base: "xl", md: "2xl" }} fontWeight={900} color="white">
            Get an instant quote
          </Text>
          <Text fontSize="sm" color="rgba(255,255,255,0.5)">
            Tell us the two places, the property types, and your moving date.
          </Text>
        </VStack>

        <SimpleGrid columns={{ base: 1, md: 2 }} gap={4} mb={4}>
          <VStack align="start" gap={3} w="full">
            <Text fontSize="sm" fontWeight={800} color="white">
              Moving from
            </Text>
            <AddressAutocomplete
              value={state.pickupAddress}
              onChange={(addr) => handleAddressChange("pickupAddress", addr)}
              placeholder="Town, postcode or address..."
              enableCurrentLocation
              scope="scotland"
              scopeMessage={SCOTLAND_PICKUP_MESSAGE}
            />
            <PropertyPicker
              label="Moving from"
              value={state.pickupPropertyType}
              onChange={(value) => update({ pickupPropertyType: value, ...clearPricing() })}
            />
          </VStack>

          <VStack align="start" gap={3} w="full">
            <Text fontSize="sm" fontWeight={800} color="white">
              Moving to
            </Text>
            <AddressAutocomplete
              value={state.dropoffAddress}
              onChange={(addr) => handleAddressChange("dropoffAddress", addr)}
              placeholder="Town, postcode or address..."
              enableCurrentLocation
            />
            <PropertyPicker
              label="Moving to"
              value={state.dropoffPropertyType}
              onChange={(value) => update({ dropoffPropertyType: value, ...clearPricing() })}
            />
          </VStack>
        </SimpleGrid>

        <Box mb={5}>
          <Text fontSize="sm" fontWeight={800} color="white" mb={2}>
            When are you moving?
          </Text>
          <Box
            asChild
            w="full"
            h="54px"
            px={4}
            borderRadius="xl"
            border={`2px solid ${state.selectedDate ? colors.emerald : "rgba(255,255,255,0.12)"}`}
            bg="rgba(255,255,255,0.05)"
            color="white"
            fontSize="sm"
            fontWeight={700}
            _focusWithin={{ borderColor: colors.amber }}
          >
            <input
              type="date"
              min={new Date().toISOString().split("T")[0]}
              value={state.selectedDate ?? ""}
              onChange={(e) =>
                update({
                  selectedDate: e.target.value || null,
                  moveDateFlexible: false,
                  ...clearPricing(),
                })
              }
            />
          </Box>
          <Box
            as="button"
            onClick={() =>
              update({
                selectedDate: null,
                moveDateFlexible: !state.moveDateFlexible,
                ...clearPricing(),
              })
            }
            display="flex"
            alignItems="center"
            gap={3}
            mt={3}
            color={state.moveDateFlexible ? colors.emerald : "rgba(255,255,255,0.6)"}
            cursor="pointer"
          >
            <Box
              w="22px"
              h="22px"
              borderRadius="md"
              border={`2px solid ${state.moveDateFlexible ? colors.emerald : "rgba(255,255,255,0.25)"}`}
              bg={state.moveDateFlexible ? colors.emerald : "transparent"}
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              {state.moveDateFlexible && <FiCheck size={13} color="white" />}
            </Box>
            <Text fontSize="sm" fontWeight={700}>
              I don&apos;t have a move date yet
            </Text>
          </Box>
        </Box>

        {(state.pickupAddress && state.dropoffAddress) && (
          <MotionBox
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            mb={5}
            position="relative"
            borderRadius="xl"
            overflow="hidden"
            border="1px solid rgba(255,255,255,0.08)"
          >
            {showMap && (
              <RouteMapPreview
                pickup={state.pickupAddress}
                dropoff={state.dropoffAddress}
                token={mapboxToken}
                geometry={routeGeometry}
              />
            )}
            <Box
              px={4}
              py={3}
              bg="rgba(11,17,32,0.8)"
              backdropFilter="blur(12px)"
              borderTop={showMap ? "1px solid rgba(255,255,255,0.07)" : undefined}
            >
              {distanceLoading ? (
                <HStack gap={3}>
                  <MotionBox
                    w="8px"
                    h="8px"
                    borderRadius="full"
                    bg={colors.emerald}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <Text fontSize="sm" color="rgba(255,255,255,0.45)" fontWeight={700}>
                    Calculating route...
                  </Text>
                </HStack>
              ) : (
                <HStack gap={5}>
                  <HStack gap={2}>
                    <HiOutlineLocationMarker color={colors.emerald} />
                    <Text fontFamily="mono" fontSize="sm" fontWeight={800} color={colors.emerald}>
                      {state.distanceMiles != null ? `${state.distanceMiles.toFixed(1)} mi` : "-- mi"}
                    </Text>
                  </HStack>
                  {state.durationMinutes != null && (
                    <HStack gap={2}>
                      <HiOutlineClock color="rgba(255,255,255,0.55)" />
                      <Text fontFamily="mono" fontSize="sm" fontWeight={800} color="white">
                        {state.durationMinutes < 60
                          ? `${state.durationMinutes}m`
                          : `${Math.floor(state.durationMinutes / 60)}h ${state.durationMinutes % 60}m`}
                      </Text>
                    </HStack>
                  )}
                  <Box color="rgba(255,255,255,0.18)" ml="auto">
                    <HiSwitchVertical size={18} />
                  </Box>
                </HStack>
              )}
            </Box>
          </MotionBox>
        )}

        {error && (
          <Box px={4} py={3} bg="rgba(239,68,68,0.1)" border="1px solid rgba(239,68,68,0.3)" borderRadius="lg" mb={4}>
            <Text fontSize="sm" color="#EF4444">{error}</Text>
          </Box>
        )}
      </Box>

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
          <Box
            as="button"
            onClick={handleContinue}
            w="full"
            py={4}
            borderRadius="xl"
            bg={colors.amber}
            color={colors.midnight}
            fontFamily="heading"
            fontSize="sm"
            fontWeight={900}
            cursor="pointer"
            _hover={{ bg: "#E08E0A", transform: "translateY(-1px)" }}
          >
            Get an instant quote
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

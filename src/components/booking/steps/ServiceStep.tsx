"use client";

import { useState } from "react";
import { Box, Flex, Text, VStack, HStack, SimpleGrid } from "@chakra-ui/react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  FiHome, FiTruck, FiCodesandbox, FiPackage,
  FiBriefcase, FiMapPin, FiMonitor, FiMusic, FiBox, FiUser, FiCheck, FiInfo,
} from "react-icons/fi";
import { colors, shadows } from "@/lib/tokens";
import type { BookingFormState } from "@/types/booking";

interface ServiceMeta {
  slug: string;
  name: string;
  icon: React.ComponentType<{ size?: number }>;
  from: number;
  helper: string;
  detail: string;
  badge: string;
}

const SERVICES: ServiceMeta[] = [
  {
    slug: "van-with-man",
    name: "Van with Man",
    icon: FiTruck,
    from: 27,
    helper: "Best for 1–5 items",
    detail: "Sofa, bed, fridge, small loads",
    badge: "Small moves",
  },
  {
    slug: "furniture-removals",
    name: "Furniture Removals",
    icon: FiCodesandbox,
    from: 36,
    helper: "Best for bulky furniture",
    detail: "Wardrobes, sofas, tables",
    badge: "Furniture",
  },
  {
    slug: "deliveries",
    name: "Deliveries",
    icon: FiPackage,
    from: 21,
    helper: "Best for store or marketplace pickup",
    detail: "IKEA, Gumtree, Facebook items",
    badge: "Quick delivery",
  },
  {
    slug: "house-move",
    name: "House Move",
    icon: FiHome,
    from: 72,
    helper: "Best for full home moves",
    detail: "Rooms, boxes, furniture",
    badge: "Full property",
  },
  {
    slug: "office-removals",
    name: "Office Removals",
    icon: FiMonitor,
    from: 84,
    helper: "Best for desks and office equipment",
    detail: "Desks, chairs, monitors",
    badge: "Office",
  },
  {
    slug: "business-removals",
    name: "Business Removals",
    icon: FiBriefcase,
    from: 90,
    helper: "Best for business relocation",
    detail: "Equipment, stock, commercial moves",
    badge: "Business",
  },
  {
    slug: "hotel-removals",
    name: "Hotel Removals",
    icon: FiMapPin,
    from: 48,
    helper: "Best for hotel furniture and equipment",
    detail: "Beds, chairs, fixtures",
    badge: "Commercial",
  },
  {
    slug: "piano-moves",
    name: "Piano Moves",
    icon: FiMusic,
    from: 108,
    helper: "Specialist heavy item move",
    detail: "Careful handling required",
    badge: "Specialist",
  },
  {
    slug: "packing-service",
    name: "Packing Service",
    icon: FiBox,
    from: 24,
    helper: "Add packing help to your move",
    detail: "Boxes, wrapping, preparation",
    badge: "Add-on",
  },
];

const HOUSE_VARIANTS = ["Studio", "1 Bed", "2 Bed", "3 Bed", "4 Bed", "5+ Bed"];
const BUSINESS_VARIANTS = ["Small Office", "Medium Office", "Large Office", "Retail Shop", "Restaurant/Café", "Warehouse"];

const HELPER_OPTIONS = [
  { count: 0, label: "Driver only", note: "Included" },
  { count: 1, label: "1 Helper", note: "+£22" },
  { count: 2, label: "2 Helpers", note: "+£43" },
  { count: 3, label: "3 Helpers", note: "+£65" },
  { count: 4, label: "4 Helpers", note: "+£86" },
];

function getVariants(slug: string): string[] | null {
  if (slug === "house-move") return HOUSE_VARIANTS;
  if (slug === "business-removals" || slug === "office-removals") return BUSINESS_VARIANTS;
  return null;
}

interface ServiceStepProps {
  state: BookingFormState;
  update: (updates: Partial<BookingFormState>) => void;
  onNext: () => void;
}

const MotionBox = motion.create(Box);

export function ServiceStep({ state, update, onNext }: ServiceStepProps) {
  const [error, setError] = useState("");
  const reduceMotion = useReducedMotion() ?? false;

  const variants = getVariants(state.service);
  const needsVariant = variants !== null;
  const variantSelected = !needsVariant || !!state.serviceVariant;
  const canContinue = !!state.service && variantSelected;

  const handleContinue = () => {
    if (!state.service) {
      setError("Please select a service to continue.");
      return;
    }
    if (needsVariant && !state.serviceVariant) {
      setError("Please make a selection above.");
      return;
    }
    setError("");
    onNext();
  };

  const handleServiceSelect = (slug: string) => {
    setError("");
    update({ service: slug, serviceVariant: "" });
  };

  return (
    <Box>
      <Box px={{ base: 4, md: 6 }} pt={6} pb="120px">
        {/* Header */}
        <VStack align="start" gap={1} mb={4}>
          <Text fontFamily="heading" fontSize={{ base: "xl", md: "2xl" }} fontWeight={800} color="white">
            What do you need?
          </Text>
          <Text fontSize="sm" color="rgba(255,255,255,0.5)">
            Choose the closest option. We&apos;ll calculate the final price from your items, distance, floors, and timing.
          </Text>
        </VStack>

        {/* Guidance callout */}
        <Box
          mb={5}
          px={4}
          py={3}
          borderRadius="xl"
          border="1px solid rgba(245,158,11,0.25)"
          bg="rgba(245,158,11,0.06)"
          display="flex"
          alignItems="flex-start"
          gap={3}
        >
          <Box color={colors.amber} flexShrink={0} mt="2px">
            <FiInfo size={14} />
          </Box>
          <Text fontSize="xs" color="rgba(255,255,255,0.7)" lineHeight="1.55">
            Moving only{" "}
            <Box as="span" color="white" fontWeight={700}>1–5 items?</Box>{" "}
            Choose{" "}
            <Box as="span" color="white" fontWeight={700}>Van with Man</Box>{" "}
            or{" "}
            <Box as="span" color="white" fontWeight={700}>Furniture Removals</Box>.
            {" "}Small item moves are priced separately from full house removals.
          </Text>
        </Box>

        {/* Service grid */}
        {SERVICES.length === 0 ? (
          <Box
            px={4}
            py={8}
            borderRadius="xl"
            border="1px solid rgba(255,255,255,0.1)"
            bg="rgba(255,255,255,0.03)"
            textAlign="center"
            mb={6}
          >
            <Text fontSize="sm" color="rgba(255,255,255,0.5)">
              No services available right now. Please call us to book.
            </Text>
          </Box>
        ) : (
          <SimpleGrid columns={{ base: 1, sm: 2 }} gap={3} w="full" mb={6}>
            {SERVICES.map((svc, index) => {
              const Icon = svc.icon;
              const isSelected = state.service === svc.slug;
              const staggerDelay = reduceMotion ? 0 : Math.min(index * 0.04, 0.18);

              return (
                <MotionBox
                  key={svc.slug}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduceMotion ? undefined : { duration: 0.22, delay: staggerDelay }}
                  whileHover={reduceMotion ? undefined : { y: -2, scale: 1.01 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                  as="button"
                  role="button"
                  aria-pressed={isSelected}
                  tabIndex={0}
                  onClick={() => handleServiceSelect(svc.slug)}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleServiceSelect(svc.slug);
                    }
                  }}
                  position="relative"
                  p={4}
                  borderRadius="xl"
                  border={`2px solid ${isSelected ? colors.emerald : "rgba(255,255,255,0.1)"}`}
                  bg={isSelected ? "rgba(37,99,235,0.08)" : "rgba(255,255,255,0.04)"}
                  textAlign="left"
                  w="full"
                  cursor="pointer"
                  boxShadow={isSelected ? shadows.emerald : undefined}
                  _hover={{
                    borderColor: isSelected ? colors.emerald : "rgba(255,255,255,0.25)",
                    bg: isSelected ? "rgba(37,99,235,0.1)" : "rgba(255,255,255,0.06)",
                  }}
                  _focusVisible={{
                    outline: `2px solid ${colors.amber}`,
                    outlineOffset: "2px",
                  }}
                >
                  {/* Selected checkmark */}
                  <AnimatePresence>
                    {isSelected && (
                      <MotionBox
                        key="check"
                        initial={reduceMotion ? false : { scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={reduceMotion ? undefined : { scale: 0.7, opacity: 0 }}
                        transition={reduceMotion ? undefined : { type: "spring", stiffness: 500, damping: 25 }}
                        position="absolute"
                        top={2}
                        right={2}
                        w={5}
                        h={5}
                        borderRadius="full"
                        bg={colors.emerald}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        flexShrink={0}
                      >
                        <FiCheck size={11} color="white" />
                      </MotionBox>
                    )}
                  </AnimatePresence>

                  <VStack align="start" gap={2.5}>
                    {/* Icon */}
                    <MotionBox
                      animate={reduceMotion ? {} : (isSelected ? { scale: 1.08, y: -1 } : { scale: 1, y: 0 })}
                      transition={reduceMotion ? undefined : { type: "spring", stiffness: 400, damping: 20 }}
                      color={isSelected ? colors.emerald : "rgba(255,255,255,0.55)"}
                    >
                      <Icon size={20} />
                    </MotionBox>

                    {/* Title + price */}
                    <VStack align="start" gap={0.5}>
                      <Text
                        fontFamily="heading"
                        fontSize="xs"
                        fontWeight={700}
                        color={isSelected ? "white" : "rgba(255,255,255,0.85)"}
                        lineHeight="tight"
                        pr={6}
                      >
                        {svc.name}
                      </Text>
                      <Text
                        fontFamily="mono"
                        fontSize="xs"
                        fontWeight={600}
                        color={colors.emerald}
                      >
                        from £{svc.from}
                      </Text>
                    </VStack>

                    {/* Helper text */}
                    <Text
                      fontSize="9px"
                      color={isSelected ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.45)"}
                      lineHeight="1.4"
                      letterSpacing="0.1px"
                    >
                      {svc.helper}
                    </Text>

                    {/* Detail + badge row */}
                    <HStack gap={2} flexWrap="wrap" align="center">
                      <Text
                        fontSize="9px"
                        color="rgba(255,255,255,0.35)"
                        lineHeight="1.3"
                        flex="1"
                        minW={0}
                      >
                        {svc.detail}
                      </Text>
                      <Box
                        px={1.5}
                        py="2px"
                        borderRadius="full"
                        bg={isSelected ? "rgba(37,99,235,0.2)" : "rgba(255,255,255,0.07)"}
                        border={`1px solid ${isSelected ? "rgba(37,99,235,0.4)" : "rgba(255,255,255,0.12)"}`}
                        flexShrink={0}
                      >
                        <Text
                          fontSize="8px"
                          fontWeight={700}
                          color={isSelected ? colors.emerald : "rgba(255,255,255,0.45)"}
                          letterSpacing="0.3px"
                          textTransform="uppercase"
                          lineHeight="1.4"
                        >
                          {svc.badge}
                        </Text>
                      </Box>
                    </HStack>
                  </VStack>
                </MotionBox>
              );
            })}
          </SimpleGrid>
        )}

        {/* Section B — Variant selector */}
        <AnimatePresence>
          {state.service && variants && (
            <MotionBox
              key="variants"
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              overflow="hidden"
            >
              <VStack align="start" gap={3}>
                <Text fontFamily="heading" fontSize="sm" fontWeight={700} color="rgba(255,255,255,0.8)">
                  {state.service === "house-move" ? "How many bedrooms?" : "What type of business?"}
                </Text>
                <Flex gap={2} flexWrap="wrap">
                  {variants.map((v) => {
                    const isSelected = state.serviceVariant === v;
                    return (
                      <Box
                        key={v}
                        as="button"
                        role="button"
                        aria-pressed={isSelected}
                        tabIndex={0}
                        onClick={() => { update({ serviceVariant: v }); setError(""); }}
                        onKeyDown={(e: React.KeyboardEvent) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            update({ serviceVariant: v });
                            setError("");
                          }
                        }}
                        px={4}
                        py={2}
                        borderRadius="full"
                        border={`2px solid ${isSelected ? colors.emerald : "rgba(255,255,255,0.15)"}`}
                        bg={isSelected ? colors.emerald : "transparent"}
                        color={isSelected ? colors.midnight : "rgba(255,255,255,0.7)"}
                        fontSize="sm"
                        fontWeight={600}
                        cursor="pointer"
                        transition="all 0.15s ease"
                        _hover={{
                          borderColor: isSelected ? colors.emerald : "rgba(255,255,255,0.4)",
                          color: isSelected ? colors.midnight : "white",
                        }}
                        _focusVisible={{ outline: `2px solid ${colors.amber}`, outlineOffset: "2px" }}
                        boxShadow={isSelected ? shadows.emerald : undefined}
                      >
                        {v}
                      </Box>
                    );
                  })}
                </Flex>
              </VStack>
            </MotionBox>
          )}
        </AnimatePresence>

        {/* Section C — Add-ons */}
        <AnimatePresence>
          {state.service && (
            <MotionBox
              key="addons"
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: 12 }}
              transition={reduceMotion ? undefined : { delay: 0.1 }}
              mb={6}
            >
              <VStack align="start" gap={3}>
                <Text fontFamily="heading" fontSize="sm" fontWeight={700} color="rgba(255,255,255,0.8)">
                  Add-ons
                </Text>
                <VStack gap={2} w="full">
                  {(
                    [
                      { key: "needsPacking" as const, label: "Packing help", desc: "Materials and packing priced from your inventory", price: "Item priced" },
                      { key: "needsAssembly" as const, label: "Dismantling & reassembly", desc: "Priced by the furniture items selected", price: "Item priced" },
                    ] as const
                  ).map(({ key, label, desc, price }) => (
                    <Box
                      key={key}
                      as="button"
                      role="button"
                      aria-pressed={state[key]}
                      tabIndex={0}
                      onClick={() => update({ [key]: !state[key] })}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          update({ [key]: !state[key] });
                        }
                      }}
                      w="full"
                      p={4}
                      borderRadius="xl"
                      border={`2px solid ${state[key] ? colors.emerald : "rgba(255,255,255,0.1)"}`}
                      bg={state[key] ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.03)"}
                      textAlign="left"
                      display="flex"
                      alignItems="center"
                      justifyContent="space-between"
                      cursor="pointer"
                      transition="all 0.15s ease"
                      _hover={{ borderColor: state[key] ? colors.emerald : "rgba(255,255,255,0.25)" }}
                      _focusVisible={{ outline: `2px solid ${colors.amber}`, outlineOffset: "2px" }}
                    >
                      <VStack align="start" gap={0}>
                        <Text fontSize="sm" fontWeight={600} color="white">{label}</Text>
                        <Text fontSize="xs" color="rgba(255,255,255,0.45)">{desc}</Text>
                      </VStack>
                      <HStack gap={3}>
                        <Text fontFamily="mono" fontSize="sm" fontWeight={700} color={colors.emerald}>
                          {price}
                        </Text>
                        <Box
                          w="40px"
                          h="22px"
                          borderRadius="full"
                          bg={state[key] ? colors.emerald : "rgba(255,255,255,0.15)"}
                          position="relative"
                          flexShrink={0}
                          transition="background 0.2s ease"
                          aria-hidden="true"
                        >
                          <Box
                            position="absolute"
                            top="3px"
                            left={state[key] ? "21px" : "3px"}
                            w="16px"
                            h="16px"
                            borderRadius="full"
                            bg="white"
                            transition="left 0.2s ease"
                          />
                        </Box>
                      </HStack>
                    </Box>
                  ))}
                </VStack>
              </VStack>
            </MotionBox>
          )}
        </AnimatePresence>

        {/* Section D — Helpers */}
        <AnimatePresence>
          {state.service && (
            <MotionBox
              key="helpers"
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: 12 }}
              transition={reduceMotion ? undefined : { delay: 0.15 }}
              mb={6}
            >
              <VStack align="start" gap={3}>
                <VStack align="start" gap={0}>
                  <Text fontFamily="heading" fontSize="sm" fontWeight={700} color="rgba(255,255,255,0.8)">
                    How many helpers?
                  </Text>
                  <Text fontSize="xs" color="rgba(255,255,255,0.4)">
                    Extra help for heavy lifts or large moves
                  </Text>
                </VStack>
                <SimpleGrid columns={{ base: 3, sm: 5 }} gap={2} w="full">
                  {HELPER_OPTIONS.map(({ count, label, note }) => {
                    const isSelected = state.helpersCount === count;
                    return (
                      <Box
                        key={count}
                        as="button"
                        role="button"
                        aria-pressed={isSelected}
                        tabIndex={0}
                        onClick={() => update({ helpersCount: count })}
                        onKeyDown={(e: React.KeyboardEvent) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            update({ helpersCount: count });
                          }
                        }}
                        p={3}
                        borderRadius="xl"
                        border={`2px solid ${isSelected ? colors.amber : "rgba(255,255,255,0.1)"}`}
                        bg={isSelected ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.03)"}
                        cursor="pointer"
                        transition="all 0.15s ease"
                        _hover={{ borderColor: isSelected ? colors.amber : "rgba(255,255,255,0.25)" }}
                        _focusVisible={{ outline: `2px solid ${colors.amber}`, outlineOffset: "2px" }}
                      >
                        <VStack gap={1.5}>
                          <HStack gap={0.5} justifyContent="center" h="18px">
                            {Array.from({ length: Math.max(1, count + 1) }).map((_, i) => (
                              <Box
                                key={i}
                                color={
                                  isSelected
                                    ? i === 0
                                      ? colors.amber
                                      : colors.emerald
                                    : "rgba(255,255,255,0.4)"
                                }
                              >
                                <FiUser size={i < count ? 11 : 14} />
                              </Box>
                            ))}
                          </HStack>
                          <Text
                            fontSize="9px"
                            fontWeight={700}
                            color={isSelected ? "white" : "rgba(255,255,255,0.5)"}
                            textAlign="center"
                            lineHeight="tight"
                            letterSpacing="0.2px"
                          >
                            {label}
                          </Text>
                          <Text
                            fontFamily="mono"
                            fontSize="9px"
                            fontWeight={600}
                            color={isSelected ? colors.amber : "rgba(255,255,255,0.35)"}
                          >
                            {note}
                          </Text>
                        </VStack>
                      </Box>
                    );
                  })}
                </SimpleGrid>
              </VStack>
            </MotionBox>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <MotionBox
            initial={reduceMotion ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            mb={4}
          >
            <Box
              px={4}
              py={3}
              bg="rgba(239,68,68,0.1)"
              border="1px solid rgba(239,68,68,0.3)"
              borderRadius="lg"
            >
              <Text fontSize="sm" color="#EF4444" role="alert">
                {error}
              </Text>
            </Box>
          </MotionBox>
        )}
      </Box>

      {/* Fixed bottom CTA */}
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
            bg={canContinue ? colors.amber : "rgba(255,255,255,0.1)"}
            color={canContinue ? colors.midnight : "rgba(255,255,255,0.3)"}
            fontFamily="heading"
            fontSize="sm"
            fontWeight={800}
            letterSpacing="0.5px"
            cursor={canContinue ? "pointer" : "not-allowed"}
            aria-disabled={!canContinue}
            transition="all 0.2s ease"
            _hover={canContinue ? { bg: "#E08E0A", transform: "translateY(-1px)" } : {}}
            _focusVisible={{ outline: `2px solid ${colors.amber}`, outlineOffset: "2px" }}
          >
            Continue to Addresses →
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

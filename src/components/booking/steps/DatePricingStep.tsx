"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Box, Flex, Text, VStack, HStack } from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import { colors } from "@/lib/tokens";
import { formatPrice } from "@/lib/pricing";
import { PricingLoader, type LoaderStep } from "@/components/booking/PricingLoader";
import type {
  BookingFormState,
  DayPrice,
  PricingResult,
} from "@/types/booking";

const MotionBox = motion.create(Box);
const MotionFlex = motion.create(Flex);

const SLOT_META: Record<
  "morning" | "afternoon" | "evening",
  { label: string; hours: string; icon: string; desc: string }
> = {
  morning: { label: "Morning", hours: "8am – 12pm", icon: "🌅", desc: "Early start" },
  afternoon: { label: "Afternoon", hours: "12pm – 4pm", icon: "☀️", desc: "Mid-day" },
  evening: { label: "Evening", hours: "4pm – 8pm", icon: "🌙", desc: "Late slot" },
};

const TIER_COLORS: Record<string, string> = {
  cheap: colors.cheapGreen,
  mid: colors.midYellow,
  expensive: colors.expensiveRed,
};

const SHOW_PRICE_BREAKDOWN = false;

type TimeSlot = "morning" | "afternoon" | "evening";
const SLOT_ORDER: TimeSlot[] = ["morning", "afternoon", "evening"];

interface PriceOption {
  day: DayPrice;
  slot: TimeSlot;
  price: number;
}

function cheapestSlotForDay(day: DayPrice): TimeSlot {
  return SLOT_ORDER.reduce((best, slot) =>
    day.prices[slot] < day.prices[best] ? slot : best
  );
}

function cheapestOption(days: DayPrice[]): PriceOption | null {
  return days.reduce<PriceOption | null>((best, day) => {
    const slot = cheapestSlotForDay(day);
    const option = { day, slot, price: day.prices[slot] };
    if (!best || option.price < best.price) return option;
    return best;
  }, null);
}

function soonestOption(days: DayPrice[]): PriceOption | null {
  const day = days[0];
  if (!day) return null;
  const slot = cheapestSlotForDay(day);
  return { day, slot, price: day.prices[slot] };
}

function weekendOption(days: DayPrice[]): PriceOption | null {
  return cheapestOption(days.filter((day) => day.isWeekend));
}

interface DatePricingStepProps {
  state: BookingFormState;
  update: (updates: Partial<BookingFormState>) => void;
  onNext: () => void;
  onBack: () => void;
}

function useCountUp(target: number, active: boolean, durationMs = 800) {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        raf.current = requestAnimationFrame(animate);
      } else {
        setValue(target);
      }
    };
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [target, active, durationMs]);

  return value;
}

export function DatePricingStep({ state, update, onNext, onBack }: DatePricingStepProps) {
  const [phase, setPhase] = useState<"loader" | "calendar">(
    state.pricingResult ? "calendar" : "loader"
  );
  const [apiResult, setApiResult] = useState<PricingResult | null>(
    state.pricingResult ?? null
  );
  const [apiDone, setApiDone] = useState(!!state.pricingResult);
  const [loaderDone, setLoaderDone] = useState(!!state.pricingResult);
  const [apiError, setApiError] = useState("");

  const [selectedDay, setSelectedDay] = useState<DayPrice | null>(
    state.selectedDate && state.pricingResult
      ? (state.pricingResult.days.find((d) => d.date === state.selectedDate) ?? null)
      : null
  );
  const [selectedSlot, setSelectedSlot] = useState<
    TimeSlot | null
  >(state.selectedTimeSlot ?? null);

  const [breakdownVisible, setBreakdownVisible] = useState(
    !!(state.selectedDate && state.selectedTimeSlot)
  );

  const dayScrollRef = useRef<HTMLDivElement>(null);

  const scrollDays = (dir: 1 | -1) => {
    const el = dayScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 200, behavior: "smooth" });
  };

  // Count-up for total
  const selectedPrice =
    selectedDay && selectedSlot ? selectedDay.prices[selectedSlot] : 0;
  const countedPrice = useCountUp(selectedPrice, breakdownVisible);

  const recommendedOption = useMemo(
    () => (apiResult ? cheapestOption(apiResult.days) : null),
    [apiResult]
  );
  const quickOptions = useMemo(() => {
    if (!apiResult) return [];
    const options = [
      { key: "cheapest", label: "Cheapest", option: cheapestOption(apiResult.days) },
      { key: "soonest", label: "Soonest", option: soonestOption(apiResult.days) },
      { key: "weekend", label: "Weekend", option: weekendOption(apiResult.days) },
    ];
    return options.filter((entry): entry is { key: string; label: string; option: PriceOption } => !!entry.option);
  }, [apiResult]);

  // Build loader steps from booking state
  const loaderSteps = useCallback((): LoaderStep[] => {
    const floorLabel = (floor: number, lift: boolean) => {
      if (floor === 0) return "Ground floor";
      return `Floor ${floor}, ${lift ? "with lift" : "no lift"}`;
    };
    const addons: string[] = [];
    if (state.needsPacking) addons.push("Packing");
    if (state.needsAssembly) addons.push("Assembly");

    const serviceNames: Record<string, string> = {
      "house-move": "Home move",
      "van-with-man": "Few items",
      "furniture-removals": "Furniture move",
      deliveries: "Delivery",
      "business-removals": "Business move",
      "hotel-removals": "Hotel move",
      "office-removals": "Office move",
      "piano-moves": "Piano move",
      "packing-service": "Packing service",
    };

    return [
      {
        label: "Distance",
        value: `${state.distanceMiles?.toFixed(1) ?? "0"} miles`,
      },
      {
        label: "Service",
        value: state.serviceVariant
          ? `${serviceNames[state.service] ?? state.service} (${state.serviceVariant})`
          : (serviceNames[state.service] ?? state.service),
      },
      {
        label: "Helpers",
        value:
          state.helpersCount === 0
            ? "Van + Driver"
            : `${state.helpersCount} helper${state.helpersCount > 1 ? "s" : ""}`,
      },
      {
        label: "Pickup floor",
        value: floorLabel(state.pickupFloor, state.pickupHasLift),
      },
      {
        label: "Drop-off floor",
        value: floorLabel(state.dropoffFloor, state.dropoffHasLift),
      },
      {
        label: "Add-ons",
        value: addons.length > 0 ? addons.join(", ") : "None",
      },
      { label: "Weather forecast", value: "Checking..." },
      { label: "Finding best prices", value: "14 days" },
    ];
  }, [state]);

  // Call pricing API on first visit
  useEffect(() => {
    if (state.pricingResult) return;
    const body = {
      serviceType: state.service,
      serviceVariant: state.serviceVariant || undefined,
      distanceMiles: state.distanceMiles ?? 0,
      pickupFloor: state.pickupFloor,
      pickupHasLift: state.pickupHasLift,
      dropoffFloor: state.dropoffFloor,
      dropoffHasLift: state.dropoffHasLift,
      helpersCount: state.helpersCount,
      needsPacking: state.needsPacking,
      needsAssembly: state.needsAssembly,
      pickupLat: state.pickupAddress?.lat ?? 51.5,
      pickupLng: state.pickupAddress?.lng ?? -0.1,
      pickupPostcode: state.pickupAddress?.postcode ?? "",
      pickupRegion: state.pickupAddress?.region ?? "",
      pickupCountry: state.pickupAddress?.country ?? "",
      pickupFullAddress: state.pickupAddress?.fullAddress ?? "",
      moveDateFlexible: state.moveDateFlexible,
      items: state.selectedItems.map((s) => ({
        name: s.name,
        quantity: s.quantity,
        imagePath: s.imagePath,
      })),
    };
    fetch("/api/pricing/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setApiResult(json.data as PricingResult);
        } else {
          setApiError(json.error ?? "Pricing unavailable. Please try again.");
        }
        setApiDone(true);
      })
      .catch(() => {
        setApiError("Network error. Please check your connection.");
        setApiDone(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Transition to calendar when BOTH loader animation AND API are done
  useEffect(() => {
    if (apiDone && loaderDone && phase === "loader") {
      const t = setTimeout(() => setPhase("calendar"), 300);
      return () => clearTimeout(t);
    }
  }, [apiDone, loaderDone, phase]);

  const selectDayAndSlot = useCallback((day: DayPrice, slot: TimeSlot) => {
    setSelectedDay(day);
    setSelectedSlot(slot);
    setBreakdownVisible(false);
    const price = day.prices[slot];

    const staticItems = apiResult?.staticLineItems ?? [];
    const baseLine = staticItems.find((li) => li.type === "base");
    const breakdown = {
      base: baseLine?.amount ?? apiResult?.staticSubtotal ?? 0,
      distanceCharge: 0,
      lineItems: staticItems.map((li) => ({ label: li.label, amount: li.amount })),
      lines:     staticItems.map((li) => ({ label: li.label, amount: li.amount })),
      dayMultiplier: 1,
      dayLabel: slot,
      subtotal: apiResult?.staticSubtotal ?? 0,
      total: price,
    };

    update({
      selectedDate: day.date,
      selectedTimeSlot: slot,
      selectedPrice: price,
      pricingResult: apiResult ?? undefined,
      priceBreakdown: breakdown,
    } as Partial<BookingFormState>);

    setTimeout(() => setBreakdownVisible(true), 50);
  }, [apiResult, update]);

  const handleDaySelect = useCallback((day: DayPrice) => {
    selectDayAndSlot(day, cheapestSlotForDay(day));
  }, [selectDayAndSlot]);

  const handleSlotSelect = (slot: TimeSlot) => {
    if (!selectedDay) return;
    selectDayAndSlot(selectedDay, slot);
  };

  useEffect(() => {
    if (phase !== "calendar") return;
    if (!recommendedOption) return;
    if (selectedDay || selectedSlot || state.selectedDate || state.selectedTimeSlot) return;
    selectDayAndSlot(recommendedOption.day, recommendedOption.slot);
  }, [
    phase,
    recommendedOption,
    selectDayAndSlot,
    selectedDay,
    selectedSlot,
    state.selectedDate,
    state.selectedTimeSlot,
  ]);

  const handleContinue = () => {
    if (!state.selectedDate || !state.selectedTimeSlot) return;
    onNext();
  };

  const canContinue = !!state.selectedDate && !!state.selectedTimeSlot;

  // Find cheapest slot on selected day
  const cheapestSlot = selectedDay
    ? (["morning", "afternoon", "evening"] as const).reduce((a, b) =>
        selectedDay.prices[a] <= selectedDay.prices[b] ? a : b
      )
    : null;

  return (
    <Box>
      <Box px={{ base: 4, md: 6 }} pt={6} pb="140px">
        <VStack align="start" gap={1} mb={6}>
          <Text
            fontFamily="var(--font-heading)"
            fontSize={{ base: "xl", md: "2xl" }}
            fontWeight={800}
            color="white"
          >
            Pick a date & time
          </Text>
          <Text fontSize="sm" color="rgba(255,255,255,0.5)">
            Prices vary by day & time — green dates are cheapest
          </Text>
        </VStack>

        {apiError && (
          <Box
            px={4}
            py={3}
            bg="rgba(239,68,68,0.1)"
            border="1px solid rgba(239,68,68,0.3)"
            borderRadius="xl"
            mb={4}
          >
            <Text fontSize="sm" color={colors.crimson} mb={2}>
              {apiError}
            </Text>
            <Box
              as="button"
              px={4}
              py={2}
              borderRadius="lg"
              bg="rgba(239,68,68,0.2)"
              color={colors.crimson}
              fontSize="sm"
              fontWeight={600}
              cursor="pointer"
              onClick={() => window.location.reload()}
            >
              Try again
            </Box>
          </Box>
        )}

        <AnimatePresence mode="wait">
          {phase === "loader" && (
            <MotionBox
              key="loader"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <PricingLoader
                steps={loaderSteps()}
                onComplete={() => setLoaderDone(true)}
              />
            </MotionBox>
          )}

          {phase === "calendar" && apiResult && (
            <MotionBox
              key="calendar"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              {recommendedOption && (
                <MotionBox
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  mb={4}
                  p={4}
                  borderRadius="18px"
                  border="1.5px solid rgba(16,185,129,0.45)"
                  bg="linear-gradient(135deg, rgba(16,185,129,0.16), rgba(37,99,235,0.10))"
                  boxShadow="0 10px 30px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.08)"
                >
                  <Flex align="center" justify="space-between" gap={4}>
                    <VStack align="start" gap={1} minW={0}>
                      <Text
                        fontSize="10px"
                        fontWeight={900}
                        color="#6EE7B7"
                        textTransform="uppercase"
                        letterSpacing="1px"
                      >
                        Recommended
                      </Text>
                      <Text fontSize="md" fontWeight={900} color="white" lineHeight={1.2}>
                        {recommendedOption.day.dayName} {recommendedOption.day.dayNumber}{" "}
                        {recommendedOption.day.month} · {SLOT_META[recommendedOption.slot].label}
                      </Text>
                      <Text fontSize="xs" color="rgba(255,255,255,0.58)">
                        {SLOT_META[recommendedOption.slot].hours}
                      </Text>
                    </VStack>
                    <VStack align="end" gap={2} flexShrink={0}>
                      <Text
                        fontFamily="var(--font-mono)"
                        fontSize={{ base: "2xl", md: "3xl" }}
                        fontWeight={900}
                        color="#D1FAE5"
                        lineHeight={1}
                      >
                        {formatPrice(recommendedOption.price)}
                      </Text>
                      <Box
                        as="button"
                        onClick={() => selectDayAndSlot(recommendedOption.day, recommendedOption.slot)}
                        px={4}
                        py={2}
                        borderRadius="12px"
                        bg="#D1FAE5"
                        color="#052E16"
                        fontSize="xs"
                        fontWeight={900}
                        cursor="pointer"
                        _hover={{ bg: "#A7F3D0" }}
                      >
                        Select
                      </Box>
                    </VStack>
                  </Flex>
                </MotionBox>
              )}

              {quickOptions.length > 0 && (
                <Flex gap={2} mb={5} overflowX="auto" pb={1} css={{ scrollbarWidth: "none" }}>
                  {quickOptions.map(({ key, label, option }) => {
                    const active =
                      selectedDay?.date === option.day.date && selectedSlot === option.slot;
                    return (
                      <Box
                        key={key}
                        as="button"
                        onClick={() => selectDayAndSlot(option.day, option.slot)}
                        flexShrink={0}
                        minW="146px"
                        px={3}
                        py={3}
                        borderRadius="14px"
                        border={`1.5px solid ${active ? "#2563EB" : "rgba(255,255,255,0.12)"}`}
                        bg={active ? "rgba(37,99,235,0.22)" : "rgba(255,255,255,0.045)"}
                        color="white"
                        textAlign="left"
                        cursor="pointer"
                        _hover={{ borderColor: "#2563EB", bg: "rgba(37,99,235,0.14)" }}
                      >
                        <Text fontSize="10px" fontWeight={900} color={active ? "#2563EB" : "rgba(255,255,255,0.58)"} textTransform="uppercase">
                          {label}
                        </Text>
                        <Text fontSize="xs" fontWeight={800} mt={1}>
                          {option.day.dayName} {option.day.dayNumber} {option.day.month}
                        </Text>
                        <Flex align="center" justify="space-between" gap={2} mt={2}>
                          <Text fontSize="11px" color="rgba(255,255,255,0.56)">
                            {SLOT_META[option.slot].label}
                          </Text>
                          <Text fontFamily="var(--font-mono)" fontSize="sm" fontWeight={900} color={active ? "#2563EB" : "#D1FAE5"}>
                            {formatPrice(option.price)}
                          </Text>
                        </Flex>
                      </Box>
                    );
                  })}
                </Flex>
              )}

              {/* 14-day airline scroll grid */}
              <Box position="relative">
                <Box
                  ref={dayScrollRef}
                  overflowX="auto"
                  pt={3}
                  pb={2}
                  onWheel={(e) => {
                    const el = e.currentTarget;
                    if (el.scrollWidth <= el.clientWidth) return;
                    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                      el.scrollLeft += e.deltaY;
                    }
                  }}
                  css={{
                    scrollbarWidth: "none",
                    "&::-webkit-scrollbar": { display: "none" },
                    touchAction: "pan-x",
                  }}
                >
                  <Flex gap={3} minW="max-content" mb={4}>
                    {apiResult.days.map((day) => {
                      const isSelected = selectedDay?.date === day.date;
                      const dotColor = TIER_COLORS[day.tier] ?? colors.emerald;
                      const priceBadge =
                        day.tier === "cheap"
                          ? { bg: "#D1FAE5", border: "#34D399", color: "#052E16" }
                          : day.tier === "mid"
                            ? { bg: "#FEF3C7", border: "#FBBF24", color: "#451A03" }
                            : { bg: "#FEE2E2", border: "#F87171", color: "#7F1D1D" };

                      return (
                        <MotionBox
                          key={day.date}
                          as="button"
                          onClick={() => handleDaySelect(day)}
                          w={{ base: "116px", md: "112px" }}
                          minH="152px"
                          flexShrink={0}
                          px={3}
                          pt={4}
                          pb={4}
                          borderRadius="18px"
                          border={`1.5px solid ${isSelected ? "#2563EB" : "rgba(255,255,255,0.16)"}`}
                          bg={
                            isSelected
                              ? "linear-gradient(160deg, rgba(37,99,235,0.42) 0%, rgba(30,64,175,0.22) 100%)"
                              : "linear-gradient(180deg, rgba(30,41,59,0.96) 0%, rgba(15,23,42,0.96) 100%)"
                          }
                          boxShadow={
                            isSelected
                              ? `0 0 0 1px rgba(37,99,235,0.5), 0 0 24px rgba(37,99,235,0.35), 0 0 48px rgba(37,99,235,0.15), inset 0 1px 0 rgba(255,255,255,0.12)`
                              : `inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 22px rgba(0,0,0,0.32)`
                          }
                          cursor="pointer"
                          whileHover={{ scale: 1.04, y: -2 }}
                          whileTap={{ scale: 0.96 }}
                          transition={{ duration: 0.15, ease: "easeOut" } as never}
                          animate={{ scale: isSelected ? 1.06 : 1, y: isSelected ? -3 : 0 }}
                          position="relative"
                          overflow="hidden"
                        >
                          {/* Neon top edge line when selected */}
                          {isSelected && (
                            <Box
                              position="absolute"
                              top={0}
                              left="15%"
                              right="15%"
                              h="2px"
                              bg="linear-gradient(90deg, transparent, #2563EB, #2563EB, #2563EB, transparent)"
                              boxShadow="0 0 8px #2563EB, 0 0 16px rgba(37,99,235,0.6)"
                              borderRadius="full"
                            />
                          )}

                          {(day.isToday || day.isTomorrow) && (
                            <Box
                              position="absolute"
                              top="-1px"
                              left="50%"
                              transform="translateX(-50%)"
                              px="8px"
                              py="2px"
                              bg={day.isToday ? "#EF4444" : "#F59E0B"}
                              borderBottomRadius="md"
                              whiteSpace="nowrap"
                              zIndex={2}
                              boxShadow={day.isToday ? "0 2px 10px rgba(239,68,68,0.6)" : "0 2px 10px rgba(245,158,11,0.6)"}
                            >
                              <Text fontSize="8px" fontWeight={900} color="white" letterSpacing="0.8px">
                                {day.isToday ? "TODAY" : "TMRW"}
                              </Text>
                            </Box>
                          )}

                          <VStack gap="6px" align="center" mt={day.isToday || day.isTomorrow ? 2 : 0}>
                            <Text
                              fontSize="10px"
                              fontWeight={700}
                              color={isSelected ? "#2563EB" : "rgba(255,255,255,0.68)"}
                              textTransform="uppercase"
                              letterSpacing="1px"
                            >
                              {day.dayName}
                            </Text>

                            <Text
                              fontFamily="var(--font-heading)"
                              fontSize={{ base: "34px", md: "32px" }}
                              fontWeight={900}
                              color="white"
                              lineHeight={1}
                              textShadow={isSelected ? "0 0 20px rgba(255,255,255,0.4)" : "none"}
                            >
                              {day.dayNumber}
                            </Text>

                            <Text fontSize="10px" color={isSelected ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.56)"}>
                              {day.month}
                            </Text>

                            {/* Tier indicator */}
                            <Box
                              px="10px"
                              py="6px"
                              borderRadius="12px"
                              bg={priceBadge.bg}
                              border={`1px solid ${priceBadge.border}`}
                              boxShadow={isSelected ? `0 0 10px ${dotColor}66` : "0 4px 10px rgba(0,0,0,0.18)"}
                              minW="76px"
                            >
                              <Text
                                fontSize="8px"
                                fontWeight={900}
                                color={priceBadge.color}
                                lineHeight={1}
                                textTransform="uppercase"
                              >
                                From
                              </Text>
                              <Text
                                fontFamily="var(--font-mono)"
                                fontSize={{ base: "15px", md: "14px" }}
                                fontWeight={900}
                                color={priceBadge.color}
                                lineHeight={1}
                                mt="3px"
                              >
                                {formatPrice(day.cheapest)}
                              </Text>
                            </Box>

                            <Text fontSize="16px" lineHeight={1}>{day.weather.icon}</Text>
                          </VStack>
                        </MotionBox>
                      );
                    })}
                  </Flex>
                </Box>

                {/* Scroll arrows */}
                <Box
                  as="button"
                  aria-label="Previous dates"
                  onClick={() => scrollDays(-1)}
                  position="absolute"
                  left="-14px"
                  top="46px"
                  w="32px"
                  h="32px"
                  borderRadius="full"
                  bg="rgba(15,23,42,0.95)"
                  border="1px solid rgba(255,255,255,0.15)"
                  display={{ base: "none", md: "flex" }}
                  alignItems="center"
                  justifyContent="center"
                  cursor="pointer"
                  zIndex={2}
                  transition="all 0.15s ease"
                  _hover={{ borderColor: "#2563EB", boxShadow: "0 0 12px rgba(37,99,235,0.4)", bg: "rgba(15,23,42,1)" }}
                >
                  <Text fontSize="16px" color="white" lineHeight={1}>‹</Text>
                </Box>
                <Box
                  as="button"
                  aria-label="More dates"
                  onClick={() => scrollDays(1)}
                  position="absolute"
                  right="-14px"
                  top="46px"
                  w="32px"
                  h="32px"
                  borderRadius="full"
                  bg="rgba(15,23,42,0.95)"
                  border="1px solid rgba(255,255,255,0.15)"
                  display={{ base: "none", md: "flex" }}
                  alignItems="center"
                  justifyContent="center"
                  cursor="pointer"
                  zIndex={2}
                  transition="all 0.15s ease"
                  _hover={{ borderColor: "#2563EB", boxShadow: "0 0 12px rgba(37,99,235,0.4)", bg: "rgba(15,23,42,1)" }}
                >
                  <Text fontSize="16px" color="white" lineHeight={1}>›</Text>
                </Box>
              </Box>

              {/* Legend */}
              <Flex gap={4} mb={6} flexWrap="wrap">
                {[
                  { color: colors.cheapGreen, label: "Cheapest" },
                  { color: colors.midYellow, label: "Average" },
                  { color: colors.expensiveRed, label: "Peak" },
                ].map(({ color, label }) => (
                  <Flex key={label} align="center" gap={1}>
                    <Box
                      w="8px"
                      h="8px"
                      borderRadius="full"
                      bg={color}
                      boxShadow={`0 0 4px ${color}`}
                    />
                    <Text fontSize="11px" color="rgba(255,255,255,0.5)">
                      {label}
                    </Text>
                  </Flex>
                ))}
              </Flex>

              {/* Time slot cards */}
              <AnimatePresence>
                {selectedDay && (
                  <MotionBox
                    key={selectedDay.date}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.25 }}
                    mb={6}
                  >
                    <Text
                      fontSize="sm"
                      fontWeight={700}
                      color="rgba(255,255,255,0.8)"
                      mb={3}
                    >
                      Arrival window for{" "}
                      <Text as="span" color={colors.amber}>
                        {selectedDay.dayName} {selectedDay.dayNumber} {selectedDay.month}
                      </Text>
                    </Text>

                    <Flex direction="column" gap={3}>
                      {(["morning", "afternoon", "evening"] as const).map((slot, idx) => {
                        const isSel = selectedSlot === slot;
                        const isBest = cheapestSlot === slot;
                        const price = selectedDay.prices[slot];
                        const allPrices = Object.values(selectedDay.prices) as number[];
                        const minP = Math.min(...allPrices);
                        const maxP = Math.max(...allPrices);
                        const pctFill = maxP === minP ? 50 : Math.round(((price - minP) / (maxP - minP)) * 100);
                        const barColor = pctFill < 34 ? "#10B981" : pctFill < 67 ? "#F59E0B" : "#EF4444";

                        return (
                          <MotionBox
                            key={slot}
                            as="button"
                            onClick={() => handleSlotSelect(slot)}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.07, duration: 0.25 } as never}
                            whileHover={{ scale: 1.015, y: -1 }}
                            whileTap={{ scale: 0.985 }}
                            px={4}
                            pt={4}
                            pb={4}
                            borderRadius="20px"
                            border={`1.5px solid ${isSel ? "#2563EB" : "rgba(255,255,255,0.08)"}`}
                            bg={
                              isSel
                                ? "linear-gradient(135deg, rgba(37,99,235,0.18) 0%, rgba(37,99,235,0.08) 100%)"
                                : "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)"
                            }
                            boxShadow={
                              isSel
                                ? `0 0 0 1px rgba(37,99,235,0.4), 0 0 20px rgba(37,99,235,0.25), 0 0 40px rgba(37,99,235,0.1), inset 0 1px 0 rgba(255,255,255,0.1)`
                                : `inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 10px rgba(0,0,0,0.3)`
                            }
                            cursor="pointer"
                            position="relative"
                            textAlign="left"
                            w="full"
                            overflow="hidden"
                          >
                            {/* Neon left edge accent when selected */}
                            {isSel && (
                              <Box
                                position="absolute"
                                left={0}
                                top="15%"
                                bottom="15%"
                                w="3px"
                                bg="linear-gradient(180deg, transparent, #2563EB, #2563EB, #2563EB, transparent)"
                                boxShadow="0 0 8px #2563EB, 0 0 16px rgba(37,99,235,0.5)"
                                borderRightRadius="full"
                              />
                            )}

                            {isBest && (
                              <Box
                                position="absolute"
                                top={0}
                                right={0}
                                px={3}
                                py="4px"
                                bg="linear-gradient(135deg, rgba(16,185,129,0.25), rgba(5,150,105,0.15))"
                                border="1px solid rgba(16,185,129,0.35)"
                                borderTopRightRadius="18px"
                                borderBottomLeftRadius="12px"
                              >
                                <Text fontSize="9px" fontWeight={800} color="#34D399" letterSpacing="0.8px">
                                  ✦ BEST VALUE
                                </Text>
                              </Box>
                            )}

                            <Flex align="center" gap={3}>
                              {/* Icon box */}
                              <Box
                                w="48px"
                                h="48px"
                                borderRadius="14px"
                                bg={isSel ? "rgba(37,99,235,0.2)" : "rgba(255,255,255,0.05)"}
                                border={`1px solid ${isSel ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.07)"}`}
                                boxShadow={isSel ? "0 0 12px rgba(37,99,235,0.3), inset 0 1px 0 rgba(255,255,255,0.1)" : "none"}
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                                flexShrink={0}
                                fontSize="22px"
                              >
                                {SLOT_META[slot].icon}
                              </Box>

                              {/* Label */}
                              <Box flex={1}>
                                <Text
                                  fontSize="md"
                                  fontWeight={700}
                                  color={isSel ? "white" : "rgba(255,255,255,0.8)"}
                                  lineHeight={1.2}
                                >
                                  {SLOT_META[slot].label}
                                </Text>
                                <Text fontSize="xs" color={isSel ? "rgba(37,99,235,0.7)" : "rgba(255,255,255,0.35)"} mt="3px">
                                  {SLOT_META[slot].hours}
                                </Text>
                              </Box>

                              {/* Price + check */}
                              <Flex align="center" gap={2} flexShrink={0}>
                                <Text
                                  fontFamily="var(--font-mono)"
                                  fontSize="2xl"
                                  fontWeight={900}
                                  color={isSel ? "#2563EB" : "rgba(255,255,255,0.85)"}
                                  lineHeight={1}
                                  textShadow={isSel ? "0 0 20px rgba(37,99,235,0.6)" : "none"}
                                >
                                  {formatPrice(price)}
                                </Text>
                                <Box
                                  w="26px"
                                  h="26px"
                                  borderRadius="full"
                                  bg={isSel ? "#2563EB" : "rgba(255,255,255,0.06)"}
                                  border={`2px solid ${isSel ? "#2563EB" : "rgba(255,255,255,0.12)"}`}
                                  boxShadow={isSel ? "0 0 10px rgba(37,99,235,0.6)" : "none"}
                                  display="flex"
                                  alignItems="center"
                                  justifyContent="center"
                                  flexShrink={0}
                                  transition="all 0.2s ease"
                                >
                                  {isSel && (
                                    <Text fontSize="12px" color="white" fontWeight={900} lineHeight={1}>✓</Text>
                                  )}
                                </Box>
                              </Flex>
                            </Flex>

                            {/* Price bar */}
                            <Box mt={3} h="3px" borderRadius="full" bg="rgba(255,255,255,0.06)" overflow="hidden">
                              <Box
                                h="full"
                                borderRadius="full"
                                bg={isSel ? "linear-gradient(90deg, #2563EB, #2563EB)" : barColor}
                                w={`${Math.max(pctFill, 6)}%`}
                                transition="width 0.5s ease"
                                boxShadow={isSel ? "0 0 6px #2563EB" : `0 0 4px ${barColor}`}
                              />
                            </Box>
                          </MotionBox>
                        );
                      })}
                    </Flex>
                  </MotionBox>
                )}
              </AnimatePresence>

              {/* Price breakdown is still calculated for payment records, but hidden from customers. */}
              {SHOW_PRICE_BREAKDOWN && (
              <AnimatePresence>
                {breakdownVisible && selectedDay && selectedSlot && apiResult && (
                  <MotionBox
                    key="breakdown"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    p={5}
                    bg="linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(11,17,32,0.6) 100%)"
                    border="1px solid rgba(37,99,235,0.2)"
                    borderRadius="20px"
                    mb={4}
                    backdropFilter="blur(16px)"
                    boxShadow="0 0 0 1px rgba(37,99,235,0.1), 0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)"
                  >
                    <Flex align="center" gap={2} mb={4}>
                      <Box w="3px" h="16px" borderRadius="full" bg="#2563EB" boxShadow="0 0 8px #2563EB" />
                      <Text
                        fontSize="sm"
                        fontWeight={700}
                        color="rgba(255,255,255,0.7)"
                        letterSpacing="0.5px"
                        textTransform="uppercase"
                      >
                        Price breakdown
                      </Text>
                    </Flex>

                    <VStack gap={2} w="full">
                      {/* Static line items from the server */}
                      {apiResult.staticLineItems.map((line, i) => {
                        // Info rows (move-type label) rendered as a badge, no amount.
                        if (line.type === "info") {
                          return (
                            <MotionFlex
                              key={line.label}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.06, duration: 0.2 }}
                              w="full"
                              mb={1}
                            >
                              <Box
                                px={3}
                                py="5px"
                                borderRadius="full"
                                bg="rgba(99,102,241,0.18)"
                                border="1px solid rgba(99,102,241,0.4)"
                              >
                                <Text fontSize="xs" fontWeight={700} color="#2563EB" letterSpacing="0.3px">
                                  {line.label}
                                </Text>
                              </Box>
                            </MotionFlex>
                          );
                        }

                        const isDiscount = line.type === "discount";
                        return (
                          <MotionFlex
                            key={line.label}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.06, duration: 0.2 }}
                            justify="space-between"
                            w="full"
                          >
                            <Text fontSize="sm" color="rgba(255,255,255,0.6)">
                              {line.label}
                            </Text>
                            <Text
                              fontFamily="var(--font-mono)"
                              fontSize="sm"
                              fontWeight={600}
                              color={isDiscount ? colors.emerald : "white"}
                            >
                              {isDiscount
                                ? `−${formatPrice(Math.abs(line.amount))}`
                                : formatPrice(line.amount)}
                            </Text>
                          </MotionFlex>
                        );
                      })}

                      {/* Per-day adjustment lines (surcharges & discounts) */}
                      {selectedDay.dayAdjustments.map((adj, ri) => {
                        const delay = (apiResult.staticLineItems.length + ri) * 0.06;
                        const isDiscount = adj.type === "discount";
                        return (
                          <MotionFlex
                            key={adj.label}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay, duration: 0.2 }}
                            justify="space-between"
                            w="full"
                          >
                            <Text fontSize="sm" color="rgba(255,255,255,0.6)">
                              {adj.label}
                            </Text>
                            <Text
                              fontFamily="var(--font-mono)"
                              fontSize="sm"
                              fontWeight={600}
                              color={isDiscount ? colors.emerald : colors.amber}
                            >
                              {isDiscount
                                ? `−${formatPrice(Math.abs(adj.amount))}`
                                : `+${formatPrice(adj.amount)}`}
                            </Text>
                          </MotionFlex>
                        );
                      })}

                      {/* Slot premium / discount vs afternoon neutral baseline */}
                      {selectedSlot !== "afternoon" && (() => {
                        const afternoonPrice = selectedDay.prices.afternoon;
                        const slotPrice      = selectedDay.prices[selectedSlot];
                        const diff           = slotPrice - afternoonPrice;
                        if (diff === 0) return null;
                        const delay = (apiResult.staticLineItems.length + selectedDay.dayAdjustments.length) * 0.06;
                        const isDiscount = diff < 0;
                        return (
                          <MotionFlex
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay, duration: 0.2 }}
                            justify="space-between"
                            w="full"
                          >
                            <Text fontSize="sm" color="rgba(255,255,255,0.6)">
                              {SLOT_META[selectedSlot].label} slot premium
                            </Text>
                            <Text
                              fontFamily="var(--font-mono)"
                              fontSize="sm"
                              fontWeight={600}
                              color={isDiscount ? colors.emerald : colors.amber}
                            >
                              {isDiscount ? `−${formatPrice(Math.abs(diff))}` : `+${formatPrice(diff)}`}
                            </Text>
                          </MotionFlex>
                        );
                      })()}

                      <Box w="full" h="1px" bg="rgba(37,99,235,0.2)" my={2} />

                      {/* Total */}
                      <Box
                        w="full"
                        px={4}
                        py={3}
                        borderRadius="14px"
                        bg="linear-gradient(135deg, rgba(37,99,235,0.15), rgba(37,99,235,0.08))"
                        border="1px solid rgba(37,99,235,0.3)"
                        boxShadow="0 0 16px rgba(37,99,235,0.15), inset 0 1px 0 rgba(255,255,255,0.08)"
                      >
                        <Flex justify="space-between" w="full" align="center">
                          <Text
                            fontFamily="var(--font-heading)"
                            fontWeight={800}
                            fontSize="sm"
                            color="rgba(255,255,255,0.85)"
                            letterSpacing="0.3px"
                          >
                            Total due today
                          </Text>
                          <Text
                            fontFamily="var(--font-mono)"
                            fontSize="2xl"
                            fontWeight={900}
                            color="#2563EB"
                            textShadow="0 0 20px rgba(37,99,235,0.7), 0 0 40px rgba(37,99,235,0.3)"
                          >
                            {formatPrice(countedPrice)}
                          </Text>
                        </Flex>
                      </Box>
                    </VStack>
                  </MotionBox>
                )}
              </AnimatePresence>
              )}
            </MotionBox>
          )}
        </AnimatePresence>
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
              ← Back
            </Box>
            <Box
              as="button"
              onClick={handleContinue}
              flex={1}
              py={4}
              borderRadius="xl"
              bg={canContinue ? colors.amber : "rgba(255,255,255,0.1)"}
              color={canContinue ? colors.midnight : "rgba(255,255,255,0.3)"}
              fontFamily="var(--font-heading)"
              fontSize="sm"
              fontWeight={800}
              cursor={canContinue ? "pointer" : "not-allowed"}
              transition="all 0.2s ease"
              _hover={canContinue ? { bg: "#E08E0A" } : {}}
            >
              {canContinue && selectedPrice
                ? `Continue — Pay ${formatPrice(selectedPrice)} →`
                : "Continue to Payment →"}
            </Box>
          </HStack>
        </Box>
      </Box>
    </Box>
  );
}

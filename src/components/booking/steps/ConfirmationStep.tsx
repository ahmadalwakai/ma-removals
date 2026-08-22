"use client";

import { useEffect, useRef } from "react";
import { Box, Flex, Text, VStack, HStack } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { FiCheckCircle, FiNavigation, FiDownload, FiPhone } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";
import { colors } from "@/lib/tokens";
import { formatPrice } from "@/lib/money";
import { trackPurchase } from "@/lib/analytics";
import { SERVICE_LABELS, type BookingFormState } from "@/types/booking";
import styles from "./ConfirmationStep.module.css";

const MotionBox = motion.create(Box);

interface ConfirmationStepProps {
  state: BookingFormState;
  bookingRef: string;
}

export function ConfirmationStep({ state, bookingRef }: ConfirmationStepProps) {
  const clearRef = useRef(false);

  // Clear localStorage after confirmed
  useEffect(() => {
    if (clearRef.current) return;
    clearRef.current = true;
    try {
      localStorage.removeItem("ma-booking-v4");
      localStorage.removeItem("ma-booking-v3");
      localStorage.removeItem("ma-booking-v2");
      // Save email for booking detection popup
      if (state.customerEmail) {
        localStorage.setItem("ma-booking-email", state.customerEmail);
      }
    } catch {}
    // Fire analytics purchase event
    const total = state.priceBreakdown?.total ?? 0;
    if (total > 0) {
      trackPurchase(total, bookingRef);
    }
  }, []);

  const total = state.priceBreakdown?.total ?? 0;
  const serviceLabel =
    SERVICE_LABELS[state.service] ??
    state.service.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const schedDate = state.selectedDate
    ? new Date(state.selectedDate + "T12:00:00").toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const whatsappMsg = encodeURIComponent(
    `Hi MA Removals! I just booked — ref: ${bookingRef}. Looking forward to the move!`
  );

  return (
    <Box px={{ base: 4, md: 6 }} pt={8} pb={20}>
      {/* Animated check */}
      <Flex justify="center" mb={8}>
        <MotionBox
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          w="80px"
          h="80px"
          borderRadius="full"
          bg="rgba(16,185,129,0.15)"
          border={`3px solid ${colors.emerald}`}
        >
          <FiCheckCircle size={40} color={colors.emerald} />
        </MotionBox>
      </Flex>

      {/* Heading */}
      <VStack gap={2} mb={8} textAlign="center">
        <MotionBox
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Text
            fontFamily="heading"
            fontSize={{ base: "2xl", md: "3xl" }}
            fontWeight={900}
            color="white"
            lineHeight="tight"
          >
            Booking confirmed!
          </Text>
        </MotionBox>
        <MotionBox
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <Text fontSize="sm" color="rgba(255,255,255,0.55)" maxW="320px" mx="auto">
            Payment received · Confirmation email sent · We&apos;ll be in touch 24hrs before
          </Text>
        </MotionBox>
      </VStack>

      {/* Booking reference badge */}
      <MotionBox
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.55 }}
        mb={6}
        p={4}
        bg="rgba(16,185,129,0.08)"
        border={`2px solid ${colors.emerald}`}
        borderRadius="2xl"
        textAlign="center"
      >
        <Text fontSize="xs" fontWeight={600} color="rgba(255,255,255,0.5)" mb={1} letterSpacing="1px" textTransform="uppercase">
          Booking reference
        </Text>
        <Text
          fontFamily="mono"
          fontSize={{ base: "xl", md: "2xl" }}
          fontWeight={900}
          color={colors.emerald}
          letterSpacing="2px"
        >
          {bookingRef}
        </Text>
        <Text fontSize="xs" color="rgba(255,255,255,0.35)" mt={1}>
          Save this reference for your records
        </Text>
      </MotionBox>

      {/* Summary card */}
      <MotionBox
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
        mb={6}
        p={4}
        bg="rgba(255,255,255,0.04)"
        border="1px solid rgba(255,255,255,0.1)"
        borderRadius="xl"
      >
        <Text fontFamily="heading" fontSize="sm" fontWeight={700} color="rgba(255,255,255,0.6)" mb={3}>
          Booking summary
        </Text>
        <VStack gap={2.5} w="full">
          {[
            {
              label: "Service",
              value: serviceLabel + (state.serviceVariant ? ` · ${state.serviceVariant}` : ""),
            },
            ...(state.pickupAddress ? [{ label: "From", value: state.pickupAddress.fullAddress }] : []),
            ...(state.dropoffAddress ? [{ label: "To", value: state.dropoffAddress.fullAddress }] : []),
            ...(schedDate ? [{ label: "Date", value: `${schedDate}${state.selectedTimeSlot ? ` at ${state.selectedTimeSlot}` : ""}` }] : []),
            ...(state.customerName ? [{ label: "Name", value: state.customerName }] : []),
          ].map(({ label, value }) => (
            <HStack key={label} justify="space-between" w="full" align="start">
              <Text fontSize="sm" color="rgba(255,255,255,0.45)" flexShrink={0}>
                {label}
              </Text>
              <Text fontSize="sm" fontWeight={500} color="white" textAlign="right" maxW="65%">
                {value}
              </Text>
            </HStack>
          ))}
          <Box w="full" h="1px" bg="rgba(255,255,255,0.1)" />
          <HStack justify="space-between" w="full">
            <Text fontFamily="heading" fontSize="sm" fontWeight={700} color="white">Total paid</Text>
            <Text fontFamily="heading" fontSize="lg" fontWeight={800} color={colors.emerald}>
              {formatPrice(total)}
            </Text>
          </HStack>
        </VStack>
      </MotionBox>

      {/* Action buttons */}
      <MotionBox
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.75 }}
      >
        <VStack gap={3} w="full">
          {/* Track your move */}
          <Box
            asChild
            w="full"
            py={4}
            borderRadius="xl"
            bg={colors.emerald}
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontFamily="heading"
            fontSize="sm"
            fontWeight={800}
            color="white"
            cursor="pointer"
            transition="all 0.2s ease"
            _hover={{ opacity: 0.88, transform: "translateY(-1px)" }}
          >
            <a
              href={`/booking/track/${encodeURIComponent(bookingRef)}?email=${encodeURIComponent(state.customerEmail ?? "")}`}
              style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", justifyContent: "center", textDecoration: "none", color: "inherit" }}
            >
              <FiNavigation size={17} />
              Track Your Move
            </a>
          </Box>

          {/* Download invoice */}
          <a
            href={`/api/booking/${encodeURIComponent(bookingRef)}/invoice?email=${encodeURIComponent(state.customerEmail ?? "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.invoiceBtn}
          >
            <FiDownload size={17} />
            Download Invoice
          </a>

          {/* WhatsApp */}
          <Box
            asChild
            w="full"
            py={4}
            borderRadius="xl"
            bg="#25D366"
            display="flex"
            alignItems="center"
            justifyContent="center"
            gap={3}
            fontFamily="heading"
            fontSize="sm"
            fontWeight={800}
            color="white"
            cursor="pointer"
            transition="all 0.2s ease"
            _hover={{ bg: "#20bb5a", transform: "translateY(-1px)" }}
          >
            <a
              href={`https://wa.me/447355748549?text=${whatsappMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", justifyContent: "center", textDecoration: "none", color: "inherit" }}
            >
              <FaWhatsapp size={18} />
              Chat with us on WhatsApp
            </a>
          </Box>

          {/* Call us */}
          <a
            href="tel:07426467112"
            className={styles.callBtn}
          >
            <FiPhone size={15} />
            07426 467 112
          </a>

          {/* Back to home */}
          <Box
            asChild
            w="full"
            py={3}
            borderRadius="xl"
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontFamily="heading"
            fontSize="sm"
            fontWeight={600}
            color="rgba(255,255,255,0.35)"
            cursor="pointer"
            transition="all 0.2s ease"
            _hover={{ color: "rgba(255,255,255,0.6)" }}
          >
            <a href="/" style={{ textDecoration: "none", color: "inherit" }}>Back to home</a>
          </Box>
        </VStack>
      </MotionBox>
    </Box>
  );
}

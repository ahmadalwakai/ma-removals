"use client";

import { useState, useEffect } from "react";
import { Box, Flex, Text, VStack, HStack, Spinner } from "@chakra-ui/react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { colors } from "@/lib/tokens";
import { formatPrice } from "@/lib/pricing";
import { SERVICE_LABELS, type BookingFormState } from "@/types/booking";

// Load Stripe outside of component render
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
);

interface PaymentStepProps {
  state: BookingFormState;
  update: (updates: Partial<BookingFormState>) => void;
  onComplete: (bookingRef: string) => void;
  onBack: () => void;
}

interface PaymentFormProps {
  state: BookingFormState;
  update: (updates: Partial<BookingFormState>) => void;
  onComplete: (bookingRef: string) => void;
  onBack: () => void;
}

function PaymentForm({ state, update, onComplete, onBack }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const total = state.priceBreakdown?.total ?? 0;
  const serviceLabel =
    SERVICE_LABELS[state.service] ??
    state.service.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const canPay =
    !!state.customerName.trim() &&
    !!state.customerEmail.trim() &&
    !!state.customerPhone.trim() &&
    !!stripe &&
    !!elements;

  const handlePay = async () => {
    if (!stripe || !elements || !state.priceIntentSecret) return;
    setPaymentError("");
    setPaying(true);

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {},
        redirect: "if_required",
      });

      if (result.error) {
        setPaymentError(result.error.message ?? "Payment failed. Please try again.");
        setPaying(false);
        return;
      }

      const pi = result.paymentIntent;
      if (pi?.status === "succeeded") {
        // Confirm booking in our database
        const res = await fetch("/api/booking/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId: pi.id, state }),
        });
        const data = (await res.json()) as { bookingRef?: string; error?: string };
        if (data.bookingRef) {
          onComplete(data.bookingRef);
        } else {
          setPaymentError(data.error ?? "Booking confirmation failed. Please contact us.");
        }
      }
    } catch {
      setPaymentError("An unexpected error occurred. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <Box>
      <Box px={{ base: 4, md: 6 }} pt={6} pb="120px">
        <VStack align="start" gap={1} mb={6}>
          <Text fontFamily="heading" fontSize={{ base: "xl", md: "2xl" }} fontWeight={800} color="white">
            Your details & payment
          </Text>
          <Text fontSize="sm" color="rgba(255,255,255,0.5)">
            Secure checkout · Full upfront · No hidden fees
          </Text>
        </VStack>

        {/* Customer details */}
        <VStack gap={4} mb={6}>
          {[
            { field: "customerName" as const, label: "Full name", placeholder: "John Smith", type: "text" },
            { field: "customerEmail" as const, label: "Email", placeholder: "john@email.com", type: "email" },
            { field: "customerPhone" as const, label: "Phone", placeholder: "+44 7700 900000", type: "tel" },
          ].map(({ field, label, placeholder, type }) => (
            <Box key={field} w="full">
              <Text fontSize="sm" fontWeight={600} color="rgba(255,255,255,0.7)" mb={2}>
                {label}
              </Text>
              <Box
                asChild
                w="full"
                px={4}
                py={3}
                bg="rgba(255,255,255,0.06)"
                border="2px solid rgba(255,255,255,0.12)"
                borderRadius="xl"
                color="white"
                fontSize="sm"
                fontFamily="body"
                _placeholder={{ color: "rgba(255,255,255,0.3)" }}
                _focus={{
                  outline: "none",
                  borderColor: colors.amber,
                  bg: "rgba(255,255,255,0.08)",
                }}
              >
                <input
                  type={type}
                  value={state[field]}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => update({ [field]: e.target.value })}
                  placeholder={placeholder}
                  autoComplete={type === "email" ? "email" : type === "tel" ? "tel" : "name"}
                  style={{ WebkitAppearance: "none" }}
                />
              </Box>
            </Box>
          ))}
          <Box w="full">
            <Text fontSize="sm" fontWeight={600} color="rgba(255,255,255,0.7)" mb={2}>
              Special instructions <Text as="span" color="rgba(255,255,255,0.35)">(optional)</Text>
            </Text>
            <Box
              asChild
              w="full"
              px={4}
              py={3}
              bg="rgba(255,255,255,0.06)"
              border="2px solid rgba(255,255,255,0.12)"
              borderRadius="xl"
              color="white"
              fontSize="sm"
              fontFamily="body"
              _placeholder={{ color: "rgba(255,255,255,0.3)" }}
              _focus={{
                outline: "none",
                borderColor: colors.amber,
                bg: "rgba(255,255,255,0.08)",
              }}
            >
              <textarea
                value={state.specialInstructions}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => update({ specialInstructions: e.target.value })}
                placeholder="Parking info, access codes, fragile items..."
                rows={3}
                style={{ resize: "vertical", WebkitAppearance: "none", width: "100%" }}
              />
            </Box>
          </Box>
        </VStack>

        {/* Order summary */}
        <Box
          p={4}
          bg="rgba(255,255,255,0.04)"
          border="1px solid rgba(255,255,255,0.1)"
          borderRadius="xl"
          mb={6}
        >
          <Text fontFamily="heading" fontSize="sm" fontWeight={700} color="rgba(255,255,255,0.7)" mb={3}>
            Order summary
          </Text>
          <VStack gap={2} w="full">
            <HStack justify="space-between" w="full">
              <Text fontSize="sm" color="rgba(255,255,255,0.6)">Service</Text>
              <Text fontSize="sm" fontWeight={600} color="white">
                {serviceLabel}
                {state.serviceVariant ? ` · ${state.serviceVariant}` : ""}
              </Text>
            </HStack>
            {state.pickupAddress && (
              <HStack justify="space-between" w="full" align="start">
                <Text fontSize="sm" color="rgba(255,255,255,0.6)">From</Text>
                <Text fontSize="sm" fontWeight={600} color="white" textAlign="right" maxW="60%">
                  {state.pickupAddress.fullAddress}
                </Text>
              </HStack>
            )}
            {state.dropoffAddress && (
              <HStack justify="space-between" w="full" align="start">
                <Text fontSize="sm" color="rgba(255,255,255,0.6)">To</Text>
                <Text fontSize="sm" fontWeight={600} color="white" textAlign="right" maxW="60%">
                  {state.dropoffAddress.fullAddress}
                </Text>
              </HStack>
            )}
            {state.selectedDate && (
              <HStack justify="space-between" w="full">
                <Text fontSize="sm" color="rgba(255,255,255,0.6)">Date</Text>
                <Text fontSize="sm" fontWeight={600} color="white">
                  {new Date(state.selectedDate + "T12:00:00").toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {state.selectedTimeSlot ? ` at ${state.selectedTimeSlot}` : ""}
                </Text>
              </HStack>
            )}
            <Box w="full" h="1px" bg="rgba(255,255,255,0.1)" my={1} />
            <HStack justify="space-between" w="full">
              <Text fontFamily="heading" fontSize="base" fontWeight={700} color="white">Total</Text>
              <Text fontFamily="heading" fontSize="xl" fontWeight={800} color={colors.amber}>
                {formatPrice(total)}
              </Text>
            </HStack>
          </VStack>
        </Box>

        {/* Stripe PaymentElement */}
        <Box mb={6}>
          <Text fontSize="sm" fontWeight={600} color="rgba(255,255,255,0.7)" mb={3}>
            Card details
          </Text>
          <Box
            p={4}
            bg="rgba(255,255,255,0.04)"
            border="1px solid rgba(255,255,255,0.1)"
            borderRadius="xl"
          >
            <PaymentElement
              options={{
                layout: "tabs",
                fields: { billingDetails: { email: "auto" } },
              }}
            />
          </Box>
        </Box>

        {paymentError && (
          <Box px={4} py={3} bg="rgba(239,68,68,0.1)" border="1px solid rgba(239,68,68,0.3)" borderRadius="lg" mb={4}>
            <Text fontSize="sm" color="#EF4444">{paymentError}</Text>
          </Box>
        )}

        {/* SSL trust indicators */}
        <HStack justify="center" gap={3} mb={4}>
          <Text fontSize="xs" color="rgba(255,255,255,0.3)">🔒 SSL encrypted</Text>
          <Text fontSize="xs" color="rgba(255,255,255,0.3)">·</Text>
          <Text fontSize="xs" color="rgba(255,255,255,0.3)">Powered by Stripe</Text>
          <Text fontSize="xs" color="rgba(255,255,255,0.3)">·</Text>
          <Text fontSize="xs" color="rgba(255,255,255,0.3)">PCI compliant</Text>
        </HStack>
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
              cursor={paying ? "not-allowed" : "pointer"}
              opacity={paying ? 0.5 : 1}
              _hover={!paying ? { borderColor: "rgba(255,255,255,0.3)", color: "white" } : {}}
            >
              ← Back
            </Box>
            <Box
              as="button"
              onClick={() => { void handlePay(); }}
              flex={1}
              py={4}
              borderRadius="xl"
              bg={canPay && !paying ? colors.emerald : "rgba(255,255,255,0.1)"}
              color={canPay && !paying ? "white" : "rgba(255,255,255,0.3)"}
              fontFamily="heading"
              fontSize="sm"
              fontWeight={800}
              cursor={canPay && !paying ? "pointer" : "not-allowed"}
              transition="all 0.2s ease"
              display="flex"
              alignItems="center"
              justifyContent="center"
              gap={2}
              _hover={canPay && !paying ? { bg: "#0ca572", transform: "translateY(-1px)" } : {}}
            >
              {paying ? (
                <>
                  <Spinner size="sm" color="white" />
                  Processing...
                </>
              ) : (
                `Pay ${formatPrice(total)} securely`
              )}
            </Box>
          </HStack>
        </Box>
      </Box>
    </Box>
  );
}

export function PaymentStep({ state, update, onComplete, onBack }: PaymentStepProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(
    state.priceIntentSecret ?? null
  );
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [intentError, setIntentError] = useState("");

  const total = state.priceBreakdown?.total ?? 0;

  useEffect(() => {
    if (clientSecret) return;
    if (total < 5) {
      setIntentError("Invalid booking amount.");
      return;
    }

    setLoadingIntent(true);
    fetch("/api/booking/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: total,
        metadata: { service: state.service, variant: state.serviceVariant ?? "" },
        // Full context so the server can re-price and verify the amount
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
        selectedDate: state.selectedDate ?? undefined,
        selectedTimeSlot: state.selectedTimeSlot ?? undefined,
        clientTotal: total,
        items: state.selectedItems.map((s) => ({
          name: s.name,
          quantity: s.quantity,
          imagePath: s.imagePath,
        })),
      }),
    })
      .then((r) => r.json())
      .then((d: { clientSecret?: string; error?: string }) => {
        if (d.clientSecret) {
          setClientSecret(d.clientSecret);
          update({ priceIntentSecret: d.clientSecret });
        } else {
          setIntentError(d.error ?? "Payment setup failed.");
        }
      })
      .catch(() => setIntentError("Failed to connect to payment server."))
      .finally(() => setLoadingIntent(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loadingIntent) {
    return (
      <Box px={4} pt={16} display="flex" flexDirection="column" alignItems="center" gap={4}>
        <Spinner size="lg" color={colors.amber} />
        <Text color="rgba(255,255,255,0.5)">Setting up secure payment...</Text>
      </Box>
    );
  }

  if (intentError || !clientSecret) {
    return (
      <Box px={4} pt={8}>
        <Box p={4} bg="rgba(239,68,68,0.1)" border="1px solid rgba(239,68,68,0.3)" borderRadius="xl">
          <Text color="#EF4444">{intentError || "Payment unavailable. Please try again."}</Text>
        </Box>
        <Box
          as="button"
          onClick={onBack}
          mt={4}
          px={5}
          py={3}
          borderRadius="xl"
          border="2px solid rgba(255,255,255,0.15)"
          color="rgba(255,255,255,0.6)"
          fontSize="sm"
          cursor="pointer"
        >
          ← Go back
        </Box>
      </Box>
    );
  }

  return (
    <Elements
      key={clientSecret}
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "night",
          variables: {
            colorPrimary: colors.amber,
            colorBackground: "#1a2540",
            colorText: "#ffffff",
            colorDanger: "#EF4444",
            fontFamily: "Inter, system-ui, sans-serif",
            borderRadius: "12px",
          },
        },
      }}
    >
      <PaymentForm
        state={state}
        update={update}
        onComplete={onComplete}
        onBack={onBack}
      />
    </Elements>
  );
}

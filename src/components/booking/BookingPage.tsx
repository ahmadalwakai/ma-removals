"use client";

import { useState, useEffect, useCallback } from "react";
import { Box } from "@chakra-ui/react";
import { AnimatePresence, motion } from "framer-motion";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { MoveDetailsStep } from "@/components/booking/steps/MoveDetailsStep";
import { AddressItemStep } from "@/components/booking/steps/AddressItemStep";
import { DatePricingStep } from "@/components/booking/steps/DatePricingStep";
import { PaymentStep } from "@/components/booking/steps/PaymentStep";
import { ConfirmationStep } from "@/components/booking/steps/ConfirmationStep";
import { INITIAL_BOOKING_STATE } from "@/types/booking";
import { trackBookingStart } from "@/lib/analytics";
import type { BookingFormState } from "@/types/booking";

const STORAGE_KEY = "ma-booking-v4";

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? "100%" : "-100%",
    opacity: 0,
  }),
};

const MotionBox = motion.create(Box);

function loadState(): BookingFormState {
  if (typeof window === "undefined") return INITIAL_BOOKING_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      // Merge with INITIAL_BOOKING_STATE to handle schema additions (e.g. selectedItems)
      return { ...INITIAL_BOOKING_STATE, ...(JSON.parse(raw) as Partial<BookingFormState>) };
    }
  } catch {}
  return INITIAL_BOOKING_STATE;
}

function saveState(state: BookingFormState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function BookingPage() {
  const [state, setState] = useState<BookingFormState>(INITIAL_BOOKING_STATE);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [bookingRef, setBookingRef] = useState("");
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setState(loadState());
    setHydrated(true);
    trackBookingStart();
  }, []);

  const update = useCallback((updates: Partial<BookingFormState>) => {
    setState((prev) => {
      const next = { ...prev, ...updates };
      saveState(next);
      return next;
    });
  }, []);

  const goNext = () => {
    setDirection(1);
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => s - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleComplete = (ref: string) => {
    setBookingRef(ref);
    setDirection(1);
    setStep(4); // confirmation
  };

  if (!hydrated) {
    // Avoid hydration mismatch — render empty shell
    return (
      <Box minH="100vh" bg="#0B1120" />
    );
  }

  const isConfirmation = step === 4;

  return (
    <Box minH="100vh" bg="#0B1120">
      {/* Progress bar — hide on confirmation */}
      {!isConfirmation && <BookingProgress currentStep={step} />}

      {/* Step container */}
      <Box maxW="560px" mx="auto" position="relative" overflow="hidden">
        <AnimatePresence mode="popLayout" custom={direction}>
          {step === 0 && (
            <MotionBox
              key="step-0"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "tween", duration: 0.3, ease: "easeInOut" }}
            >
              <MoveDetailsStep state={state} update={update} onNext={goNext} />
            </MotionBox>
          )}
          {step === 1 && (
            <MotionBox
              key="step-1"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "tween", duration: 0.3, ease: "easeInOut" }}
            >
              <AddressItemStep state={state} update={update} onNext={goNext} onBack={goBack} hideAddresses />
            </MotionBox>
          )}
          {step === 2 && (
            <MotionBox
              key="step-2"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "tween", duration: 0.3, ease: "easeInOut" }}
            >
              <DatePricingStep state={state} update={update} onNext={goNext} onBack={goBack} />
            </MotionBox>
          )}
          {step === 3 && (
            <MotionBox
              key="step-3"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "tween", duration: 0.3, ease: "easeInOut" }}
            >
              <PaymentStep state={state} update={update} onComplete={handleComplete} onBack={goBack} />
            </MotionBox>
          )}
          {step === 4 && (
            <MotionBox
              key="step-4"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "tween", duration: 0.3, ease: "easeInOut" }}
            >
              <ConfirmationStep state={state} bookingRef={bookingRef} />
            </MotionBox>
          )}
        </AnimatePresence>
      </Box>
    </Box>
  );
}

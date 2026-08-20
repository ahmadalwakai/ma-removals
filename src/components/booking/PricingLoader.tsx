"use client";

import { useState, useEffect } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import { FiCheck, FiLoader } from "react-icons/fi";
import { colors } from "@/lib/tokens";

const MotionBox = motion.create(Box);
const MotionFlex = motion.create(Flex);

export interface LoaderStep {
  label: string;
  value: string;
}

interface PricingLoaderProps {
  steps: LoaderStep[];
  onComplete: () => void;
}

export function PricingLoader({ steps, onComplete }: PricingLoaderProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useEffect(() => {
    if (currentStep >= steps.length) {
      const t = setTimeout(onComplete, 400);
      return () => clearTimeout(t);
    }
    const delay = 350 + Math.random() * 250;
    const t = setTimeout(() => {
      setCompletedSteps((prev) => [...prev, currentStep]);
      setCurrentStep((prev) => prev + 1);
    }, delay);
    return () => clearTimeout(t);
  }, [currentStep, steps.length, onComplete]);

  return (
    <Flex direction="column" align="center" justify="center" minH="400px" gap={8}>
      {/* Spinning logo */}
      <MotionBox
        animate={{ rotate: 360 }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
      >
        <Box
          w={16}
          h={16}
          borderRadius="xl"
          bg={colors.midnight}
          border={`2px solid ${colors.emerald}`}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Text fontSize="lg" fontWeight={800} color={colors.emerald} fontFamily="var(--font-heading)">
            MA
          </Text>
        </Box>
      </MotionBox>

      <Text fontSize="xl" fontWeight={700} color="white" fontFamily="var(--font-heading)">
        Calculating your quote...
      </Text>

      <Box w="full" maxW="360px">
        <AnimatePresence mode="popLayout">
          {steps.map((step, i) => {
            const isDone = completedSteps.includes(i);
            const isCurrent = currentStep === i;
            if (i > currentStep) return null;
            return (
              <MotionFlex
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                align="center"
                gap={3}
                py={2}
                px={3}
                borderRadius="lg"
                bg={isDone ? "rgba(16,185,129,0.08)" : "transparent"}
                mb={1}
              >
                <Box flexShrink={0} w="18px" display="flex" alignItems="center" justifyContent="center">
                  {isDone ? (
                    <MotionBox
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      color={colors.emerald}
                    >
                      <FiCheck size={16} />
                    </MotionBox>
                  ) : (
                    <MotionBox
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      color={colors.amber}
                    >
                      <FiLoader size={16} />
                    </MotionBox>
                  )}
                </Box>

                <Text
                  fontSize="sm"
                  color={isDone ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.5)"}
                  fontWeight={isDone ? 500 : 400}
                  flex={1}
                >
                  {step.label}
                </Text>
                <Text
                  fontSize="sm"
                  fontWeight={600}
                  color={isDone ? colors.emerald : "rgba(255,255,255,0.3)"}
                  fontFamily="var(--font-mono)"
                  minW="60px"
                  textAlign="right"
                >
                  {isDone ? step.value : isCurrent ? "..." : ""}
                </Text>
              </MotionFlex>
            );
          })}
        </AnimatePresence>
      </Box>
    </Flex>
  );
}

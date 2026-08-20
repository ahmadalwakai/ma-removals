"use client";

import { Box, Flex, Text, HStack } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { colors } from "@/lib/tokens";

const STEP_LABELS = ["Move Details", "Items", "Date & Price", "Payment"];

interface BookingProgressProps {
  currentStep: number;
}

export function BookingProgress({ currentStep }: BookingProgressProps) {
  return (
    <Box
      px={{ base: 4, md: 6 }}
      py={4}
      bg={colors.midnight}
      borderBottom="1px solid rgba(255,255,255,0.08)"
      position="sticky"
      top={0}
      zIndex={10}
    >
      <Box maxW="560px" mx="auto">
        {/* Step dots + line */}
        <Box position="relative">
          {/* Connecting line */}
          <Box
            position="absolute"
            top="11px"
            left="11px"
            right="11px"
            h="2px"
            bg="rgba(255,255,255,0.1)"
            zIndex={0}
          />
          {/* Progress fill */}
          <Box
            position="absolute"
            top="11px"
            left="11px"
            h="2px"
            bg={colors.emerald}
            zIndex={1}
            transition="width 0.4s ease"
            style={{
              width: currentStep === 0
                ? "0%"
                : `${(currentStep / (STEP_LABELS.length - 1)) * 100}%`,
            }}
          />

          {/* Step dots */}
          <Flex justify="space-between" position="relative" zIndex={2}>
            {STEP_LABELS.map((label, i) => {
              const isComplete = i < currentStep;
              const isCurrent = i === currentStep;
              return (
                <Flex key={label} direction="column" align="center" gap={2}>
                  <Box position="relative">
                    {isCurrent && (
                      <motion.div
                        style={{
                          position: "absolute",
                          inset: -4,
                          borderRadius: "50%",
                          border: `2px solid ${colors.amber}`,
                          opacity: 0.5,
                        }}
                        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                    <Box
                      w="22px"
                      h="22px"
                      borderRadius="full"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      bg={
                        isComplete
                          ? colors.emerald
                          : isCurrent
                          ? colors.amber
                          : "rgba(255,255,255,0.12)"
                      }
                      border={`2px solid ${
                        isComplete
                          ? colors.emerald
                          : isCurrent
                          ? colors.amber
                          : "rgba(255,255,255,0.2)"
                      }`}
                      transition="all 0.3s ease"
                    >
                      {isComplete ? (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path
                            d="M1 4L3.5 6.5L9 1"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <Text
                          fontSize="9px"
                          fontWeight={700}
                          color={isCurrent ? colors.midnight : "rgba(255,255,255,0.5)"}
                          lineHeight={1}
                        >
                          {i + 1}
                        </Text>
                      )}
                    </Box>
                  </Box>
                  <Text
                    fontSize="10px"
                    fontWeight={isCurrent ? 700 : 500}
                    color={
                      isComplete
                        ? colors.emerald
                        : isCurrent
                        ? colors.amber
                        : "rgba(255,255,255,0.35)"
                    }
                    display={{ base: i === currentStep ? "block" : "none", md: "block" }}
                    transition="color 0.3s"
                    letterSpacing="0.3px"
                    textTransform="uppercase"
                  >
                    {label}
                  </Text>
                </Flex>
              );
            })}
          </Flex>
        </Box>
      </Box>
    </Box>
  );
}

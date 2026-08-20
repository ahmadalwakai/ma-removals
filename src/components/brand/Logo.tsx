import React from "react";
import Image from "next/image";
import { HStack, Text } from "@chakra-ui/react";
import { colors } from "@/lib/tokens";
import styles from "./Logo.module.css";

interface LogoProps {
  /**
   * - `full`  → badge + "MA Removals" wordmark (dark text, for light backgrounds)
   * - `mono`  → badge + "MA Removals" wordmark (white text, for dark backgrounds)
   * - `mark`  → badge only
   */
  variant?: "full" | "mark" | "mono";
  height?: number;
  className?: string;
}

/**
 * MA Removals Logo
 *
 * Circular badge emblem (square PNG) with a self-contained dark navy background
 * that matches the site's `midnight` (#0B1120) header and footer. The `full` and
 * `mono` variants pair the badge with a legible "MA Removals" wordmark.
 */
export function Logo({ variant = "full", height = 40, className }: LogoProps) {
  const showWordmark = variant !== "mark";
  const textColor = variant === "mono" ? "#FFFFFF" : colors.emerald;

  return (
    <HStack as="span" className={className} gap={`${Math.round(height * 0.28)}px`} align="center">
      <span className={styles.logoImageWrapper}>
        <Image
          src="/images/logo.png"
          alt="MA Removals"
          width={height}
          height={height}
          priority
          unoptimized
          style={{ height, width: height, objectFit: "contain" }}
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
          className={styles.neonArc}
          style={{ width: height, height: height }}
        >
          <circle
            cx="50"
            cy="50"
            r="47"
            fill="none"
            stroke="#2563EB"
            strokeWidth="4"
            strokeDasharray="36.9 258.4"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {showWordmark && (
        <Text
          as="span"
          fontFamily="'Plus Jakarta Sans', sans-serif"
          fontWeight={800}
          fontSize={`${Math.round(height * 0.42)}px`}
          letterSpacing="-0.5px"
          color={textColor}
          whiteSpace="nowrap"
          lineHeight={1}
        >
          MA Removals
        </Text>
      )}
    </HStack>
  );
}

export default Logo;

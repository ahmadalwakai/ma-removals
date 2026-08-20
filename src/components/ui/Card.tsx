"use client";

import { Box, type BoxProps } from "@chakra-ui/react";
import Link from "next/link";
import { colors, shadows } from "@/lib/tokens";

interface CardProps extends Omit<BoxProps, "href"> {
  hover?: boolean;
  href?: string;
}

export function Card({ hover = false, href, children, ...props }: CardProps) {
  const style = {
    bg: colors.surface,
    borderRadius: "xl",
    boxShadow: shadows.card,
    overflow: "hidden",
    transition: "box-shadow 0.2s ease, transform 0.2s ease",
    ...(hover
      ? {
          _hover: {
            boxShadow: shadows.cardHover,
            transform: "translateY(-2px)",
          },
        }
      : {}),
    ...props,
  };

  if (href) {
    return (
      <Box asChild {...style}>
        <Link href={href}>{children}</Link>
      </Box>
    );
  }

  return <Box {...style}>{children}</Box>;
}

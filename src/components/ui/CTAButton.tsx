"use client";

import { Button, type ButtonProps } from "@chakra-ui/react";
import Link from "next/link";
import { colors, shadows } from "@/lib/tokens";

interface CTAButtonProps extends Omit<ButtonProps, "href"> {
  ctaVariant?: "primary" | "secondary" | "ghost";
  href?: string;
  target?: string;
  rel?: string;
}

export function CTAButton({
  ctaVariant = "primary",
  href,
  target,
  rel,
  children,
  className,
  ...props
}: CTAButtonProps) {
  const variants = {
    primary: {
      bg: colors.amber,
      color: colors.midnight,
      _hover: {
        bg: "#E08E0A",
        boxShadow: shadows.amber,
        transform: "translateY(-1px)",
      },
      _active: { transform: "translateY(0)" },
      fontWeight: 700,
    },
    secondary: {
      bg: colors.emerald,
      color: "#fff",
      _hover: {
        bg: "#0EA571",
        boxShadow: shadows.emerald,
        transform: "translateY(-1px)",
      },
      _active: { transform: "translateY(0)" },
      fontWeight: 600,
    },
    ghost: {
      bg: "transparent",
      color: colors.emerald,
      border: `2px solid ${colors.emerald}`,
      _hover: {
        bg: colors.emerald,
        color: "#fff",
      },
      fontWeight: 600,
    },
  };

  const style = {
    transition: "all 0.2s ease",
    borderRadius: "lg",
    px: 6,
    py: 3,
    fontSize: "sm",
    letterSpacing: "0.5px",
    className: [
      className,
      ctaVariant === "primary" ? "ma-cta-attention ma-cta-scan ma-quote-cta" : "ma-lift-on-hover",
    ].filter(Boolean).join(" "),
    ...variants[ctaVariant],
    ...props,
  };

  if (href) {
    const isExternal =
      href.startsWith("http") ||
      href.startsWith("tel:") ||
      href.startsWith("mailto:") ||
      href.startsWith("https://wa.me");

    if (isExternal) {
      return (
        <Button asChild {...style}>
          <a href={href} target={target} rel={rel}>{children}</a>
        </Button>
      );
    }

    return (
      <Button asChild {...style}>
        <Link href={href}>{children}</Link>
      </Button>
    );
  }

  return <Button {...style}>{children}</Button>;
}

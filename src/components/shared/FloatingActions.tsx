"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Box, Flex, Text, VStack, HStack } from "@chakra-ui/react";
import { AnimatePresence, motion } from "framer-motion";
import { FaWhatsapp } from "react-icons/fa";
import { HiPhone, HiArrowUp, HiOutlineCalculator } from "react-icons/hi";
import { colors } from "@/lib/tokens";
import { SITE } from "@/lib/constants";
import { trackContact, trackLead } from "@/lib/analytics";

const MotionBox = motion.create(Box);

/**
 * Site-wide conversion helpers tuned for Google Ads (esp. mobile):
 *  - Floating WhatsApp + Call bubbles (bottom-right, all viewports)
 *  - Back-to-top button that appears after scrolling
 *  - Sticky mobile action bar (Call · WhatsApp · Get Quote) pinned to the
 *    bottom of the viewport so a CTA is always one tap away.
 */
export function FloatingActions() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Never render over the admin / driver / booking flow chrome.
  const hidden =
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/driver") ||
    pathname?.startsWith("/book");

  if (hidden) return null;

  const phoneHref = `tel:${SITE.phone}`;
  const waHref = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(
    "Hi MA Removals, I'd like a quote for my move."
  )}`;

  return (
    <>
      {/* ───────────────── Desktop / tablet floating bubbles ───────────────── */}
      <Box
        position="fixed"
        bottom={{ base: "84px", md: 6 }}
        right={{ base: 4, md: 6 }}
        zIndex={1400}
        display={{ base: "none", md: "block" }}
      >
        <VStack gap={3} align="end">
          <AnimatePresence>
            {scrolled && (
              <MotionBox
                key="top"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.2 }}
              >
                <Box
                  as="button"
                  onClick={() =>
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }
                  aria-label="Back to top"
                  w={11}
                  h={11}
                  borderRadius="full"
                  bg="rgba(11,17,32,0.85)"
                  color="white"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  boxShadow="0 6px 20px rgba(0,0,0,0.25)"
                  backdropFilter="blur(6px)"
                  _hover={{ bg: colors.midnight }}
                  transition="all 0.2s"
                >
                  <HiArrowUp size={18} />
                </Box>
              </MotionBox>
            )}
          </AnimatePresence>

          {/* Expandable label bubbles */}
          <AnimatePresence>
            {expanded && (
              <MotionBox
                key="labels"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
              >
                <VStack gap={3} align="end">
          <Box
            asChild
            onClick={() => trackContact("call")}
            className="ma-lift-on-hover"
            px={4}
                    py={2.5}
                    borderRadius="full"
                    bg={colors.midnight}
                    color="white"
                    boxShadow="0 6px 20px rgba(0,0,0,0.25)"
                    _hover={{ textDecoration: "none", bg: colors.ink }}
                  >
                    <a href={phoneHref}>
                      <HStack gap={2}>
                        <HiPhone size={16} color={colors.emerald} />
                        <Text fontSize="sm" fontWeight={600}>
                          {SITE.phoneDisplay}
                        </Text>
                      </HStack>
                    </a>
                  </Box>
                </VStack>
              </MotionBox>
            )}
          </AnimatePresence>

          {/* WhatsApp bubble */}
          <Box
            asChild
            onClick={() => trackContact("whatsapp")}
            aria-label="Chat on WhatsApp"
            position="relative"
          >
            <a href={waHref} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp" title="Chat on WhatsApp">
              <MotionBox
                className="ma-call-ring"
                w={14}
                h={14}
                borderRadius="full"
                bg="#25D366"
                display="flex"
                alignItems="center"
                justifyContent="center"
                boxShadow="0 8px 24px rgba(37,211,102,0.45)"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                onMouseEnter={() => setExpanded(true)}
                onMouseLeave={() => setExpanded(false)}
              >
                <FaWhatsapp size={28} color="white" />
                <Box
                  position="absolute"
                  inset={0}
                  borderRadius="full"
                  border="2px solid #25D366"
                  css={{
                    animation: "maPing 2s cubic-bezier(0,0,0.2,1) infinite",
                  }}
                  pointerEvents="none"
                />
              </MotionBox>
            </a>
          </Box>
        </VStack>
      </Box>

      {/* ───────────────── Mobile sticky bottom action bar ───────────────── */}
      <Box
        position="fixed"
        bottom={0}
        left={0}
        right={0}
        zIndex={1400}
        display={{ base: "block", md: "none" }}
        bg="rgba(11,17,32,0.96)"
        backdropFilter="blur(12px)"
        borderTop="1px solid rgba(255,255,255,0.08)"
        boxShadow="0 -4px 24px rgba(0,0,0,0.3)"
        pb="env(safe-area-inset-bottom)"
      >
        <Flex align="stretch" gap={0} h="64px">
          <Box
            asChild
            onClick={() => trackContact("call")}
            className="ma-lift-on-hover"
            flex={1}
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            gap={0.5}
            color="white"
            borderRight="1px solid rgba(255,255,255,0.08)"
            _active={{ bg: "rgba(255,255,255,0.06)" }}
          >
            <a href={phoneHref} aria-label="Call MA Removals">
              <VStack gap={0.5}>
                <HiPhone size={20} color={colors.emerald} />
                <Text fontSize="11px" fontWeight={600}>
                  Call
                </Text>
              </VStack>
            </a>
          </Box>

          <Box
            asChild
            onClick={() => trackContact("whatsapp")}
            flex={1}
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            gap={0.5}
            color="white"
            borderRight="1px solid rgba(255,255,255,0.08)"
            _active={{ bg: "rgba(255,255,255,0.06)" }}
          >
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp MA Removals"
            >
              <VStack gap={0.5}>
                <FaWhatsapp size={20} color="#25D366" />
                <Text fontSize="11px" fontWeight={600}>
                  WhatsApp
                </Text>
              </VStack>
            </a>
          </Box>

          <Box
            asChild
            onClick={() => trackLead("mobile_sticky_bar")}
            className="ma-cta-attention ma-cta-scan ma-quote-cta"
            flex={1.4}
            display="flex"
            alignItems="center"
            justifyContent="center"
            gap={2}
            bg={colors.amber}
            color={colors.midnight}
            fontWeight={700}
            _active={{ bg: "#E08E0A" }}
          >
            <Link href="/book" aria-label="Get a free quote">
              <HStack gap={1.5}>
                <HiOutlineCalculator size={18} />
                <Text fontSize="sm" fontWeight={700}>
                  Get Quote
                </Text>
              </HStack>
            </Link>
          </Box>
        </Flex>
      </Box>

      {/* Spacer so the fixed mobile bar never overlaps page content/footer */}
      <Box display={{ base: "block", md: "none" }} h="64px" aria-hidden />
    </>
  );
}

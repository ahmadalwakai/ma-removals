"use client";

import {
  Box,
  Container,
  SimpleGrid,
  VStack,
  HStack,
  Text,
  Link as ChakraLink,
  Separator,
  chakra,
} from "@chakra-ui/react";
import Link from "next/link";
import { FaInstagram, FaTiktok, FaFacebookF, FaWhatsapp } from "react-icons/fa";
import { HiPhone, HiMail, HiLocationMarker, HiClock } from "react-icons/hi";
import { Logo } from "@/components/brand/Logo";
import { colors } from "@/lib/tokens";
import { SITE, SERVICES, ALL_AREAS } from "@/lib/constants";

const footerServices = SERVICES.slice(0, 6);
const footerAreas = ALL_AREAS.filter((a) => a.region === "glasgow").slice(0, 8);

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <chakra.footer bg={colors.midnight} color="rgba(255,255,255,0.7)">
      {/* Main footer grid */}
      <Container maxW="7xl" px={{ base: 4, md: 6 }} py={{ base: 12, md: 16 }}>
        <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} gap={8}>
          {/* Column 1 – Brand */}
          <VStack align="start" gap={4}>
            <Logo variant="mono" height={48} />
            <Text fontSize="sm" lineHeight="tall" color="rgba(255,255,255,0.55)" maxW="220px">
              {SITE.tagline} Professional moving services in Glasgow, Edinburgh and Dundee whatever you&apos;re moving, we&apos;ll get it there safely.
            </Text>
            {/* Social links */}
            <HStack gap={3} mt={1}>
              {[
                { href: SITE.social.instagram, Icon: FaInstagram, label: "Instagram" },
                { href: SITE.social.tiktok, Icon: FaTiktok, label: "TikTok" },
                { href: SITE.social.facebook, Icon: FaFacebookF, label: "Facebook" },
              ].map(({ href, Icon, label }) => (
                <ChakraLink
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  w={9}
                  h={9}
                  borderRadius="lg"
                  bg="rgba(255,255,255,0.07)"
                  border="1px solid rgba(255,255,255,0.1)"
                  color="rgba(255,255,255,0.6)"
                  _hover={{ color: colors.emerald, bg: "rgba(16,185,129,0.1)", borderColor: colors.emerald, textDecoration: "none" }}
                  transition="all 0.2s"
                >
                  <Icon size={15} />
                </ChakraLink>
              ))}
            </HStack>
          </VStack>

          {/* Column 2 – Services */}
          <VStack align="start" gap={3}>
            <Text fontFamily="heading" fontWeight={700} color="white" fontSize="sm" letterSpacing="0.5px" textTransform="uppercase">
              Services
            </Text>
            {footerServices.map((s) => (
              <ChakraLink
                key={s.slug}
                as={Link}
                href={`/services/${s.slug}`}
                fontSize="sm"
                color="rgba(255,255,255,0.55)"
                _hover={{ color: colors.emerald, textDecoration: "none" }}
                transition="color 0.15s"
              >
                {s.name}
              </ChakraLink>
            ))}
            <ChakraLink
              as={Link}
              href="/services"
              fontSize="sm"
              color={colors.emerald}
              fontWeight={500}
              _hover={{ textDecoration: "underline" }}
            >
              All services →
            </ChakraLink>
          </VStack>

          {/* Column 3 – Areas */}
          <VStack align="start" gap={3}>
            <Text fontFamily="heading" fontWeight={700} color="white" fontSize="sm" letterSpacing="0.5px" textTransform="uppercase">
              Glasgow Area
            </Text>
            {footerAreas.map((a) => (
              <ChakraLink
                key={a.slug}
                as={Link}
                href={`/areas/${a.slug}`}
                fontSize="sm"
                color="rgba(255,255,255,0.55)"
                _hover={{ color: colors.emerald, textDecoration: "none" }}
                transition="color 0.15s"
              >
                Removals in {a.name}
              </ChakraLink>
            ))}
          </VStack>

          {/* Column 4 – Contact */}
          <VStack align="start" gap={4}>
            <Text fontFamily="heading" fontWeight={700} color="white" fontSize="sm" letterSpacing="0.5px" textTransform="uppercase">
              Contact
            </Text>
            <VStack align="start" gap={3}>
              {[
                {
                  icon: HiPhone,
                  href: `tel:${SITE.phone}`,
                  label: SITE.phoneDisplay,
                },
                {
                  icon: HiMail,
                  href: `mailto:${SITE.email}`,
                  label: SITE.email,
                },
                {
                  icon: HiLocationMarker,
                  href: "#",
                  label: SITE.address,
                },
                {
                  icon: HiClock,
                  href: "#",
                  label: SITE.hours,
                },
              ].map(({ icon: Icon, href, label }) => (
                <ChakraLink
                  key={label}
                  href={href}
                  display="flex"
                  alignItems="center"
                  gap={2}
                  fontSize="sm"
                  color="rgba(255,255,255,0.55)"
                  _hover={{ color: colors.emerald, textDecoration: "none" }}
                  transition="color 0.15s"
                >
                  <Icon size={14} style={{ flexShrink: 0 }} />
                  {label}
                </ChakraLink>
              ))}
            </VStack>

            {/* WhatsApp CTA */}
            <ChakraLink
              href={`https://wa.me/${SITE.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              display="flex"
              alignItems="center"
              gap={2}
              mt={2}
              px={4}
              py={2}
              borderRadius="lg"
              bg="rgba(37,211,102,0.1)"
              border="1px solid rgba(37,211,102,0.25)"
              color="#25D366"
              fontSize="sm"
              fontWeight={500}
              _hover={{ bg: "rgba(37,211,102,0.18)", textDecoration: "none" }}
              transition="all 0.2s"
            >
              <FaWhatsapp size={15} />
              Chat on WhatsApp
            </ChakraLink>
          </VStack>
        </SimpleGrid>
      </Container>

      {/* Bottom bar */}
      <Box borderTop="1px solid rgba(255,255,255,0.06)">
        <Container maxW="7xl" px={{ base: 4, md: 6 }} py={5}>
          <HStack justify="space-between" flexWrap="wrap" gap={3}>
            <Text fontSize="xs" color="rgba(255,255,255,0.35)">
              © {year} MA Removals. All rights reserved. {SITE.insurance}.
            </Text>
            <HStack gap={4} flexWrap="wrap">
              {[
                { label: "Privacy Policy", href: "/privacy" },
                { label: "Terms", href: "/terms" },
                { label: "Cookies", href: "/cookies" },
                { label: "Cancellation", href: "/cancellation" },
              ].map(({ label, href }) => (
                <ChakraLink
                  key={href}
                  as={Link}
                  href={href}
                  fontSize="xs"
                  color="rgba(255,255,255,0.35)"
                  _hover={{ color: "rgba(255,255,255,0.6)", textDecoration: "none" }}
                  transition="color 0.15s"
                >
                  {label}
                </ChakraLink>
              ))}
            </HStack>
          </HStack>
        </Container>
      </Box>
    </chakra.footer>
  );
}

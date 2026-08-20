"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Container,
  Flex,
  HStack,
  Text,
  VStack,
  Link as ChakraLink,
  IconButton,
  Drawer,
  Portal,
  CloseButton,
  useDisclosure,
  chakra,
} from "@chakra-ui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HiArrowRight, HiChevronDown, HiMenu, HiPhone } from "react-icons/hi";
import { FaWhatsapp } from "react-icons/fa";
import { motion } from "framer-motion";
import { Logo } from "@/components/brand/Logo";
import { colors } from "@/lib/tokens";
import { SITE } from "@/lib/constants";

const MotionFlex = motion.create(Flex);

const NAV_LINKS = [
  { label: "Services", href: "/services" },
  { label: "Areas We Cover", href: "/areas" },
  { label: "About Us", href: "/about" },
  { label: "Reviews", href: "/reviews" },
  { label: "Contact Us", href: "/contact" },
];

export function Navbar() {
  const pathname = usePathname();
  const { open, onOpen, onClose } = useDisclosure();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <chakra.header
        position="sticky"
        top={0}
        zIndex={100}
        bg="#050B18"
        borderBottom="1px solid rgba(255,255,255,0.08)"
        transition="box-shadow 0.3s ease"
        boxShadow={scrolled ? "0 2px 20px rgba(11,17,32,0.28)" : "none"}
      >
        <Container maxW="1500px" px={{ base: 4, md: 5, xl: 8 }}>
          <MotionFlex
            align="center"
            justify="space-between"
            gap={{ base: 3, lg: 4, xl: 6 }}
            animate={{ height: scrolled ? 68 : 82 }}
            initial={{ height: 82 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            overflow="hidden"
          >
            {/* Logo */}
            <Link href="/" aria-label="MA Removals home">
              <HStack gap={2.5} align="center">
                <Logo variant="mark" height={54} />
                <Box>
                  <Text
                    fontFamily="'Plus Jakarta Sans', sans-serif"
                    fontSize={{ md: "xl", lg: "22px", xl: "24px" }}
                    fontWeight={900}
                    color="#FFFFFF"
                    lineHeight="1"
                    whiteSpace="nowrap"
                  >
                    MA Removals
                  </Text>
                  <Text mt={1} fontSize="xs" fontWeight={800} color="#2384FF" lineHeight="1" whiteSpace="nowrap">
                    Moving Made Easy
                  </Text>
                </Box>
              </HStack>
            </Link>

            {/* Desktop nav */}
            <HStack gap={{ lg: 5, xl: 8 }} display={{ base: "none", lg: "flex" }} minW={0}>
              {NAV_LINKS.map((link) => (
                <ChakraLink
                  key={link.href}
                  as={Link}
                  href={link.href}
                  display="inline-flex"
                  alignItems="center"
                  gap={1}
                  px={1}
                  py={2}
                  fontSize={{ lg: "sm", xl: "md" }}
                  fontWeight={700}
                  whiteSpace="nowrap"
                  color={
                    pathname?.startsWith(link.href)
                      ? "#FFFFFF"
                      : "rgba(255,255,255,0.92)"
                  }
                  _hover={{ color: "#FFFFFF", textDecoration: "none" }}
                  transition="all 0.15s"
                >
                  {link.label}
                  {link.label === "Services" && <HiChevronDown size={14} />}
                </ChakraLink>
              ))}
            </HStack>

            {/* Desktop CTA */}
            <HStack gap={{ lg: 3, xl: 4 }} display={{ base: "none", lg: "flex" }} flexShrink={0}>
              <ChakraLink
                href={`tel:${SITE.phone}`}
                className="ma-lift-on-hover"
                display="flex"
                alignItems="center"
                gap={2.5}
                color="#FFFFFF"
                _hover={{ color: "#FFFFFF", textDecoration: "none" }}
                transition="color 0.15s"
              >
                <Box
                  className="ma-call-ring"
                  w={{ lg: "40px", xl: "46px" }}
                  h={{ lg: "40px", xl: "46px" }}
                  borderRadius="full"
                  border="1px solid rgba(37,99,235,0.80)"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  color="#FFFFFF"
                  bg="rgba(37,99,235,0.10)"
                >
                  <HiPhone size={22} />
                </Box>
                <Box minW={0}>
                  <Text fontSize={{ lg: "xl", xl: "2xl" }} fontWeight={900} lineHeight="1" whiteSpace="nowrap">
                    {SITE.phoneDisplay}
                  </Text>
                  <Text mt={1} fontSize="xs" fontWeight={700} color="rgba(255,255,255,0.78)" lineHeight="1" whiteSpace="nowrap">
                    Mon - Sun: 7am - 9pm
                  </Text>
                </Box>
              </ChakraLink>
              <ChakraLink
                as={Link}
                href="/book"
                className="ma-cta-attention ma-cta-scan ma-quote-cta"
                h={{ lg: "48px", xl: "52px" }}
                px={{ lg: 5, xl: 6 }}
                borderRadius="md"
                bg="#FFB900"
                color="#020817"
                display="inline-flex"
                alignItems="center"
                gap={2}
                fontSize={{ lg: "md", xl: "lg" }}
                fontWeight={900}
                whiteSpace="nowrap"
                boxShadow="0 10px 24px rgba(255,185,0,0.24)"
                _hover={{ textDecoration: "none", bg: "#FFC21A", transform: "translateY(-1px)" }}
                transition="all 0.18s ease"
              >
                Book Now
                <HiArrowRight size={18} />
              </ChakraLink>
            </HStack>

            {/* Mobile menu button */}
            <IconButton
              display={{ base: "flex", lg: "none" }}
              aria-label="Open menu"
              variant="ghost"
              color="white"
              _hover={{ bg: "rgba(255,255,255,0.08)" }}
              onClick={onOpen}
            >
              <HiMenu size={22} />
            </IconButton>
          </MotionFlex>
        </Container>
      </chakra.header>

      {/* Mobile Drawer */}
      <Drawer.Root open={open} onOpenChange={(e) => !e.open && onClose()} placement="end">
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content bg={colors.midnight} maxW="280px">
              <Drawer.Header
                borderBottom="1px solid rgba(255,255,255,0.08)"
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                px={5}
                py={4}
              >
                <Logo variant="mark" height={44} />
                <CloseButton color="white" onClick={onClose} />
              </Drawer.Header>
              <Drawer.Body px={4} py={6}>
                <VStack align="stretch" gap={1}>
                  {NAV_LINKS.map((link) => (
                    <ChakraLink
                      key={link.href}
                      as={Link}
                      href={link.href}
                      onClick={onClose}
                      px={4}
                      py={3}
                      borderRadius="lg"
                      fontSize="base"
                      fontWeight={500}
                      color={
                        pathname?.startsWith(link.href)
                          ? colors.emerald
                          : "rgba(255,255,255,0.8)"
                      }
                      _hover={{ color: "#fff", textDecoration: "none", bg: "rgba(255,255,255,0.06)" }}
                    >
                      {link.label}
                    </ChakraLink>
                  ))}
                </VStack>

                <Box mt={8} borderTop="1px solid rgba(255,255,255,0.08)" pt={6}>
                  <VStack gap={3} align="stretch">
                    <ChakraLink
                      as={Link}
                      href="/book"
                      onClick={onClose}
                      className="ma-cta-attention ma-cta-scan ma-quote-cta"
                      w="full"
                      h="50px"
                      borderRadius="md"
                      bg="#FFB900"
                      color="#020817"
                      display="inline-flex"
                      alignItems="center"
                      justifyContent="center"
                      gap={2}
                      fontWeight={900}
                    >
                      Book Now
                      <HiArrowRight size={18} />
                    </ChakraLink>
                    <ChakraLink
                      href={`tel:${SITE.phone}`}
                      className="ma-lift-on-hover"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      gap={2}
                      p={3}
                      borderRadius="lg"
                      border="1px solid rgba(255,255,255,0.15)"
                      color="rgba(255,255,255,0.8)"
                      fontSize="sm"
                      _hover={{ color: "#fff", textDecoration: "none" }}
                    >
                      <HiPhone size={15} />
                      {SITE.phoneDisplay}
                    </ChakraLink>
                    <ChakraLink
                      href={`https://wa.me/${SITE.whatsapp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      gap={2}
                      p={3}
                      borderRadius="lg"
                      bg="rgba(37,211,102,0.1)"
                      border="1px solid rgba(37,211,102,0.3)"
                      color="#25D366"
                      fontSize="sm"
                      _hover={{ bg: "rgba(37,211,102,0.18)", textDecoration: "none" }}
                    >
                      <FaWhatsapp size={16} />
                      WhatsApp Us
                    </ChakraLink>
                  </VStack>
                </Box>
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>
    </>
  );
}

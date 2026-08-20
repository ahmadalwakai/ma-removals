import type { Metadata } from "next";
import { Box, Container, Heading, Text, VStack, SimpleGrid, Badge, HStack } from "@chakra-ui/react";
import { HiPhone, HiMail, HiLocationMarker, HiClock, HiArrowRight } from "react-icons/hi";
import { FaWhatsapp } from "react-icons/fa";
import { SITE } from "@/lib/constants";
import { colors } from "@/lib/tokens";
import { Card } from "@/components/ui/Card";
import { CTAButton } from "@/components/ui/CTAButton";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with MA Removals. Call, WhatsApp or email us for a free, fixed-price quote on removals across Glasgow, Edinburgh and Dundee. Open 7 days a week.",
  alternates: { canonical: `${SITE.url}/contact` },
};

export default function ContactPage() {
  return (
    <>
      {/* Hero */}
      <Box bg={colors.midnight} pt={{ base: 14, md: 20 }} pb={{ base: 16, md: 22 }}>
        <Container maxW="3xl" px={{ base: 4, md: 6 }}>
          <VStack gap={5} align={{ base: "start", md: "center" }} textAlign={{ base: "left", md: "center" }}>
            <Badge
              bg="rgba(16,185,129,0.1)"
              color={colors.emerald}
              borderRadius="full"
              px={4}
              py={1.5}
              fontSize="xs"
              fontWeight={600}
              letterSpacing="0.5px"
              textTransform="uppercase"
            >
              Get in touch
            </Badge>
            <Heading as="h1" fontSize={{ base: "3xl", md: "4xl", lg: "5xl" }} fontWeight={800} color="white">
              We&apos;re here to help with your move.
            </Heading>
            <Text fontSize={{ base: "lg", md: "xl" }} color="rgba(255,255,255,0.65)" maxW="520px">
              Call, WhatsApp or email us for a free, fixed-price quote. We answer fast and we&apos;re open 7 days a week.
            </Text>
          </VStack>
        </Container>
      </Box>

      {/* Contact methods */}
      <Box as="section" py={{ base: 14, md: 18 }} bg={colors.slate}>
        <Container maxW="5xl" px={{ base: 4, md: 6 }}>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
            {/* Phone */}
            <Card p={7} asChild hover _hover={{ textDecoration: "none" }}>
              <a href={`tel:${SITE.phone}`}>
                <HStack justify="space-between" align="start">
                  <VStack align="start" gap={3}>
                    <Box
                      w={12}
                      h={12}
                      borderRadius="xl"
                      bg={colors.emerald}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <HiPhone size={22} color="white" />
                    </Box>
                    <VStack align="start" gap={1}>
                      <Text fontSize="sm" color={colors.muted}>
                        Call us now
                      </Text>
                      <Text fontFamily="mono" fontWeight={700} fontSize="xl" color={colors.midnight}>
                        {SITE.phoneDisplay}
                      </Text>
                    </VStack>
                  </VStack>
                  <HiArrowRight size={18} color={colors.emerald} />
                </HStack>
              </a>
            </Card>

            {/* WhatsApp */}
            <Card p={7} asChild hover _hover={{ textDecoration: "none" }}>
              <a href={`https://wa.me/${SITE.whatsapp}`} target="_blank" rel="noopener noreferrer">
                <HStack justify="space-between" align="start">
                  <VStack align="start" gap={3}>
                    <Box
                      w={12}
                      h={12}
                      borderRadius="xl"
                      bg="#25D366"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <FaWhatsapp size={22} color="white" />
                    </Box>
                    <VStack align="start" gap={1}>
                      <Text fontSize="sm" color={colors.muted}>
                        WhatsApp us
                      </Text>
                      <Text fontWeight={700} fontSize="xl" color={colors.midnight}>
                        Message now
                      </Text>
                    </VStack>
                  </VStack>
                  <HiArrowRight size={18} color="#25D366" />
                </HStack>
              </a>
            </Card>

            {/* Email */}
            <Card p={7} asChild hover _hover={{ textDecoration: "none" }}>
              <a href={`mailto:${SITE.email}`}>
                <HStack justify="space-between" align="start">
                  <VStack align="start" gap={3}>
                    <Box
                      w={12}
                      h={12}
                      borderRadius="xl"
                      bg={colors.midnight}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <HiMail size={22} color="white" />
                    </Box>
                    <VStack align="start" gap={1}>
                      <Text fontSize="sm" color={colors.muted}>
                        Email us
                      </Text>
                      <Text fontWeight={700} fontSize="xl" color={colors.midnight}>
                        {SITE.email}
                      </Text>
                    </VStack>
                  </VStack>
                  <HiArrowRight size={18} color={colors.midnight} />
                </HStack>
              </a>
            </Card>

            {/* Hours / location */}
            <Card p={7}>
              <VStack align="start" gap={4}>
                <HStack gap={3} align="start">
                  <Box
                    w={10}
                    h={10}
                    borderRadius="lg"
                    bg={colors.slate}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    flexShrink={0}
                  >
                    <HiClock size={18} color={colors.emerald} />
                  </Box>
                  <VStack align="start" gap={0}>
                    <Text fontWeight={700} fontSize="sm" color={colors.midnight}>
                      Opening hours
                    </Text>
                    <Text fontSize="sm" color={colors.muted}>
                      {SITE.hours}
                    </Text>
                  </VStack>
                </HStack>
                <HStack gap={3} align="start">
                  <Box
                    w={10}
                    h={10}
                    borderRadius="lg"
                    bg={colors.slate}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    flexShrink={0}
                  >
                    <HiLocationMarker size={18} color={colors.emerald} />
                  </Box>
                  <VStack align="start" gap={0}>
                    <Text fontWeight={700} fontSize="sm" color={colors.midnight}>
                      Based in
                    </Text>
                    <Text fontSize="sm" color={colors.muted}>
                      {SITE.address}
                    </Text>
                  </VStack>
                </HStack>
              </VStack>
            </Card>
          </SimpleGrid>
        </Container>
      </Box>

      {/* CTA */}
      <Box as="section" py={{ base: 14, md: 18 }} bg={colors.surface}>
        <Container maxW="3xl" px={{ base: 4, md: 6 }}>
          <VStack gap={6} textAlign="center">
            <Heading as="h2" fontSize={{ base: "2xl", md: "4xl" }} fontWeight={800} color={colors.midnight}>
              Prefer to book online?
            </Heading>
            <Text fontSize={{ base: "md", md: "lg" }} color={colors.muted} maxW="460px">
              Get an instant, fixed-price quote and confirm your move in under two minutes.
            </Text>
            <CTAButton href="/book" ctaVariant="primary" size="lg" px={8} fontSize="md">
              Get a Free Quote
            </CTAButton>
          </VStack>
        </Container>
      </Box>
    </>
  );
}
